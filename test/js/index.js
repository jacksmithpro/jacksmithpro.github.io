const response = await fetch(`../game.json`);
const { controls, scale } = response.status === 200 ? await response.json?.() : {};
const $buttonInstall = document.querySelector('.button-install');
const $buttonPause = document.querySelector('.button-pause');
const $buttonMute = document.querySelector('.button-mute');
const $buttonFullscreen = document.querySelector('.button-fullscreen');
const $controls = document.querySelector('.controls');
const triggerKeydownEvent = event => window.dispatchEvent(new KeyboardEvent('keydown', event));
const triggerKeyupEvent = event => window.dispatchEvent(new KeyboardEvent('keyup', event));
// Lọc ra các phần tử và mã lệnh liên quan đến joystick

const joystickControls = controls.filter(control => control.type === 'joystick');

// Xử lý từng control joystick
joystickControls.forEach(async (control) => {
    const { mappings, dataset = { mode: 'fixed' } } = control;
    const assignMapping = (direction) => {
        const code = mappings[direction];
        return typeof code === 'string' ? { code } : code;
    };
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
});
