// ============================================================================
//  Space Cadet Pinball leaderboard  —  Firebase (Auth + Firestore)
//  Three boards: Today / This week / All-time + a rank badge system.
//  Scores are pushed in from the game (WASM) via window.pinballSubmitScore(score).
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
	getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
	getFirestore, collection, addDoc, query, where, orderBy, limit,
	getDocs, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// --- Rank system --------------------------------------------------------------
// Ordered HIGH to LOW. The `min` thresholds must match the legend in the HTML.
// To tune how hard the badges are to earn, just edit the `min` numbers here.
const TIERS = [
	{ name: "Legend",   min: 50000000, color: "#ff4d6d", icon: "👑" },
	{ name: "Master",   min: 25000000, color: "#b06cff", icon: "⚔️" },
	{ name: "Diamond",  min: 12000000, color: "#5ad1ff", icon: "💎" },
	{ name: "Platinum", min:  5000000, color: "#3fe0c5", icon: "🛡️" },
	{ name: "Gold",     min:  2000000, color: "#ffce3a", icon: "🥇" },
	{ name: "Silver",   min:   750000, color: "#cdd6e0", icon: "🥈" },
	{ name: "Bronze",   min:   250000, color: "#e08b4c", icon: "🥉" },
	{ name: "Iron",     min:        0, color: "#8b97a3", icon: "🔩" },
];

function tierFor(score) {
	return TIERS.find((t) => score >= t.min) || TIERS[TIERS.length - 1];
}

function badgeHtml(score, withName = false) {
	const t = tierFor(score);
	return `<span class="lb-badge" style="--c:${t.color}" title="${t.name}">` +
		`${t.icon}${withName ? " " + t.name : ""}</span>`;
}

// --- Safety limits ------------------------------------------------------------
const MAX_SCORE = 1000000000;     // 1 billion (matches firestore.rules)
const PAGE = 20;                  // rows revealed per scroll batch
const POOL = 500;                 // max players ranked per board

// --- State --------------------------------------------------------------------
let app, auth, db, provider;
let currentUser = null;
let pendingScore = null;          // score waiting to be sent after sign-in
let activeTab = "all";
let configured = false;
let allRows = [];                 // full ranked list for the active tab
let shown = 0;                    // how many rows currently rendered

const $ = (id) => document.getElementById(id);

function setStatus(msg) {
	const el = $("lb-status");
	if (el) el.textContent = msg || "";
}

// --- Initialize Firebase ------------------------------------------------------
function init() {
	if (String(firebaseConfig.apiKey).startsWith("PASTE_")) {
		setStatus("⚠️ Firebase not configured — edit firebase-config.js (see SETUP-FIREBASE.md).");
		const btn = $("lb-login");
		if (btn) btn.disabled = true;
		return;
	}
	try {
		app = initializeApp(firebaseConfig);
		auth = getAuth(app);
		db = getFirestore(app);
		provider = new GoogleAuthProvider();
		configured = true;

		onAuthStateChanged(auth, (user) => {
			currentUser = user;
			renderAuth();
			updateMyRank();
			if (user && pendingScore != null) {
				const s = pendingScore;
				pendingScore = null;
				submitScore(s);
			}
		});

		loadLeaderboard();
	} catch (e) {
		console.error(e);
		setStatus("Failed to initialize Firebase: " + e.message);
	}
}

// --- Sign in / Sign out -------------------------------------------------------
async function login() {
	if (!configured) return;
	try {
		await signInWithPopup(auth, provider);
	} catch (e) {
		console.error(e);
		setStatus("Sign-in failed: " + (e.code || e.message));
	}
}

async function logout() {
	if (!configured) return;
	try { await signOut(auth); } catch (e) { console.error(e); }
}

