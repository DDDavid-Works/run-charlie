import { CONFIG } from './config.js';

// Decorative parallax scenery. Purely visual: it never affects gameplay, and
// it is driven by distance travelled, so it freezes whenever the run does.
// Colors come from the active theme (see themes.js). They stay close to the
// sky so obstacles remain the highest-contrast things on screen.
const B = CONFIG.background;
const { width: W, height: H } = CONFIG.canvas;
const GROUND = CONFIG.groundY;

// Cheap deterministic hash in [0, 1) so scenery is stable frame to frame.
const rand = (i) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Positive modulo so offsets wrap cleanly.
const mod = (a, n) => ((a % n) + n) % n;

const STARS = Array.from({ length: B.starCount }, (_, i) => ({
  x: rand(i + 1) * W,
  y: 8 + rand(i + 101) * (GROUND - 110),
  r: 0.6 + rand(i + 201) * 0.9,
  a: 0.25 + rand(i + 301) * 0.45,
}));

const CLOUDS = Array.from({ length: B.cloudCount }, (_, i) => ({
  x: (i / B.cloudCount) * (W + 140) + rand(i + 401) * 40,
  y: 24 + rand(i + 501) * 90,
  s: 0.7 + rand(i + 601) * 0.7,
}));

function drawSky(ctx, theme) {
  if (theme.sky.length > 1) {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = theme.sky[0];
  }
  ctx.fillRect(0, 0, W, H);
}

// Moon or sun; they barely move because they are very far away.
function drawCelestial(ctx, theme, distance) {
  const x = mod(80 - distance * B.starParallax * 0.5, W + 80) - 20;
  if (theme.celestial === 'sun') {
    ctx.fillStyle = 'rgba(255, 224, 102, 0.3)';
    ctx.beginPath();
    ctx.arc(x, 52, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x, 52, 16, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = '#e8ecf7';
  ctx.beginPath();
  ctx.arc(x, 52, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.sky[0]; // crescent bite
  ctx.beginPath();
  ctx.arc(x + 7, 48, 13, 0, Math.PI * 2);
  ctx.fill();
}

function drawStars(ctx, distance) {
  const shift = distance * B.starParallax;
  ctx.fillStyle = '#c4cbe0';
  for (const s of STARS) {
    ctx.globalAlpha = s.a;
    ctx.fillRect(mod(s.x - shift, W), s.y, s.r * 2, s.r * 2);
  }
  ctx.globalAlpha = 1;
}

function drawClouds(ctx, distance) {
  const shift = distance * B.cloudParallax;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (const c of CLOUDS) {
    const x = mod(c.x - shift, W + 140) - 70;
    ctx.beginPath();
    ctx.ellipse(x, c.y, 26 * c.s, 8 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 12 * c.s, c.y - 6 * c.s, 12 * c.s, 9 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 6 * c.s, c.y - 9 * c.s, 14 * c.s, 11 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Rolling hills from two summed sine waves; offset scrolls them left.
function drawHills(ctx, offset, { base, amp1, amp2, f1, f2, seed, color }) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (let x = 0; x <= W + 6; x += 6) {
    const wx = x + offset;
    const y = base - amp1 * (0.5 + 0.5 * Math.sin(wx * f1 + seed)) - amp2 * (0.5 + 0.5 * Math.sin(wx * f2 + seed * 2.3));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 6, GROUND);
  ctx.closePath();
  ctx.fill();
}

// Small pine trees at jittered spacing along the near layer.
function drawTrees(ctx, theme, offset) {
  const gap = B.treeSpacing;
  const first = Math.floor(offset / gap) - 1;
  for (let i = first; i <= first + Math.ceil(W / gap) + 2; i++) {
    if (rand(i + 500) < 0.35) continue; // leave some gaps
    const x = i * gap + rand(i + 600) * gap * 0.6 - offset;
    const s = 0.8 + rand(i + 700) * 0.6;
    const baseY = GROUND - 2;
    ctx.fillStyle = theme.trunk;
    ctx.fillRect(x - 1.5, baseY - 6 * s, 3, 6 * s);
    ctx.fillStyle = theme.tree;
    for (let t = 0; t < 3; t++) {
      const w = (13 - t * 3) * s;
      const top = baseY - (10 + t * 9) * s - 4 * s;
      ctx.beginPath();
      ctx.moveTo(x - w, top + 11 * s);
      ctx.lineTo(x + w, top + 11 * s);
      ctx.lineTo(x, top);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// Short dashes and pebbles on the ground strip, scrolling at full world speed
// so the ground matches the obstacles and the dog's running speed.
function drawGround(ctx, theme, distance) {
  ctx.fillStyle = theme.soil;
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = theme.line;
  ctx.fillRect(0, GROUND, W, 3);

  ctx.fillStyle = theme.pebble;
  const gap = B.pebbleSpacing;
  const first = Math.floor(distance / gap) - 1;
  for (let i = first; i <= first + Math.ceil(W / gap) + 2; i++) {
    const x = i * gap + rand(i + 800) * gap - distance;
    const y = GROUND + 10 + rand(i + 900) * (H - GROUND - 18);
    const w = 3 + rand(i + 1000) * 9;
    ctx.fillRect(x, y, w, 2);
  }
}

export function drawBackground(ctx, distance, theme) {
  drawSky(ctx, theme);
  if (theme.stars) drawStars(ctx, distance);
  drawCelestial(ctx, theme, distance);
  if (theme.clouds) drawClouds(ctx, distance);
  drawHills(ctx, distance * B.farParallax, { base: GROUND - 8, amp1: 44, amp2: 18, f1: 0.006, f2: 0.017, seed: 1.3, color: theme.hillsFar });
  drawHills(ctx, distance * B.nearParallax, { base: GROUND, amp1: 26, amp2: 10, f1: 0.011, f2: 0.029, seed: 4.1, color: theme.hillsNear });
  drawTrees(ctx, theme, distance * B.nearParallax * 1.4);
  drawGround(ctx, theme, distance);
}
