// All tuning values live here. Units: pixels and seconds unless noted.
export const CONFIG = {
  // Logical world size. The canvas is scaled to fit its container, so a narrow
  // world keeps obstacles large on portrait phones. Obstacles spawn at the right
  // edge, so width also sets how far ahead the player can see.
  canvas: { width: 600, height: 300 },
  groundY: 250,            // y of the ground line

  player: {
    x: 80,
    width: 40,             // visual size
    height: 50,
    hitbox: { insetX: 6, insetTop: 6, insetBottom: 2 }, // shrinks collision box vs sprite
    gravity: 2400,         // px/s^2
    jumpVelocity: 800,     // px/s, upward
    // Cosmetic tuning only; none of this affects collision or gameplay.
    visual: {
      runCycleRate: 0.06,  // run-cycle radians per px of world speed
      stretch: 0.12,       // vertical stretch in the air (fraction)
      squashAmount: 0.2,   // vertical squash on landing (fraction)
      squashTime: 0.14,    // s for the landing squash to recover
      runDustEvery: 0.12,  // s between dust puffs while running
      slideDustEvery: 0.05,
      dustLife: 0.4,       // s
    },
    slide: {
      width: 56,          // visual size while sliding
      height: 26,
      hitbox: { insetX: 6, insetTop: 4, insetBottom: 2 },
      minDuration: 0.4,    // s; slide always lasts at least this long
      blendIn: 0.08,       // s; visual ease into the slide pose
      blendOut: 0.15,      // s; visual ease back to the run pose
    },
  },

  // Scenery scroll rates as a fraction of the distance travelled (1 = same as
  // the ground). Cosmetic only.
  background: {
    starCount: 28,
    starParallax: 0.02,
    cloudCount: 5,
    cloudParallax: 0.05,
    farParallax: 0.08,
    nearParallax: 0.2,
    treeSpacing: 70,
    pebbleSpacing: 46,
  },

  speed: {
    start: 320,           // px/s obstacle scroll speed
    max: 640,              // cap so the game stays fair
    accel: 6,              // px/s gained per second survived
  },

  score: {
    pixelsPerPoint: 10,    // distance travelled per score point
    gameOverLockout: 0.4,  // s after dying before Restart is accepted (avoids accidental restarts)
  },

  obstacle: {
    // Overhead obstacles are crawl-under: solid from the clearance line up to a
    // top edge that a full jump cannot reach. The lowest edge is this far above
    // the ground: a standing hitbox (top ~44px up) hits it, a crawling hitbox
    // (top ~22px up) clears it with margin.
    overheadClearance: 32,
    // The top edge sits this far above the apex of a full jump, so jumping over
    // an overhead obstacle is impossible. Derived from jumpVelocity and gravity,
    // so retuning the jump keeps this true.
    overheadJumpMargin: 28,
    // Ground obstacles are cleared by jumping; overhead ones by sliding.
    // Drawn as: small = hydrant, tall = cone, trashcan = trash can, double = doghouse, overheads vary by theme (see themes.js).
    variants: {
      small:        { type: 'ground',   w: 26,  h: 34 },
      tall:         { type: 'ground',   w: 26,  h: 50 },
      trashcan:     { type: 'ground',   w: 30,  h: 42 },
      double:       { type: 'ground',   w: 76,  h: 40, posts: 2 },
      overhead:     { type: 'overhead', w: 60 },
      // `tail` is cosmetic overhang past the hitbox (see the day theme's laundry row).
      overheadWide: { type: 'overhead', w: 130, tail: 190 },
    },
    // Combos: planned jump-then-slide pairs with a fixed gap (seconds, edge to
    // edge) much tighter than the normal type-switch gap. Holding slide in the
    // air starts the crawl on landing; without that, even the latest possible
    // jump lands with >= 0.25s left to press slide (checked in tests/run.mjs).
    // Tier weights pick a combo by name, like a variant.
    combos: {
      hopUnder:   { steps: ['small', 'overhead'],      gaps: [0.85] },
      coneUnder:  { steps: ['tall', 'overhead'],       gaps: [0.85] },
      houseUnder: { steps: ['double', 'overheadWide'], gaps: [0.85] },
    },
    // Difficulty tiers unlock by score. Variants and combos are picked by weight.
    // One new idea at a time: jump only, then slide, then doubles and long
    // slides, then tighter gaps with jump-then-slide combos, then more combos.
    tiers: [
      { fromScore: 0,    weights: { small: 1, tall: 1, trashcan: 1 },                                  maxGapSeconds: 1.9 },
      { fromScore: 250,  weights: { small: 2, tall: 2, trashcan: 2, overhead: 3 },                   maxGapSeconds: 1.8 },
      { fromScore: 600,  weights: { small: 2, tall: 2, trashcan: 2, double: 2, overhead: 3, overheadWide: 1 }, maxGapSeconds: 1.6 },
      { fromScore: 1100, weights: { small: 2, tall: 2, trashcan: 2, double: 3, overhead: 3, overheadWide: 2, hopUnder: 1, coneUnder: 1 }, maxGapSeconds: 1.4 },
      { fromScore: 1600, weights: { small: 2, tall: 2, trashcan: 2, double: 3, overhead: 3, overheadWide: 2, hopUnder: 2, coneUnder: 2, houseUnder: 1 }, maxGapSeconds: 1.4 },
    ],
    // Gaps are measured in seconds of travel (edge to edge), so they scale with
    // speed. Jump airtime = 2 * jumpVelocity / gravity (~0.67s); the minimum
    // gap gives the player time to land and react before the next action.
    minGapSeconds: 1.0,
    typeSwitchExtraGap: 0.3, // extra seconds when switching jump <-> slide
    // Extra seconds before and after the first overhead of a run, so the
    // player meets the slide on its own before it is mixed in.
    firstOverheadExtraGap: 1.0,
    firstSpawnDelay: 1.2,    // seconds before the first obstacle appears
  },

  maxDeltaTime: 0.05,      // clamp to avoid huge steps after a stall
};
