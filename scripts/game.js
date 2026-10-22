import { CONFIG } from './config.js';
import { Player } from './player.js';
import { ObstacleManager } from './obstacles.js';
import { drawBackground } from './background.js';
import { setupInput } from './input.js';
import { loadBest, saveBest, loadTheme } from './storage.js';
import { THEMES, DEFAULT_THEME } from './themes.js';
import { formatScore } from './format.js';

const State = { READY: 'ready', PLAYING: 'playing', GAME_OVER: 'gameover' };
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export class Game {
  constructor(canvas, restartButton, statusEl, { jumpButton, slideButton, endActions, shareButton, shareNote } = {}) {
    this.canvas = canvas;
    this.endActions = endActions || restartButton; // container shown on Game Over
    this.shareNote = shareNote;
    this.ctx = canvas.getContext('2d');
    this.restartButton = restartButton;
    this.statusEl = statusEl; // visually hidden live region for screen readers
    this.player = new Player();
    this.obstacles = new ObstacleManager();
    this.state = State.READY;
    this.speed = CONFIG.speed.start;
    this.distance = 0;       // px travelled this run; score derives from it
    this.best = loadBest();
    this.newBest = false;
    const saved = loadTheme();
    this.theme = THEMES[Object.hasOwn(THEMES, saved) ? saved : DEFAULT_THEME];
    this.gameOverAt = 0;
    this.lastTime = null;
    this.rafId = null;

    this.touchUi = window.matchMedia('(pointer: coarse)').matches;
    this.scale = 1;
    this.resize();
    // Keep the backing store sharp when the layout, orientation or zoom changes.
    new ResizeObserver(() => this.resize()).observe(canvas);
    window.addEventListener('resize', () => this.resize());

    this.input = setupInput(canvas, {
      jumpButton,
      slideButton,
      onJump: () => this.handleJumpInput(),
      onSlideStart: () => this.handleSlideStart(),
      onSlideEnd: () => this.player.releaseSlide(),
      shouldPreventScroll: () => this.state !== State.GAME_OVER,
    });

    restartButton.addEventListener('click', () => this.restart());
    shareButton?.addEventListener('click', () => this.share());

    // Pause when hidden; resume without a large time jump.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopLoop();
      else this.startLoop();
    });
  }

  // Size the backing store to the displayed size x devicePixelRatio, and scale
  // drawing so game code keeps using the fixed logical world size.
  resize() {
    const cssWidth = this.canvas.clientWidth;
    if (!cssWidth) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round((width * CONFIG.canvas.height) / CONFIG.canvas.width);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.scale = width / CONFIG.canvas.width;
    if (this.rafId === null) this.draw(); // repaint immediately if the loop is paused
  }

  // Switch the look (cosmetic only) and repaint right away if the loop is paused.
  setTheme(name) {
    if (!Object.hasOwn(THEMES, name)) return;
    this.theme = THEMES[name];
    if (this.rafId === null) this.draw();
  }

  get score() {
    return Math.floor(this.distance / CONFIG.score.pixelsPerPoint);
  }

  start() {
    this.startLoop();
  }

  startLoop() {
    if (this.rafId !== null) return;
    this.lastTime = null;
    this.rafId = requestAnimationFrame((t) => this.frame(t));
  }

  stopLoop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  handleJumpInput() {
    if (this.state === State.READY) {
      this.state = State.PLAYING;
    } else if (this.state === State.PLAYING) {
      this.player.jump(this.standBlocked());
    } else {
      this.restart();
    }
  }

  handleSlideStart() {
    if (this.state === State.PLAYING) this.player.pressSlide();
  }

  // True when an overhead obstacle is above the player, so standing up (to run
  // or jump) would collide. A slide in progress must not end here.
  standBlocked() {
    const { x, w } = this.player.hitbox;
    return this.obstacles.overheadAbove(x, x + w);
  }

  restart() {
    // Ignore restarts right after dying so a held or mashed key can't skip the screen.
    if (this.state === State.GAME_OVER && performance.now() - this.gameOverAt < CONFIG.score.gameOverLockout * 1000) {
      return;
    }
    this.player.reset();
    this.obstacles.reset();
    this.speed = CONFIG.speed.start;
    this.distance = 0;
    this.newBest = false;
    this.input.clear();
    this.player.releaseSlide();
    this.endActions.hidden = true;
    this.setShareNote('');
    this.setStatus('');
    this.state = State.PLAYING;
  }

  frame(time) {
    this.rafId = requestAnimationFrame((t) => this.frame(t));
    const dt = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, CONFIG.maxDeltaTime);
    this.lastTime = time;
    this.update(dt);
    this.draw();
  }

  update(dt) {
    if (this.state !== State.PLAYING) return;
    this.speed = Math.min(CONFIG.speed.max, this.speed + CONFIG.speed.accel * dt);
    this.distance += this.speed * dt;
    this.obstacles.update(dt, this.speed, this.score);
    this.player.update(dt, this.standBlocked(), this.speed);
    if (this.hitObstacle()) this.gameOver();
  }

  // AABB overlap between the player's hitbox and every obstacle.
  hitObstacle() {
    const p = this.player.hitbox;
    return this.obstacles.list.some(
      (o) => p.x < o.x + o.w && p.x + p.w > o.x && p.y < o.y + o.h && p.y + p.h > o.y
    );
  }

  gameOver() {
    this.state = State.GAME_OVER;
    this.gameOverAt = performance.now();
    this.player.dead = true;
    this.input.clear();
    this.player.releaseSlide();
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      saveBest(this.best);
    }
    this.endActions.hidden = false;
    this.restartButton.focus();
    this.setStatus(
      `Game over. Score ${formatScore(this.score)}. Best ${formatScore(this.best)}.` +
        (this.newBest ? ' New best!' : '')
    );
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  setShareNote(text) {
    if (this.shareNote) this.shareNote.textContent = text;
  }

  // Share the score and a direct link. Uses the Web Share sheet where available,
  // otherwise copies the text. The score is local and unverified, so no ranking claims.
  async share() {
    const text = `I scored ${formatScore(this.score)} in Runner. Can you beat it?`;
    const url = location.href.split('#')[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Runner', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      this.setShareNote('Copied to clipboard!');
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user closed the share sheet
      this.setShareNote(`Copy this link: ${url}`);
    }
  }

  draw() {
    const { ctx } = this;
    const { width } = CONFIG.canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    drawBackground(ctx, this.distance, this.theme);

    this.obstacles.draw(ctx, this.theme);
    this.player.draw(ctx, this.theme);
    this.drawHud(ctx, width);

    ctx.fillStyle = this.theme.text;
    ctx.textAlign = 'center';
    if (this.state === State.READY) {
      ctx.font = `700 34px ${FONT}`;
      ctx.fillText('Runner', width / 2, 85);
      ctx.font = `600 20px ${FONT}`;
      ctx.fillText(this.touchUi ? 'Tap Jump to start' : 'Press Space or tap to start', width / 2, 125);
      ctx.font = `17px ${FONT}`;
      ctx.fillText('Jump over obstacles. Crawl under hanging things.', width / 2, 155);
    } else if (this.state === State.GAME_OVER) {
      ctx.font = `700 36px ${FONT}`;
      ctx.fillText('Game Over', width / 2, 62);
      ctx.font = `600 22px ${FONT}`;
      ctx.fillText(`Score ${formatScore(this.score)}`, width / 2, 92);
      ctx.font = `18px ${FONT}`;
      ctx.fillStyle = this.newBest ? this.theme.accent : this.theme.text;
      ctx.fillText(
        this.newBest ? `New best! ${formatScore(this.best)}` : `Best ${formatScore(this.best)}`,
        width / 2,
        117
      );
    }
  }

  drawHud(ctx, width) {
    ctx.fillStyle = this.theme.text;
    ctx.textAlign = 'right';
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(formatScore(this.score), width - 16, 32);
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = this.theme.textDim;
    ctx.fillText(`Best ${formatScore(this.best)}`, width - 16, 52);
  }
}
