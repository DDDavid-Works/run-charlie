const JUMP_KEYS = new Set(['Space', 'ArrowUp']);
const SLIDE_KEYS = new Set(['ArrowDown', 'KeyS']);
const SLIDE_BUTTON = 'button:slide'; // pseudo key code for the on-screen Slide button

const isSlide = (code) => SLIDE_KEYS.has(code) || code === SLIDE_BUTTON;

// Wires keyboard, pointer, and on-screen button input to callbacks.
// onJump fires once per press (held keys do not repeat).
// onSlideStart / onSlideEnd fire when the first slide source goes down / the last comes up.
export function setupInput(
  canvas,
  { jumpButton, slideButton, onJump, onSlideStart, onSlideEnd, shouldPreventScroll }
) {
  const down = new Set();
  const slideHeld = () => [...down].some(isSlide);
  const controls = [jumpButton, slideButton].filter(Boolean);

  function press(code) {
    if (down.has(code)) return false;
    const wasSliding = slideHeld();
    down.add(code);
    if (isSlide(code) && !wasSliding) onSlideStart();
    return true;
  }

  function release(code) {
    if (!down.delete(code)) return;
    if (isSlide(code) && !slideHeld()) onSlideEnd();
  }

  window.addEventListener('keydown', (e) => {
    const jump = JUMP_KEYS.has(e.code);
    if (!jump && !SLIDE_KEYS.has(e.code)) return;
    // Let other focused buttons (e.g. Restart) handle Space/Enter themselves.
    // The on-screen game controls are not excluded, so keys still work after tapping them.
    if (e.target instanceof HTMLButtonElement && !e.target.hasAttribute('data-game-control')) return;
    if (shouldPreventScroll()) e.preventDefault();
    if (e.repeat) return;
    if (press(e.code) && jump) onJump();
  });

  window.addEventListener('keyup', (e) => release(e.code));

  // Release everything (and any held slide) after focus changes or restarts.
  const clear = () => {
    const wasSliding = slideHeld();
    down.clear();
    controls.forEach((el) => el.classList.remove('pressed'));
    if (wasSliding) onSlideEnd();
  };
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onJump();
  });

  // Pointer capture keeps a finger that slides off the button "on" it until it lifts;
  // cancel / lost-capture also release so a slide can never get stuck.
  function holdControl(el, onDown, onUp) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('pressed');
      onDown();
    });
    const up = () => {
      el.classList.remove('pressed');
      onUp();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault()); // Android long-press menu
  }

  if (jumpButton) holdControl(jumpButton, () => onJump(), () => {});
  if (slideButton) holdControl(slideButton, () => press(SLIDE_BUTTON), () => release(SLIDE_BUTTON));

  return { clear };
}
