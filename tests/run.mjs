// Headless checks for spawn fairness, difficulty, and storage. Run: node tests/run.mjs
import assert from 'node:assert/strict';
import { CONFIG } from '../scripts/config.js';
import { Player } from '../scripts/player.js';
import { ObstacleManager, tierFor } from '../scripts/obstacles.js';
import { loadBest, saveBest } from '../scripts/storage.js';
import { formatScore } from '../scripts/format.js';

let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n     ${e.message}`);
  }
}

// Small seeded RNG so runs are repeatable.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hit = (a, o) => a.x < o.x + o.w && a.x + a.w > o.x && a.y < o.y + o.h && a.y + a.h > o.y;
const PLAYER_RIGHT = CONFIG.player.x + CONFIG.player.hitbox.insetX + CONFIG.player.width - CONFIG.player.hitbox.insetX * 2;
const PLAYER_LEFT = CONFIG.player.x + CONFIG.player.hitbox.insetX;

// Simulates a run. If `bot` is true a simple player reacts to each obstacle at a
// fixed lead time; returns what happened.
function simulate({ seed, seconds, dt, bot }) {
  const rng = mulberry32(seed);
  const m = new ObstacleManager(rng);
  const p = new Player();
  let speed = CONFIG.speed.start;
  let distance = 0;
  let time = 0;
  const spawns = [];
  const seen = new Set();
  let collision = null;

  const handled = new WeakSet();
  while (time < seconds && !collision) {
    speed = Math.min(CONFIG.speed.max, speed + CONFIG.speed.accel * dt);
    distance += speed * dt;
    const score = Math.floor(distance / CONFIG.score.pixelsPerPoint);
    m.update(dt, speed, score);
    for (const o of m.list) {
      if (!seen.has(o)) {
        seen.add(o);
        spawns.push({ o, time, score, speed });
      }
    }

    if (bot) {
      for (const o of m.list) {
        const tta = (o.x - PLAYER_RIGHT) / speed; // time until it reaches the player
        if (o.type === 'ground' && !handled.has(o) && tta <= 0.2 && tta > 0 && p.grounded) {
          p.jump(false);
          handled.add(o);
        } else if (o.type === 'overhead' && !handled.has(o) && tta <= 0.15) {
          p.pressSlide();
          handled.add(o);
        }
        if (o.type === 'overhead' && handled.has(o) && o.x + o.w < PLAYER_LEFT) p.releaseSlide();
      }
    }

    const hb = p.hitbox;
    p.update(dt, m.overheadAbove(hb.x, hb.x + hb.w));
    const box = p.hitbox;
    const o = m.list.find((ob) => hit(box, ob));
    if (o) collision = { time, name: o.name, score };
    time += dt;
  }
  return { spawns, collision, finalSpeed: speed, finalScore: Math.floor(distance / CONFIG.score.pixelsPerPoint) };
}

test('tiers unlock by score', () => {
  assert.equal(tierFor(0), 0);
  assert.equal(tierFor(249), 0);
  assert.equal(tierFor(250), 1);
  assert.equal(tierFor(1100), 3);
  assert.equal(tierFor(1e6), CONFIG.obstacle.tiers.length - 1);
});

test('early run is ground-only; overhead and doubles appear only once unlocked', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { spawns } = simulate({ seed, seconds: 120, dt: 1 / 60, bot: false });
    // (collision stops the run, so simulate with a bot below for long runs)
    for (const s of spawns) {
      if (s.score < 250) assert.notEqual(s.o.type, 'overhead', `overhead at score ${s.score}`);
      if (s.score < 600) assert.ok(!['double', 'overheadWide'].includes(s.o.name), `${s.o.name} at score ${s.score}`);
    }
  }
});

test('edge-to-edge gap between obstacles never drops below the minimum', () => {
  let checked = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { spawns } = simulate({ seed, seconds: 150, dt: 1 / 60, bot: true });
    for (let i = 1; i < spawns.length; i++) {
      const prev = spawns[i - 1];
      const cur = spawns[i];
      // Distance between spawn points, minus the previous obstacle's width, over the speed there.
      const elapsed = cur.time - prev.time;
      const avgSpeed = (prev.speed + cur.speed) / 2;
      const clearanceSeconds = (elapsed * avgSpeed - prev.o.w) / cur.speed;
      // Steps inside a combo use the combo's own tighter gap (tested below).
      if (cur.o.comboStep > 0) {
        const planned = CONFIG.obstacle.combos[cur.o.combo].gaps[cur.o.comboStep - 1];
        assert.ok(clearanceSeconds >= planned - 0.02, `seed ${seed}: ${cur.o.combo} gap ${clearanceSeconds.toFixed(3)}s`);
        continue;
      }
      assert.ok(
        clearanceSeconds >= CONFIG.obstacle.minGapSeconds - 0.02,
        `seed ${seed}: gap ${clearanceSeconds.toFixed(3)}s between ${prev.o.name} and ${cur.o.name}`
      );
      if (prev.o.type !== cur.o.type) {
        assert.ok(
          clearanceSeconds >= CONFIG.obstacle.minGapSeconds + CONFIG.obstacle.typeSwitchExtraGap - 0.02,
          `seed ${seed}: switch gap ${clearanceSeconds.toFixed(3)}s`
        );
      }
      checked++;
    }
  }
  assert.ok(checked > 500, `only ${checked} gaps checked`);
});

test("a run's first overhead appears alone, with extra space before and after it", () => {
  const O = CONFIG.obstacle;
  // Edge-to-edge seconds between two spawns, as in the gap test above.
  const clearance = (a, b) => ((b.time - a.time) * ((a.speed + b.speed) / 2) - a.o.w) / b.speed;
  for (let seed = 1; seed <= 30; seed++) {
    const { spawns } = simulate({ seed, seconds: 60, dt: 1 / 60, bot: true });
    const i = spawns.findIndex((s) => s.o.type === 'overhead');
    assert.ok(i > 0 && i < spawns.length - 1, `seed ${seed}: no overhead with neighbours`);
    assert.ok(spawns[i].o.intro, `seed ${seed}: first overhead not marked as intro`);
    assert.equal(spawns.filter((s) => s.o.intro).length, 1, `seed ${seed}: more than one intro`);
    const before = clearance(spawns[i - 1], spawns[i]);
    const after = clearance(spawns[i], spawns[i + 1]);
    const want = O.minGapSeconds + O.typeSwitchExtraGap + O.firstOverheadExtraGap - 0.02;
    assert.ok(before >= want, `seed ${seed}: ${before.toFixed(3)}s before the first overhead`);
    // After it the next one may be another overhead (no switch), so no switch extra is owed.
    assert.ok(after >= want - O.typeSwitchExtraGap, `seed ${seed}: ${after.toFixed(3)}s after the first overhead`);
  }
  // A restart introduces the slide again.
  const m = new ObstacleManager(mulberry32(3));
  m.overheadSeen = true;
  m.reset();
  assert.equal(m.overheadSeen, false);
});

test('a reactive bot survives long runs at several frame rates (no unavoidable sequences)', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    for (let seed = 1; seed <= 25; seed++) {
      const r = simulate({ seed, seconds: 180, dt, bot: true });
      assert.equal(r.collision, null, `dt=${dt.toFixed(4)} seed=${seed}: hit ${JSON.stringify(r.collision)}`);
    }
  }
});

test('long runs reach every tier, every variant, every combo, and the speed cap', () => {
  const names = new Set();
  const combos = new Set();
  let last;
  for (let seed = 1; seed <= 10; seed++) {
    last = simulate({ seed, seconds: 180, dt: 1 / 60, bot: true });
    last.spawns.forEach((s) => {
      names.add(s.o.name);
      if (s.o.combo) {
        combos.add(s.o.combo);
        assert.ok(tierFor(s.score) >= 3, `${s.o.combo} at score ${s.score}`);
      }
    });
  }
  assert.deepEqual([...names].sort(), Object.keys(CONFIG.obstacle.variants).sort());
  assert.deepEqual([...combos].sort(), Object.keys(CONFIG.obstacle.combos).sort());
  assert.equal(last.finalSpeed, CONFIG.speed.max);
});

// Plays one combo at a fixed speed: jump at `jumpAt` seconds, then press slide
// `slideDelay` seconds after landing (null = no combo follow-up, ground only).
// Slide is released once the overhead has passed. Returns true if no collision.
function playCombo(steps, gaps, speed, jumpAt, slideDelay, dt = 1 / 240) {
  const m = new ObstacleManager(() => 0.5);
  const obs = [];
  let x = PLAYER_RIGHT + speed * 1.0; // first obstacle arrives after 1s
  const count = slideDelay === null ? 1 : steps.length;
  for (let i = 0; i < count; i++) {
    const o = m.spawn(steps[i]);
    o.x = x;
    obs.push(o);
    x += o.w + speed * (gaps[i] ?? 0);
  }
  m.list = obs;
  const p = new Player();
  let slideAt = Infinity;
  let jumped = false;
  for (let t = 0; t < 4; t += dt) {
    if (t >= jumpAt && !jumped) {
      p.jump(false);
      jumped = true;
    }
    const wasAir = !p.grounded;
    for (const o of obs) o.x -= speed * dt;
    const hb = p.hitbox;
    p.update(dt, m.overheadAbove(hb.x, hb.x + hb.w));
    if (wasAir && p.grounded && slideDelay !== null && slideAt === Infinity) slideAt = t + slideDelay;
    if (t >= slideAt && !p.slideHeld && obs.some((o) => o.type === 'overhead' && o.x + o.w >= PLAYER_LEFT)) p.pressSlide();
    if (p.slideHeld && obs.every((o) => o.type !== 'overhead' || o.x + o.w < PLAYER_LEFT)) p.releaseSlide();
    if (obs.some((o) => hit(p.hitbox, o))) return false;
  }
  return true;
}

test('combos are fair: any jump that clears the first obstacle leaves time to slide under the next', () => {
  const REACTION = 0.25; // s from landing to pressing slide, with no buffering in the air
  for (const [name, { steps, gaps }] of Object.entries(CONFIG.obstacle.combos)) {
    for (const speed of [CONFIG.speed.start, CONFIG.speed.max]) {
      let valid = 0;
      for (let jumpAt = 0; jumpAt < 1.2; jumpAt += 0.005) {
        if (!playCombo(steps, gaps, speed, jumpAt, null)) continue; // this jump fails the ground obstacle anyway
        valid++;
        assert.ok(playCombo(steps, gaps, speed, jumpAt, REACTION), `${name} @${speed}: jump at ${jumpAt.toFixed(3)}s clears the first obstacle but not the second`);
        assert.ok(playCombo(steps, gaps, speed, jumpAt, 0), `${name} @${speed}: slide held through landing fails`);
      }
      // The jump window itself must not be frame-perfect.
      assert.ok(valid * 0.005 >= 0.2, `${name} @${speed}: jump window only ${(valid * 0.005).toFixed(3)}s`);
    }
  }
});

test('speed rises gradually and score grows with distance', () => {
  const a = simulate({ seed: 1, seconds: 10, dt: 1 / 60, bot: true });
  const b = simulate({ seed: 1, seconds: 30, dt: 1 / 60, bot: true });
  assert.ok(a.finalSpeed > CONFIG.speed.start && a.finalSpeed < b.finalSpeed);
  assert.ok(a.finalScore < b.finalScore);
});

test('formatScore is consistent', () => {
  assert.equal(formatScore(0), '0');
  assert.equal(formatScore(1234567), '1,234,567');
  assert.equal(formatScore(12.9), '12');
  assert.equal(formatScore(-5), '0');
});

// --- storage ---
function withStorage(impl, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: impl, configurable: true, writable: true });
  try { fn(); } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage;
  }
}
const memStore = (init = {}) => {
  const d = { ...init };
  return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, d };
};

test('storage: saves and loads best score', () => {
  const s = memStore();
  withStorage(s, () => {
    saveBest(321);
    assert.equal(loadBest(), 321);
    assert.equal(s.d['runner.bestScore'], '321');
  });
});

test('storage: malformed values are ignored', () => {
  for (const bad of ['abc', '-5', '1.5', 'NaN', '', '{"a":1}', '1e99', 'Infinity']) {
    withStorage(memStore({ 'runner.bestScore': bad }), () => {
      assert.equal(loadBest(), 0, `value ${JSON.stringify(bad)}`);
    });
  }
});

test('storage: unavailable or throwing storage does not crash and falls back to memory', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  withStorage(throwing, () => {
    assert.doesNotThrow(() => saveBest(77));
    assert.equal(loadBest(), 77);
  });
  withStorage(undefined, () => {
    assert.doesNotThrow(() => saveBest(88));
    assert.equal(loadBest(), 88);
  });
  delete globalThis.localStorage; // not defined at all
  assert.doesNotThrow(() => loadBest());
});

// --- PWA / site files ---
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

test('service worker precaches every script and every file the pages reference', () => {
  const sw = read('sw.js');
  const list = [...sw.matchAll(/^\s+'([^']+)',?$/gm)].map((m) => m[1]);
  for (const f of readdirSync(join(root, 'scripts'))) assert.ok(list.includes(`scripts/${f}`), `scripts/${f} not precached`);
  for (const page of ['index.html', 'privacy.html', 'contact.html']) {
    const html = read(page);
    for (const m of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) {
      const ref = m[1];
      assert.ok(existsSync(join(root, ref)), `${page}: missing file ${ref}`);
    }
    for (const m of html.matchAll(/(?:href|src)="((?:styles|scripts|icons)\/[^"]+|manifest\.webmanifest)"/g)) {
      assert.ok(list.includes(m[1]), `${page}: ${m[1]} not precached`);
    }
  }
  for (const f of list) {
    if (f === './') continue;
    assert.ok(existsSync(join(root, f)), `precache lists missing file ${f}`);
  }
});

test('manifest is valid for installability (portrait, standalone, icons exist)', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.orientation, 'portrait');
  assert.ok(m.name && m.short_name && m.start_url);
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(existsSync(join(root, i.src)), `missing ${i.src}`);
});

test('contact form stays hidden until an endpoint is configured; no secrets in the file', () => {
  const src = read('scripts/contact.js');
  assert.match(src, /const FORM_ENDPOINT = '';/);
});

test('overhead obstacles cannot be jumped over, and a crawl fits under them', () => {
  const m = new ObstacleManager(() => 0.5);
  for (const name of ['overhead', 'overheadWide']) {
    const o = m.spawn(name);
    assert.ok(o.y >= 0, `${name} starts above the canvas`);
    // Fly a full jump: the hitbox bottom must never get above the obstacle's top edge.
    const p = new Player();
    p.jump(false);
    let highestBottom = Infinity;
    for (let i = 0; i < 2000 && !p.grounded; i++) {
      p.update(0.001);
      const hb = p.hitbox;
      highestBottom = Math.min(highestBottom, hb.y + hb.h);
    }
    assert.ok(highestBottom > o.y, `${name} can be jumped over (apex hitbox bottom ${highestBottom} <= top ${o.y})`);
    // Standing under it collides; crawling under it does not.
    assert.ok(new Player().hitbox.y < o.y + o.h, `${name} does not block a standing player`);
    const crawl = new Player();
    crawl.pressSlide();
    crawl.update(0.01);
    assert.ok(crawl.hitbox.y >= o.y + o.h, `${name} blocks a crawling player`);
  }
});

console.log(failed ?`\n${failed} test(s) failed` : '\nall tests passed');
process.exit(failed ? 1 : 0);
