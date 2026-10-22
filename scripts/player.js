import { CONFIG } from './config.js';

const P = CONFIG.player;
const S = P.slide;
const V = P.visual;

const lerp = (a, b, t) => a + (b - a) * t;

// Original dog palette (kept in one place so the look is easy to retune).
const C = {
  fur: '#dfa86a',
  furDark: '#b07434',
  belly: '#f7e2bf',
  tongue: '#ff7a8a',
  earInner: '#f2a9a0',
  ink: '#1b1f2a',
  eyeWhite: '#ffffff',
};

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = P.x;
    this.y = CONFIG.groundY - P.height; // top-left y of the standing sprite
    this.vy = 0;
    this.grounded = true;
    this.sliding = false;
    this.slideTime = 0;      // seconds spent in the current slide
    this.slideHeld = false;  // is the slide input currently held?
    this.pose = 0;           // visual blend: 0 = running, 1 = full crawl pose
    this.dead = false;       // visual only: shows the crash face
    this.phase = 0;          // run-cycle phase (radians), advances with speed
    this.squash = 0;         // 1 on landing, decays to 0
    this.dustTimer = 0;
    this.dust = [];
  }

  // Jump is allowed only while grounded. A slide can be cancelled into a jump
  // once its minimum duration has passed and nothing overhead blocks standing up.
  jump(blocked = false) {
    if (!this.grounded) return;
    if (this.sliding) {
      if (!this.canEndSlide(blocked)) return;
      this.sliding = false;
    }
    this.vy = -P.jumpVelocity;
    this.grounded = false;
  }

  // Slide input pressed. Ignored in the air; if still held on landing, the
  // slide starts then (see update).
  pressSlide() {
    this.slideHeld = true;
    this.beginSlide();
  }

  releaseSlide() {
    this.slideHeld = false;
  }

  beginSlide() {
    if (!this.grounded || this.sliding) return;
    this.sliding = true;
    this.slideTime = 0;
  }

  canEndSlide(blocked) {
    return this.slideTime >= S.minDuration && !blocked;
  }

  // blocked: an overhead obstacle is above the player, so standing up would collide.
  update(dt, blocked = false, speed = CONFIG.speed.start) {
    const wasGrounded = this.grounded;
    if (this.sliding) {
      this.slideTime += dt;
      if (!this.slideHeld && this.canEndSlide(blocked)) this.sliding = false;
    }

    if (!this.grounded) {
      this.vy += P.gravity * dt;
      this.y += this.vy * dt;
      const groundTop = CONFIG.groundY - P.height;
      if (this.y >= groundTop) {
        this.y = groundTop;
        this.vy = 0;
        this.grounded = true;
        if (this.slideHeld) this.beginSlide();
      }
    }

    // Ease the visual pose so entering/leaving a slide never snaps.
    const target = this.sliding ? 1 : 0;
    const rate = dt / (target === 1 ? S.blendIn : S.blendOut);
    this.pose += Math.max(-rate, Math.min(rate, target - this.pose));

    this.updateVisuals(dt, speed, wasGrounded);
  }

  // The collision box is smaller than the sprite and is lowered while sliding.
  get hitbox() {
    if (this.sliding) {
      const h = S.hitbox;
      return {
        x: this.x + h.insetX,
        y: CONFIG.groundY - S.height + h.insetTop,
        w: S.width - h.insetX * 2,
        h: S.height - h.insetTop - h.insetBottom,
      };
    }
    const h = P.hitbox;
    return {
      x: this.x + h.insetX,
      y: this.y + h.insetTop,
      w: P.width - h.insetX * 2,
      h: P.height - h.insetTop - h.insetBottom,
    };
  }

  // --- Visuals only: nothing below affects the hitbox or gameplay. ---

  // Spawn a fading dust puff at the feet; it drifts back with the scrolling world.
  emitDust(speed, count, size) {
    for (let i = 0; i < count; i++) {
      this.dust.push({
        x: this.x + 6 + Math.random() * 8,
        y: CONFIG.groundY - 2,
        vx: -speed * (0.3 + Math.random() * 0.4),
        vy: -(10 + Math.random() * 30),
        r: size * (0.7 + Math.random() * 0.6),
        life: 0,
      });
    }
  }

  updateVisuals(dt, speed, wasGrounded) {
    this.phase += dt * speed * V.runCycleRate;
    this.squash = Math.max(0, this.squash - dt / V.squashTime);
    if (!wasGrounded && this.grounded) {
      this.squash = 1;
      this.emitDust(speed, 4, 4);
    }
    if (this.grounded) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = this.sliding ? V.slideDustEvery : V.runDustEvery;
        this.emitDust(speed, 1, this.sliding ? 3 : 2.5);
      }
    }
    for (const d of this.dust) {
      d.life += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    this.dust = this.dust.filter((d) => d.life < V.dustLife);
  }

  drawDust(ctx, rgb) {
    for (const d of this.dust) {
      const t = d.life / V.dustLife;
      ctx.fillStyle = `rgba(${rgb}, ${0.45 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * (1 + t), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  draw(ctx, theme) {
        const k = this.pose;
    const w = lerp(P.width, S.width, k);
    const h = lerp(P.height, S.height, k);
    const y = this.grounded ? CONFIG.groundY - h : this.y;

    this.drawDust(ctx, theme.fx.dust);

    // Squash and stretch about the feet: stretched going up/down, squashed on landing.
    let sx = 1;
    let sy = 1;
    if (!this.grounded) {
      const s = Math.min(1, Math.abs(this.vy) / P.jumpVelocity);
      sy = 1 + V.stretch * s;
      sx = 1 - V.stretch * 0.6 * s;
    }
    sy -= V.squashAmount * this.squash;
    sx += V.squashAmount * 0.75 * this.squash;

    ctx.save();
    ctx.translate(this.x + w / 2, y + h);
    ctx.scale(sx, sy);
    ctx.translate(-w / 2, -h);
    this.drawDog(ctx, k, w, h);
    ctx.restore();
  }

  // The dog is a chihuahua: big apple head, tall bat ears, large dark eyes, a
  // slim body on thin legs and a tail curled up over the back. It is drawn in
  // local coordinates (0,0 = top-left of the sprite box) and every shape is
  // blended between a standing run pose (k=0) and a low crawl pose (k=1), so
  // entering/leaving a slide morphs instead of swapping sprites.
  drawDog(ctx, k, w, h) {
    const ph = this.phase;
    const air = this.grounded ? 0 : 1;
    const bob = this.grounded && !this.sliding ? -Math.abs(Math.sin(ph)) * 1.5 : 0;

    const bx = lerp(16, 24, k);
    const by = lerp(35, 13.5, k) + bob;
    const brx = lerp(13, 20, k);
    const bry = lerp(8.5, 6, k);
    const hx = lerp(27, 44, k);
    const hy = lerp(20, 12.5, k) + bob;
    const hr = lerp(11, 9, k);

    const ellipse = (cx, cy, rx, ry, rot = 0) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    };
    const limb = (x1, y1, x2, y2, width, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    const tri = (a, b, c, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.closePath();
      ctx.fill();
    };
    // Pointed ear with a pink inner ear (the inner triangle is the outer one
    // shrunk toward its centre).
    const ear = (a, b, tip, outer, inner) => {
      tri(a, b, tip, outer);
      if (!inner) return;
      const cx = (a[0] + b[0] + tip[0]) / 3;
      const cy = (a[1] + b[1] + tip[1]) / 3;
      const s = (p) => [lerp(p[0], cx, 0.45), lerp(p[1], cy, 0.45)];
      tri(s(a), s(b), s(tip), inner);
    };

    // Paw positions: trot (alternating swing + lift), airborne (stretched), crawl
    // (short low strokes with the paws kept near the ground).
    const paw = (hipX, hipY, offset, airDx) => {
      const lift = Math.max(0, Math.sin(ph + offset)) * 5;
      const runX = hipX + Math.sin(ph + offset) * 5;
      const runY = h - 3 - lift;
      const airX = hipX + airDx;
      const airY = hipY + 9;
      const crawlX = hipX + Math.sin(ph + offset) * 4;
      const crawlY = h - 2 - Math.max(0, Math.sin(ph + offset)) * 3;
      const x = lerp(lerp(runX, airX, air), crawlX, k);
      const yy = lerp(lerp(runY, airY, air), crawlY, k);
      return [x, yy];
    };
    const hipY = by + bry * 0.6;
    const backHip = bx - brx * 0.55;
    const frontHip = bx + brx * 0.55;
    const [bpx, bpy] = paw(backHip, hipY, 0, -8);
    const [fpx, fpy] = paw(frontHip, hipY, Math.PI, 8);

    // Tail: curled up over the back with a small wag; held low and trailing while crawling.
    const wag = Math.sin(ph * 1.5) * 1.5;
    const tx = bx - brx + 2;
    const ty = by - 2;
    ctx.strokeStyle = C.fur;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(
      tx - lerp(7, 12, k), ty - lerp(10, 2, k),
      tx - lerp(2, 10, k) + wag * (1 - k * 0.4), ty - lerp(15, 4, k)
    );
    ctx.stroke();

    limb(backHip, hipY, bpx, bpy, 4, C.furDark); // far legs sit behind the body
    ctx.fillStyle = C.fur;
    ellipse(bx, by, brx, bry);
    ctx.fillStyle = C.belly;
    ellipse(bx, by + bry * 0.45, brx * 0.7, bry * 0.5);
    limb(frontHip, hipY, fpx, fpy, 4, C.fur);

    // Big ears: upright when running, swept back in the air and flat in a slide.
    const topY = hy - hr;
    const flick = this.grounded ? Math.sin(ph) * 1.5 : 0;
    const back = lerp(air * 3, 9, k);
    const farTip = [hx + 7 - back * 0.6 + flick, topY - lerp(9, -1, k)];
    ear([hx + 1, topY + 1], [hx + 9, hy - 5], farTip, C.furDark);

    // Apple head, then a short muzzle and a small nose.
    ctx.fillStyle = C.fur;
    ellipse(hx, hy, hr, hr);
    const sx = hx + lerp(8.5, 8, k);
    const sy = hy + lerp(3.5, 3, k);
    ctx.fillStyle = C.belly;
    ellipse(sx, sy, lerp(6.2, 5.6, k), lerp(3.5, 3.2, k));
    ctx.fillStyle = C.ink;
    ellipse(sx + lerp(5, 4.5, k), sy - 1.2, 1.8, 1.5);

    // Tongue hangs out when airborne.
    const tongue = air;
    if (tongue > 0.1 && !this.dead) {
      ctx.fillStyle = C.tongue;
      ellipse(sx + 0.5, sy + 3.5, 1.8 * tongue, 2.8 * tongue);
    }

    const nearTip = [hx - 7 - back + flick, topY - lerp(10, -1, k)];
    ear([hx - 10, hy - 4], [hx - 1, topY + 1], nearTip, C.fur, C.earInner);

    // Eye: big and round with a highlight, or a squashed X when the run has ended.
    const ex = hx + 3.5;
    const ey = hy - lerp(1.5, 1, k);
    if (this.dead) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - 2.5, ey - 2.5); ctx.lineTo(ex + 2.5, ey + 2.5);
      ctx.moveTo(ex + 2.5, ey - 2.5); ctx.lineTo(ex - 2.5, ey + 2.5);
      ctx.stroke();
    } else {
      ctx.fillStyle = C.ink;
      ellipse(ex, ey, 3.6, 3.8);
      ctx.fillStyle = C.eyeWhite;
      ellipse(ex + 1.1, ey - 1.2, 1.2, 1.2);
    }
  }
}
