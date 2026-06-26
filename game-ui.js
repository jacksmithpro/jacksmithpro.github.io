// ============================================================================
//  Custom HTML overlay screens for Space Cadet Pinball (web build).
//  Replaces the in-canvas ImGui menu with Start / Pause / Game Over screens.
//  Talks to the WASM game through the C bridge (Module._webXxx()).
// ============================================================================
(function () {
	"use strict";

	const BEST_KEY = "scp_best_score";
	const fmt = (n) => Number(n || 0).toLocaleString("en-US");

	let state = "loading";   // loading | start | playing | paused | gameover

	const $ = (id) => document.getElementById(id);
	const overlay = $("game-overlay");
	const pauseBtn = $("btn-pause");
	const fsBtn = $("btn-fullscreen");
	const rotateBtn = $("btn-rotate");
	const screenEl = () => document.querySelector(".screen");

	// --- Clean line icons (SVG) ----------------------------------------------
	const svg = (paths) =>
		`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ` +
		`stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
	const ICON_PAUSE = svg('<rect x="7" y="5" width="3.2" height="14" rx="1"/><rect x="13.8" y="5" width="3.2" height="14" rx="1"/>');
	// Enter: 4-corner frame (expand).
	const ICON_FS_ENTER = svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>');
	// Exit: 4 corners pointing inward (shrink).
	const ICON_FS_EXIT = svg('<path d="M3 8h3a2 2 0 0 0 2-2V3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M21 16h-3a2 2 0 0 0-2 2v3"/>');
	const ICON_ROTATE = svg('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>');

	if (pauseBtn) pauseBtn.innerHTML = ICON_PAUSE;
	if (fsBtn) fsBtn.innerHTML = ICON_FS_ENTER;
	if (rotateBtn) rotateBtn.innerHTML = ICON_ROTATE;

	// --- Rotate the game to landscape (mobile) -------------------------------
	function toggleRotate() {
		const el = screenEl();
		if (!el) return;
		const on = el.classList.toggle("rotated");
		document.body.classList.toggle("rotate-lock", on);
		focusGame();
	}

	// --- Fullscreen ----------------------------------------------------------
	function toggleFullscreen() {
		const el = screenEl();
		if (!document.fullscreenElement) {
			(el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
		} else {
			(document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
		}
	}
	document.addEventListener("fullscreenchange", () => {
		if (fsBtn) fsBtn.innerHTML = document.fullscreenElement ? ICON_FS_EXIT : ICON_FS_ENTER;
		focusGame();
	});

	// --- Best score ----------------------------------------------------------
	// Prefer the player's all-time best from Firebase (set by leaderboard.js).
	// Fall back to a per-browser localStorage value when not signed in.
	const getLocalBest = () => parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
	const setLocalBest = (s) => { if (s > getLocalBest()) localStorage.setItem(BEST_KEY, String(s)); };
	function getBest() {
		const fb = window.pinballMyBest;
		return (typeof fb === "number" && fb > 0) ? fb : getLocalBest();
	}

	// --- Bridge helpers (safe if game not ready) -----------------------------
	const M = () => (window.Module && typeof Module._webNewGame === "function" ? Module : null);
	function soundOn() { const m = M(); return m ? !!m._webGetSound() : true; }
	function musicOn() { const m = M(); return m ? !!m._webGetMusic() : true; }
	function stopMusic() { const m = M(); if (m && m._webStopMusic) m._webStopMusic(); }

	function focusGame() {
		const c = $("canvas");
		if (c) { try { c.focus(); } catch (e) {} }
	}

	// --- Reusable toggle button markup ---------------------------------------
	function soundIcon(on) { return on ? "🔊" : "🔇"; }

	function toggleRow(kind) {
		const on = kind === "sound" ? soundOn() : musicOn();
		const icon = kind === "sound" ? soundIcon(on) : "🎵";
		const label = kind === "sound" ? "Sound" : "Music";
		return `<button class="ovl-toggle ${on ? "on" : "off"}" data-toggle="${kind}" ` +
			`role="switch" aria-checked="${on}">` +
			`<span class="ovl-label"><span class="ovl-ic">${icon}</span> ${label}</span>` +
			`<span class="ovl-switch"></span></button>`;
	}

	function wireToggles(root) {
		root.querySelectorAll("[data-toggle]").forEach((btn) => {
			btn.addEventListener("click", () => {
				const m = M();
				if (!m) return;
				const kind = btn.dataset.toggle;
				const nowOn = kind === "sound" ? !!m._webToggleSound() : !!m._webToggleMusic();
				btn.classList.toggle("on", nowOn);
				btn.classList.toggle("off", !nowOn);
				btn.setAttribute("aria-checked", String(nowOn));
				if (kind === "sound") btn.querySelector(".ovl-ic").textContent = soundIcon(nowOn);
				// Don't let toggling Music ON preview-play before the game starts.
				if (kind === "music" && (state === "start" || state === "gameover")) stopMusic();
			});
		});
	}

	// --- Screens --------------------------------------------------------------
	function showStart() {
		state = "start";
		pauseBtn.hidden = true;
		overlay.hidden = false;
		overlay.innerHTML =
			`<div class="ovl-card">
				<div class="ovl-logo">🚀</div>
				<h2 class="ovl-title">SPACE CADET</h2>
				<div class="ovl-best">🏅 Your best: <b>${fmt(getBest())}</b></div>
				<div class="ovl-settings">${toggleRow("sound")}${toggleRow("music")}</div>
				<button class="ovl-play" id="ovl-play">▶ PLAY</button>
			</div>`;
		wireToggles(overlay);
		stopMusic();   // keep the Start screen silent until the player hits Play
		$("ovl-play").addEventListener("click", startGame);
	}

	function showPause() {
		state = "paused";
		pauseBtn.hidden = true;
		overlay.hidden = false;
		overlay.innerHTML =
			`<div class="ovl-card">
				<h2 class="ovl-title">PAUSED</h2>
				<div class="ovl-settings">${toggleRow("sound")}${toggleRow("music")}</div>
				<button class="ovl-play" id="ovl-resume">▶ RESUME</button>
			</div>`;
		wireToggles(overlay);
		$("ovl-resume").addEventListener("click", resumeGame);
	}

	function showGameOver(last, high) {
		state = "gameover";
		setLocalBest(last);
		// getBest() reflects Firebase, but the just-submitted score may not be
		// queried back yet — include `last` so Best is never below this run.
		const best = Math.max(last || 0, getBest());
		pauseBtn.hidden = true;
		overlay.hidden = false;
		overlay.innerHTML =
			`<div class="ovl-card">
				<h2 class="ovl-title">GAME OVER</h2>
				<div class="ovl-scores">
					<div class="ovl-score"><span>Last score</span><b>${fmt(last)}</b></div>
					<div class="ovl-score"><span>Best score</span><b class="hi">${fmt(best)}</b></div>
				</div>
				<button class="ovl-play" id="ovl-continue">↻ CONTINUE</button>
			</div>`;
		stopMusic();   // silence on the Game Over screen until Continue
		$("ovl-continue").addEventListener("click", startGame);
	}

	function enterPlaying() {
		state = "playing";
		overlay.hidden = true;
		overlay.innerHTML = "";
		pauseBtn.hidden = false;
		focusGame();
	}

	// --- Actions --------------------------------------------------------------
	function startGame() {
		const m = M();
		if (!m) return;
		m._webNewGame();
		enterPlaying();
	}
	function pauseGame() {
		const m = M();
		if (!m) return;
		m._webPause();
		showPause();
	}
	function resumeGame() {
		const m = M();
		if (!m) return;
		m._webResume();
		enterPlaying();
	}

	// --- Events from the game (C++ -> JS) -------------------------------------
	window.pinballOnGameOver = function (last, high) {
		showGameOver(last | 0, high | 0);
	};

	// Firebase best updated (e.g. after sign-in) -> refresh the Start screen.
	window.addEventListener("pinball-best", () => {
		if (state === "start") showStart();
	});

	pauseBtn.addEventListener("click", pauseGame);
	if (fsBtn) fsBtn.addEventListener("click", toggleFullscreen);
	if (rotateBtn) rotateBtn.addEventListener("click", toggleRotate);

	// --- Touch controls: hold a zone/button -> press a key, release -> key up.
	// A quick tap is stretched to a minimum hold so the flipper completes its
	// full swing (otherwise a fast tap releases before the flipper hits the ball).
	const MIN_HOLD = 120; // ms
	function bindHold(el, downFn, upFn) {
		if (!el) return;
		let active = false, downAt = 0, upTimer = null;
		const press = () => { const m = M(); if (m) m[downFn](); };
		const release = () => { const m = M(); if (m) m[upFn](); };
		const down = (e) => {
			e.preventDefault();
			if (state !== "playing" || !M()) return;
			if (upTimer) { clearTimeout(upTimer); upTimer = null; }
			active = true;
			downAt = performance.now();
			press();
		};
		const up = () => {
			if (!active) return;
			active = false;
			const held = performance.now() - downAt;
			if (held < MIN_HOLD) {
				upTimer = setTimeout(() => { upTimer = null; release(); }, MIN_HOLD - held);
			} else {
				release();
			}
		};
		el.addEventListener("pointerdown", down);
		el.addEventListener("pointerup", up);
		el.addEventListener("pointercancel", up);
		el.addEventListener("pointerleave", up);
	}
	bindHold($("touch-left"), "_webLeftDown", "_webLeftUp");   // left half  -> left flipper (Z)
	bindHold($("touch-right"), "_webRightDown", "_webRightUp"); // right half -> right flipper (/)
	bindHold($("btn-push"), "_webPlungerDown", "_webPlungerUp"); // launch ball (plunger)

	// Keyboard: Esc toggles pause while playing/paused.
	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			if (state === "playing") pauseGame();
			else if (state === "paused") resumeGame();
		}
	}, true);

	// --- Wait for the WASM runtime, then show the Start screen ----------------
	const ready = setInterval(() => {
		if (M()) {
			clearInterval(ready);
			showStart();
		}
	}, 150);
})();
