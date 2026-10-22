import { CONFIG } from './config.js';

const O = CONFIG.obstacle;

export const ObstacleType = { GROUND: 'ground', OVERHEAD: 'overhead' };

// Laundry palettes: each laundry obstacle picks its own colors (see seeded()).
const PANTS = [
  { fill: '#3f6fb5', dark: '#2b4f8c', stitch: '#f0c05a' },   // blue jeans
  { fill: '#3a3f4e', dark: '#252a38', stitch: '#f0c05a' },   // black
  { fill: '#c8a86a', dark: '#8a6a3b', stitch: '#8a6a3b' },   // khaki
  { fill: '#6b8f5a', dark: '#4d6b40', stitch: '#d8d08a' },   // olive
];
const TOWELS = ['#ffd23f', '#f06a9a', '#4caf6a'];
const SHIRTS = [
  { fill: '#f26b4f', dark: '#c94a33' },
  { fill: '#ffd23f', dark: '#d9a800' },
  { fill: '#e05a9a', dark: '#b03a72' },
  { fill: '#4caf6a', dark: '#2f8f4e' },
];
const SHORTS = [
  { fill: '#8c6bd6', dark: '#6e50b8', stitch: '#6e50b8' },
  { fill: '#2fb5a8', dark: '#1f8a80', stitch: '#1f8a80' },
  { fill: '#ff9a3d', dark: '#d97a1a', stitch: '#d97a1a' },
];

