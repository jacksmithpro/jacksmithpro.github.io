window.customElements.define('virtual-joystick', class VirtualJoystick extends HTMLElement {
    static #style = `
        :host {
            --radius: 65px;
            --size: calc(var(--radius) * 2);
        }
        :host,
        slot {
            position: relative;
            display: block;
            width: var(--size);
            height: var(--size);
        }
        slot {
            --x: var(--radius);
            --y: var(--radius);
            border: 1px solid gray;
            background-color: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            box-sizing: border-box;
            transition: opacity 1s, background-color .2s;
        }
        slot[part*="active"] {
            background-color: rgba(255, 255, 255, 0.6);
        }
        slot[part*="active"]:after {
            background-color: rgba(255, 255, 255, 0.8);
            transition: transform .1s, background-color 0.2s;
        }
        slot:after,
        slot:before {
            content: "";
            display: block;
            position: absolute;
            box-sizing: border-box;
            border-radius: 50%;
            width: 50px;
            height: 50px;
        }
        slot:after {
            border: 1px solid gray;
            background-color: rgba(255, 255, 255, 0.5);
            transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y)));
            transition: transform .4s, background-color .2s;
        }
        slot:before {
            border: 1px solid rgb(139, 139, 139);
            transform: translate(calc(-50% + var(--radius)), calc(-50% + var(--radius)));
        }
        [part*="dynamic"] {
            opacity: 0;
        }
        [part*="active"] {
            opacity: 1;
        }
        [part*="box"]:after {
            transform: translate(calc(-50% + clamp(0px, var(--x), var(--size))), calc(-50% + clamp(0px, var(--y), var(--size))));
        }
    `;
    static #getDir(degree) {
        const dirs = ['ne', 'n', 'nw', 'w', 'sw', 's', 'se'];
        const acute = 45;
        let threshold = 22.5;
        for (let dir of dirs) {
            if (degree >= threshold && degree < (threshold += acute)) {
                return dir;
            }
        }
        return 'e';
    }
    static #getUniqueDir(a = '', b = '') {
        let dir = '';
        if (!a.includes(b[0])) {
            dir = b[0];
        }
        if (b[1] && !a.includes(b[1])) {
            dir += b[1];
        }
        return dir;
    }
    #setXY(x, y) {
        this.element.style.setProperty('--x', `${x}px`);
        this.element.style.setProperty('--y', `${y}px`);
    }
    #calcCrow(event) {
        const { lock } = this.dataset;
        this.rect = this.element.getBoundingClientRect();
        const { clientX, clientY } = event;
        const dx = lock === 'x' ? this.r : clientX - this.rect.left;
        const dy = lock === 'y' ? this.r : clientY - this.rect.top;
        const dxr = dx - this.r;
        const dyr = dy - this.r;
        const hypot = Math.hypot(dxr, dyr);
        this.crow = { dx, dy, dxr, dyr, hypot };
    }
    #log({
        degree = 0,
        force = 0,
        radian = 0,
        distance = 0,
        direction = '',
        hypot = 0,
        capture = '',
        release = '',
        x = this.rect.width + this.rect.left,
        y = this.rect.top + this.rect.top,
    }) {
        Object.assign(
            this.dataset,
            { degree, force, radian, distance, direction, hypot, capture, release, x, y }
        );
    }
    #isInside(event) {
        const { clientX, clientY } = event;
        const {
            left: x,
            top: y,
            width: w,
            height: h
        } = this.dataset.mode ? this.getBoundingClientRect() : this.rect;
        const inside = clientX >= x && clientX <= x + w && clientY >= y && clientY <= y + h;
        return inside;
    }
    constructor() {
        super();
        this.element = null;
        this.rect = null;
        this.crow = null;
        this.pointers = [];
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>${VirtualJoystick.#style}</style>
            <slot part="joystick"></slot>
        `;
        this.element = this.shadowRoot.lastElementChild;
        if (this.dataset.mode === 'semi' || this.dataset.mode === 'dynamic') {
            this.element.classList.add('dynamic');
        }
        if (this.dataset.shape) {
            this.element.classList.add('box');
        }
        this.rect = this.element.getBoundingClientRect();
        this.r = this.rect.width / 2;
        this.#log({ x: 0, y: 0 });
    }
    connectedCallback() {
        document.addEventListener('pointerdown', this.#start);
        document.addEventListener('pointermove', this.#move);
        document.addEventListener('pointerup', this.#up);
    }
    #start = (event) => {
        const { clientX, clientY } = event;
        const attachEvents = () => {
            this.pointers.push(event.pointerId);
            this.element.classList.add('active');
            this.#bind(event);
            this.dispatchEvent(new CustomEvent('joystickdown'));
        };
        if (this.pointers.length && this.dataset.mode !== 'fixed') {
            return;
        }
        this.rect = this.element.getBoundingClientRect();
        if (this.#isInside(event)) {
            if (this.dataset.mode) {
                if (this.dataset.mode !== 'fixed') {
                    if (this.dataset.mode === 'semi') {
                        this.element.classList.remove('dynamic');
                    }
                    const { top, left } = this.getBoundingClientRect();
                    this.element.style.left = `${clientX - left - this.r}px`;
                    this.element.style.top = `${clientY - top - this.r}px`;
                }
                this.#calcCrow(event);
                return attachEvents();
            }
            this.#calcCrow(event);
            if (this.crow.hypot <= this.r || this.dataset.shape) {
                attachEvents();
            }
        }
    };
    #move = (event) => {
        if (this.pointers.at(-1) === event.pointerId) {
            this.#calcCrow(event);
            this.#bind(event);
            this.dispatchEvent(new CustomEvent('joystickmove'));
        }
    };
    #bind(event) {
        const { dx, dy, dxr, dyr, hypot } = this.crow;
        const r = this.r;
        const angle = Math.atan2(dyr, dxr);
        let degree = angle * 180 / Math.PI;
        let x = dx;
        let y = dy;
        const force = hypot / r;
        if (!this.dataset.shape && hypot > r) {
            x = r * Math.cos(angle) + r;
            y = r * Math.sin(angle) + r;
        }
        degree = (degree > 0 ? 360 : 0) - degree;
        const direction = +this.dataset.threshold > force ? '' : VirtualJoystick.#getDir(degree);
        this.#log({
            hypot,
            degree,
            force,
            direction,
            capture: VirtualJoystick.#getUniqueDir(this.dataset.direction, direction),
            release: VirtualJoystick.#getUniqueDir(direction, this.dataset.direction),
            x: x + this.rect.left,
            y: y + this.rect.top,
            radian: (angle > 0 ? 2 * Math.PI : 0) - angle,
            distance: Math.min(hypot, r),
        });
        this.#setXY(x, y);
    }
    #up = (event) => {
        if (this.pointers.at(-1) === event.pointerId) {
            this.pointers.pop();
            this.element.classList.remove('active');
            this.#log({ release: this.dataset.direction });
            this.#setXY(this.r, this.r);
            this.dispatchEvent(new CustomEvent('joystickup'));
        }
        const pointerIndex = this.pointers.indexOf(event.pointerId);
        if (pointerIndex !== -1) {
            this.pointers.splice(pointerIndex, 1);
        }
    };
});