function renderAuth() {
	const info = $("lb-user");
	const loginBtn = $("lb-login");
	const logoutBtn = $("lb-logout");
	if (currentUser) {
		info.innerHTML = `<img src="${currentUser.photoURL || ""}" referrerpolicy="no-referrer" alt="">` +
			`<span>${escapeHtml(currentUser.displayName || "Player")}</span>`;
		loginBtn.style.display = "none";
		logoutBtn.style.display = "";
	} else {
		info.innerHTML = "";
		loginBtn.style.display = "";
		logoutBtn.style.display = "none";
	}
}

// Show the player's current rank (based on their all-time best score).
async function updateMyRank() {
	const el = $("lb-myrank");
	if (!el) return;
	if (!configured || !currentUser) {
		el.innerHTML = "";
		window.pinballMyBest = 0;
		window.dispatchEvent(new CustomEvent("pinball-best", { detail: 0 }));
		return;
	}
	try {
		// Fetch all of this user's scores (uid filter only -> no composite index)
		// and compute the max on the client.
		const q = query(collection(db, "scores"),
			where("uid", "==", currentUser.uid), limit(500));
		const snap = await getDocs(q);
		let best = 0;
		snap.forEach((d) => { const s = d.data().score; if (s > best) best = s; });

		// Expose the player's all-time best so the game overlays can show it.
		window.pinballMyBest = best;
		window.dispatchEvent(new CustomEvent("pinball-best", { detail: best }));

		const t = tierFor(best);
		el.innerHTML = best > 0
			? `<span class="lb-badge" style="--c:${t.color}">${t.icon} ${t.name}</span>` +
			  `<span class="lb-best">${best.toLocaleString("en-US")} pts</span>`
			: `<span class="lb-best">Play a game to earn a badge!</span>`;
	} catch (e) {
		console.error(e);
		el.innerHTML = "";
	}
}

// --- Submit score (called by the WASM game) ----------------------------------
async function submitScore(score) {
	score = Math.floor(Number(score));
	if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) return;

	if (!configured) { setStatus("Firebase not configured, score not saved."); return; }

	if (!currentUser) {
		pendingScore = score;
		setStatus(`You scored ${score.toLocaleString("en-US")} pts. Sign in with Google to save it!`);
		return;
	}

	try {
		await addDoc(collection(db, "scores"), {
			uid: currentUser.uid,
			name: currentUser.displayName || "Player",
			photo: currentUser.photoURL || "",
			score: score,
			createdAt: serverTimestamp()
		});
		const t = tierFor(score);
		setStatus(`Saved ${score.toLocaleString("en-US")} pts — rank ${t.icon} ${t.name}!`);
		loadLeaderboard();
		updateMyRank();
	} catch (e) {
		console.error(e);
		setStatus("Could not save score: " + (e.code || e.message));
	}
}

// Bridge for the WASM game.
window.pinballSubmitScore = (score) => submitScore(score);

