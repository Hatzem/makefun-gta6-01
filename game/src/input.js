// Keyboard and mouse input for Sunset Harbor. Held keys steer and drive;
// one-shot presses (enter a car, start, pause, confirm) are queued and
// taken once by the game loop so a press between frames is never lost.

export const PRESS_ENTER_CAR = 1;
export const PRESS_START = 2;
export const PRESS_PAUSE = 4;
export const PRESS_RESTART = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CAR_KEYS = new Set(['KeyE']);
const START_KEYS = new Set(['Enter', 'Space', 'Digit1', 'Digit2', 'Digit3']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const RESTART_KEYS = new Set(['KeyR']);

export function createInput(canvas) {
  const held = new Set();
  let pressed = 0;
  let mouse = { x: 0, y: 0, clicked: false };

  function down(event) {
    const code = event.code;
    if (UP.has(code) || DOWN.has(code) || LEFT.has(code) || RIGHT.has(code)) {
      held.add(code);
      event.preventDefault();
    } else if (CAR_KEYS.has(code)) {
      if (!event.repeat) pressed |= PRESS_ENTER_CAR;
      event.preventDefault();
    } else if (START_KEYS.has(code)) {
      if (!event.repeat) pressed |= PRESS_START;
    } else if (PAUSE_KEYS.has(code)) {
      if (!event.repeat) pressed |= PRESS_PAUSE;
    } else if (RESTART_KEYS.has(code)) {
      if (!event.repeat) pressed |= PRESS_RESTART;
    }
  }

  function up(event) {
    held.delete(event.code);
  }

  function blur() {
    held.clear();
  }

  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  function pointerDown(event) {
    pointerMove(event);
    mouse.clicked = true;
  }

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerdown', pointerDown);

  return {
    axisX() {
      const l = [...LEFT].some((c) => held.has(c));
      const r = [...RIGHT].some((c) => held.has(c));
      return (r ? 1 : 0) - (l ? 1 : 0);
    },
    axisY() {
      const u = [...UP].some((c) => held.has(c));
      const d = [...DOWN].some((c) => held.has(c));
      return (d ? 1 : 0) - (u ? 1 : 0);
    },
    takePressed() {
      const p = pressed;
      pressed = 0;
      return p;
    },
    takeClick() {
      const c = mouse.clicked;
      mouse.clicked = false;
      return c ? { x: mouse.x, y: mouse.y } : null;
    },
    mousePos() {
      return { x: mouse.x, y: mouse.y };
    },
    // Test hooks: pretend a key is held, or fire a one-shot press.
    testHold(code, on) {
      if (on) held.add(code);
      else held.delete(code);
    },
    testPress(flag) {
      pressed |= flag;
    },
  };
}
