// Visual themes. Purely cosmetic: a theme changes colors, scenery and which
// obstacle drawings are used, never sizes, hitboxes or spawning. To add a theme,
// add an entry here (and any new obstacle drawings in obstacles.js).
//
// skins maps each obstacle variant to a drawing: small, tall, trashcan and
// double are ground obstacles (jump); overhead and overheadWide are the two
// overhead variants (crawl). A skin can also be a list of drawings, and each
// obstacle picks one at random. Overhead drawings available: cart, barrier,
// laundry, laundryRow, branch.
//
// obstacleFx styles every obstacle drawing: shadow (ground oval), outline and
// outlineWidth (world px), tint (washed over the art, null for none), rim and
// rimWidth (lit top edge, null for none), glow (lamps on the barrier and cart, null for none).
export const THEMES = {
  night: {
    label: 'Night',
    icon: '☾',
    sky: ['#2a3042'],
    celestial: 'moon',
    stars: true,
    clouds: false,
    hillsFar: '#313a54',
    hillsNear: '#394362',
    tree: '#2f3853',
    trunk: '#2a3149',
    soil: '#232838',
    line: '#566080',
    pebble: '#3a4258',
    text: '#f2f4f8',
    textDim: '#c4cbe0',
    accent: '#ffb347',
    fx: { dust: '200, 205, 220' },
    skins: { small: 'hydrant', tall: 'cone', trashcan: 'trashcan', double: 'doghouse', overhead: 'cart', overheadWide: 'barrier' },
    // Cool, dimmed colors under moonlight, with a pale top edge.
    obstacleFx: {
      shadow: 'rgba(8, 10, 20, 0.45)',
      outline: '#141826',
      outlineWidth: 1.5,
      tint: 'rgba(36, 46, 92, 0.3)',
      rim: 'rgba(214, 224, 255, 0.4)',
      rimWidth: 1.5,
      glow: 'rgba(255, 179, 71, 0.45)',
    },
  },
  day: {
    label: 'Day',
    icon: '☀',
    sky: ['#79c4f0', '#d3efff'],
    celestial: 'sun',
    stars: false,
    clouds: true,
    hillsFar: '#8fcf9a',
    hillsNear: '#6fba7e',
    tree: '#3f8f55',
    trunk: '#6b4a2f',
    soil: '#c9a46a',
    line: '#8a6a3b',
    pebble: '#b08a4f',
    text: '#1b1f2a',
    textDim: '#2f3a52',
    accent: '#c2410c',
    fx: { dust: '140, 115, 80' },
    skins: { small: 'hydrant', tall: 'cone', trashcan: 'trashcan', double: 'doghouse', overhead: 'laundry', overheadWide: ['laundryRow', 'branch'] },
    obstacleFx: {
      shadow: 'rgba(70, 45, 15, 0.28)',
      outline: 'rgba(27, 31, 42, 0.85)',
      outlineWidth: 1.5,
      tint: null,
      rim: null,
      rimWidth: 0,
      glow: null,
    },
  },
};

export const DEFAULT_THEME = 'night';