// --- Query & render the leaderboard ------------------------------------------
function startOfToday() {
	const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function startOfWeek() {
	const d = new Date(); d.setHours(0, 0, 0, 0);
	const day = (d.getDay() + 6) % 7;          // Monday = start of week
	d.setDate(d.getDate() - day);
	return d;
}

async function fetchScores(sinceDate) {
	const col = collection(db, "scores");
	let q;
	if (sinceDate) {
		q = query(col,
			where("createdAt", ">=", Timestamp.fromDate(sinceDate)),
			orderBy("createdAt", "desc"),
			limit(POOL));
	} else {
		q = query(col, orderBy("score", "desc"), limit(POOL));
	}
	const snap = await getDocs(q);
	const rows = [];
	snap.forEach((doc) => rows.push(doc.data()));
	return rows;
}

// Keep only each player's best score, then sort descending.
function bestPerUser(rows) {
	const best = new Map();
	for (const r of rows) {
		const cur = best.get(r.uid);
		if (!cur || r.score > cur.score) best.set(r.uid, r);
	}
	return Array.from(best.values()).sort((a, b) => b.score - a.score);
}

async function loadLeaderboard() {
	if (!configured) return;
	const body = $("lb-rows");
	body.innerHTML = `<tr><td colspan="3" class="lb-empty">Loading…</td></tr>`;
	try {
		let since = null;
		if (activeTab === "today") since = startOfToday();
		else if (activeTab === "week") since = startOfWeek();
		allRows = bestPerUser(await fetchScores(since));
		shown = 0;
		body.innerHTML = "";
		const sc = $("lb-scroll");
		if (sc) sc.scrollTop = 0;
		renderPage();
		updateRankLine();
	} catch (e) {
		console.error(e);
		body.innerHTML = `<tr><td colspan="3" class="lb-empty">Failed to load. Check the console (an index may be required).</td></tr>`;
	}
}

// Reveal the next batch of rows (infinite scroll).
function renderPage() {
	const body = $("lb-rows");
	if (!allRows.length) {
		body.innerHTML = `<tr><td colspan="3" class="lb-empty">No scores yet. Be the first!</td></tr>`;
		return;
	}
	const next = allRows.slice(shown, shown + PAGE);
	const html = next.map((r, i) => {
		const rank = shown + i + 1;
		const mine = currentUser && r.uid === currentUser.uid ? " lb-me" : "";
		return `<tr class="${mine}">` +
			`<td class="lb-rank">${rank}</td>` +
			`<td class="lb-name"><img src="${r.photo || ""}" referrerpolicy="no-referrer" alt="">` +
			`<span>${escapeHtml(r.name || "Player")}</span>${badgeHtml(r.score)}</td>` +
			`<td class="lb-score">${Number(r.score).toLocaleString("en-US")}</td></tr>`;
	}).join("");
	body.insertAdjacentHTML("beforeend", html);
	shown += next.length;
}

function onScroll() {
	const sc = $("lb-scroll");
	if (!sc || shown >= allRows.length) return;
	if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 80) renderPage();
}

// Show "You: rank / total" for the current player.
function updateRankLine() {
	const el = $("lb-rankline");
	if (!el) return;
	const total = allRows.length;
	if (!currentUser) {
		el.innerHTML = total
			? `<span>${total.toLocaleString("en-US")} players</span>`
			: "";
		return;
	}
	const idx = allRows.findIndex((r) => r.uid === currentUser.uid);
	if (idx < 0) {
		el.innerHTML = `<span>Your rank</span><b>— / ${total.toLocaleString("en-US")}</b>`;
	} else {
		el.innerHTML = `<span>Your rank</span>` +
			`<b>${(idx + 1).toLocaleString("en-US")} / ${total.toLocaleString("en-US")}</b>`;
	}
}

function setTab(tab) {
	activeTab = tab;
	document.querySelectorAll(".lb-tab").forEach((b) =>
		b.classList.toggle("active", b.dataset.tab === tab));
	loadLeaderboard();
}

function escapeHtml(s) {
	return String(s).replace(/[&<>"']/g, (c) =>
		({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --- Wire up events & run -----------------------------------------------------
function wire() {
	$("lb-login").addEventListener("click", login);
	$("lb-logout").addEventListener("click", logout);
	$("lb-refresh").addEventListener("click", loadLeaderboard);
	document.querySelectorAll(".lb-tab").forEach((b) =>
		b.addEventListener("click", () => setTab(b.dataset.tab)));

	const sc = $("lb-scroll");
	if (sc) sc.addEventListener("scroll", onScroll, { passive: true });

	// Cap the leaderboard panel height to the game screen height (desktop).
	const screen = document.querySelector(".screen");
	const lbApp = $("lb-app");
	if (screen && lbApp && "ResizeObserver" in window) {
		const sync = () => {
			lbApp.style.maxHeight = window.innerWidth > 920
				? screen.offsetHeight + "px" : "";
		};
		new ResizeObserver(sync).observe(screen);
		window.addEventListener("resize", sync);
		sync();
	}

	init();
}

if (document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", wire);
else
	wire();