// Small repeatable random numbers from a seed, so a drawing that picks colors
// or items always picks the same ones for the same obstacle.
function seeded(seed) {
  let t = Math.floor(seed * 4294967296) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (list, rand) => list[Math.floor(rand() * list.length)];

// y of an overhead obstacle's top edge: above the apex of a full jump (plus the
// hitbox's bottom inset and a safety margin), so it cannot be jumped over.
export function overheadTop() {
  const apex = (CONFIG.player.jumpVelocity ** 2) / (2 * CONFIG.player.gravity);
  return CONFIG.groundY - apex - CONFIG.player.hitbox.insetBottom - O.overheadJumpMargin;
}

// Obstacle palette: warm colors for ground (jump), cool teal and purple for
// overhead (slide). Shapes differ too, so type is never told by color alone.
const COLORS = {
  hydrant: '#e05a6d',
  hydrantDark: '#a83a4b',
  shine: 'rgba(255, 255, 255, 0.35)',
  cone: '#ff8a3d',
  coneBand: '#f6f1e6',
  houseWall: '#c9873f',
  houseRoof: '#a8442f',
  houseDoor: '#1b1f2a',
  bone: '#f6f1e6',
  can: '#7f8ea3',
  canDark: 'rgba(27, 31, 42, 0.3)',
  canLid: '#a9b8cc',
  leaf: '#2f8f4e',
  leafLight: '#4caf6a',
  leafDark: 'rgba(27, 31, 42, 0.3)',
  trunk: '#6b4a2f',
  apple: '#ff6b6b',
  kites: ['#ff6b6b', '#ffd23f', '#5ac8e0'],
  board: '#5b86a8',
  boardDark: 'rgba(27, 31, 42, 0.4)',
  houseCream: '#f6f1e6',
  post: '#3a3f4e',
  sign: '#f6f1e6',
  bun: '#e0a85a',
  sausage: '#c4553a',
  mustard: '#ffd23f',
  steel: '#6b7488',
  barrierRed: '#e05a6d',
  barrierWhite: '#f6f1e6',
  lamp: '#ffb347',
  roofPurple: '#8c6bd6',
  towelStripe: '#f6f1e6',
  pegLight: '#f6f1e6',
  peg: '#6b4a2f',
  sock: '#8c6bd6',
  sockCuff: '#f6f1e6',
};

// --- Theme effects (cosmetic): outline, night tint, moonlit top edge ---

// Scratch canvases for building sprites. Each is resized to exactly the sprite
// being built (which also clears it): once a canvas has been drawn from, the
// browser copies its whole backing store before the next change, so a scratch
// canvas left at the size of the largest obstacle makes every sprite slow.
const layers = [];
function layer(i, w, h) {
  if (!layers[i]) layers[i] = document.createElement('canvas');
  const c = layers[i];
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d') };
}

// Spare sprite canvases from obstacles that scrolled off, so spawning rarely
// allocates. A laundry row alone uses about ten layers.
const spritePool = [];
const SPRITE_POOL_MAX = 32;

// Device-pixel size of the art box `b` at scale `s`.
const fxSize = (b, s) => ({ w: Math.ceil(b.w * s) + 2, h: Math.ceil(b.h * s) + 2 });

// A world-space box grown by `pad` on every side (room for the outline).
const box = (x, y, w, h, pad = 4) => ({ x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 });

// Renders `paint` through the effects once into a sprite canvas, with the art
// box's top-left at the sprite's (0, 0). Drawing the sprite later is a single
// drawImage, however many effects the theme has.
function renderSprite(b, s, fx, paint) {
  const { w, h } = fxSize(b, s);
  const c = spritePool.pop() || document.createElement('canvas');
  c.width = w; // also clears it
  c.height = h;
  const sctx = c.getContext('2d');
  composeFx(sctx, 0, 0, w, h, s, fx, (a) => {
    a.setTransform(s, 0, 0, s, -b.x * s, -b.y * s);
    paint(a);
  });
  return c;
}

// Draws the art (via `paintArt`, which sets its own transform) into a scratch
// canvas, tints it, then composites outline, art and rim onto `dst` at device
// position (dx, dy). `dst` must have an identity transform.
function composeFx(dst, dx, dy, w, h, s, fx, paintArt) {
  const art = layer(0, w, h);
  paintArt(art.ctx);
  art.ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (fx.tint) {
    art.ctx.globalCompositeOperation = 'source-atop';
    art.ctx.fillStyle = fx.tint;
    art.ctx.fillRect(0, 0, w, h);
  }

  // Silhouette, filled with a single color.
  const tinted = (i, color) => {
    const l = layer(i, w, h);
    l.ctx.drawImage(art.c, 0, 0, w, h, 0, 0, w, h);
    l.ctx.globalCompositeOperation = 'source-in';
    l.ctx.fillStyle = color;
    l.ctx.fillRect(0, 0, w, h);
    return l;
  };

  if (fx.outline && fx.outlineWidth > 0) {
    const sil = tinted(1, fx.outline);
    const r = fx.outlineWidth * s;
    for (let a = 0; a < 8; a++) {
      const ox = Math.round(Math.cos((a * Math.PI) / 4) * r);
      const oy = Math.round(Math.sin((a * Math.PI) / 4) * r);
      dst.drawImage(sil.c, 0, 0, w, h, dx + ox, dy + oy, w, h);
    }
  }
  dst.drawImage(art.c, 0, 0, w, h, dx, dy, w, h);
  if (fx.rim) {
    // Top-edge band: the silhouette minus itself shifted down.
    const rim = tinted(2, fx.rim);
    rim.ctx.globalCompositeOperation = 'destination-out';
    rim.ctx.drawImage(art.c, 0, 0, w, h, 0, Math.round(fx.rimWidth * s), w, h);
    dst.drawImage(rim.c, 0, 0, w, h, dx, dy, w, h);
  }
}

// --- Pure spawning rules (exported so they can be tested without a canvas) ---

export function tierFor(score) {
  let tier = 0;
  for (let i = 0; i < O.tiers.length; i++) {
    if (score >= O.tiers[i].fromScore) tier = i;
  }
  return tier;
}

export function pickVariant(tier, rng = Math.random) {
  const weights = O.tiers[tier].weights;
  const names = Object.keys(weights);
  let roll = rng() * names.reduce((sum, n) => sum + weights[n], 0);
  for (const name of names) {
    roll -= weights[name];
    if (roll < 0) return name;
  }
  return names[names.length - 1];
}

// Seconds of travel between one obstacle's trailing edge and the next one's leading edge.
export function gapSeconds(tier, switchedType, rng = Math.random) {
  const max = O.tiers[tier].maxGapSeconds;
  return O.minGapSeconds + rng() * (max - O.minGapSeconds) + (switchedType ? O.typeSwitchExtraGap : 0);
}

export class ObstacleManager {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.reset();
  }

  reset() {
    for (const o of this.list || []) this.releaseSprite(o);
    for (const u of this.upcoming || []) this.releaseSprite(u.o);
    this.list = [];
    // Obstacles waiting to spawn, chosen at least one spawn ahead so the gap
    // that precedes each can account for a jump <-> slide switch. A combo
    // queues all its steps at once; steps after the first carry a fixed gap.
    // Each entry's obstacle (u.o) already exists, so its sprites can be built
    // before it appears (see draw).
    this.upcoming = [];
    this.overheadSeen = false;
    this.queueNext(0);
    // distance (px) still to travel before the next obstacle spawns
    this.distanceToNext = CONFIG.speed.start * O.firstSpawnDelay;
  }

  queueNext(tier) {
    const name = pickVariant(tier, this.rng);
    const combo = O.combos[name];
    if (!combo) {
      this.upcoming.push({ name, o: this.makeObstacle(name) });
      return;
    }
    combo.steps.forEach((step, i) => {
      this.upcoming.push({ name: step, o: this.makeObstacle(step), combo: name, comboStep: i, gap: i > 0 ? combo.gaps[i - 1] : undefined });
    });
  }

  update(dt, speed, score = 0) {
    const dx = speed * dt;
    for (const o of this.list) o.x -= dx;
    // `tail` is decoration trailing past the hitbox; keep it until it has scrolled off too.
    this.list = this.list.filter((o) => {
      const onScreen = o.x + o.w + (o.tail || 0) > 0;
      if (!onScreen) this.releaseSprite(o);
      return onScreen;
    });

    this.distanceToNext -= dx;
    if (this.distanceToNext <= 0) {
      const tier = tierFor(score);
      const step = this.upcoming.shift();
      const o = this.spawn(step.name, step.o);
      if (step.combo) Object.assign(o, { combo: step.combo, comboStep: step.comboStep });
      if (o.type === ObstacleType.OVERHEAD && !this.overheadSeen) {
        o.intro = true;
        this.overheadSeen = true;
      }
      if (!this.upcoming.length) this.queueNext(tier);
      const next = this.upcoming[0];
      const nextType = O.variants[next.name].type;
      let gap = next.gap ?? gapSeconds(tier, nextType !== o.type, this.rng);
      // Space out the run's first overhead: before it, and after it.
      const introNext = nextType === ObstacleType.OVERHEAD && !this.overheadSeen;
      if (introNext || o.intro) gap += O.firstOverheadExtraGap;
      // Speed keeps rising during the gap, so size it at the speed it will have
      // reached by then; at the current speed the gap would arrive early.
      const arrivalSpeed = Math.min(CONFIG.speed.max, speed + CONFIG.speed.accel * gap);
      // + o.w so the gap is edge to edge rather than spawn point to spawn point.
      this.distanceToNext = arrivalSpeed * gap + o.w;
    }
  }

  // Puts an obstacle (a queued one, or a new one) on the track at the right edge.
  spawn(name, o = this.makeObstacle(name)) {
    o.x = CONFIG.canvas.width;
    this.list.push(o);
    return o;
  }

  makeObstacle(name) {
    const v = O.variants[name];
    const x = CONFIG.canvas.width;
    // seed fixes per-obstacle looks (which skin, laundry colors); from this.rng so seeded runs repeat.
    const seed = this.rng();
    return v.type === ObstacleType.OVERHEAD
      ? { name, type: v.type, x, y: overheadTop(), w: v.w, h: CONFIG.groundY - O.overheadClearance - overheadTop(), tail: v.tail || 0, seed }
      : { name, type: v.type, x, y: CONFIG.groundY - v.h, w: v.w, h: v.h, posts: v.posts || 1, seed };
  }

  // True if an overhead obstacle is above the horizontal span [x0, x1], i.e.
  // the player cannot safely stand up there.
  overheadAbove(x0, x1) {
    return this.list.some(
      (o) => o.type === ObstacleType.OVERHEAD && x0 < o.x + o.w && x1 > o.x
    );
  }

  // The theme's skins pick which drawing each variant gets (see themes.js). A
  // skin may be a list of drawings; each obstacle then picks one by its seed.
  // Every obstacle gets a ground shadow and is painted through the theme's
  // effects (theme.obstacleFx). None of it changes the collision box.
  // Each obstacle is drawn from cached layers: images rendered once (effects
  // included), then only moved each frame. Swaying parts are their own layers,
  // offset or rotated by layer.motion(o). Layers for queued obstacles are built
  // ahead, a layer per frame, so a spawn never stalls a frame rendering them.
  draw(ctx, theme) {
    const fx = theme.obstacleFx;
    const m = ctx.getTransform(); // uniform scale + translation (see Game.draw)
    const s = m.a;
    for (const o of this.list) {
      const skin = this.skinFor(o, theme);
      this.buildLayers(o, theme, s); // normally already built while queued
      this.drawShadow(ctx, o, fx.shadow);
      ctx.save();
      for (const l of o.layers) {
        const { dx = 0, angle = 0 } = l.motion ? l.motion(o) : {};
        const x = s * (o.x + l.relX + dx) + m.e;
        const y = s * l.y + m.f;
        if (angle) {
          const px = s * (o.x + l.pivotRelX) + m.e;
          const py = s * l.pivotY + m.f;
          ctx.setTransform(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), px, py);
          ctx.drawImage(l.c, x - px, y - py);
        } else {
          // Still layers snap to whole pixels to stay crisp; swaying ones don't, so they move smoothly.
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(l.c, l.motion ? x : Math.round(x), l.motion ? y : Math.round(y));
        }
      }
      ctx.restore();
      if (fx.glow) this.drawLampGlow(ctx, o, skin, fx.glow);
    }
    for (const u of this.upcoming) {
      if (!this.buildLayers(u.o, theme, s, 1)) break;
    }
  }

  skinFor(o, theme) {
    const skins = theme.skins[o.name];
    return Array.isArray(skins) ? skins[Math.floor(o.seed * skins.length)] : skins;
  }

  // Renders o's layer sprites for this theme and canvas scale, at most `limit`
  // of them per call (the rest on later calls). Starts over if the theme or
  // scale changed. Layers are stored relative to o.x, so they follow the
  // obstacle wherever it is. Returns true once every layer is built.
  buildLayers(o, theme, s, limit = Infinity) {
    if (!o.layers || o.layersTheme !== theme || o.layersScale !== s) {
      this.releaseSprite(o);
      o.layerDefs = this.layersFor(o, this.skinFor(o, theme));
      o.layers = [];
      o.layersTheme = theme;
      o.layersScale = s;
    }
    for (; limit > 0 && o.layers.length < o.layerDefs.length; limit--) {
      const l = o.layerDefs[o.layers.length];
      o.layers.push({
        c: renderSprite(l.bounds, s, theme.obstacleFx, l.paint),
        relX: l.bounds.x - o.x,
        y: l.bounds.y,
        pivotRelX: l.pivot ? l.pivot.x - o.x : 0,
        pivotY: l.pivot ? l.pivot.y : 0,
        motion: l.motion,
      });
    }
    return o.layers.length === o.layerDefs.length;
  }

  // The layers an obstacle is drawn from, in order: each { paint, bounds } in
  // world coordinates, plus { pivot, motion } for a part that sways. Most
  // drawings are a single still layer.
  layersFor(o, skin) {
    if (skin === 'laundry') return this.laundryLayers(o);
    if (skin === 'laundryRow') return this.laundryRowLayers(o);
    if (skin === 'branch') return this.branchLayers(o);
    const paint = o.type === ObstacleType.OVERHEAD
      ? (c) => this.drawOverhead(c, o, skin)
      : (c) => this.drawGround(c, o, skin);
    return [{ paint, bounds: this.artBounds(o) }];
  }

  releaseSprite(o) {
    for (const l of o.layers || []) {
      if (spritePool.length < SPRITE_POOL_MAX) spritePool.push(l.c);
    }
    o.layers = null;
    o.layerDefs = null;
  }

  // World-space box that holds everything a drawing paints (posts, lamps, the
  // laundry tail and sway), with room for the outline.
  artBounds(o) {
    const pad = 8;
    const top = o.type === ObstacleType.OVERHEAD ? o.y - 12 : o.y;
    return { x: o.x - pad, y: top - pad, w: o.w + (o.tail || 0) + pad * 2, h: CONFIG.groundY - top + pad * 2 };
  }

  // A soft oval on the ground: tight under ground obstacles, wide and faint
  // under overhead ones (they are higher up, so their shadow is more diffuse).
  drawShadow(ctx, o, color) {
    const overhead = o.type === ObstacleType.OVERHEAD;
    ctx.save();
    ctx.fillStyle = color;
    if (overhead) ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, CONFIG.groundY + 1, o.w / 2 + (overhead ? 6 : 4), overhead ? 4 : 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Lamps a drawing has, as { x, y, r } in world coordinates.
  lampsFor(o, skin) {
    if (skin === 'barrier') return [{ x: o.x + 9, y: o.y - 3, r: 4 }, { x: o.x + o.w - 9, y: o.y - 3, r: 4 }];
    if (skin === 'cart') {
      const { hem, scallops } = this.cartLayout(o);
      return [{ x: o.x + o.w / scallops, y: hem + 9, r: 3.5 }]; // where the first two scallops meet
    }
    return [];
  }

  // Night: lamps glow and stay bright through the tint.
  drawLampGlow(ctx, o, skin, color) {
    for (const { x, y, r } of this.lampsFor(o, skin)) {
      const g = ctx.createRadialGradient(x, y, r / 2, x, y, r * 5.5);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.lamp;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Each shape is drawn to fill its collision box (o.x, o.y, o.w, o.h), so what
  // the player sees is what they can hit.
  drawGround(ctx, o, skin) {
    if (skin === 'hydrant') this.drawHydrant(ctx, o);
    else if (skin === 'cone') this.drawCone(ctx, o);
    else if (skin === 'trashcan') this.drawTrashcan(ctx, o);
    else this.drawDoghouse(ctx, o);
  }

  // Small ground obstacle: fire hydrant. Jump over it.
  drawHydrant(ctx, { x, y, w, h }) {
    const cx = x + w / 2;
    ctx.fillStyle = COLORS.hydrant;
    ctx.fillRect(x + 3, y + 12, w - 6, h - 12);      // body
    ctx.fillRect(x, y + 17, w, 7);                   // side nozzles
    ctx.fillRect(x, y + h - 5, w, 5);                // base
    ctx.beginPath();
    ctx.arc(cx, y + 12, w / 2 - 3, Math.PI, 0);      // dome
    ctx.fill();
    ctx.fillRect(cx - 2, y, 4, 4);                   // top knob
    ctx.fillStyle = COLORS.hydrantDark;
    ctx.fillRect(x + 3, y + 11, w - 6, 2);           // cap seam
    ctx.fillStyle = COLORS.shine;
    ctx.fillRect(x + 6, y + 15, 3, h - 24);
  }

  // Tall ground obstacle: traffic cone with white bands. Jump over it.
  drawCone(ctx, { x, y, w, h }) {
    const cx = x + w / 2;
    const top = y;
    const bottom = y + h - 5;
    const halfAt = (py) => ((w / 2 - 3) * (py - top)) / (bottom - top);
    ctx.fillStyle = COLORS.cone;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + halfAt(bottom), bottom);
    ctx.lineTo(cx - halfAt(bottom), bottom);
    ctx.fill();
    ctx.fillRect(x, bottom, w, 5);
    ctx.fillStyle = COLORS.coneBand;
    for (const [a, b] of [[0.3, 0.45], [0.6, 0.75]]) {
      const ya = top + (bottom - top) * a;
      const yb = top + (bottom - top) * b;
      ctx.beginPath();
      ctx.moveTo(cx - halfAt(ya), ya);
      ctx.lineTo(cx + halfAt(ya), ya);
      ctx.lineTo(cx + halfAt(yb), yb);
      ctx.lineTo(cx - halfAt(yb), yb);
      ctx.fill();
    }
  }

  // Ground obstacle: metal trash can with a lid and ridged sides. Jump over it.
  drawTrashcan(ctx, { x, y, w, h }) {
    const cx = x + w / 2;
    ctx.fillStyle = COLORS.can;
    ctx.beginPath();                                 // body, slightly tapered
    ctx.moveTo(x + 3, y + 7);
    ctx.lineTo(x + w - 3, y + 7);
    ctx.lineTo(x + w - 5, y + h);
    ctx.lineTo(x + 5, y + h);
    ctx.fill();
    ctx.fillStyle = COLORS.canDark;                  // ridges
    for (const f of [0.3, 0.5, 0.7]) {
      ctx.fillRect(x + w * f - 1, y + 11, 2, h - 15);
    }
    ctx.fillStyle = COLORS.canLid;
    ctx.fillRect(x, y + 3, w, 5);                    // lid
    ctx.fillRect(cx - 4, y, 8, 4);                   // handle
  }

  // Wide ground obstacle: doghouse with a bone by the door. One jump clears it.
  drawDoghouse(ctx, { x, y, w, h }) {
    const cx = x + w / 2;
    ctx.fillStyle = COLORS.houseWall;
    ctx.fillRect(x + 6, y + 14, w - 12, h - 14);
    ctx.fillStyle = COLORS.houseRoof;
    ctx.beginPath();
    ctx.moveTo(x, y + 17);
    ctx.lineTo(cx, y);
    ctx.lineTo(x + w, y + 17);
    ctx.fill();
    ctx.fillStyle = COLORS.houseDoor;                // arched doorway
    ctx.beginPath();
    ctx.moveTo(cx - 9, y + h);
    ctx.lineTo(cx - 9, y + h - 14);
    ctx.arc(cx, y + h - 14, 9, Math.PI, 0);
    ctx.lineTo(cx + 9, y + h);
    ctx.fill();
    ctx.fillStyle = COLORS.bone;                     // bone beside the door
    const bx = x + 14;
    const by = y + h - 7;
    ctx.fillRect(bx, by, 12, 3);
    for (const [dx, dy] of [[0, -1], [0, 3], [12, -1], [12, 3]]) {
      ctx.beginPath();
      ctx.arc(bx + dx, by + dy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Overhead drawings. Each is a solid shape from the obstacle's top edge down to
  // its bottom edge (the full collision box), with posts or legs standing in the
  // crawl gap below it. The dog is drawn in front of the legs. Laundry and tree
  // are built from layers (see layersFor) so their hanging parts can sway.
  drawOverhead(ctx, o, skin) {
    if (skin === 'barrier') this.drawBarrier(ctx, o);
    else this.drawCart(ctx, o);
  }

  // Legs or posts from the obstacle's bottom edge down to the ground.
  drawLegs(ctx, o, xs, width, color) {
    ctx.fillStyle = color;
    for (const x of xs) ctx.fillRect(o.x + x, o.y + o.h, width, CONFIG.groundY - o.y - o.h);
  }

  // Where the cart's umbrella hem and counter sit, shared with its lantern.
  cartLayout(o) {
    // One umbrella scallop per ~18px of width.
    return { hem: o.y + 42, counter: o.y + 62, scallops: Math.max(4, Math.round(o.w / 18)) };
  }

  // A hot dog cart: a striped umbrella on a pole over a steel cart with a hot
  // dog sign, standing on a wheel and a stand leg. A lantern hangs from the
  // umbrella. Crawl under the cart.
  drawCart(ctx, o) {
    const L = o.x;
    const R = o.x + o.w;
    const T = o.y;
    const B = o.y + o.h;
    const G = CONFIG.groundY;
    const cx = L + o.w / 2;
    const { hem, counter, scallops } = this.cartLayout(o);

    ctx.fillStyle = COLORS.post;                     // wheel on a strut, stand leg with a foot
    ctx.fillRect(L + 12, B, 3, G - B - 14);
    ctx.fillRect(R - 13, B, 4, G - B - 2);
    ctx.fillRect(R - 16, G - 3, 10, 3);
    ctx.beginPath();
    ctx.arc(L + 13.5, G - 9, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.steel;
    ctx.beginPath();
    ctx.arc(L + 13.5, G - 9, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.steel;                    // umbrella pole
    ctx.fillRect(cx - 1.5, hem - 6, 3, counter - hem + 6);

    ctx.fillRect(L + 2, counter, o.w - 4, B - counter); // cart body
    ctx.fillStyle = COLORS.canLid;                   // counter top
    ctx.fillRect(L, counter, o.w, 6);
    ctx.fillStyle = COLORS.boardDark;                // panel seams and skirt
    for (const f of [1 / 3, 2 / 3]) ctx.fillRect(L + o.w * f - 1, counter + 44, 2, B - counter - 50);
    ctx.fillStyle = COLORS.post;
    ctx.fillRect(L + 2, B - 6, o.w - 4, 6);
    ctx.fillStyle = COLORS.sign;                     // sign with a hot dog
    ctx.beginPath();
    const signW = Math.min(o.w - 12, 58);
    ctx.roundRect(cx - signW / 2, counter + 12, signW, 26, 4);
    ctx.fill();
    this.drawHotDog(ctx, cx, counter + 25);

    // Umbrella: a dome with a scalloped hem, in red and cream wedges.
    const canopy = new Path2D();
    canopy.moveTo(L, hem);
    canopy.quadraticCurveTo(L + 2, T + 4, cx, T);
    canopy.quadraticCurveTo(R - 2, T + 4, R, hem);
    const n = scallops;
    for (let i = n - 1; i >= 0; i--) {
      const sx = L + (o.w * (i + 0.5)) / n;
      canopy.arc(sx, hem, o.w / n / 2, 0, Math.PI);
    }
    canopy.closePath();
    ctx.fillStyle = COLORS.barrierWhite;
    ctx.fill(canopy);
    ctx.save();
    ctx.clip(canopy);
    ctx.fillStyle = COLORS.barrierRed;
    for (let i = 0; i < 6; i += 2) {
      ctx.beginPath();
      ctx.moveTo(cx, T - 10);
      ctx.lineTo(L - 10 + ((o.w + 20) * i) / 6, hem + 12);
      ctx.lineTo(L - 10 + ((o.w + 20) * (i + 1)) / 6, hem + 12);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = COLORS.steel;                    // finial
    ctx.beginPath();
    ctx.arc(cx, T - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    const [lamp] = this.lampsFor(o, 'cart');         // lantern on a cord
    ctx.fillStyle = COLORS.post;
    ctx.fillRect(lamp.x - 0.5, hem + 2, 1, lamp.y - hem - 4);
    ctx.fillRect(lamp.x - 2.5, lamp.y - lamp.r - 1.5, 5, 2);
    ctx.fillStyle = COLORS.lamp;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // A hot dog in a bun with a mustard zigzag, centred on (cx, cy).
  drawHotDog(ctx, cx, cy) {
    ctx.fillStyle = COLORS.bun;
    ctx.beginPath();
    ctx.roundRect(cx - 14, cy - 3, 28, 9, 4.5);
    ctx.fill();
    ctx.fillStyle = COLORS.sausage;
    ctx.beginPath();
    ctx.roundRect(cx - 17, cy - 6, 34, 7, 3.5);
    ctx.fill();
    ctx.strokeStyle = COLORS.mustard;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 3);
    for (let i = 1; i <= 8; i++) ctx.lineTo(cx - 12 + i * 3, cy - 3 + (i % 2 ? -2 : 1));
    ctx.stroke();
  }

  // A road-works gantry: steel frame with a warning sign on top, a red and white
  // striped bar below it and amber lamps. Crawl under the bar.
  drawBarrier(ctx, o) {
    const bottom = o.y + o.h;
    const barTop = bottom - 40;
    this.drawLegs(ctx, o, [6, o.w - 12], 6, COLORS.post);

    ctx.fillStyle = COLORS.steel;
    ctx.fillRect(o.x, o.y, o.w, barTop - o.y);
    ctx.fillStyle = COLORS.boardDark;                // rivet lines
    for (let sx = o.x + 10; sx < o.x + o.w - 4; sx += 22) {
      ctx.fillRect(sx, o.y, 3, barTop - o.y);
    }
    const cx = o.x + o.w / 2;                        // warning triangle
    const cy = o.y + (barTop - o.y) / 2;
    ctx.fillStyle = COLORS.lamp;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx + 22, cy + 16);
    ctx.lineTo(cx - 22, cy + 16);
    ctx.fill();
    ctx.fillStyle = COLORS.houseDoor;
    ctx.fillRect(cx - 2, cy - 8, 4, 14);
    ctx.fillRect(cx - 2, cy + 9, 4, 4);

    ctx.save();
    ctx.beginPath();
    ctx.rect(o.x, barTop, o.w, 40);
    ctx.clip();
    ctx.fillStyle = COLORS.barrierWhite;
    ctx.fillRect(o.x, barTop, o.w, 40);
    ctx.fillStyle = COLORS.barrierRed;               // diagonal stripes
    for (let sx = o.x - 40; sx < o.x + o.w; sx += 26) {
      ctx.beginPath();
      ctx.moveTo(sx, bottom);
      ctx.lineTo(sx + 13, bottom);
      ctx.lineTo(sx + 53, barTop);
      ctx.lineTo(sx + 40, barTop);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = COLORS.lamp;
    ctx.beginPath();
    ctx.arc(o.x + 9, o.y - 3, 4, 0, Math.PI * 2);
    ctx.arc(o.x + o.w - 9, o.y - 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Washing-line poles and the line itself, standing on the ground with the line
  // just above the obstacle's top edge. `span` is the line's length.
  drawLaundryLine(ctx, o, span = o.w) {
    ctx.fillStyle = COLORS.peg;
    ctx.fillRect(o.x, o.y - 6, 4, CONFIG.groundY - o.y + 6);
    ctx.fillRect(o.x + span - 4, o.y - 6, 4, CONFIG.groundY - o.y + 6);
    ctx.strokeStyle = COLORS.boardDark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(o.x + 2, o.y - 3);
    ctx.lineTo(o.x + span - 2, o.y - 3);
    ctx.stroke();
  }

  // A clothes peg on the line at x.
  drawPeg(ctx, x, y) {
    ctx.fillStyle = COLORS.pegLight;
    ctx.fillRect(x - 2, y - 4, 4, 9);
  }

  // The poles and line as a layer. `span` is the line's length.
  lineLayer(o, span) {
    return { paint: (c) => this.drawLaundryLine(c, o, span), bounds: box(o.x, o.y - 6, span, CONFIG.groundY - o.y + 6) };
  }

  // One item hanging from the line, x..x+w and h tall from the line down, with
  // its two pegs 6px in from each side. It swings gently about its middle on
  // the line (cx) as it scrolls; the pegs move with it, too little to see.
  hangingLayer(o, cx, x, w, h, paint, pegInset = 6) {
    return {
      paint: (c) => {
        paint(c);
        this.drawPeg(c, x + pegInset, o.y - 3);
        this.drawPeg(c, x + w - pegInset, o.y - 3);
      },
      bounds: box(x, o.y - 7, w, h + 7),
      pivot: { x: cx, y: o.y - 3 },
      motion: (ob) => ({ angle: Math.sin(ob.x * 0.05) * 0.025 }),
    };
  }

  // A pair of trousers (or shorts, if short) hung by the waistband: waistband,
  // belt loops, two legs and cuffs. Fills x..x+w from `top` down to `bottom`.
  drawPants(ctx, { x, w, top, bottom, fill, dark, stitch }) {
    const mid = x + w / 2;
    const height = bottom - top;
    const crotch = top + Math.min(40, height * 0.6);
    const band = height > 60 ? 9 : 6;
    const cuff = height > 60 ? 7 : 4;
    ctx.fillStyle = fill;
    ctx.fillRect(x, top, w, crotch - top + 2);                            // hips
    ctx.fillRect(x, crotch, mid - x - 1.5, bottom - crotch);               // left leg
    ctx.fillRect(mid + 1.5, crotch, x + w - mid - 1.5, bottom - crotch);   // right leg
    ctx.fillStyle = dark;                                                  // waistband and cuffs
    ctx.fillRect(x, top, w, band);
    ctx.fillRect(x, bottom - cuff, mid - x - 1.5, cuff);
    ctx.fillRect(mid + 1.5, bottom - cuff, x + w - mid - 1.5, cuff);
    for (const lx of [x + 4, mid - 1.5, x + w - 7]) {                      // belt loops
      ctx.fillRect(lx, top - 2, 3, band + 3);
    }
    if (height <= 60) return;
    ctx.strokeStyle = stitch;                                              // fly, pocket and seam stitching
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(mid, top + 10);
    ctx.lineTo(mid, crotch - 6);
    ctx.moveTo(x + 4, top + 14);
    ctx.quadraticCurveTo(x + 4, top + 28, x + 14, top + 30);
    ctx.moveTo(x + w - 4, top + 14);
    ctx.quadraticCurveTo(x + w - 4, top + 28, x + w - 14, top + 30);
    ctx.moveTo(mid - w * 0.15, crotch + 4);
    ctx.lineTo(mid - w * 0.15, bottom - 10);
    ctx.moveTo(mid + w * 0.15, crotch + 4);
    ctx.lineTo(mid + w * 0.15, bottom - 10);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // A T-shirt hung by the shoulders: neckline notch, sleeves, body and hem.
  // x..x+w includes the sleeves; the body is the middle 55%.
  drawShirt(ctx, { x, w, top, h, fill, dark }) {
    const body = w * 0.55;
    const bx = x + (w - body) / 2;
    const sleeve = Math.min(h * 0.55, w * 0.55);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, top + 2);
    ctx.lineTo(x + w * 0.31, top);
    ctx.quadraticCurveTo(x + w / 2, top + 12, x + w * 0.69, top);
    ctx.lineTo(x + w, top + 2);
    ctx.lineTo(x + w, top + sleeve);
    ctx.lineTo(bx + body, top + sleeve + 2);
    ctx.lineTo(bx + body, top + h);
    ctx.lineTo(bx, top + h);
    ctx.lineTo(bx, top + sleeve + 2);
    ctx.lineTo(x, top + sleeve);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dark;                                                  // collar rib and hem
    ctx.beginPath();
    ctx.moveTo(x + w * 0.31, top);
    ctx.quadraticCurveTo(x + w / 2, top + 12, x + w * 0.69, top);
    ctx.lineTo(x + w * 0.69, top + 3);
    ctx.quadraticCurveTo(x + w / 2, top + 15, x + w * 0.31, top + 3);
    ctx.fill();
    ctx.fillRect(bx, top + h - 5, body, 5);
  }

  // A striped towel hung by one edge, with a fringe at the bottom.
  drawTowel(ctx, { x, w, top, bottom, fill }) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, top, w, bottom - top - 5);
    ctx.fillStyle = COLORS.towelStripe;              // stripes: shape cue, not just color
    for (let y = top + 8; y < bottom - 12; y += 20) {
      ctx.fillRect(x, y, w, 9);
    }
    for (let fx = x + 1; fx < x + w - 2; fx += 5) {
      ctx.fillRect(fx, bottom - 5, 3, 5);
    }
  }

  // Short overhead (day): long laundry items side by side on a washing line,
  // one per ~44px of width (two at the default width): trousers in random
  // colors, or sometimes striped towels, never all towels. Fixed per obstacle
  // by its seed. Crawl under them.
  laundryLayers(o) {
    const rand = seeded(o.seed);
    const bottom = o.y + o.h;
    const n = Math.max(1, Math.round(o.w / 44));
    const slot = (o.w - 10) / n;                    // the line between the poles, split evenly
    const items = Array.from({ length: n }, () => {
      const towel = rand() < 0.3;
      return { towel, style: pick(towel ? TOWELS : PANTS, rand) };
    });
    if (items.every((item) => item.towel)) items[0] = { towel: false, style: pick(PANTS, rand) };
    return [
      this.lineLayer(o, o.w),
      ...items.map(({ towel, style }, i) => {
        const cx = o.x + 5 + slot * (i + 0.5);
        const w = slot - (towel ? 9 : 2);
        const x = cx - w / 2;
        return this.hangingLayer(o, cx, x, w, bottom - o.y, (c) => {
          if (towel) this.drawTowel(c, { x, w, top: o.y, bottom, fill: style });
          else this.drawPants(c, { x, w, top: o.y, bottom, ...style });
        });
      }),
    ];
  }

  // Wide overhead (day): a washing line. Three long items (trousers or towels,
  // random colors) hang first and cover the whole collision box. Then come up to
  // four normal-length shirts and shorts, past the box, which only decorate: the
  // dog passes under them standing up (see `tail` in config.js). Everything is
  // fixed per obstacle by its seed, so a row never changes as it scrolls past.
  laundryRowLayers(o) {
    const rand = seeded(o.seed);
    const bottom = o.y + o.h;

    const longs = [25, 68, 109].map((center) => {
      const towel = rand() < 0.35;
      return { center, towel, style: pick(towel ? TOWELS : PANTS, rand) };
    });
    if (longs.every((item) => item.towel)) longs[0] = { center: 25, towel: false, style: pick(PANTS, rand) };

    const shorts = [];
    let cursor = 8;
    for (let i = 0, want = Math.floor(rand() * 5); i < want; i++) {
      const shirt = rand() < 0.6;
      const w = shirt ? 40 : 30;
      if (cursor + w > o.tail - 8) break;
      shorts.push({ shirt, x: cursor, w, h: 46 + Math.floor(rand() * 3) * 4, style: pick(shirt ? SHIRTS : SHORTS, rand) });
      cursor += w + 12;
    }
    // The end pole stands just past the last item (or just past the box if there are none).
    const span = o.w + (shorts.length ? cursor - 2 : 6);
    const layers = [this.lineLayer(o, span)];

    for (const { center, towel, style } of longs) {
      const w = towel ? 32 : 40;
      const x = o.x + center - w / 2;
      layers.push(this.hangingLayer(o, o.x + center, x, w, bottom - o.y, (c) => {
        if (towel) this.drawTowel(c, { x, w, top: o.y, bottom, fill: style });
        else this.drawPants(c, { x, w, top: o.y, bottom, ...style });
      }));
    }

    const tailX = o.x + o.w;
    for (const item of shorts) {
      const x = tailX + item.x;
      const h = item.shirt ? item.h : 34;
      layers.push(this.hangingLayer(o, x + item.w / 2, x, item.w, h, (c) => {
        if (item.shirt) this.drawShirt(c, { x, w: item.w, top: o.y, h, ...item.style });
        else this.drawPants(c, { x, w: item.w, top: o.y, bottom: o.y + h, ...item.style });
      }));
    }
    return layers;
  }

  // A tree with a low limb reaching out over the track. The leafy crown fills
  // the collision box, the trunk stands at the right end, and the limb runs left
  // along the crown's underside. Leaf clusters hang from the limb down to the
  // box's bottom edge and sway (separate layers). Crawl under them.
  branchLayers(o) {
    const bottom = o.y + o.h;
    const leaves = [0.1, 0.36, 0.62].map((f) => {
      const cx = o.x + o.w * f;
      return {
        paint: (c) => this.drawLeafCluster(c, cx, bottom - 7),
        bounds: box(cx - 9, bottom - 18, 18, 20),
        motion: (ob) => ({ dx: Math.sin(ob.x * 0.04 + f * 9) * 1.5 }),
      };
    });
    // Own bounds: the tree has no tail, unlike the laundry row on the same variant.
    const tree = box(o.x, o.y, o.w, CONFIG.groundY - o.y, 8);
    return [{ paint: (c) => this.drawTree(c, o), bounds: tree }, ...leaves];
  }

  // Trunk, limb and crown. The crown is a union of round clumps (bumpy
  // silhouette), shaded darker underneath and lighter on top, with apples.
  drawTree(ctx, o) {
    const L = o.x;
    const R = o.x + o.w;
    const T = o.y;
    const B = o.y + o.h;
    const G = CONFIG.groundY;

    ctx.fillStyle = COLORS.trunk;                    // tapered trunk with a root flare
    ctx.beginPath();
    ctx.moveTo(R - 40, G);
    ctx.quadraticCurveTo(R - 30, G - 4, R - 30, G - 16);
    ctx.lineTo(R - 28, T + 50);
    ctx.lineTo(R - 13, T + 50);
    ctx.lineTo(R - 12, G - 16);
    ctx.quadraticCurveTo(R - 12, G - 4, R - 3, G);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.boardDark;              // bark lines
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(R - 24, G - 4);
    ctx.quadraticCurveTo(R - 22, B + 12, R - 24, B - 4);
    ctx.moveTo(R - 18, G - 10);
    ctx.quadraticCurveTo(R - 16, B + 18, R - 18, B + 4);
    ctx.stroke();

    ctx.fillStyle = COLORS.trunk;                    // limb, thick at the trunk, thin at the tip
    ctx.beginPath();
    ctx.moveTo(R - 26, B - 32);
    ctx.quadraticCurveTo(L + o.w * 0.45, B - 30, L + 2, B - 24);
    ctx.quadraticCurveTo(L - 2, B - 20, L + 3, B - 18);
    ctx.quadraticCurveTo(L + o.w * 0.45, B - 19, R - 26, B - 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.boardDark;                // knot
    ctx.beginPath();
    ctx.ellipse(L + o.w * 0.5, B - 21, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crown clumps: three rows of overlapping circles, nudged up and down. The
    // top row is inset so the crown rounds into a dome.
    const clumps = [];
    for (const [y, r, inset] of [[T + 24, 24, 14], [T + 58, 30, -6], [B - 50, 24, -2]]) {
      const n = Math.max(2, Math.round((o.w - 2 * inset) / (r * 1.3)));
      const x0 = L + r + inset;
      const x1 = R - r - inset;
      for (let i = 0; i < n; i++) {
        clumps.push({ x: x0 + ((x1 - x0) * i) / (n - 1), y: y + (i % 2 ? 3 : -3), r });
      }
    }
    const crown = new Path2D();
    for (const c of clumps) {
      crown.moveTo(c.x + c.r, c.y);
      crown.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    }
    ctx.fillStyle = COLORS.leaf;
    ctx.fill(crown);
    ctx.save();
    ctx.clip(crown);
    // Shade: one band across the lower crown with a scalloped top edge.
    const shadeY = T + (B - T) * 0.52;
    ctx.fillStyle = COLORS.leafDark;
    ctx.beginPath();
    ctx.rect(L - 10, shadeY, o.w + 20, B - shadeY);
    for (let sx = L - 4; sx < R + 10; sx += 22) {
      ctx.moveTo(sx + 13, shadeY);
      ctx.arc(sx, shadeY, 13, 0, Math.PI, true);
    }
    ctx.fill();
    // Sunlit tops on the upper clumps.
    ctx.fillStyle = COLORS.leafLight;
    for (const c of clumps.filter((c) => c.y < T + 40)) {
      ctx.beginPath();
      ctx.arc(c.x - c.r * 0.2, c.y - c.r * 0.35, c.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const [fx, fy] of [[0.22, 0.5], [0.55, 0.28], [0.78, 0.58]]) {
      const ax = L + o.w * fx;
      const ay = T + (B - 30 - T) * fy;
      ctx.fillStyle = COLORS.apple;
      ctx.beginPath();
      ctx.arc(ax, ay, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.shine;
      ctx.beginPath();
      ctx.arc(ax - 1.5, ay - 1.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.trunk;                  // stem
      ctx.fillRect(ax - 0.5, ay - 7, 1.5, 3);
    }
  }

  // Three leaves hanging tip-down from a short stem; the stem's top (cy - 11)
  // meets the limb, the leaf tips reach about cy + 7.
  drawLeafCluster(ctx, cx, cy) {
    ctx.strokeStyle = COLORS.trunk;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11);
    ctx.lineTo(cx, cy - 4);
    ctx.stroke();
    ctx.fillStyle = COLORS.leaf;
    for (const [dx, rot] of [[-4, 0.55], [4, -0.55], [0, 0]]) {
      // A leaf: pointed at the bottom, round at the stem.
      ctx.save();
      ctx.translate(cx + dx * 0.5, cy - 4);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(5, 3, 0, 11);
      ctx.quadraticCurveTo(-5, 3, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  }
}
