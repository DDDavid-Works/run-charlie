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
  leafDark: 'rgba(27, 31, 42, 0.3)',
  trunk: '#6b4a2f',
  apple: '#ff6b6b',
  kites: ['#ff6b6b', '#ffd23f', '#5ac8e0'],
  board: '#5b86a8',
  boardDark: 'rgba(27, 31, 42, 0.4)',
  houseCream: '#f6f1e6',
  flower: '#ff9ec2',
  bench: '#a8703a',
  benchSeat: '#c98f55',
  benchLeg: '#3a3f4e',
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
    this.list = [];
    // The next variant is chosen one spawn ahead so the gap that precedes it
    // can account for a jump <-> slide switch.
    this.nextName = pickVariant(0, this.rng);
    // distance (px) still to travel before the next obstacle spawns
    this.distanceToNext = CONFIG.speed.start * O.firstSpawnDelay;
  }

  update(dt, speed, score = 0) {
    const dx = speed * dt;
    for (const o of this.list) o.x -= dx;
    // `tail` is decoration trailing past the hitbox; keep it until it has scrolled off too.
    this.list = this.list.filter((o) => o.x + o.w + (o.tail || 0) > 0);

    this.distanceToNext -= dx;
    if (this.distanceToNext <= 0) {
      const tier = tierFor(score);
      const o = this.spawn(this.nextName);
      this.nextName = pickVariant(tier, this.rng);
      const switched = O.variants[this.nextName].type !== o.type;
      const gap = gapSeconds(tier, switched, this.rng);
      // Speed keeps rising during the gap, so size it at the speed it will have
      // reached by then; at the current speed the gap would arrive early.
      const arrivalSpeed = Math.min(CONFIG.speed.max, speed + CONFIG.speed.accel * gap);
      // + o.w so the gap is edge to edge rather than spawn point to spawn point.
      this.distanceToNext = arrivalSpeed * gap + o.w;
    }
  }

  spawn(name) {
    const v = O.variants[name];
    const x = CONFIG.canvas.width;
    // seed fixes per-obstacle looks (which skin, laundry colors); from this.rng so seeded runs repeat.
    const seed = this.rng();
    const o =
      v.type === ObstacleType.OVERHEAD
        ? { name, type: v.type, x, y: overheadTop(), w: v.w, h: CONFIG.groundY - O.overheadClearance - overheadTop(), tail: v.tail || 0, seed }
        : { name, type: v.type, x, y: CONFIG.groundY - v.h, w: v.w, h: v.h, posts: v.posts || 1, seed };
    this.list.push(o);
    return o;
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
  draw(ctx, theme) {
    for (const o of this.list) {
      const skins = theme.skins[o.name];
      const skin = Array.isArray(skins) ? skins[Math.floor(o.seed * skins.length)] : skins;
      if (o.type === ObstacleType.OVERHEAD) this.drawOverhead(ctx, o, skin);
      else this.drawGround(ctx, o, skin);
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
  // crawl gap below it. The dog is drawn in front of the legs. Hanging parts
  // sway a little as they scroll past.
  drawOverhead(ctx, o, skin) {
    if (skin === 'barrier') this.drawBarrier(ctx, o);
    else if (skin === 'laundry') this.drawLaundry(ctx, o);
    else if (skin === 'laundryRow') this.drawLaundryRow(ctx, o);
    else if (skin === 'branch') this.drawBranch(ctx, o);
    else this.drawBench(ctx, o);
  }

  // Legs or posts from the obstacle's bottom edge down to the ground.
  drawLegs(ctx, o, xs, width, color) {
    ctx.fillStyle = color;
    for (const x of xs) ctx.fillRect(o.x + x, o.y + o.h, width, CONFIG.groundY - o.y - o.h);
  }

  // A park bench with a tall hedge growing up its back. Crawl under the seat.
  drawBench(ctx, o) {
    const bottom = o.y + o.h;
    const seatY = bottom - 10;
    const backTop = seatY - 46;
    this.drawLegs(ctx, o, [5, o.w - 10], 5, COLORS.benchLeg);

    ctx.fillStyle = COLORS.leaf;                     // hedge
    ctx.beginPath();
    ctx.roundRect(o.x + 2, o.y, o.w - 4, backTop - o.y + 2, [16, 16, 0, 0]);
    ctx.fill();
    ctx.fillStyle = COLORS.leafDark;                 // clipped-hedge stripes
    for (let sx = o.x + 10; sx < o.x + o.w - 8; sx += 12) {
      ctx.fillRect(sx, o.y + 14, 3, backTop - o.y - 14);
    }
    ctx.fillStyle = COLORS.flower;
    for (const [fx, fy] of [[0.25, 0.3], [0.7, 0.2], [0.5, 0.6], [0.8, 0.75], [0.2, 0.8]]) {
      ctx.beginPath();
      ctx.arc(o.x + o.w * fx, o.y + (backTop - o.y) * fy + 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = COLORS.bench;                    // slatted backrest
    ctx.fillRect(o.x, backTop, o.w, seatY - backTop);
    ctx.fillStyle = COLORS.boardDark;
    for (let y = backTop + 11; y < seatY - 4; y += 12) {
      ctx.fillRect(o.x, y, o.w, 2);
    }
    ctx.fillStyle = COLORS.benchSeat;                // seat plank
    ctx.fillRect(o.x - 2, seatY, o.w + 4, 10);
  }

  // A road-works gantry: steel frame with a warning sign on top, a red and white
  // striped bar below it and amber lamps. Crawl under the bar.
  drawBarrier(ctx, o) {
    const bottom = o.y + o.h;
    const barTop = bottom - 40;
    this.drawLegs(ctx, o, [6, o.w - 12], 6, COLORS.benchLeg);

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

  // Swing an item gently about the washing line so the laundry sways.
  hangFromLine(ctx, o, cx, draw) {
    ctx.save();
    ctx.translate(cx, o.y - 3);
    ctx.rotate(Math.sin(o.x * 0.05) * 0.025);
    ctx.translate(-cx, -(o.y - 3));
    draw();
    ctx.restore();
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

  // Short overhead (day): one long laundry item on a washing line: a pair of
  // trousers in a random color, or sometimes a striped towel. Which one is fixed
  // per obstacle by its seed. Crawl under it.
  drawLaundry(ctx, o) {
    const rand = seeded(o.seed);
    const bottom = o.y + o.h;
    this.drawLaundryLine(ctx, o);
    const towel = rand() < 0.3;
    const style = pick(towel ? TOWELS : PANTS, rand);
    this.hangFromLine(ctx, o, o.x + o.w / 2, () => {
      if (towel) this.drawTowel(ctx, { x: o.x + 11, w: o.w - 22, top: o.y, bottom, fill: style });
      else this.drawPants(ctx, { x: o.x + 7, w: o.w - 14, top: o.y, bottom, ...style });
    });
    this.drawPeg(ctx, o.x + 12, o.y - 3);
    this.drawPeg(ctx, o.x + o.w - 12, o.y - 3);
  }

  // Wide overhead (day): a washing line. Three long items (trousers or towels,
  // random colors) hang first and cover the whole collision box. Then come up to
  // four normal-length shirts and shorts, past the box, which only decorate: the
  // dog passes under them standing up (see `tail` in config.js). Everything is
  // fixed per obstacle by its seed, so a row never changes as it scrolls past.
  drawLaundryRow(ctx, o) {
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
    this.drawLaundryLine(ctx, o, span);

    for (const { center, towel, style } of longs) {
      const w = towel ? 32 : 40;
      const x = o.x + center - w / 2;
      this.hangFromLine(ctx, o, o.x + center, () => {
        if (towel) this.drawTowel(ctx, { x, w, top: o.y, bottom, fill: style });
        else this.drawPants(ctx, { x, w, top: o.y, bottom, ...style });
      });
      this.drawPeg(ctx, x + 6, o.y - 3);
      this.drawPeg(ctx, x + w - 6, o.y - 3);
    }

    const tailX = o.x + o.w;
    for (const item of shorts) {
      const x = tailX + item.x;
      this.hangFromLine(ctx, o, x + item.w / 2, () => {
        if (item.shirt) this.drawShirt(ctx, { x, w: item.w, top: o.y, h: item.h, ...item.style });
        else this.drawPants(ctx, { x, w: item.w, top: o.y, bottom: o.y + 34, ...item.style });
      });
      this.drawPeg(ctx, x + 6, o.y - 3);
      this.drawPeg(ctx, x + item.w - 6, o.y - 3);
    }
  }

  // A tree with a low branch reaching out over the track: leafy crown, a thick
  // bark limb across the bottom with a knot and hanging leaves. The trunk stands
  // at the right end. Crawl under the limb.
  drawBranch(ctx, o) {
    const bottom = o.y + o.h;
    const hem = bottom - 34;
    ctx.fillStyle = COLORS.trunk;                    // trunk in the crawl gap
    ctx.fillRect(o.x + o.w - 20, hem, 14, CONFIG.groundY - hem);

    ctx.fillStyle = COLORS.leaf;                     // crown
    ctx.beginPath();
    ctx.roundRect(o.x, o.y, o.w, hem - o.y - 4, [26, 26, 0, 0]);
    ctx.fill();
    const bumps = Math.round(o.w / 16);
    const bw = o.w / bumps;
    for (let i = 0; i < bumps; i++) {
      ctx.beginPath();
      ctx.arc(o.x + bw * (i + 0.5), hem - 6, bw / 2 + 1, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.leafDark;                 // stripes: shape cue, not just color
    for (let sx = o.x + 8; sx < o.x + o.w - 8; sx += 14) {
      ctx.fillRect(sx, o.y + 18, 4, hem - o.y - 26);
    }

    ctx.fillStyle = COLORS.trunk;                    // limb with bark lines and a knot
    ctx.beginPath();
    ctx.roundRect(o.x, hem - 4, o.w, 12, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.boardDark;
    for (let sx = o.x + 10; sx < o.x + o.w - 8; sx += 18) {
      ctx.fillRect(sx, hem - 2, 8, 2);
    }
    ctx.beginPath();
    ctx.arc(o.x + o.w * 0.7, hem + 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.leaf;
    for (const f of [0.2, 0.45, 0.85]) {
      const sway = Math.sin(o.x * 0.04 + f * 9) * 2;
      ctx.beginPath();
      ctx.ellipse(o.x + o.w * f + sway, hem + 14, 5, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
