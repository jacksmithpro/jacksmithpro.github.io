// Đăng ký Service Worker
(async () => {
    try {
        await navigator.serviceWorker.register('https://jacksmithpro.github.io/xenos/sw.js');
    } catch (error) {
        console.error("❌ Lỗi đăng ký Service Worker:", error);
    }
})();

// Tải thông tin game.json
let controls = [], scale = null;
(async () => {
    try {
        const response = await fetch(`https://jacksmithpro.github.io/xenos/game.json`);
        if (response.ok) {
            const data = await response.json();
            controls = data.controls || [];
            scale = data.scale || null;
        }
    } catch (error) {
        console.error("❌ Lỗi tải game.json:", error);
    }
})();

// Khởi tạo Ruffle
window.RufflePlayer = window.RufflePlayer || {};
const ruffle = window.RufflePlayer.newest();
const player = ruffle.createPlayer();
const gamePath = `https://jacksmithpro.github.io/xenos/game.swf`;

// Tìm các phần tử DOM quan trọng
const $playground = document.querySelector('.playground');
const $buttonInstall = document.querySelector('.button-install');
const $buttonPause = document.querySelector('.button-pause');
const $buttonMute = document.querySelector('.button-mute');
const $buttonFullscreen = document.querySelector('.button-fullscreen');
const $controls = document.querySelector('.controls');

// Xử lý phím tắt
const triggerKeydownEvent = event => window.dispatchEvent(new KeyboardEvent('keydown', event));
const triggerKeyupEvent = event => window.dispatchEvent(new KeyboardEvent('keyup', event));

// Cấu hình player
player.config = {
    autoplay: 'on',
    contextMenu: 'rightClickOnly',
    warnOnUnsupportedContent: false,
    unmuteOverlay: 'hidden'
};

// 🚀 Tự động load game ngay khi trang sẵn sàng
window.addEventListener('load', () => {
    if ($playground) {
        console.log("🎮 Đang load game...");
        $playground.prepend(player);
        player.load(gamePath);
    } else {
        console.error("❌ Không tìm thấy phần tử .playground!");
    }
});

// Xử lý lỗi tải chậm trên Safari
setTimeout(() => {
    if (!player.parentNode && $playground) {
        console.warn("⚠ Safari có thể chặn tự động tải, thử lại...");
        $playground.prepend(player);
        player.load(gamePath);
    }
}, 1000);

// Xử lý nút Pause
$buttonPause.addEventListener('click', () => {
    $buttonPause.classList.toggle('active');
    player[$buttonPause.classList.contains('active') ? 'pause' : 'play']();
});

// Xử lý nút Mute
$buttonMute.addEventListener('click', () => {
    player.volume = +!$buttonMute.classList.contains('active');
    $buttonMute.classList.toggle('active');
});

// Xử lý Fullscreen
const exitFullscreen = () => {
    if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
        $buttonFullscreen?.classList.remove('active');
    }
};

if (navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
    $buttonFullscreen.remove();
} else {
    $buttonFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            $buttonFullscreen.classList.add('active');
        } else {
            exitFullscreen();
        }
    });
}

// Cài đặt gamepad nếu có
if (controls?.length) {
    $buttonPause.insertAdjacentHTML('afterend', '<button type="button" class="menu-button button-toggle-controls"></button>');
    document.querySelector('.button-toggle-controls').onclick = ({ currentTarget }) => {
        currentTarget.classList.toggle('hide-gamepad');
    };

    controls.forEach(async (control) => {
        if (control.type === 'joystick') {
            const { mappings, dataset = { mode: 'fixed' } } = control;
            const assignMapping = direction => (typeof mappings[direction] === 'string' ? { code: mappings[direction] } : mappings[direction]);
            const mapKeydown = direction => triggerKeydownEvent(assignMapping(direction));
            const mapKeyup = direction => triggerKeyupEvent(assignMapping(direction));
            const data = Object.entries(dataset).map(([key, value]) => `data-${key}=${value}`).join(' ');

            $controls.insertAdjacentHTML('beforeend', `<virtual-joystick ${data}></virtual-joystick>`);
            const $joystick = $controls.querySelector('virtual-joystick');

            const handleKeyEvents = () => {
                $joystick.dataset.release.split('').forEach(mapKeyup);
                $joystick.dataset.capture.split('').forEach(mapKeydown);
            };

            $joystick.addEventListener('joystickdown', handleKeyEvents);
            $joystick.addEventListener('joystickmove', handleKeyEvents);
            $joystick.addEventListener('joystickup', handleKeyEvents);
        }
    });
}

// Xử lý cài đặt PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    console.log('👍 beforeinstallprompt', event);
    deferredPrompt = event;
    $buttonInstall.hidden = false;
});

$buttonInstall.addEventListener('click', async () => {
    console.log('👍 butInstall-clicked');
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    console.log('👍 userChoice', result);
    deferredPrompt = null;
    $buttonInstall.hidden = true;
});
