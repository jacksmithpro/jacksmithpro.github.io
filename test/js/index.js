// Lọc ra các phần tử và mã lệnh liên quan đến joystick
const $controls = document.querySelector('.controls');

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