const { pathname } = window.location;
navigator.serviceWorker.register('../sw.js').then(() => {
    fetch(`../game.json`).then(response => {
        if (response.status === 200) {
            response.json().then(data => {
                const { controls, scale } = data;
                window.RufflePlayer = window.RufflePlayer || {};
                const $playground = document.querySelector('.playground');
                const $buttonInstall = document.querySelector('.button-install');
                const $buttonPause = document.querySelector('.button-pause');
                const $buttonMute = document.querySelector('.button-mute');
                const $buttonFullscreen = document.querySelector('.button-fullscreen');
                const $controls = document.querySelector('.controls');
                const triggerKeydownEvent = event => window.dispatchEvent(new KeyboardEvent('keydown', event));
                const triggerKeyupEvent = event => window.dispatchEvent(new KeyboardEvent('keyup', event));
                const ruffle = window.RufflePlayer.newest();
                const player = ruffle.createPlayer();
                const gamePath = `../game.swf`;
                const exitFullscreen = () => {
                    if (document.exitFullscreen && document.fullscreenElement) {
                        document.exitFullscreen();
                        $buttonFullscreen?.classList.remove('active');
                    }
                };
                const handleHashChange = () => {
                    $playground.prepend(player);
                    player.load(gamePath);
                };
                let deferredPrompt;
                player.config = {
                    autoplay: 'on',
                    contextMenu: 'rightClickOnly',
                    warnOnUnsupportedContent: false,
                    unmuteOverlay: 'hidden'
                };
                addEventListener('hashchange', handleHashChange);
                handleHashChange();
                fetch(gamePath);
                $buttonPause.addEventListener('click', () => {
                    $buttonPause.classList.contains('active') ? player.play() : player.pause();
                    $buttonPause.classList.toggle('active');
                });
                $buttonMute.addEventListener('click', () => {
                    player.volume = +$buttonMute.classList.contains('active');
                    $buttonMute.classList.toggle('active');
                });
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
                if (scale) {
                    const { style } = $playground;
                    const w = style.getPropertyValue('--w');
                    const h = style.getPropertyValue('--h');
                    const ratio = w / h;
                    const setScale = () => {
                        const { innerWidth, innerHeight } = window;
                        const scale = ratio > innerWidth / innerHeight ? innerWidth / w : innerHeight / h;
                        style.setProperty('--vw', innerWidth);
                        style.setProperty('--vh', innerHeight);
                        style.setProperty('--s', scale);
                        style.setProperty('--to', innerWidth > w ? 'center' : 'left top');
                    };
                    window.addEventListener('resize', setScale);
                    document.body.classList.add('scale');
                    setScale();
                }
                if (controls && controls.length) {
                    $buttonPause.insertAdjacentHTML('afterend', '<button type="button" class="menu-button button-toggle-controls"></button>');
                    document.querySelector('.button-toggle-controls').onclick = ({ currentTarget }) => {
                        currentTarget.classList.toggle('hide-gamepad');
                    };
                    controls.forEach(control => {
                        const { type } = control;
                        if ('joystick' === type) {
                            const { mappings, dataset = { mode: 'fixed' } } = control;
                            const assignMapping = direction => {
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
                        }
                        if ('button' === type) {
                            const Button = require('./button.js');
                            Button.default(control, $controls);
                        }
                    });
                }
            });
        }
    });
});

window.addEventListener('beforeinstallprompt', event => {
    // Prevent the mini-infobar from appearing on mobile.
    event.preventDefault();
    console.log('👍', 'beforeinstallprompt', event);
    // Stash the event so it can be triggered later.
    deferredPrompt = event;
    $buttonInstall.hidden = false;
});

$buttonInstall.addEventListener('click', async () => {
    console.log('👍', 'butInstall-clicked');
    const promptEvent = deferredPrompt;
    if (!promptEvent) {
        // The deferred prompt isn't available.
        return;
    }
    // Show the install prompt.
    promptEvent.prompt();
    // Log the result
    const result = await promptEvent.userChoice;
    console.log('👍', 'userChoice', result);
    // Reset the deferred prompt variable, since
    // prompt() can only be called once.
    deferredPrompt = null;
    // Hide the install button.
    $buttonInstall.hidden = true;
});
