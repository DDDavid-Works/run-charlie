import { Game } from './game.js';
import { THEMES } from './themes.js';
import { saveTheme } from './storage.js';

const canvas = document.getElementById('game');
const restartButton = document.getElementById('restart');
const statusEl = document.getElementById('status');

const game = new Game(canvas, restartButton, statusEl, {
  jumpButton: document.getElementById('jump-btn'),
  slideButton: document.getElementById('slide-btn'),
  endActions: document.getElementById('end-actions'),
  shareButton: document.getElementById('share-btn'),
  shareNote: document.getElementById('share-note'),
});
game.start();

// Theme toggle: cycles through the themes in themes.js. The button names the
// theme you would switch to.
const themeButton = document.getElementById('theme-btn');
const themeNames = Object.keys(THEMES);
let themeIndex = Math.max(0, themeNames.findIndex((n) => THEMES[n] === game.theme));

function showTheme() {
  const next = THEMES[themeNames[(themeIndex + 1) % themeNames.length]];
  document.documentElement.dataset.theme = themeNames[themeIndex];
  themeButton.textContent = `${next.icon} ${next.label}`;
  themeButton.setAttribute('aria-label', `Switch to ${next.label.toLowerCase()} theme`);
}
showTheme();

themeButton.addEventListener('click', (e) => {
  themeIndex = (themeIndex + 1) % themeNames.length;
  game.setTheme(themeNames[themeIndex]);
  saveTheme(themeNames[themeIndex]);
  showTheme();
  // After a mouse or touch click, hand Space back to the game (keyboard users keep focus).
  if (e.detail > 0) themeButton.blur();
});

window.__gameStarted = true; // lets the page show a message if scripts failed to load

// Offline support. Registration failing (blocked, unsupported, insecure origin)
// must never affect the game.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
