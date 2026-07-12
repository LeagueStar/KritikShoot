/**
 * KritikShoot — game.js
 * Vanilla JS top-down survival shooter. No dependencies.
 */

"use strict";

// FIX(polish1): single switch for dev-only diagnostics (console.assert, etc.)
// so production play doesn't pay for a per-physics-tick assertion.
const DEBUG = false;

// =============================================================================
// SECTION 1 — CONFIGURATION
// =============================================================================
const CONFIG = Object.freeze({

  PLAYER_SIZE:          20,
  PLAYER_BASE_SPEED:    300,
  PLAYER_BASE_HEALTH:   200,
  PLAYER_SHOOT_DELAY:   0.20,
  PLAYER_BULLET_SPEED:  600,
  PLAYER_BASE_DAMAGE:   10,

  BASE_ENEMY_SPEED:     90,
  ENEMY_BULLET_SPEED:   360,
  WAVE_MULTIPLIER:      0.5,

  // FIX(feature2): onboarding wave — wave 1 spawns from this small fixed
  // budget instead of the normal 8+wave*3 formula (which would already be
  // 11 at wave 1), giving new players a gentler first taste of combat.
  // Only "normal"/"rusher" are unlocked at wave 1 anyway (see ENEMY_TABLE),
  // so this only reduces enemy *count*, not variety.
  ONBOARDING_WAVE1_BUDGET: 4,
  ONBOARDING_HINT_DURATION: 6,   // seconds the control hint stays on screen

  SHAKE_MAX:            14,
  SHAKE_DECAY:          6.5,
  SHAKE_FREQ:           55,
  // FIX(bug4): low-frequency "thud" component summed with the high-freq
  // rattle above, only for high-intensity events (boss death, exploder,
  // boss dash contact) — see Game._addShake()/_draw().
  SHAKE_THUD_FREQ:      10,

  PARTICLE_FRICTION:    0.88,
  PARTICLE_DECAY:       0.94,

  POOL_BULLETS:         300,
  POOL_PARTICLES:       500,

  // Dead-flag compaction: sweep the array when dead slots reach this fraction
  COMPACT_THRESHOLD_BULLETS:   0.35,
  COMPACT_THRESHOLD_PARTICLES: 0.35,

  POWERUP_TYPES:  ["health", "xp", "shield", "triple_shot", "speed_boost", "rage"],
  POWERUP_COLORS: {
    health:       "#ff6b81",
    xp:           "#feca57",
    shield:       "#48dbfb",
    triple_shot:  "#ff9f43",
    speed_boost:  "#1dd1a1",
    rage:         "#ff4757",
  },
  // FIX(bug2): colorblind accessibility — a distinct glyph per powerup type,
  // drawn on top of the existing glow sprite so type reads without relying
  // on hue alone. Plain unicode symbols (not emoji) for consistent cross-
  // platform canvas rendering at small sizes.
  POWERUP_GLYPHS: {
    health:       "+",
    xp:           "\u2726",  // ✦
    shield:       "\u25C8",  // ◈
    triple_shot:  "\u039E",  // Ξ (three bars — reads as a spread/triple)
    speed_boost:  "\u00BB",  // »
    rage:         "\u2739",  // ✹
  },

  HUD_FONT:             "'Rajdhani', sans-serif",
  HUD_COLOR_MAIN:       "#e8f0fe",
  HUD_COLOR_HP_BG:      "rgba(255, 45, 85, 0.35)",
  HUD_COLOR_HP_FG:      "#2ecc71",
  HUD_COLOR_XP_BG:      "rgba(0, 229, 255, 0.2)",
  HUD_COLOR_XP_FG:      "#00e5ff",
  WALL_COLOR:           "#1a2033",
  WALL_HP_COLOR:        "#e74c3c",
  WALL_HP_GOOD_COLOR:   "#2ecc71",
});


// =============================================================================
// SECTION 1b — WAVE BUDGET / ENEMY TABLE
// Each enemy type has:
//   cost        — threat-budget units consumed when spawned
//   unlockWave  — earliest wave the type can appear
//   weight      — relative spawn probability once unlocked (higher = more common)
// _spawnWave() fills a per-wave budget by drawing from this table.
// =============================================================================
const ENEMY_TABLE = Object.freeze([
  { type: "normal",   cost: 1, unlockWave: 1, weight: 5 },
  { type: "rusher",   cost: 1, unlockWave: 1, weight: 4 },
  { type: "fast",     cost: 2, unlockWave: 2, weight: 3 },
  { type: "ranged",   cost: 2, unlockWave: 3, weight: 3 },
  { type: "spread",   cost: 2, unlockWave: 4, weight: 2 },
  { type: "exploder", cost: 3, unlockWave: 5, weight: 2 },
  { type: "tank",     cost: 3, unlockWave: 6, weight: 1 },
]);

// =============================================================================
// SECTION 1c — ENEMY TYPES
// FIX(perf4): single source of truth for per-type visual/gameplay stats.
// Previously adding a type meant touching three places: the Enemy
// constructor's switch (color/size/speed/hp/shootDelay), the rotSpeed
// ternary chain in draw(), and the sides ternary chain in draw() — all of
// which had to be kept in sync by hand. Now both read from here.
//   baseSize          — × game.uiScale = Enemy.size
//   hpMul             — × the wave's baseHp = Enemy.hp
//   sides / rotSpeed  — draw()'s rotating-polygon silhouette
//   preferredDistMul  — ranged-only: × game.uiScale = orbit distance
//   meleeCooldown / meleeDamageMult — tank/rusher-only: see FIX(bug1)
// =============================================================================
const ENEMY_TYPES = Object.freeze({
  normal: {
    color: "#2ecc71", baseSize: 20, speed: CONFIG.BASE_ENEMY_SPEED,
    hpMul: 1.0, shootDelay: 2.0, sides: 4, rotSpeed: 1.2,
  },
  rusher: {
    color: "#e74c3c", baseSize: 14, speed: 240,
    hpMul: 0.4, shootDelay: 99, sides: 3, rotSpeed: 4.0,   // shootDelay 99 == melee only
    meleeCooldown: 0.4, meleeDamageMult: 1.0,
  },
  fast: {
    color: "#f1c40f", baseSize: 16, speed: 185,
    hpMul: 0.6, shootDelay: 1.5, sides: 3, rotSpeed: 4.0,
  },
  ranged: {
    color: "#00e5ff", baseSize: 18, speed: 60,
    hpMul: 0.8, shootDelay: 1.2, sides: 8, rotSpeed: 1.2,  // octagon — reads as "technological"
    preferredDistMul: 260,
  },
  spread: {
    color: "#9b59b6", baseSize: 20, speed: 70,
    hpMul: 1.0, shootDelay: 2.5, sides: 5, rotSpeed: 1.2,
  },
  exploder: {
    color: "#e67e22", baseSize: 22, speed: 105,
    hpMul: 1.0, shootDelay: 4.0, sides: 4, rotSpeed: 1.2,
  },
  tank: {
    color: "#3498db", baseSize: 30, speed: 40,
    hpMul: 2.5, shootDelay: 99, sides: 6, rotSpeed: 0.3,   // shootDelay 99 == no shooting
    meleeCooldown: 0.9, meleeDamageMult: 2.5,
  },
});

// =============================================================================
// SECTION 1d — ASCENSION MODS
// FIX(feature4): a 4th upgrade tier offered at levels 10/20/30 instead of
// the normal 7-way grid — a 2-of-3 choice, letting the player commit to a
// build-warping perk for a weapon (not necessarily the one currently
// equipped). Implemented as boolean flags on player.mods, checked inline in
// the existing per-weapon branches of _shoot() and CombatSystem's bullet-
// collision block — the same pattern getSynergies() already uses there,
// extended rather than duplicated.
// =============================================================================
const ASCENSION_LEVELS = Object.freeze([10, 20, 30]);

const ASCENSION_MODS = Object.freeze([
  {
    id: "ricochet", weapon: "default",
    label: "\u{1F501} Ricochet Rounds",
    desc: "Gun bullets bounce off one wall instead of dying on contact.",
  },
  {
    id: "detonatorPellets", weapon: "spread",
    label: "\u{1F4A3} Detonator Pellets",
    desc: "Shotgun pellets chain-explode in a small radius on enemy kill.",
  },
  {
    id: "beamSplit", weapon: "laser",
    label: "\u{1F374} Beam Split",
    desc: "Laser bolts fork into two thinner beams on their first pierce.",
  },
]);

const Utils = {

  distSq(x1, y1, x2, y2) {
    return (x2 - x1) ** 2 + (y2 - y1) ** 2;
  },

  // O(1) swap-and-pop — order not preserved. Only for unordered sim lists.
  removeFast(arr, index) {
    arr[index] = arr[arr.length - 1];
    arr.pop();
  },

  circleRect(cx, cy, r, rx, ry, rw, rh) {
    const clampX = Math.max(rx, Math.min(cx, rx + rw));
    const clampY = Math.max(ry, Math.min(cy, ry + rh));
    return Utils.distSq(cx, cy, clampX, clampY) <= r * r;
  },

  lerp(a, b, t) { return a + (b - a) * t; },

  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },

  /**
   * CCD — swept circle vs static circle.
   * Returns t ∈ [0,1] of first contact, or -1 if no hit.
   */
  sweepCircle(x0, y0, x1, y1, cx, cy, combinedR) {
    const dx  = x1 - x0,  dy  = y1 - y0;
    const fx  = x0 - cx,  fy  = y0 - cy;
    const rSq = combinedR * combinedR;
    const c0   = fx * fx + fy * fy - rSq;
    if (c0 <= 0) return 0;   // already overlapping at t=0 — instant hit (point-blank/melee range)
    const a   = dx * dx + dy * dy;
    if (a < 1e-10) return -1;
    const b    = 2 * (fx * dx + fy * dy);
    const c    = c0;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return (t >= 0 && t <= 1) ? t : -1;
  },

  /**
   * Line-of-Sight raycasting helper.
   * Returns true if the segment (x0,y0)→(x1,y1) intersects the AABB rect.
   * Uses the Liang–Barsky parametric clipping algorithm — branchless and cheap.
   */
  lineIntersectsRect(x0, y0, x1, y1, rx, ry, rw, rh) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    let tMin = 0, tMax = 1;
    const checks = [
      [-dx, -(rx - x0)],
      [ dx,   rx + rw - x0],
      [-dy, -(ry - y0)],
      [ dy,   ry + rh - y0],
    ];
    for (const [p, q] of checks) {
      if (p === 0) { if (q < 0) return false; continue; }
      const r = q / p;
      if (p < 0) { if (r > tMax) return false; if (r > tMin) tMin = r; }
      else        { if (r < tMin) return false; if (r < tMax) tMax = r; }
    }
    return tMin <= tMax;
  },

  /**
   * A4 — Shared LoS helper extracted from Enemy and Boss (they were identical).
   * Returns true if there is a clear line from (x0,y0) to (x1,y1) —
   * i.e. no wall or crate intersects the segment.
   */
  hasLineOfSight(game, x0, y0, x1, y1) {
    for (const w of game.walls) {
      if (Utils.lineIntersectsRect(x0, y0, x1, y1, w.x, w.y, w.w, w.h)) return false;
    }
    if (game.crates) {
      for (const c of game.crates) {
        if (Utils.lineIntersectsRect(x0, y0, x1, y1, c.x, c.y, c.w, c.h)) return false;
      }
    }
    return true;
  },

  // FIX(feature3): seeded PRNG for Daily Challenge mode. hashStringToSeed()
  // turns an arbitrary string (the UTC date) into a 32-bit int via FNV-1a;
  // mulberry32() is a small, fast, well-distributed PRNG driven by that int.
  // createSeededRNG() wraps both so call sites just get a Math.random()-
  // shaped function: () => float in [0, 1).
  hashStringToSeed(str) {
    let h = 0x811c9dc5; // FNV-1a offset basis
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193); // FNV prime
    }
    return h >>> 0;
  },

  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  createSeededRNG(seedStr) {
    return Utils.mulberry32(Utils.hashStringToSeed(seedStr));
  },

  // Canonical "today" string for the daily seed — UTC so every player gets
  // the same challenge on the same calendar day regardless of local timezone.
  todayUTCString() {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  },
};


// Best-effort landscape lock for touch devices, called from a click handler
// so it runs inside a user-gesture (both Fullscreen and Orientation Lock
// require one). Neither API is universal — iOS Safari supports neither, so
// the CSS .rotate-prompt overlay is the real cross-platform fallback and
// this is purely a nicety on browsers that do support it (mainly Chrome/
// Android). Failures are swallowed on purpose: there's nothing useful to
// show the player if the browser declines.
function attemptLandscapeLock() {
  if (!navigator.maxTouchPoints) return;
  const el = document.documentElement;
  const requestFs = el.requestFullscreen || el.webkitRequestFullscreen;
  if (requestFs) {
    requestFs.call(el).catch(() => {});
  }
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock("landscape").catch(() => {});
  }
}


// =============================================================================
// SECTION 3 — SPATIAL HASH GRID
// =============================================================================
// NOTE: query() returns this._scratch, a single reusable array shared across
// ALL calls on this instance — it is cleared and refilled on every query().
// The array is invalidated the moment query() is called again, so callers
// MUST fully consume the result (read every entry they need) before issuing
// another query() on this same SpatialHash. Dedup of entities that straddle
// multiple cells (and would otherwise appear more than once in the result)
// is handled structurally via a per-query stamp written onto each entity —
// callers no longer need their own Set-based dedup for this.
class SpatialHash {
  constructor(cellSize = 80) {
    this._cell    = cellSize;
    this._map     = new Map();
    this._scratch = [];   // shared query result buffer — see class comment
    this._stamp   = 0;    // incremented every query(); written onto entities to dedup
    // FIX(perf1): pool of bucket arrays reused across clear()/insert()
    // cycles. clear()+full-reinsert runs every physics tick for every
    // entity (Game._update()); at 40+ concurrent enemies (a realistic
    // late-wave count per the budget formula in _spawnWave), each usually
    // touching 1-4 grid cells, that was 100+ short-lived array allocations
    // per tick for the GC to reclaim. Reusing the arrays (reset via
    // .length = 0, not discarded) avoids that churn without turning this
    // into a persistent incremental structure — the Map itself is still
    // cleared every tick, so stale grid-cell keys never accumulate.
    this._bucketPool = [];
  }

  clear() {
    for (const bucket of this._map.values()) {
      bucket.length = 0;
      this._bucketPool.push(bucket);
    }
    this._map.clear();
  }

  // Packed integer key instead of string concatenation — this runs on the
  // hottest path in the file (every tick, every entity insert/query).
  // Offset both axes by a large constant to keep them non-negative, then
  // combine into a single integer. OFFSET (1e5) and MULT (2e5) are large
  // enough that gx/gy can range roughly ±100000 grid cells (i.e. tens of
  // millions of px at cellSize 80-120) before colliding — far beyond any
  // realistic arena size — while still handling the negative-coordinate
  // case the original string scheme was designed for.
  _key(gx, gy) {
    return (gx + 100000) * 200000 + (gy + 100000);
  }

  insert(entity) {
    const r    = entity.size || 8;
    const minX = Math.floor((entity.x - r) / this._cell);
    const minY = Math.floor((entity.y - r) / this._cell);
    const maxX = Math.floor((entity.x + r) / this._cell);
    const maxY = Math.floor((entity.y + r) / this._cell);
    for (let gx = minX; gx <= maxX; gx++) {
      for (let gy = minY; gy <= maxY; gy++) {
        const k = this._key(gx, gy);
        let bucket = this._map.get(k);
        if (!bucket) {
          // FIX(perf1): pull a reset array from the pool instead of `[]`
          bucket = this._bucketPool.pop() || [];
          this._map.set(k, bucket);
        }
        bucket.push(entity);
      }
    }
  }

  query(x, y, r) {
    const minX = Math.floor((x - r) / this._cell);
    const minY = Math.floor((y - r) / this._cell);
    const maxX = Math.floor((x + r) / this._cell);
    const maxY = Math.floor((y + r) / this._cell);
    const out  = this._scratch;
    out.length = 0;
    this._stamp++;
    const stamp = this._stamp;
    for (let gx = minX; gx <= maxX; gx++) {
      for (let gy = minY; gy <= maxY; gy++) {
        const bucket = this._map.get(this._key(gx, gy));
        if (bucket) {
          for (const e of bucket) {
            // an entity straddling a cell boundary appears in multiple buckets;
            // the stamp ensures it's only pushed once per query() call
            if (e._qStamp === stamp) continue;
            e._qStamp = stamp;
            out.push(e);
          }
        }
      }
    }
    return out;
  }
}


// =============================================================================
// SECTION 4 — FINITE STATE MACHINE
// =============================================================================
const GameState = Object.freeze({
  MENU:            "MENU",
  PLAYING:         "PLAYING",
  PAUSED:          "PAUSED",
  LEVEL_UP:        "LEVEL_UP",
  GAME_OVER:       "GAME_OVER",
  WAVE_TRANSITION: "WAVE_TRANSITION",  // 3-second inter-wave countdown
});

class GameFSM {
  constructor() {
    this._state    = GameState.MENU;
    this._handlers = new Map();
  }

  get state() { return this._state; }

  register(state, { enter, exit } = {}) {
    this._handlers.set(state, { enter, exit });
    return this;
  }

  transition(newState) {
    if (this._state === newState) return;
    this._handlers.get(this._state)?.exit?.();
    this._state = newState;
    this._handlers.get(newState)?.enter?.();
  }

  is(state)    { return this._state === state; }
  isNot(state) { return this._state !== state; }
}


// =============================================================================
// SECTION 5 — OBJECT POOL
// =============================================================================
class ObjectPool {
  constructor(FactoryClass, initialSize = 100, maxSize = initialSize * 4) {
    this._factory = FactoryClass;
    this._maxSize = maxSize;
    this._pool    = Array.from({ length: initialSize }, () => new FactoryClass());
    for (const obj of this._pool) obj._pooled = true;
  }

  get() {
    const obj = this._pool.length > 0 ? this._pool.pop() : new this._factory();
    obj._pooled = false;
    return obj;
  }

  release(obj) {
    // guard against double-release: a double-released object could be handed
    // out by two live get() calls simultaneously
    if (obj._pooled) {
      console.warn("ObjectPool.release() called on an already-released object; ignoring.");
      return;
    }
    obj._pooled = true;
    // beyond maxSize, drop the object for GC instead of retaining it forever —
    // otherwise a large simultaneous burst (e.g. boss death) permanently
    // grows the pool to its single largest historical peak.
    if (this._pool.length >= this._maxSize) return;
    this._pool.push(obj);
  }

  get size()   { return this._pool.length; }
}


// =============================================================================
// SECTION 6 — GLOW SPRITE CACHE
// =============================================================================
const GlowCache = {
  _map: new Map(),
  // FIX(perf2): global glow-radius multiplier, set by Game based on
  // _lowPowerMode. Kept here (one spot) instead of touching every
  // GlowCache.get() call site individually. 1 = unchanged (desktop default).
  padScale: 1,

  get(color, radius, pad = null) {
    pad = (pad ?? radius * 1.5) * GlowCache.padScale;
    const key = `${color}:${radius | 0}:${pad | 0}`;
    let   g   = this._map.get(key);
    if (g) {
      // LRU: move this entry to the end of the Map's iteration order on hit,
      // so a frequently-reused color doesn't get evicted ahead of a color
      // that was only used once but more recently.
      this._map.delete(key);
      this._map.set(key, g);
    } else {
      // evict the oldest entry when the cache exceeds 128 sprites
      if (this._map.size >= 128) {
        const oldestKey = this._map.keys().next().value;
        this._map.delete(oldestKey);
      }
      const dim  = ((radius + pad) * 2) | 0;
      const oc   = document.createElement("canvas");
      oc.width = oc.height = Math.max(4, dim);
      const octx = oc.getContext("2d");
      const cx   = oc.width / 2;
      const grad = octx.createRadialGradient(cx, cx, 0, cx, cx, radius + pad);
      grad.addColorStop(0,   color);
      grad.addColorStop(0.5, color);
      grad.addColorStop(1,   "rgba(0,0,0,0)");
      octx.fillStyle = grad;
      octx.beginPath();
      octx.arc(cx, cx, radius + pad, 0, Math.PI * 2);
      octx.fill();
      g = { canvas: oc, half: cx };
      this._map.set(key, g);
    }
    return g;
  },

  clear() { this._map.clear(); },
};


// =============================================================================
// SECTION 6b — TRAIL MANAGER
// Ring buffer of past positions per entity → fading neon line drawn behind it.
// =============================================================================
class TrailManager {
  constructor(maxLength = 10) {
    this._maxLen = maxLength;
    this._trails = new Map();
  }

  register(entity, color) {
    // allocate a fixed-length array and a write-index pointer instead of
    // a dynamic array that requires O(n) shift() on every push.
    const pts = new Array(this._maxLen).fill(null);
    this._trails.set(entity, { pts, color, writeIdx: 0, count: 0 });
  }

  unregister(entity) {
    this._trails.delete(entity);
  }

  push(entity) {
    const t = this._trails.get(entity);
    if (!t) return;
    // write to writeIdx % maxLen and advance pointer — O(1), no shift()
    t.pts[t.writeIdx % this._maxLen] = { x: entity.x, y: entity.y };
    t.writeIdx++;
    if (t.count < this._maxLen) t.count++;
  }

  draw(ctx) {
    for (const [, t] of this._trails) {
      if (t.count < 2) continue;
      ctx.save();
      ctx.shadowColor = t.color;
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = t.color;
      ctx.lineWidth   = 2;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";
      ctx.beginPath();
      // read in insertion order — oldest slot is writeIdx % maxLen when buffer is full,
      // otherwise slot 0 is the oldest.
      const start = t.count < this._maxLen ? 0 : t.writeIdx % this._maxLen;
      for (let i = 0; i < t.count; i++) {
        const pt = t.pts[(start + i) % this._maxLen];
        ctx.globalAlpha = ((i + 1) / t.count) * 0.65;
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else         ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  clear() { this._trails.clear(); }
}


// =============================================================================
// SECTION 6c — AUDIO ENGINE
// Dependency-free procedural sound via Web Audio API OscillatorNode.
// All sounds are fire-and-forget: short envelope, no leaks.
// Context is lazy-created on first play (satisfies autoplay policy).
// =============================================================================
class AudioEngine {
  constructor() {
    this._ctx = null;
    try { this.muted = localStorage.getItem("ks_muted") === "true"; }
    catch { this.muted = false; }
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (this._ctx.state === "suspended") this._ctx.resume();
    return this._ctx;
  }

  // Shared envelope helper — connects osc → gain → dest, schedules stop
  _play(setupFn, duration = 0.25) {
    if (this.muted) return;   // FIX(bug1): no sound at all while muted
    try {
      const ctx  = this._getCtx();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      const node = setupFn(ctx, gain);
      // FIX(bug7): ramp to zero instead of an instant jump, to avoid a click
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration + 0.02);
      // disconnect the gain node once the source finishes to prevent GainNode leaks
      if (node && typeof node.addEventListener === "function") {
        node.addEventListener("ended", () => gain.disconnect(), { once: true });
      } else if (node && node.onended !== undefined) {
        node.onended = () => gain.disconnect();
      }
    } catch (e) { /* AudioContext unavailable (e.g. unit tests) */ }
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem("ks_muted", this.muted); } catch {}
  }

  // "Pew" — short square-wave chirp descending from 880 → 220 Hz
  playShoot() {
    this._play((ctx, gain) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.13);
      return osc;   // return node so _play can hook onended for gain.disconnect()
    });
  }

  // "Boom" — deep sine thud + short noise burst for player hit
  playPlayerHit() {
    this._play((ctx, gain) => {
      // Sub-bass thud
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.31);

      // Noise crackle layer
      const bufLen   = ctx.sampleRate * 0.15;
      const buffer   = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data     = buffer.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
      const src      = ctx.createBufferSource();
      src.buffer     = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      src.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      src.start(ctx.currentTime);
      // disconnect the noise sub-graph when the buffer source ends
      src.onended = () => noiseGain.disconnect();
      return osc;   // return primary node so _play hooks onended on the main gain
    }, 0.31);
  }

  // "Crunch" — filtered noise burst for enemy death
  playEnemyDeath() {
    this._play((ctx, gain) => {
      const bufLen = ctx.sampleRate * 0.18;
      const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data   = buffer.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

      const src    = ctx.createBufferSource();
      src.buffer   = buffer;

      // Band-pass filter gives it a "crunch" character vs flat noise
      const bpf    = ctx.createBiquadFilter();
      bpf.type     = "bandpass";
      bpf.frequency.value = 1800;
      bpf.Q.value  = 1.2;

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      src.connect(bpf);
      bpf.connect(gain);
      src.start(ctx.currentTime);
      return src;   // return node so _play can hook onended → gain.disconnect()
    }, 0.19);
  }

  // Laser "zap" — sawtooth with rapid frequency drop, for piercing mode
  playLaser() {
    this._play((ctx, gain) => {
      const osc = ctx.createOscillator();
      osc.type  = "sawtooth";
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.09);
      return osc;
    }, 0.09);
  }

  // Spread "thwump" — chord of two slightly-detuned sines for shotgun feel
  playSpread() {
    this._play((ctx, gain) => {
      let firstOsc = null;
      for (const freq of [320, 295]) {
        const osc = ctx.createOscillator();
        osc.type  = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.14);
        const g2  = ctx.createGain();
        g2.gain.setValueAtTime(0.18, ctx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
        osc.connect(g2);
        g2.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
        // disconnect each sub-gain when its oscillator ends
        osc.onended = () => g2.disconnect();
        if (!firstOsc) firstOsc = osc;
      }
      return firstOsc;   // let _play hook gain.disconnect() via the first osc
    }, 0.15);
  }
}


// =============================================================================
// SECTION 6d — META-PROGRESSION
// Coin economy + persistent upgrades stored in localStorage.
// Coins earned = wave * 10 + floor(gameTime / 5) on death.
// Stat bonuses are applied multiplicatively on top of base CONFIG values
// via MetaProgression.getBonus(key), which returns a flat additive value.
//
// Session cache — initSession() snapshots localStorage once at game
// start. All getBonus() calls during gameplay read from the in-memory cache.
// localStorage is only written on purchase (write-on-change, not every frame).
// =============================================================================
class MetaProgression {
  // Upgrade catalogue: each entry is one purchasable tier.
  // maxTier: how many times it can be bought.
  // cost(tier): coins cost for that tier.
  // label: display name.
  // bonus(tiers): the flat additive bonus given the number of tiers owned.
  // NOTE: UPGRADES stays static — it's an immutable readonly catalogue, not
  // mutable state, so it's fine to share across instances.
  static UPGRADES = [
    {
      id:      "fireRate",
      label:   "⚡ Fire Rate",
      desc:    "+5% fire rate per tier",
      maxTier: 5,
      cost:    tier => 40 + tier * 20,
      // Returns seconds to subtract from shoot delay (capped in Player getter)
      bonus:   tiers => tiers * 0.01,
    },
    {
      id:      "health",
      label:   "❤ Max HP",
      desc:    "+25 max HP per tier",
      maxTier: 8,
      cost:    tier => 30 + tier * 15,
      bonus:   tiers => tiers * 25,
    },
    {
      id:      "damage",
      label:   "💥 Damage",
      desc:    "+5 damage per tier",
      maxTier: 6,
      cost:    tier => 50 + tier * 25,
      bonus:   tiers => tiers * 5,
    },
    {
      id:      "speed",
      label:   "🏃 Move Speed",
      desc:    "+15 speed per tier",
      maxTier: 5,
      cost:    tier => 35 + tier * 20,
      bonus:   tiers => tiers * 15,
    },
    {
      id:      "bulletSpeed",
      label:   "🚀 Bullet Speed",
      desc:    "+40 bullet speed per tier",
      maxTier: 4,
      cost:    tier => 45 + tier * 20,
      bonus:   tiers => tiers * 40,
    },
  ];

  constructor() {
    // ── Session cache (populated once per run by initSession()) ─────────────
    this._cache = null;   // plain object mirror of ks_meta
    this._coins = 0;      // integer mirror of ks_coins

    // instance Map built lazily on first getBonus()/purchase() call — O(1)
    // lookup instead of UPGRADES.find() which is O(n) called every physics tick.
    this._upgradeMap = null;
  }

  /**
   * Call once at the start of every run (Game.start).
   * Reads localStorage into memory so Player getters never touch LS again.
   */
  initSession() {
    try {
      const parsed = JSON.parse(localStorage.getItem("ks_meta") || "{}");
      // FIX(bug10): a manually-edited/corrupted key, or one written by a
      // future/older schema, could parse to a non-object (array, number,
      // string, null) — every getBonus()/purchase() call assumes an object
      // with numeric tier fields, so fall back to a fresh cache instead.
      this._cache = (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
    } catch {
      this._cache = {};
    }
    // FIX(bug10): parseInt on a corrupted/non-numeric value (or a stray
    // empty string) yields NaN, which then poisons every future coin total
    // permanently — Math.max(0, NaN) is NaN, so setCoins()/awardCoins() can
    // never recover once this happens. Guard against NaN explicitly.
    // FIX(audit1): this localStorage.getItem() call sat outside the try/catch
    // above — in environments where storage access itself throws (Safari
    // private-mode edge cases, storage disabled by policy, etc.) this would
    // throw out of initSession() uncaught, breaking Game.start() entirely.
    let rawCoins = 0;
    try { rawCoins = parseInt(localStorage.getItem("ks_coins") || "0", 10); } catch { rawCoins = 0; }
    this._coins = Number.isFinite(rawCoins) ? Math.max(0, rawCoins) : 0;
  }

  /** Returns the in-memory cache object (never null after initSession). */
  load() {
    return this._cache ?? {};
  }

  /** Writes data to both the in-memory cache and localStorage. */
  save(data) {
    this._cache = data;
    // FIX(bug5): guard against quota errors / Safari private-mode throws
    try { localStorage.setItem("ks_meta", JSON.stringify(data)); } catch { /* in-memory cache still updated */ }
  }

  getCoins() {
    return this._coins;
  }

  setCoins(n) {
    // FIX(bug10): belt-and-suspenders — never let a NaN slip into _coins
    // from here either, so one bad caller can't permanently poison the
    // in-memory total for the rest of the session.
    this._coins = Number.isFinite(n) ? Math.max(0, n) : this._coins;
    // FIX(bug5): guard against quota errors / Safari private-mode throws
    try { localStorage.setItem("ks_coins", String(this._coins)); } catch { /* in-memory value still updated */ }
  }

  awardCoins(wave, gameTime) {
    const earned = wave * 10 + Math.floor(gameTime / 5);
    this.setCoins(this.getCoins() + earned);
    return earned;
  }

  // Returns the flat bonus value for a given upgrade id — reads from cache only
  getBonus(id) {
    // build the map once on first call
    if (!this._upgradeMap) {
      this._upgradeMap = new Map(MetaProgression.UPGRADES.map(u => [u.id, u]));
    }
    const cache = this._cache ?? {};
    const tiers = cache[id] || 0;
    const entry = this._upgradeMap.get(id);
    return entry ? entry.bonus(tiers) : 0;
  }

  // Returns true if purchase succeeded; writes cache + localStorage once.
  purchase(id) {
    if (!this._upgradeMap) {
      this._upgradeMap = new Map(MetaProgression.UPGRADES.map(u => [u.id, u]));
    }
    const entry = this._upgradeMap.get(id);
    if (!entry) return false;
    const data  = { ...this.load() };   // shallow clone of cache
    const tiers = data[id] || 0;
    if (tiers >= entry.maxTier) return false;
    const cost  = entry.cost(tiers);
    const coins = this.getCoins();
    if (coins < cost) return false;
    this.setCoins(coins - cost);
    data[id] = tiers + 1;
    this.save(data);   // updates cache + LS in one shot
    return true;
  }
}


// =============================================================================
// SECTION 7 — BULLET
// prevX/prevY cached before each move (temporal interpolation).
// active=false on death; pool release is caller's job; draw() skips
// inactive bullets, and compaction is done in bulk.
// =============================================================================
class Bullet {
  constructor() {
    this.active  = false;
    this.prevX   = 0;
    this.prevY   = 0;
    this._pooled = true;   // ObjectPool.get()/release() manage this flag
  }

  init(x, y, dx, dy, size, color, damage, isEnemy, piercing = false, maxPierce = 4, weaponType = "default") {
    this.x        = x;
    this.y        = y;
    this.prevX    = x;
    this.prevY    = y;
    this.dx       = dx;
    this.dy       = dy;
    this.size     = size;
    this.color    = color;
    this.damage   = damage;
    this.isEnemy  = isEnemy;
    this.piercing = piercing;
    // track how many enemies a piercing round has passed through
    this.hitCount = 0;
    // FIX(feature1): pierce cap is now per-bullet instead of a hardcoded 4,
    // so a synergy (or a future upgrade) can grant a bullet extra pierces
    // without touching the collision-loop constant.
    this.maxPierce = maxPierce;
    // FIX(feature4): which weapon fired this bullet — lets CombatSystem gate
    // Ascension mods (Ricochet Rounds/Beam Split/Detonator Pellets) to the
    // right weapon without re-deriving it from size/color heuristics.
    // Irrelevant for enemy bullets (isEnemy: true), left at the default.
    this.weaponType  = weaponType;
    this._ricocheted = false;   // Ricochet Rounds: only bounce once per bullet
    this._forked     = false;   // Beam Split: only fork once per bullet/child
    this.active   = true;
  }

  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.dx * dt;
    this.y += this.dy * dt;
  }

  draw(ctx, alpha) {
    if (!this.active) return;
    const rx = Utils.lerp(this.prevX, this.x, alpha);
    const ry = Utils.lerp(this.prevY, this.y, alpha);
    const glow = GlowCache.get(this.color, this.size, this.size * 3);
    ctx.drawImage(glow.canvas, rx - glow.half, ry - glow.half);
  }
}


// =============================================================================
// SECTION 8 — PARTICLE
// prevX/prevY cached before each move; active flag gates draw skipping.
// =============================================================================
class Particle {
  constructor() {
    this.active  = false;
    this.prevX   = 0;
    this.prevY   = 0;
    this._pooled = true;   // ObjectPool.get()/release() manage this flag
  }

  init(x, y, dx, dy, color, size, life) {
    this.x       = x;
    this.y       = y;
    this.prevX   = x;
    this.prevY   = y;
    this.dx      = dx;
    this.dy      = dy;
    this.color   = color;
    this.size    = size;
    this.life    = life;
    this.maxLife = life;
    this.active  = true;
  }

  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x    += this.dx * dt * 60;
    this.y    += this.dy * dt * 60;
    this.dx   *= CONFIG.PARTICLE_FRICTION;
    this.dy   *= CONFIG.PARTICLE_FRICTION;
    this.size  = Math.max(0, this.size * CONFIG.PARTICLE_DECAY);
    this.life -= dt;
  }

  draw(ctx, alpha) {
    if (!this.active || this.size < 0.3) return;
    const lifeAlpha = Math.max(0, this.life / this.maxLife);
    if (lifeAlpha < 0.01) return;
    const rx   = Utils.lerp(this.prevX, this.x, alpha);
    const ry   = Utils.lerp(this.prevY, this.y, alpha);
    const glow = GlowCache.get(this.color, this.size, this.size * 2);
    ctx.globalAlpha = lifeAlpha;
    ctx.drawImage(glow.canvas, rx - glow.half, ry - glow.half);
  }
}


// =============================================================================
// SECTION 9 — PLAYER
// Sharp fighter-jet visual with toned glow and dark stroke. prevX/prevY are
// cached each tick so draw() can lerp the render position. Joystick input is
// a pre-normalised [-1,1] vector. Shoot input uses a one-tick latch buffer so
// clicks between fixed-step ticks are never dropped. Speed is capped at
// 800 px/s. Aim angle is cached once per tick in update() and reused by both
// _shoot() and draw().
// =============================================================================
class Player {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.x      = this.game.width  / 2;
    this.y      = this.game.height / 2;
    this.prevX  = this.x;
    this.prevY  = this.y;
    this.size   = CONFIG.PLAYER_SIZE;
    this.color  = "#ffffff";
    this.alive  = true;
    this.health = CONFIG.PLAYER_BASE_HEALTH;

    this.stats    = { level: 1, xp: 0, xpToNext: 100 };
    this.upgrades = { speed: 0, health: 0, damage: 0, fireRate: 0, bulletSpeed: 0, critChance: 0, lifesteal: 0 };
    this.buffs    = { shield: 0, tripleShot: 0, speedBoost: 0, rage: 0 };
    this._lastShot = 0;

    // FIX(feature4): Ascension mods — player-chosen, permanent flags for the
    // run (as opposed to getSynergies(), which is auto-computed each read).
    // See ASCENSION_MODS for the catalogue and CombatSystem/_shoot() for
    // where each flag is actually checked.
    this.mods = {};
    this._ascensionLevelsSeen = new Set();

    // Weapon: "default" | "spread" | "laser"
    // Cycle with E or Shift; powerup "weapon_spread" / "weapon_laser" also sets it.
    this.weapon   = "default";

    this.weaponShots = { default: 0, spread: 0, laser: 0 };

    // cached aim angle — computed once per tick in update()
    this._cachedAimAngle = 0;
  }

  get maxHealth()  { return CONFIG.PLAYER_BASE_HEALTH + this.upgrades.health * 20    + this.game.meta.getBonus("health"); }
  // speed capped at 800 px/s so maxed meta + in-session upgrades can't break physics
  get speed()      { return Math.min(800, CONFIG.PLAYER_BASE_SPEED + (this.upgrades.speed * 30) + (this.buffs.speedBoost > 0 ? 150 : 0) + this.game.meta.getBonus("speed")); }
  get damage()     { return CONFIG.PLAYER_BASE_DAMAGE + (this.upgrades.damage * 2)   + this.game.meta.getBonus("damage"); }
  // shootDelay floor already present — Math.max(0.05) prevents fire-rate breaking the loop
  get shootDelay() { return Math.max(0.05, CONFIG.PLAYER_SHOOT_DELAY - (this.upgrades.fireRate * 0.02) - this.game.meta.getBonus("fireRate")); }
  get bulletSpd()  { return CONFIG.PLAYER_BULLET_SPEED + (this.upgrades.bulletSpeed * 30) + this.game.meta.getBonus("bulletSpeed"); }
  get critChance() { return this.upgrades.critChance * 0.05; }
  get lifesteal()  { return this.upgrades.lifesteal  * 0.05; }

  // FIX(feature1): upgrade synergies. This is a read-only layer on top of
  // the existing additive upgrade math above — it doesn't change any base
  // formula, it only flags combinations worth a bonus effect elsewhere
  // (in _shoot() and in Game._update()'s bullet-hit handling). Threshold of
  // 3 tiers keeps a synergy from firing on a single early pickup; it needs
  // real investment in that stat to unlock the combo payoff.
  static SYNERGY_TIER = 3;

  getSynergies() {
    const u = this.upgrades;
    return {
      // Piercing Overload — laser + heavily-invested crit chance: crit
      // laser bolts punch through 2 more enemies than the normal cap.
      piercingOverload: this.weapon === "laser" && u.critChance >= Player.SYNERGY_TIER,
      // Vampiric Rage — lifesteal + an active rage buff: lifesteal healing
      // is doubled for as long as rage is active.
      vampiricRage: this.buffs.rage > 0 && u.lifesteal >= Player.SYNERGY_TIER,
      // Overcharged Beam — laser + heavily-invested fire rate: laser bolts
      // gain bonus damage scaling with fire-rate tiers past the threshold.
      overchargedBeam: this.weapon === "laser" && u.fireRate >= Player.SYNERGY_TIER,
    };
  }

  // compute aim angle once per tick; shared by update() gate and _shoot() and draw()
  // FIX(bug3): the nearest-enemy fallback (previously mobile-only) now also
  // covers keyboard fire before any mouse movement has happened this
  // session — reuses the exact same scan rather than duplicating it.
  _computeAimAngle(input) {
    const needsFallback = (input.isMobile || !input._mouseMoved) && this.game.enemies.length > 0;
    if (needsFallback) {
      let nearestDSq = Infinity, nearest = this.game.enemies[0];
      for (const e of this.game.enemies) {
        const dSq = Utils.distSq(this.x, this.y, e.x, e.y);
        if (dSq < nearestDSq) { nearestDSq = dSq; nearest = e; }
      }
      return Math.atan2(nearest.y - this.y, nearest.x - this.x);
    }
    return Math.atan2(input.mouseY - this.y, input.mouseX - this.x);
  }

  update(dt, input) {
    if (!this.alive) return;

    this.prevX = this.x;
    this.prevY = this.y;

    // compute aim angle once here for both shooting and draw()
    this._cachedAimAngle = this._computeAimAngle(input);

    for (const key in this.buffs) {
      if (this.buffs[key] > 0) this.buffs[key] = Math.max(0, this.buffs[key] - dt);
    }

    let dx = 0, dy = 0;
    if (input.joystickActive) {
      // joystickX/Y are already a normalised [-1,1] vector — no /40 needed
      dx = input.joystickX;
      dy = input.joystickY;
    } else {
      if (input.keys["w"] || input.keys["arrowup"])    dy -= 1;
      if (input.keys["s"] || input.keys["arrowdown"])  dy += 1;
      if (input.keys["a"] || input.keys["arrowleft"])  dx -= 1;
      if (input.keys["d"] || input.keys["arrowright"]) dx += 1;
    }

    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }

    const nx = this.x + dx * this.speed * dt;
    const ny = this.y + dy * this.speed * dt;
    if (!this.game.checkWallCollision(nx, this.y, this.size)) this.x = nx;
    if (!this.game.checkWallCollision(this.x, ny, this.size)) this.y = ny;

    this.x = Utils.clamp(this.x, this.size, this.game.width  - this.size);
    this.y = Utils.clamp(this.y, this.size, this.game.height - this.size);

    // consume the shoot latch so clicks between ticks are never dropped
    const wantsShoot = input.isShooting || input._shootBuffer;
    if (wantsShoot && (this.game.gameTime - this._lastShot) >= this.shootDelay) {
      input._shootBuffer = false;   // latch consumed
      this._shoot(input);
    }
  }

  _shoot(input) {
    this._lastShot = this.game.gameTime;
    const audio    = this.game.audio;

    // reuse the angle cached in update() — no redundant O(n) enemy scan
    const angle = this._cachedAimAngle;

    this.weaponShots[this.weapon] = (this.weaponShots[this.weapon] || 0) + 1;

    // ── Weapon dispatch ────────────────────────────────────────────────────
    if (this.weapon === "spread") {
      // Shotgun: 6 pellets in a 40° cone. Per-pellet damage is 0.38× so total
      // spread DPS ≈ 1.9× base — matching laser effective output at mid-range.
      const PELLETS = 6;
      const SPREAD  = 0.35; // half-angle in radians
      audio.playSpread();
      for (let i = 0; i < PELLETS; i++) {
        const spread = (i / (PELLETS - 1) - 0.5) * SPREAD * 2;
        const ang    = angle + spread;
        const isCrit = Math.random() < this.critChance;
        const isRage = this.buffs.rage > 0;
        const dmg    = ((isRage || isCrit) ? this.damage * 2 : this.damage) * 0.38;
        const color  = isCrit ? "#f1c40f" : isRage ? "#ff4757" : "#ff9f43";
        const b      = this.game.bulletPool.get();
        b.init(this.x, this.y,
          Math.cos(ang) * this.bulletSpd * (0.85 + Math.random() * 0.3),
          Math.sin(ang) * this.bulletSpd * (0.85 + Math.random() * 0.3),
          (isCrit ? 6 : 4) * this.game.uiScale, color, dmg, false, false, 4, "spread");
        this.game.bullets.push(b);
        this.game.trailMgr.register(b, b.color);
      }
      return;
    }

    if (this.weapon === "laser") {
      // Piercing laser: one fat, fast bolt that passes through enemies
      audio.playLaser();
      const synergy = this.getSynergies();
      const isCrit = Math.random() < this.critChance;
      const isRage = this.buffs.rage > 0;
      let   dmg    = (isRage || isCrit) ? this.damage * 1.8 : this.damage * 1.4;
      // FIX(feature1): Overcharged Beam — +8% damage per fire-rate tier
      // past the synergy threshold, stacking with the laser's own bonus.
      if (synergy.overchargedBeam) {
        dmg *= 1 + (this.upgrades.fireRate - Player.SYNERGY_TIER + 1) * 0.08;
      }
      const color  = "#00e5ff";
      const b      = this.game.bulletPool.get();
      // FIX(feature1): Piercing Overload — a crit laser bolt fired with
      // critChance heavily invested pierces 2 further than the base cap.
      const maxPierce = (synergy.piercingOverload && isCrit) ? 6 : 4;
      b.init(this.x, this.y,
        Math.cos(angle) * this.bulletSpd * 1.5,
        Math.sin(angle) * this.bulletSpd * 1.5,
        (isCrit ? 9 : 7) * this.game.uiScale, color, dmg, false, true /* piercing */, maxPierce, "laser");
      this.game.bullets.push(b);
      this.game.trailMgr.register(b, b.color);
      return;
    }

    // ── Default gun (original logic, tripleShot buff preserved) ───────────
    audio.playShoot();
    const baseAngles = (this.buffs.tripleShot > 0)
      ? [angle, angle - 0.2, angle + 0.2]
      : [angle];

    for (const ang of baseAngles) {
      const isCrit = Math.random() < this.critChance;
      const isRage = this.buffs.rage > 0;
      const dmg    = (isRage || isCrit) ? this.damage * 2 : this.damage;
      const color  = isCrit ? "#f1c40f" : isRage ? "#ff4757" : "#e74c3c";
      const size   = (isCrit ? 7 : 5) * this.game.uiScale;

      const b = this.game.bulletPool.get();
      b.init(this.x, this.y, Math.cos(ang) * this.bulletSpd, Math.sin(ang) * this.bulletSpd, size, color, dmg, false, false, 4, "default");
      this.game.bullets.push(b);
      this.game.trailMgr.register(b, b.color);
    }
  }

  addXP(amount) {
    this.stats.xp += amount;
    if (this.stats.xp >= this.stats.xpToNext) {
      this.stats.level++;
      this.stats.xp      -= this.stats.xpToNext;
      this.stats.xpToNext = Math.floor(this.stats.xpToNext * 1.2);
      // FIX(feature4): levels 10/20/30 offer a one-time Ascension mod choice
      // instead of the normal 7-way grid. _ascensionLevelsSeen guards against
      // re-offering the same level (e.g. if XP overflow somehow re-lands on
      // it, or on a resumed run — see Game.resumeRun()).
      if (ASCENSION_LEVELS.includes(this.stats.level) && !this._ascensionLevelsSeen.has(this.stats.level)) {
        this._ascensionLevelsSeen.add(this.stats.level);
        this.game.ui.showAscensionChoice();
      } else {
        this.game.ui.showLevelUp();
      }
    }
  }

  /**
   * Sharp fighter-jet ship. Render position is lerped between prevX/prevY
   * and x/y via alpha; reuses _cachedAimAngle instead of re-scanning enemies.
   */
  draw(ctx, input, alpha) {
    if (!this.alive) return;

    // Interpolated render position
    const rx = Utils.lerp(this.prevX, this.x, alpha);
    const ry = Utils.lerp(this.prevY, this.y, alpha);

    // reuse the tick-cached angle — no duplicate O(n) enemy scan
    const angle = this._cachedAimAngle;

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(angle);

    const s = this.size;

    // Shield aura — two concentric rings
    if (this.buffs.shield > 0) {
      ctx.strokeStyle = "rgba(72,219,251,0.22)";
      ctx.lineWidth   = 8;
      ctx.beginPath();
      ctx.arc(0, 0, s + 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(72,219,251,0.72)";
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s + 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    const glow = GlowCache.get(this.color, s, s * 0.6);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(glow.canvas, -glow.half, -glow.half);
    ctx.globalAlpha = 1.0;

    const flicker   = 0.8 + Math.sin(this.game.gameTime * 40) * 0.2;
    const flameGrad = ctx.createLinearGradient(-s * 0.25, 0, -s * 1.1 * flicker, 0);
    flameGrad.addColorStop(0, `rgba(255,200,80,${0.95 * flicker})`);
    flameGrad.addColorStop(0.5, `rgba(255,120,20,${0.6 * flicker})`);
    flameGrad.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-s * 0.22,  s * 0.18);
    ctx.lineTo(-s * 1.1 * flicker, 0);
    ctx.lineTo(-s * 0.22, -s * 0.18);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo( s * 1.1,   0);
    ctx.lineTo( s * 0.1,   s * 0.18);
    ctx.lineTo(-s * 0.35,  s * 0.85);
    ctx.lineTo(-s * 0.5,   s * 0.22);
    ctx.lineTo(-s * 0.22,  0);
    ctx.lineTo(-s * 0.5,  -s * 0.22);
    ctx.lineTo(-s * 0.35, -s * 0.85);
    ctx.lineTo( s * 0.1,  -s * 0.18);
    ctx.closePath();

    ctx.fillStyle = this.color;
    ctx.fill();

    ctx.strokeStyle = "rgba(5,8,16,0.8)";
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Cockpit highlight
    ctx.fillStyle = "rgba(0,229,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(s * 0.45, 0, s * 0.18, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}


// =============================================================================
// SECTION 10 — ENEMY
// prevX/prevY cached so draw() can lerp the render position. Ranged enemies
// gate fire behind _hasLineOfSight(). orbitDirection is assigned randomly at
// spawn so ranged enemies don't all strafe the same way.
// =============================================================================
class Enemy {
  constructor(game, x, y, type, waveFactor) {
    this.game  = game;
    this.x     = x;
    this.y     = y;
    this.prevX = x;
    this.prevY = y;
    this.type  = type;
    this.alive = true;

    const baseHp   = 20 + Math.floor(waveFactor * 10);
    this.damage    = 10 + Math.floor(waveFactor * 2);
    this._lastShot = game.gameTime;
    this._lastMeleeHit = -Infinity;

    // FIX(perf4): per-type stats now read from ENEMY_TYPES (see SECTION 1c)
    // instead of a local switch — pure refactor, numbers are unchanged.
    const def = ENEMY_TYPES[type] || ENEMY_TYPES.normal;
    this.color      = def.color;
    this.size       = def.baseSize * game.uiScale;
    this.speed      = def.speed;
    this.hp         = baseHp * def.hpMul;
    this.shootDelay = def.shootDelay;

    if (def.preferredDistMul !== undefined) {
      this._preferredDist = def.preferredDistMul * game.uiScale;
      // randomise orbit direction so enemies don't all strafe the same way
      this.orbitDirection = Math.random() < 0.5 ? 1 : -1;
    }
    if (def.meleeCooldown !== undefined) {
      // FIX(bug1): melee contact-damage tuning per type — read by the
      // proximity check in update(). Tank hits harder and less often;
      // rusher hits lighter but more frequently, matching its "swarm" role.
      this.meleeCooldown   = def.meleeCooldown;
      this.meleeDamageMult = def.meleeDamageMult;
    }

    this.maxHp = this.hp;
  }

  /**
   * A4 — LoS now delegated to Utils.hasLineOfSight (shared with Boss).
   * The duplicate per-class method has been removed.
   */
  _hasLineOfSight(player) {
    return Utils.hasLineOfSight(this.game, this.x, this.y, player.x, player.y);
  }

  update(dt, player) {
    this.prevX = this.x;
    this.prevY = this.y;

    const toDx  = player.x - this.x;
    const toDy  = player.y - this.y;
    const dist  = Math.hypot(toDx, toDy) || 1;
    const angle = Math.atan2(toDy, toDx);

    // ── Ranged: orbit at preferred distance
    // use this.orbitDirection (±1) so ranged enemies alternate CW/CCW
    let sdx, sdy;
    if (this.type === "ranged" && this._preferredDist) {
      const diff = dist - this._preferredDist;
      // orbitDirection flips the perpendicular strafe component
      const strafeAng = angle + Math.PI * 0.5 * this.orbitDirection;
      const strafeStr = 0.6;
      if (Math.abs(diff) > 40) {
        const radialDir = diff > 0 ? 1 : -1;
        sdx = Math.cos(angle) * this.speed * radialDir + Math.cos(strafeAng) * this.speed * strafeStr;
        sdy = Math.sin(angle) * this.speed * radialDir + Math.sin(strafeAng) * this.speed * strafeStr;
      } else {
        sdx = Math.cos(strafeAng) * this.speed;
        sdy = Math.sin(strafeAng) * this.speed;
      }
    } else {
      sdx = Math.cos(angle) * this.speed;
      sdy = Math.sin(angle) * this.speed;
    }

    const SEP_RADIUS = this.size * 3.0;
    const SEP_FORCE  = this.speed * 0.8;
    const neighbours = this.game.spatialHash.query(this.x, this.y, SEP_RADIUS);
    let   sepX = 0, sepY = 0;

    for (const other of neighbours) {
      if (other === this) continue;
      const dSq = Utils.distSq(this.x, this.y, other.x, other.y);
      const minD = this.size + other.size;
      if (dSq < minD * minD && dSq > 0.001) {
        const d   = Math.sqrt(dSq);
        const str = (minD - d) / minD;
        sepX += ((this.x - other.x) / d) * str;
        sepY += ((this.y - other.y) / d) * str;
      }
    }

    sdx += sepX * SEP_FORCE;
    sdy += sepY * SEP_FORCE;
    const len = Math.hypot(sdx, sdy);
    if (len > 0.001) { sdx = (sdx / len) * this.speed; sdy = (sdy / len) * this.speed; }

    const nx = this.x + sdx * dt;
    const ny = this.y + sdy * dt;
    if (!this.game.checkWallCollision(nx, ny, this.size)) { this.x = nx; this.y = ny; }

    // FIX(bug1): melee contact damage for tank/rusher. These types are
    // configured with shootDelay: 99 ("melee only") but previously had no
    // actual damage path — mirrors the boss dash's proximity-check pattern
    // (dSq < (size+size)^2) with its own per-enemy cooldown so it ticks at
    // most once per meleeCooldown seconds while touching, instead of every
    // physics frame. Uses a direct distance check against the player (not
    // a SpatialHash query), so there's no risk of double-counting a hit
    // across neighbour-query results.
    if ((this.type === "tank" || this.type === "rusher") && player.alive) {
      const meleeDSq = Utils.distSq(this.x, this.y, player.x, player.y);
      const meleeMinD = this.size + player.size;
      if (meleeDSq < meleeMinD * meleeMinD) {
        const sinceLastMelee = this.game.gameTime - this._lastMeleeHit;
        if (sinceLastMelee >= this.meleeCooldown) {
          this._lastMeleeHit = this.game.gameTime;
          if (player.buffs.shield <= 0) {
            player.health -= this.damage * this.meleeDamageMult;
            this.game.triggerDamageFlash(this.type === "tank" ? 1.2 : 0.8);
            this.game.audio.playPlayerHit();
            if (player.health <= 0) { player.alive = false; player.health = 0; }
          }
        }
      }
    }

    const timeSinceShot = this.game.gameTime - this._lastShot;
    // ranged enemies must have LoS before firing; others fire freely
    const canFire = (this.type === "ranged")
      ? timeSinceShot >= this.shootDelay && this._hasLineOfSight(player)
      : timeSinceShot >= this.shootDelay && !this.game.checkWallCollision(this.x, this.y, this.size);

    if (canFire) {
      this._lastShot = this.game.gameTime;

      if (this.type === "exploder") {
        this.game.spawnParticles(this.x, this.y, this.color, 35);
        this.hp = 0;
        const blastRadSq = (105 * this.game.uiScale) ** 2;
        const dSq        = Utils.distSq(this.x, this.y, player.x, player.y);
        if (dSq < blastRadSq && player.alive) {
          const falloff = 1 - (Math.sqrt(dSq) / Math.sqrt(blastRadSq));
          player.health -= this.damage * 2 * falloff;
          this.game.triggerDamageFlash(1.5, true);   // FIX(bug4): high-intensity — thud
          this.game.audio.playPlayerHit();
          this.game._addShake(CONFIG.SHAKE_MAX * 1.5, true);   // FIX(bug4)
          if (player.health <= 0) { player.alive = false; player.health = 0; }
        }
        return;
      }

      // tank and rusher are melee-only — shootDelay: 99 means canFire here is
      // effectively unreachable for them; real melee damage now happens in
      // the proximity check above (FIX(bug1)). Left as a defensive no-op.
      if (this.type === "tank" || this.type === "rusher") return;

      const shootAngle = Math.atan2(player.y - this.y, player.x - this.x);

      // ranged fires a fast single accurate shot; spread fires 3-way
      const angles = (this.type === "spread")
        ? [shootAngle, shootAngle - 0.28, shootAngle + 0.28]
        : [shootAngle];

      for (const ang of angles) {
        const b = this.game.bulletPool.get();
        b.init(this.x, this.y,
          Math.cos(ang) * CONFIG.ENEMY_BULLET_SPEED,
          Math.sin(ang) * CONFIG.ENEMY_BULLET_SPEED,
          5 * this.game.uiScale, this.color, this.damage, true);
        this.game.bullets.push(b);
        this.game.trailMgr.register(b, b.color);
      }
    }
  }

  // Neon-geometry draw: rotating polygon silhouette with glow stroke + inner core
  draw(ctx, alpha) {
    const rx   = Utils.lerp(this.prevX, this.x, alpha);
    const ry   = Utils.lerp(this.prevY, this.y, alpha);
    const s    = this.size;
    const t    = this.game.gameTime;

    // Pre-rendered halo
    const glow = GlowCache.get(this.color, s, s * 1.4);
    ctx.drawImage(glow.canvas, rx - glow.half, ry - glow.half);

    ctx.save();
    ctx.translate(rx, ry);

    // FIX(perf4): rotSpeed/sides now read from the same ENEMY_TYPES entry
    // used by the constructor, instead of a second (and third) ternary
    // chain that had to be kept in sync by hand.
    const def = ENEMY_TYPES[this.type] || ENEMY_TYPES.normal;
    ctx.rotate(t * def.rotSpeed);

    const sides = def.sides;

    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a  = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * s;
      const py = Math.sin(a) * s;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Dark hollow fill + neon stroke
    ctx.fillStyle   = "rgba(5,8,16,0.7)";
    ctx.fill();
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = this.color;
    ctx.shadowBlur  = 14;
    ctx.stroke();

    // Pulsing inner energy core
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = this.color;
    ctx.globalAlpha = 0.5 + Math.sin(t * 6 + this.x) * 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();

    // HP bar — only shown when enemy is damaged; 4px tall, centred above enemy
    if (this.hp < this.maxHp && this.maxHp > 0) {
      const barW = s * 2.2;
      const barH = 4;
      const barX = rx - barW / 2;
      const barY = ry - s - 10;
      const frac = Math.max(0, this.hp / this.maxHp);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle   = "rgba(0,0,0,0.6)";
      ctx.fillRect(barX, barY, barW, barH);
      const hue     = Math.round(frac * 120);   // 120=green → 0=red as HP drops
      ctx.fillStyle = `hsl(${hue},100%,50%)`;
      ctx.fillRect(barX, barY, barW * frac, barH);
      ctx.restore();
    }
  }
}


// =============================================================================
// SECTION 10b — BOSS
// Spawns every 5 waves.  Two-phase attack cycle:
//   Phase A "Radial Hell" — fires N bullets in a ring, then rests.
//   Phase B "Charge Dash" — telegraphs (flashes) then dashes at the player.
// Boss also takes 50 % reduced damage so fights last longer.
// =============================================================================
class Boss {
  constructor(game) {
    this.game   = game;
    this.x      = game.width  / 2;
    this.y      = -80;          // enters from top-center
    this.prevX  = this.x;
    this.prevY  = this.y;
    this.alive  = true;
    this.size   = 52 * game.uiScale;
    this.color  = "#ff2d55";
    this.speed  = 80;

    const wf    = Math.max(1, Math.log(game.wave + 1));
    this.maxHp  = 800 + game.wave * 120;
    this.hp     = this.maxHp;
    this.damage = 20 + Math.floor(wf * 4);

    // Phase machine
    // "enter"  → moves to arena center, then starts cycle
    // "radial" → fires radial burst
    // "rest"   → pause between attacks
    // "telegraph" → flashes before dash (1.2 s window, player can dodge)
    // "dash"   → high-speed charge toward the player's last known position
    this._phase        = "enter";
    this._phaseTimer   = 0;
    this._targetX      = game.width  / 2;
    this._targetY      = game.height / 2;
    this._dashDx       = 0;
    this._dashDy       = 0;
    this._radialCount  = 0;   // increments each radial phase for increasing difficulty
    this._flashToggle  = false;
    this._flashTimer   = 0;
    this._lastShot     = 0;
    this._shootInterval = 0.18;  // seconds between radial ring shots during burst
    this._burstShots    = 0;     // shots fired in current radial burst
    this._burstTarget   = 16;    // ring count per burst
  }

  get isAlive() { return this.hp > 0; }

  /**
   * A4 — LoS delegated to Utils.hasLineOfSight (duplicate of Enemy version removed).
   * Returns true if boss has a clear line to player through walls/crates.
   */
  _hasLineOfSight(player) {
    return Utils.hasLineOfSight(this.game, this.x, this.y, player.x, player.y);
  }

  update(dt, player) {
    this.prevX = this.x;
    this.prevY = this.y;

    switch (this._phase) {

      // ── ENTER: glide to arena centre ──────────────────────────────────────
      case "enter": {
        const dx = this._targetX - this.x;
        const dy = this._targetY - this.y;
        const d  = Math.hypot(dx, dy);
        if (d < 4) {
          this.x = this._targetX;
          this.y = this._targetY;
          this._startRadial();
        } else {
          const spd = this.speed * 2;
          this.x += (dx / d) * spd * dt;
          this.y += (dy / d) * spd * dt;
        }
        break;
      }

      // ── RADIAL: fire expanding rings of bullets ────────────────────────────
      case "radial": {
        this._phaseTimer += dt;
        const sinceShot = this.game.gameTime - this._lastShot;
        if (sinceShot >= this._shootInterval && this._burstShots < this._burstTarget) {
          this._lastShot = this.game.gameTime;
          this._burstShots++;
          // Each ring is offset by a small angle so rings interleave
          const offset = (this._burstShots / this._burstTarget) * Math.PI * 0.5;
          const rings  = 12 + this._radialCount * 2;
          for (let i = 0; i < rings; i++) {
            const ang = (i / rings) * Math.PI * 2 + offset;
            const spd = 220 + this._radialCount * 18;
            const b   = this.game.bulletPool.get();
            b.init(this.x, this.y,
              Math.cos(ang) * spd, Math.sin(ang) * spd,
              6 * this.game.uiScale, "#ff2d55", this.damage, true);
            this.game.bullets.push(b);
            this.game.trailMgr.register(b, b.color);
          }
        }
        if (this._burstShots >= this._burstTarget) {
          this._phase      = "rest";
          this._phaseTimer = 0;
        }
        break;
      }

      // ── REST: short pause then telegraph charge ────────────────────────────
      case "rest": {
        this._phaseTimer += dt;

        // during the rest pause, fire a targeted 3-round burst at the
        // player only if there is clear LoS — boss can't shoot through walls.
        const sinceShot = this.game.gameTime - this._lastShot;
        if (sinceShot >= 0.55 && this._phaseTimer < 1.2 && this._hasLineOfSight(player)) {
          this._lastShot = this.game.gameTime;
          const shootAngle = Math.atan2(player.y - this.y, player.x - this.x);
          for (let i = -1; i <= 1; i++) {
            const ang = shootAngle + i * 0.18;
            const b   = this.game.bulletPool.get();
            b.init(this.x, this.y,
              Math.cos(ang) * 280, Math.sin(ang) * 280,
              6 * this.game.uiScale, "#ff9f43", this.damage * 0.7, true);
            this.game.bullets.push(b);
            this.game.trailMgr.register(b, b.color);
          }
        }

        if (this._phaseTimer >= 1.4) {
          this._phase      = "telegraph";
          this._phaseTimer = 0;
          this._flashTimer = 0;
          this._flashToggle = false;
          // Lock onto player's current position for the upcoming dash
          this._dashDx = player.x - this.x;
          this._dashDy = player.y - this.y;
          const dl = Math.hypot(this._dashDx, this._dashDy) || 1;
          this._dashDx /= dl;
          this._dashDy /= dl;
        }
        break;
      }

      // ── TELEGRAPH: flash yellow for 1.2 s before charging ─────────────────
      case "telegraph": {
        this._phaseTimer += dt;
        this._flashTimer  += dt;
        if (this._flashTimer >= 0.12) {  // toggle every 120 ms
          this._flashToggle = !this._flashToggle;
          this._flashTimer  = 0;
        }
        if (this._phaseTimer >= 1.2) {
          this._phase      = "dash";
          this._phaseTimer = 0;
          this._flashToggle = false;
        }
        break;
      }

      // ── DASH: fast linear charge in the locked direction ─────────────────
      case "dash": {
        this._phaseTimer += dt;
        const dashSpeed = this.speed * 7.5;
        const nx = this.x + this._dashDx * dashSpeed * dt;
        const ny = this.y + this._dashDy * dashSpeed * dt;

        // Check player contact during dash
        if (player.alive) {
          const dSq = Utils.distSq(nx, ny, player.x, player.y);
          if (dSq < (this.size + player.size) ** 2) {
            if (player.buffs.shield <= 0) {
              player.health -= this.damage * 3;
              this.game.triggerDamageFlash(2.0, true);   // FIX(bug4): high-intensity — thud
              this.game.audio.playPlayerHit();
              if (player.health <= 0) { player.alive = false; player.health = 0; }
            }
          }
        }

        this.x = nx;
        this.y = ny;

        // End dash when it exits arena OR after 0.65 s
        const oob = nx < -this.size || nx > this.game.width + this.size ||
                    ny < -this.size || ny > this.game.height + this.size;
        if (oob || this._phaseTimer >= 0.65) {
          // Reposition to centre-ish so boss stays in arena
          if (oob) {
            this.x = Utils.clamp(this.x, this.size, this.game.width  - this.size);
            this.y = Utils.clamp(this.y, this.size, this.game.height - this.size);
          }
          this._radialCount++;
          this._startRadial();
        }
        break;
      }
    }
  }

  _startRadial() {
    this._phase        = "radial";
    this._phaseTimer   = 0;
    this._burstShots   = 0;
    this._burstTarget  = 14 + this._radialCount * 2;  // grows each cycle
    this._lastShot     = this.game.gameTime;
  }

  draw(ctx, alpha) {
    const rx = Utils.lerp(this.prevX, this.x, alpha);
    const ry = Utils.lerp(this.prevY, this.y, alpha);
    const s  = this.size;
    const t  = this.game.gameTime;

    // Telegraph flash: override color to gold
    const drawColor = (this._phase === "telegraph" && this._flashToggle) ? "#f1c40f" : this.color;

    // Outer halo
    const glow = GlowCache.get(drawColor, s, s * 1.8);
    ctx.drawImage(glow.canvas, rx - glow.half, ry - glow.half);

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(t * 0.6);

    // 8-pointed star body
    const outer = s;
    const inner = s * 0.45;
    const pts   = 8;
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const r   = i % 2 === 0 ? outer : inner;
      const ang = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
      i === 0 ? ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r)
              : ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.fillStyle   = "rgba(5,8,16,0.82)";
    ctx.fill();
    ctx.strokeStyle = drawColor;
    ctx.lineWidth   = 3.5;
    ctx.shadowColor = drawColor;
    ctx.shadowBlur  = 22;
    ctx.stroke();

    // Pulsing core
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = drawColor;
    ctx.globalAlpha = 0.55 + Math.sin(t * 8) * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();

    // HP bar (wide, above the boss)
    const barW = s * 3.5;
    const barH = 10 * this.game.uiScale;
    const barX = rx - barW / 2;
    const barY = ry - s - barH - 14;
    const hpR  = Utils.clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = "rgba(255,45,85,0.35)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = "#ff2d55";
    ctx.fillRect(barX, barY, barW * hpR, barH);

    // "BOSS" label
    ctx.save();
    ctx.font      = `900 ${Math.max(14, 18 * this.game.uiScale)}px ${CONFIG.HUD_FONT}`;
    ctx.fillStyle = "#ff2d55";
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff2d55";
    ctx.shadowBlur  = 10;
    ctx.fillText("BOSS", rx, barY - 6);
    ctx.restore();
  }
}


// =============================================================================
// SECTION 11 — INPUT MANAGER
// _updateJoystick now stores a normalised [-1,1] unit vector
//                      instead of raw pixels, so movement is decoupled from CSS size
// _shootBuffer latch set on mousedown / touchstart so clicks
//                      between fixed-step ticks are never silently dropped
// weapon cycle moved to E / Shift — Tab hijacks focus,
//                      Q is reserved for quit-in-pause
// =============================================================================
class InputManager {
  constructor(game) {
    this._game          = game;   // reference for FSM state check in joystick auto-fire
    this.keys           = {};
    this.mouseX         = 0;
    this.mouseY         = 0;
    this.isShooting     = false;
    this._shootBuffer   = false;   // latch for sub-tick clicks
    this.joystickActive = false;
    this.joystickX      = 0;       // normalised [-1,1]
    this.joystickY      = 0;       // normalised [-1,1]
    this._pausePressed  = false;
    this._quitPressed   = false;
    this._weaponPressed = false;   // mobile weapon switch button

    // FIX(bug9): isShooting used to be a single flag stomped on directly by
    // four independent input sources (mouse, the canvas aim-touch zone, the
    // FIRE button, and joystick auto-fire). Releasing ANY one of them set
    // isShooting = false outright, even while another source was still held
    // — e.g. releasing the FIRE button while an aim-touch was still down
    // silently stopped fire. Each source now only owns its own flag, and
    // isShooting is derived as the OR of all of them via _updateShootState().
    // FIX(bug3): keyboard source added alongside mouse/touch/joystick —
    // composes through the same _updateShootState() OR-gate as everything else.
    this._shootSources = { mouse: false, aimTouch: false, fireBtn: false, joystick: false, keyboard: false };

    // FIX(bug3): tracks whether the mouse has moved at all this session, so
    // Player._computeAimAngle() can fall back to nearest-enemy auto-aim for
    // keyboard-only fire before any mouse input has occurred.
    this._mouseMoved = false;

    this._bindListeners();
  }

  // FIX(bug9): recompute the public isShooting flag from all active sources.
  _updateShootState() {
    const s = this._shootSources;
    this.isShooting = s.mouse || s.aimTouch || s.fireBtn || s.joystick || s.keyboard;
  }

  // Re-evaluates on every read so rotating a tablet or resizing a window
  // is picked up immediately, instead of being locked in at construction time.
  get isMobile() {
    return /Mobi|Android|iPad|iPhone/i.test(navigator.userAgent) || window.innerWidth <= 1024;
  }

  _bindListeners() {
    const canvas   = document.getElementById("gameCanvas");
    const joy      = document.getElementById("joystick");
    const knob     = joy ? joy.querySelector(".joystick__knob") : null;
    const shootBtn = document.getElementById("shootBtn");

    window.addEventListener("keydown", e => {
      this.keys[e.key.toLowerCase()] = true;
      // FIX(bug3): Spacebar fires toward the current aim direction (mouse
      // aim, or nearest-enemy fallback — see Player._computeAimAngle()).
      // Gated on PLAYING so Space doesn't hijack menus/inputs elsewhere
      // (e.g. the nickname field), and only fires once per physical
      // keydown (ignores OS key-repeat) via the _shootSources.keyboard guard.
      if ((e.code === "Space" || e.key === " ") &&
          this._game && this._game.fsm.is(GameState.PLAYING)) {
        e.preventDefault();
        if (!this._shootSources.keyboard) {
          this._shootSources.keyboard = true;
          this._updateShootState();
          this._shootBuffer = true;
        }
      }
    });
    window.addEventListener("keyup", e => {
      this.keys[e.key.toLowerCase()] = false;
      if (e.code === "Space" || e.key === " ") {
        this._shootSources.keyboard = false;
        this._updateShootState();
      }
    });

    window.addEventListener("mousemove", e => {
      const rect  = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this._mouseMoved = true;   // FIX(bug3)
    });
    window.addEventListener("mousedown", () => {
      this._shootSources.mouse = true;   // FIX(bug9)
      this._updateShootState();
      this._shootBuffer = true;   // latch so the next eligible tick fires
    });
    window.addEventListener("mouseup",   () => {
      this._shootSources.mouse = false;  // FIX(bug9)
      this._updateShootState();
    });

    // ── Touch IDs — track left (joystick) vs right (aim) independently ────────
    let jBaseX = 0, jBaseY = 0;
    let _joyTouchId  = null;
    let _aimTouchId  = null;

    const _isRightSide = touch =>
      touch.clientX > window.innerWidth * 0.45;

    canvas.addEventListener("touchstart", e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      for (const t of e.changedTouches) {
        if (_isRightSide(t) && _aimTouchId === null) {
          _aimTouchId      = t.identifier;
          this.mouseX      = t.clientX - rect.left;
          this.mouseY      = t.clientY - rect.top;
          this._shootSources.aimTouch = true;   // FIX(bug9)
          this._updateShootState();
          this._shootBuffer = true;   // latch on touch too
        }
      }
    }, { passive: false });

    canvas.addEventListener("touchmove", e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      for (const t of e.changedTouches) {
        if (t.identifier === _aimTouchId) {
          this.mouseX = t.clientX - rect.left;
          this.mouseY = t.clientY - rect.top;
        }
      }
    }, { passive: false });

    canvas.addEventListener("touchend", e => {
      for (const t of e.changedTouches) {
        if (t.identifier === _aimTouchId) {
          _aimTouchId = null;
          this._shootSources.aimTouch = false;  // FIX(bug9)
          this._updateShootState();
        }
      }
    });

    // ── Joystick (left zone) ──────────────────────────────────────────────────
    if (joy) {
      joy.addEventListener("touchstart", e => {
        e.preventDefault();
        if (_joyTouchId !== null) return;
        const t = e.changedTouches[0];
        _joyTouchId         = t.identifier;
        this.joystickActive = true;
        joy.classList.add("joystick--active");
        const r = joy.getBoundingClientRect();
        jBaseX  = r.left + r.width  / 2;
        jBaseY  = r.top  + r.height / 2;
        this._updateJoystick(t, jBaseX, jBaseY, knob);
      }, { passive: false });
    }

    document.addEventListener("touchmove", e => {
      if (!this.joystickActive) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === _joyTouchId)
          this._updateJoystick(t, jBaseX, jBaseY, knob);
      }
    }, { passive: false });

    document.addEventListener("touchend", e => {
      for (const t of e.changedTouches) {
        if (t.identifier === _joyTouchId) {
          _joyTouchId         = null;
          this.joystickActive = false;
          this.joystickX      = 0;
          this.joystickY      = 0;
          // FIX(bug9): only clear this source's own flag — other still-held
          // shoot sources (aim-touch, FIRE button, mouse) keep firing.
          this._shootSources.joystick = false;
          this._updateShootState();
          if (knob) knob.style.transform = "translate(-50%, -50%)";
          if (joy) joy.classList.remove("joystick--active");
        }
      }
    });

    // auto-fire only fires when game is in PLAYING state
    const _origUpdateJoy = this._updateJoystick.bind(this);
    this._updateJoystick = (touch, bx, by, k) => {
      _origUpdateJoy(touch, bx, by, k);
      // joystickX/Y are now [-1,1]; threshold 0.2 avoids firing in dead-zone
      const moving = Math.hypot(this.joystickX, this.joystickY) > 0.2;
      // only fire when actually PLAYING — prevents auto-fire during PAUSED/LEVEL_UP
      const shouldFire = moving && this._game && this._game.fsm.is(GameState.PLAYING);
      // FIX(bug9): drive this from the joystick's own shoot-source flag
      // (instead of stomping this.isShooting directly) so it composes
      // correctly with other held shoot sources. This also fixes a related
      // issue: previously auto-fire, once started, never turned back off
      // when the stick was pulled back into the dead-zone while still
      // held — only a full release did. Now it tracks `shouldFire` live.
      this._shootSources.joystick = shouldFire;
      this._updateShootState();
      if (shouldFire) this._shootBuffer = true;
    };

    if (shootBtn) {
      shootBtn.addEventListener("touchstart", e => {
        e.preventDefault();
        this._shootSources.fireBtn = true;   // FIX(bug9)
        this._updateShootState();
        this._shootBuffer = true;
      });
      shootBtn.addEventListener("touchend", e => {
        e.preventDefault();
        this._shootSources.fireBtn = false;  // FIX(bug9)
        this._updateShootState();
      });
    }

    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) {
      pauseBtn.addEventListener("touchstart", e => { e.preventDefault(); this._pausePressed = true; });
      pauseBtn.addEventListener("click", () => { this._pausePressed = true; });
    }

    const quitBtn = document.getElementById("quitBtn");
    if (quitBtn) {
      quitBtn.addEventListener("touchstart", e => { e.preventDefault(); this._quitPressed = true; });
      quitBtn.addEventListener("click", () => { this._quitPressed = true; });
    }

    const weaponBtn = document.getElementById("weaponBtn");
    if (weaponBtn) {
      weaponBtn.addEventListener("touchstart", e => {
        e.preventDefault();
        this._weaponPressed = true;
      });
      weaponBtn.addEventListener("click", () => { this._weaponPressed = true; });
    }

    // C3-PC: desktop weapon-switch button forwards through the same
    // _weaponPressed flag as the mobile button — one code path in
    // _handleInputEvents() does the actual cycling either way.
    const weaponBtnPC = document.getElementById("weaponBtnPC");
    if (weaponBtnPC) {
      weaponBtnPC.addEventListener("click", () => { this._weaponPressed = true; });
    }
  }

  // store a normalised [-1,1] unit vector scaled by deflection ratio.
  // Player.update() multiplies directly by this.speed — no /40 coupling to CSS.
  _updateJoystick(touch, baseX, baseY, knob) {
    const maxRadius = 40;
    let dx = touch.clientX - baseX;
    let dy = touch.clientY - baseY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }

    // Normalised deflection: magnitude 0 (centre) → 1 (rim), direction preserved
    const norm     = dist > 0 ? Math.min(dist, maxRadius) / maxRadius : 0;
    this.joystickX = (dist > 0 ? dx / dist : 0) * norm;
    this.joystickY = (dist > 0 ? dy / dist : 0) * norm;

    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}


// =============================================================================
// SECTION 12 — UI MANAGER  (unchanged)
// =============================================================================
class UIManager {
  constructor(game) {
    this.game = game;

    // load scores once at construction — _saveScore and _renderLeaderboard
    // read/write this._scores in memory; localStorage is only touched on mutation.
    try {
      const parsedScores = JSON.parse(localStorage.getItem("ks_scores") || "[]");
      // FIX(bug10): _saveScore()/_renderLeaderboard() call array methods
      // (sort/filter/map) on this unconditionally — a corrupted or
      // non-array value here would throw the first time either runs.
      this._scores = Array.isArray(parsedScores) ? parsedScores : [];
    } catch {
      this._scores = [];
    }

    this._el = {
      startScreen:     document.getElementById("startScreen"),
      levelUp:         document.getElementById("levelUpScreen"),
      ascension:       document.getElementById("ascensionScreen"),   // FIX(feature4)
      gameOverActions: document.getElementById("gameOverActions"),
      mobileUI:        document.getElementById("mobileControls"),
      leaderboard:     document.getElementById("localLeaderboard"),
      coinShop:        document.getElementById("coinShop"),
      instructions:    document.getElementById("instructionsScreen"), // FIX(instructions1)
    };

    // FIX(feature4): non-null only while an Ascension choice is on screen —
    // used by Game.saveRunSnapshot()/resumeRun() so a mid-choice save/reload
    // re-shows the Ascension screen instead of the normal upgrade grid.
    this._pendingAscension = null;

    this._bindUI();
    this._renderLeaderboard();
    this._renderCoinShop();
    this._renderDailyHistory();   // FIX(feature5): daily comparative hook
    this._updateResumeButton();   // FIX(feature6): mid-run save/resume

    // FIX(feature3): show today's UTC date next to the Daily Challenge
    // toggle so it's clear which day's seed a run will use.
    const dailyDateLabel = document.getElementById("dailyDateLabel");
    if (dailyDateLabel) dailyDateLabel.textContent = `(${Utils.todayUTCString()})`;
  }

  _bindUI() {
    const muteBtn = document.getElementById("muteBtn");
    if (muteBtn) {
      muteBtn.textContent = this.game.audio.muted ? "🔇" : "🔊";
      muteBtn.addEventListener("click", () => {
        this.game.audio.toggleMute();
        muteBtn.textContent = this.game.audio.muted ? "🔇" : "🔊";
      });
    }

    // FIX(instructions1): "How to Play" modal. Reuses the exact same
    // classList.add/remove("hidden") pattern already used for
    // levelUpScreen / coinShop below — no new show/hide plumbing.
    // Which control-scheme section is shown is decided by
    // _shouldShowMobileUI(), the same check startBtn/restartBtn already
    // use to toggle #mobileControls, rather than adding a second
    // touch/device detection method.
    const howToBtn     = document.getElementById("howToPlayBtn");
    const instrPanel   = this._el.instructions;
    const instrClose   = document.getElementById("instructionsCloseBtn");
    const instrDesktop = document.getElementById("howtoControlsDesktop");
    const instrMobile  = document.getElementById("howtoControlsMobile");

    const openInstructions = () => {
      if (!instrPanel) return;
      const mobile = this._shouldShowMobileUI();
      instrDesktop?.classList.toggle("hidden", mobile);
      instrMobile?.classList.toggle("hidden", !mobile);
      instrPanel.classList.remove("hidden");
    };

    const closeInstructions = () => {
      instrPanel?.classList.add("hidden");
    };

    if (howToBtn) howToBtn.addEventListener("click", openInstructions);
    if (instrClose) instrClose.addEventListener("click", closeInstructions);

    // Clicking the dimmed backdrop (i.e. anywhere that isn't the inner
    // card) closes the panel, same "click outside" convention used for
    // other overlay dismissals in this codebase.
    if (instrPanel) {
      instrPanel.addEventListener("click", e => {
        if (e.target === instrPanel) closeInstructions();
      });
    }

    // FIX(instructions2): dedicated Escape handler for this modal. It's
    // intentionally separate from InputManager's keys["escape"] latch
    // (which drives in-game pause and is only read while
    // fsm.is(GameState.PLAYING)) — the how-to-play modal is only
    // reachable from the start screen, before the game loop is running,
    // so the two Escape paths never compete in the same frame. Opening
    // and closing this panel never touches game state (fsm, player,
    // audio, etc.), so it's safe to return to the start screen exactly
    // as it was.
    window.addEventListener("keydown", e => {
      if (e.key === "Escape" && instrPanel && !instrPanel.classList.contains("hidden")) {
        closeInstructions();
      }
    });

    const startBtn = document.getElementById("startBtn");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        const nicknameInput = document.getElementById("nicknameInput");
        const raw  = nicknameInput ? nicknameInput.value.trim() : "";
        const name = raw.length > 0 ? raw : "Ghost";
        // FIX(bug5): guard against quota errors / Safari private-mode throws
        try { localStorage.setItem("ks_nickname", name); } catch { /* falls back to "Ghost" next read */ }
        this._el.startScreen.classList.add("hidden");
        this._el.coinShop?.classList.add("hidden");
        if (this._shouldShowMobileUI()) {
          this._el.mobileUI.classList.add("mobile-ui--active");
          attemptLandscapeLock();
        }
        // FIX(feature3): "Daily Challenge" toggle on the start screen picks
        // the seeded-vs-random RNG for this run; explicit here so a fresh
        // deploy from the menu always reflects the current toggle state
        // rather than silently carrying over the previous run's mode.
        const dailyToggle = document.getElementById("dailyModeToggle");
        this.game.start({ daily: !!dailyToggle?.checked });
      });
    }

    // FIX(feature6): "Resume Run" — only shown when a saved mid-run snapshot
    // exists (see _updateResumeButton()). Sits alongside DEPLOY rather than
    // replacing it, since the player may still want a fresh run instead.
    const resumeBtn = document.getElementById("resumeBtn");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => {
        this._el.startScreen.classList.add("hidden");
        this._el.coinShop?.classList.add("hidden");
        if (this._shouldShowMobileUI()) {
          this._el.mobileUI.classList.add("mobile-ui--active");
          attemptLandscapeLock();
        }
        if (!this.game.resumeRun()) {
          // Snapshot vanished/corrupted between page load and click (rare) —
          // fall back to a normal fresh run instead of doing nothing.
          this._el.startScreen.classList.remove("hidden");
          this._updateResumeButton();
        }
      });
    }

    const restartBtn = document.getElementById("restartBtn");
    if (restartBtn) {
      restartBtn.addEventListener("click", () => {
        this._el.gameOverActions.classList.add("hidden");
        document.getElementById("gameOverCoins")?.classList.add("hidden");
        this._el.coinShop?.classList.add("hidden");
        if (this._shouldShowMobileUI()) {
          this._el.mobileUI.classList.add("mobile-ui--active");
          attemptLandscapeLock();
        }
        this.game.start();
      });
    }

    const menuBtn = document.getElementById("menuBtn");
    if (menuBtn) {
      menuBtn.addEventListener("click", () => {
        this._el.gameOverActions.classList.add("hidden");
        document.getElementById("gameOverCoins")?.classList.add("hidden");
        this._el.mobileUI.classList.remove("mobile-ui--active");
        this._renderLeaderboard();
        this._renderCoinShop();
        this._el.startScreen.classList.remove("hidden");
        cancelAnimationFrame(this.game._rafId);
        this.game.fsm.transition(GameState.MENU);
      });
    }

    // FIX(feature5): "Copy Result" — daily runs only (see showGameOver()),
    // writes a short plain-text one-line summary to the clipboard, Wordle-
    // grid style: text only, no images, no network call.
    const copyResultBtn = document.getElementById("copyResultBtn");
    if (copyResultBtn) {
      copyResultBtn.addEventListener("click", () => {
        const r = this._lastDailyResult;
        if (!r || !navigator.clipboard?.writeText) return;
        const mins = Math.floor(r.time / 60);
        const secs = Math.round(r.time % 60).toString().padStart(2, "0");
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${Math.round(r.time)}s`;
        const text = `KritikShoot Daily ${r.date}\n`
          + `\u{1F30A} Wave ${r.wave}  \u{1F480} ${r.kills} kills  \u23F1 ${timeStr}  \u{1F52B} ${r.weaponLabel}`
          + (r.isNewBest ? "  \u2728 New best!" : "");
        navigator.clipboard.writeText(text)
          .then(() => this._showQuitToast("Result copied to clipboard!"))
          .catch(() => {});
      });
    }

    document.querySelectorAll(".btn--upgrade").forEach(btn => {
      btn.addEventListener("click", e => {
        const type = e.currentTarget.dataset.type;
        if (!type || !(type in this.game.player.upgrades)) return;
        this.game.player.upgrades[type]++;
        if (type === "health") this.game.player.health = this.game.player.maxHealth;
        this._el.levelUp.classList.add("hidden");
        this.game.fsm.transition(GameState.PLAYING);
        this.game.lastTime = performance.now();
      });
    });
  }

  // FIX(feature6): shows/hides the "Resume Run" button based on whether a
  // saved mid-run snapshot exists. Called on load and after any action that
  // creates/consumes one (start, resume, game over, quit).
  _updateResumeButton() {
    const btn = document.getElementById("resumeBtn");
    if (btn) btn.classList.toggle("hidden", !this.game.hasSavedRun());
  }

  // Returns true if mobile controls should be shown. Checks the live isMobile
  // getter (catches orientation changes) and also detects landscape touch devices
  // that wouldn't pass the portrait width threshold alone.
  _shouldShowMobileUI() {
    if (this.game.input.isMobile) return true;
    const isLandscapeTouch = (
      navigator.maxTouchPoints > 0 &&
      screen.orientation &&
      screen.orientation.type.startsWith("landscape")
    );
    return isLandscapeTouch;
  }

  showLevelUp() {
    this.game.fsm.transition(GameState.LEVEL_UP);
    this._el.levelUp.classList.remove("hidden");
  }

  // FIX(feature4): Ascension mod choice — a special 2-of-3 pick that
  // replaces the normal 7-way grid at levels 10/20/30 (see Player.addXP()).
  // Reuses the LEVEL_UP FSM state and the same overlay show/hide pattern as
  // showLevelUp(), just a different panel (#ascensionScreen) with buttons
  // built dynamically since the pair shown is randomised each time.
  showAscensionChoice() {
    const pair = this._pickAscensionPair();
    this._pendingAscension = pair;   // read by Game.saveRunSnapshot()/resumeRun()

    const grid = this._el.ascension?.querySelector("#ascensionGrid");
    if (grid) {
      grid.innerHTML = "";
      for (const mod of pair) {
        const btn = document.createElement("button");
        btn.className = "btn btn--upgrade btn--ascension";
        btn.setAttribute("role", "listitem");
        btn.dataset.modId = mod.id;
        const title = document.createElement("span");
        title.className   = "upgrade-title";
        title.textContent = mod.label;
        const desc = document.createElement("span");
        desc.className   = "upgrade-desc";
        desc.textContent = mod.desc;
        btn.append(title, desc);
        btn.addEventListener("click", () => {
          this.game.player.mods[mod.id] = true;
          this._pendingAscension = null;
          this._el.ascension.classList.add("hidden");
          this.game.fsm.transition(GameState.PLAYING);
          this.game.lastTime = performance.now();
        });
        grid.appendChild(btn);
      }
    }

    this.game.fsm.transition(GameState.LEVEL_UP);
    this._el.ascension?.classList.remove("hidden");
  }

  // Picks 2 of the 3 ASCENSION_MODS entries at random (no replacement) —
  // "2-of-3": the pair shown varies run to run, and covers mods for
  // different weapons, not just the one currently equipped.
  _pickAscensionPair() {
    const pool = [...ASCENSION_MODS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 2);
  }

  // FIX(design2): shared by showGameOver() and quitToMenu() so both save the
  // leaderboard entry and award coins the exact same way — no duplicated logic.
  _finalizeRun() {
    const g    = this.game;
    // FIX(audit1): unguarded localStorage.getItem() — see the matching fix
    // in MetaProgression.initSession() for why this needs a try/catch too.
    let name = "Ghost";
    try { name = localStorage.getItem("ks_nickname") || "Ghost"; } catch { name = "Ghost"; }
    this._saveScore(name, g.wave, g.gameTime, g.player.stats.level);
    this._renderLeaderboard();
    const coinsEarned = g.meta.awardCoins(g.wave, g.gameTime);
    this._lastCoinsEarned = coinsEarned;
    return coinsEarned;
  }

  // FIX(design2): quitting now preserves progress — awards coins and saves the
  // leaderboard entry via the same _finalizeRun() logic showGameOver() uses —
  // but stays a clean early exit: no full game-over/run-summary panel, just a
  // brief toast ("+N coins earned, returning to menu") before the menu shows.
  quitToMenu() {
    const g = this.game;
    cancelAnimationFrame(g._rafId);

    // Only bank progress if a run was actually in flight (player exists).
    let coinsEarned = 0;
    if (g.player) coinsEarned = this._finalizeRun();

    // FIX(feature6): explicit quit ends the run — an in-progress snapshot
    // from earlier this run is now stale, clear it.
    g.clearSavedRun();
    this._pendingAscension = null;

    this.game.fsm.transition(GameState.MENU);
    this._el.gameOverActions.classList.add("hidden");
    this._el.levelUp.classList.add("hidden");
    this._el.ascension?.classList.add("hidden");
    this._el.mobileUI.classList.remove("mobile-ui--active");
    this._el.mobileUI.classList.remove("paused");
    const qb = document.getElementById("quitBtn");
    if (qb) qb.classList.add("hidden");
    this._renderLeaderboard();
    this._renderCoinShop();
    this._updateResumeButton();
    this._el.startScreen.classList.remove("hidden");

    if (coinsEarned > 0) this._showQuitToast(`+${coinsEarned} coins earned — returning to menu`);
  }

  // Lightweight, self-dismissing toast for the quit-with-progress flow.
  // Reuses a single DOM node so rapid quit/restart cycles don't leak elements.
  _showQuitToast(message) {
    let toast = document.getElementById("quitToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "quitToast";
      toast.className = "quit-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    // restart the fade animation even if a toast is already showing
    toast.classList.remove("quit-toast--show");
    void toast.offsetWidth;   // force reflow so the class re-add re-triggers CSS animation
    toast.classList.add("quit-toast--show");
    clearTimeout(this._quitToastTimer);
    this._quitToastTimer = setTimeout(() => {
      toast.classList.remove("quit-toast--show");
    }, 2600);
  }

  showGameOver() {
    const g = this.game;
    const coinsEarned = this._finalizeRun();

    const p = g.player;
    const mostUsedWeapon = Object.entries(p.weaponShots)
      .reduce((best, [w, cnt]) => cnt > best[1] ? [w, cnt] : best, ["default", -1])[0];
    const weaponLabel = { default: "GUN", spread: "SHOTGUN", laser: "LASER" }[mostUsedWeapon] || mostUsedWeapon.toUpperCase();
    const mins = Math.floor(g.gameTime / 60);
    const secs = (g.gameTime % 60).toFixed(0).padStart(2, "0");
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${g.gameTime.toFixed(1)}s`;

    const summaryEl = document.createElement("div");
    summaryEl.className = "run-summary";
    summaryEl.innerHTML = `
      <div class="run-summary__row"><span class="run-summary__label">KILLS</span><span class="run-summary__value">${g.kills}</span></div>
      <div class="run-summary__row"><span class="run-summary__label">WAVE</span><span class="run-summary__value">${g.wave}</span></div>
      <div class="run-summary__row"><span class="run-summary__label">TIME</span><span class="run-summary__value">${timeStr}</span></div>
      <div class="run-summary__row"><span class="run-summary__label">LEVEL</span><span class="run-summary__value">${p.stats.level}</span></div>
      <div class="run-summary__row"><span class="run-summary__label">WEAPON</span><span class="run-summary__value">${weaponLabel}</span></div>
      <div class="run-summary__row"><span class="run-summary__label">COINS</span><span class="run-summary__value">+${coinsEarned} 🪙</span></div>
    `;
    // Remove any prior summary before inserting (in case of quick restart)
    const existingSummary = this._el.gameOverActions.querySelector(".run-summary");
    if (existingSummary) existingSummary.remove();
    this._el.gameOverActions.prepend(summaryEl);

    this._el.gameOverActions.classList.remove("hidden");

    // Show coin award notice
    const coinsEl = document.getElementById("gameOverCoins");
    if (coinsEl) {
      coinsEl.textContent = `+${coinsEarned} coins earned`;
      coinsEl.classList.remove("hidden");
    }

    // FIX(feature5): Daily Challenge comparative hook — track today's
    // personal best distinctly from the normal leaderboard, roll it into the
    // 30-day history, and surface a "Copy Result" share button (daily runs
    // only — a non-daily run's wave/time isn't comparable day to day).
    const copyBtn = document.getElementById("copyResultBtn");
    if (g.dailyMode) {
      this._updateDailyResult({
        date: g.dailySeedDate || Utils.todayUTCString(),
        wave: g.wave, time: g.gameTime, kills: g.kills, weaponLabel,
      });
      copyBtn?.classList.remove("hidden");
    } else {
      this._lastDailyResult = null;
      copyBtn?.classList.add("hidden");
    }

    this._updateResumeButton();   // FIX(feature6): run just ended, snapshot is gone
  }

  // FIX(feature5): writes ks_daily_best_<date> (only on a new best) and
  // appends/updates the 30-day rolling history in ks_daily_history. Kept
  // separate from _saveScore()/ks_scores — that's the cross-day, all-modes
  // leaderboard; this is specifically "how am I doing on THIS day's seed".
  _updateDailyResult(result) {
    const key = `ks_daily_best_${result.date}`;
    let best = null;
    try { best = JSON.parse(localStorage.getItem(key) || "null"); } catch { best = null; }
    const isNewBest = !best || result.wave > best.wave || (result.wave === best.wave && result.time > best.time);
    if (isNewBest) {
      try { localStorage.setItem(key, JSON.stringify(result)); } catch { /* best-effort */ }
    }
    this._lastDailyResult = { ...result, isNewBest };

    let hist = [];
    try {
      const parsed = JSON.parse(localStorage.getItem("ks_daily_history") || "[]");
      hist = Array.isArray(parsed) ? parsed : [];
    } catch { hist = []; }
    const entry = { date: result.date, wave: result.wave, time: +result.time.toFixed(1), kills: result.kills };
    const idx = hist.findIndex(h => h.date === entry.date);
    if (idx >= 0) {
      // Keep the better of the two if the player played the daily more than once
      if (entry.wave > hist[idx].wave || (entry.wave === hist[idx].wave && entry.time > hist[idx].time)) hist[idx] = entry;
    } else {
      hist.push(entry);
    }
    hist.sort((a, b) => a.date.localeCompare(b.date));
    if (hist.length > 30) hist = hist.slice(hist.length - 30);
    try { localStorage.setItem("ks_daily_history", JSON.stringify(hist)); } catch { /* best-effort */ }
    this._dailyHistory = hist;
    this._renderDailyHistory();
  }

  // Renders a compact streak/trend strip on the start screen from the
  // 30-day rolling history — last 7 days as pips, plus a running streak
  // count of *consecutive* days (walking back from today) with a result.
  _renderDailyHistory() {
    const el = document.getElementById("dailyHistoryStrip");
    if (!el) return;
    let hist = this._dailyHistory;
    if (!hist) {
      try {
        const parsed = JSON.parse(localStorage.getItem("ks_daily_history") || "[]");
        hist = Array.isArray(parsed) ? parsed : [];
      } catch { hist = []; }
      this._dailyHistory = hist;
    }
    if (hist.length === 0) { el.innerHTML = ""; return; }

    const byDate = new Map(hist.map(h => [h.date, h]));
    const today  = new Date(`${Utils.todayUTCString()}T00:00:00Z`);

    // streak: consecutive days with a result, walking back from today
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      if (!byDate.has(d.toISOString().slice(0, 10))) break;
      streak++;
    }

    // last 7 days as small pips, oldest → newest
    const pips = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key   = d.toISOString().slice(0, 10);
      const entry = byDate.get(key);
      pips.push(`<span class="daily-pip${entry ? " daily-pip--played" : ""}" title="${key}${entry ? ` — wave ${entry.wave}` : ""}"></span>`);
    }

    const streakLabel = streak > 0 ? `\u{1F525} ${streak} day${streak === 1 ? "" : "s"}` : "";
    el.innerHTML = `<div class="daily-pips">${pips.join("")}</div>${streakLabel ? `<span class="daily-streak">${streakLabel}</span>` : ""}`;
  }

  _saveScore(name, wave, time, level) {
    // mutate in-memory array; write to localStorage only once here
    this._scores.push({ name, wave, time: +time.toFixed(1), level, date: new Date().toLocaleDateString() });
    this._scores.sort((a, b) => b.wave - a.wave || b.time - a.time);
    const seen = new Set();
    this._scores = this._scores.filter(s => {
      const key = `${s.name}|${s.wave}|${s.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
    // FIX(bug5): guard against quota errors / Safari private-mode throws — a
    // failed write here must not stop the rest of the game-over/quit sequence
    try { localStorage.setItem("ks_scores", JSON.stringify(this._scores)); } catch { /* in-memory list still updated */ }
  }

  _renderLeaderboard() {
    // read from in-memory cache — no localStorage parse on every render
    const scores = this._scores;
    if (scores.length === 0) {
      this._el.leaderboard.innerHTML = `<p class="leaderboard__empty">No records yet. Be the first.</p>`;
      return;
    }
    const rows = scores.map((s, i) =>
      `<tr><td>${i + 1}</td><td>${this._esc(s.name)}</td><td>${s.wave}</td><td>${s.time}s</td><td>${s.level}</td></tr>`
    ).join("");
    this._el.leaderboard.innerHTML = `
      <table>
        <thead><tr><th>#</th><th>NAME</th><th>WAVE</th><th>TIME</th><th>LVL</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  _renderCoinShop() {
    const el = this._el.coinShop;
    if (!el) return;

    el.classList.remove("hidden");
    const coins = this.game.meta.getCoins();
    const data  = this.game.meta.load();

    const rows = MetaProgression.UPGRADES.map(u => {
      const owned   = data[u.id] || 0;
      const maxed   = owned >= u.maxTier;
      const cost    = maxed ? "—" : u.cost(owned);
      const canAfford = !maxed && coins >= u.cost(owned);
      return `
        <div class="shop-row">
          <div class="shop-info">
            <span class="shop-label">${u.label}</span>
            <span class="shop-desc">${u.desc} (${owned}/${u.maxTier})</span>
          </div>
          <button
            class="btn btn--shop ${maxed ? "btn--shop-maxed" : canAfford ? "btn--shop-buy" : "btn--shop-poor"}"
            data-upgrade="${u.id}"
            ${maxed ? "disabled" : ""}
          >${maxed ? "MAX" : `${cost} 🪙`}</button>
        </div>`;
    }).join("");

    el.innerHTML = `
      <div class="shop-header">
        <span class="shop-title">⚙ UPGRADE DEPOT</span>
        <span class="shop-coins" id="shopCoinDisplay">🪙 ${coins}</span>
      </div>
      ${rows}`;

    el.querySelectorAll("button[data-upgrade]").forEach(btn => {
      btn.addEventListener("click", () => {
        const success = this.game.meta.purchase(btn.dataset.upgrade);
        if (success) this._renderCoinShop();
      });
    });
  }

  _esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  drawHUD(ctx) {
    const g  = this.game;
    const p  = g.player;
    const s  = g.uiScale;
    const m  = 20 * s;
    const lh = 28 * s;

    ctx.save();
    ctx.textBaseline = "top";

    ctx.font      = `700 ${Math.max(13, 16 * s)}px ${CONFIG.HUD_FONT}`;
    ctx.fillStyle = CONFIG.HUD_COLOR_MAIN;
    const bossLabel = g.boss ? "  ☠ BOSS WAVE" : "";
    // FIX(feature3): small "DAILY" tag so it's always clear on-screen
    // whether the current run is using the seeded daily layout.
    const dailyLabel = g.dailyMode ? "  📅 DAILY" : "";
    ctx.fillStyle = g.boss ? "#ff2d55" : CONFIG.HUD_COLOR_MAIN;
    // FIX(bug7): "KILLS x/y" is meaningless on boss waves (this.kills only
    // tracks regular-enemy deaths, and a boss wave has none) — show the
    // boss's remaining HP as the wave-clear condition instead.
    const progressLabel = g.boss
      ? `BOSS HP ${Math.max(0, Math.ceil(g.boss.hp))}/${g.boss.maxHp}`
      : `KILLS ${g.kills}/${g.wave}   ENEMIES ${g.enemies.length}`;
    ctx.fillText(`WAVE ${g.wave}${bossLabel}${dailyLabel}   ${progressLabel}`, m, m);

    ctx.font      = `600 ${Math.max(12, 14 * s)}px ${CONFIG.HUD_FONT}`;
    ctx.fillStyle = "rgba(232,240,254,0.7)";
    ctx.fillText(`Time: ${g.gameTime.toFixed(1)}s   Level ${p.stats.level}`, m, m + lh);

    const hbY = m + lh * 2 + 6;
    const hbW = 180 * s;
    const hbH = 10  * s;
    const hpR = Utils.clamp(p.health / p.maxHealth, 0, 1);
    ctx.fillStyle = CONFIG.HUD_COLOR_HP_BG;
    this._roundRect(ctx, m, hbY, hbW, hbH, 4);
    ctx.fillStyle = CONFIG.HUD_COLOR_HP_FG;
    if (hpR > 0) this._roundRect(ctx, m, hbY, hbW * hpR, hbH, 4);
    ctx.font      = `700 ${Math.max(11, 13 * s)}px ${CONFIG.HUD_FONT}`;
    ctx.fillStyle = CONFIG.HUD_COLOR_MAIN;
    ctx.fillText(`HP  ${Math.ceil(p.health)} / ${p.maxHealth}`, m, hbY + hbH + 5);

    const xbY = hbY + hbH + 26 * s;
    const xbW = 140 * s;
    const xbH = 6   * s;
    const xpR = Utils.clamp(p.stats.xp / p.stats.xpToNext, 0, 1);
    ctx.fillStyle = CONFIG.HUD_COLOR_XP_BG;
    this._roundRect(ctx, m, xbY, xbW, xbH, 3);
    ctx.fillStyle = CONFIG.HUD_COLOR_XP_FG;
    if (xpR > 0) this._roundRect(ctx, m, xbY, xbW * xpR, xbH, 3);
    ctx.font      = `600 ${Math.max(10, 12 * s)}px ${CONFIG.HUD_FONT}`;
    ctx.fillStyle = "rgba(0,229,255,0.8)";
    ctx.fillText(`XP  ${p.stats.xp} / ${p.stats.xpToNext}`, m, xbY + xbH + 4);

    // FIX(design3): the on-canvas weapon label duplicated the dedicated
    // weaponBtn's textContent — the DOM button is now the single source of
    // truth for "current weapon", so this HUD line is removed.
    let buffY = xbY + xbH + 22 * s;
    for (const key in p.buffs) {
      if (p.buffs[key] > 0) {
        ctx.font      = `700 ${Math.max(11, 13 * s)}px ${CONFIG.HUD_FONT}`;
        ctx.fillStyle = CONFIG.POWERUP_COLORS[key] || "#fff";
        ctx.fillText(`${key.toUpperCase()}  ${p.buffs[key].toFixed(1)}s`, m, buffY);
        buffY += lh;
      }
    }

    // FIX(feature1): surface active upgrade synergies so the payoff of the
    // combo is actually visible, not just a silent damage-number difference.
    const synergyLabels = {
      piercingOverload: "⚡ PIERCING OVERLOAD",
      vampiricRage:     "🩸 VAMPIRIC RAGE",
      overchargedBeam:  "☢ OVERCHARGED BEAM",
    };
    const synergies = p.getSynergies();
    for (const key in synergies) {
      if (synergies[key]) {
        ctx.font      = `700 ${Math.max(10, 12 * s)}px ${CONFIG.HUD_FONT}`;
        ctx.fillStyle = "#f1c40f";
        ctx.fillText(synergyLabels[key], m, buffY);
        buffY += lh * 0.8;
      }
    }

    const state = g.fsm.state;

    if (state === GameState.PAUSED || state === GameState.LEVEL_UP) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, g.width, g.height);
      ctx.textAlign = "center";
      ctx.font      = `900 ${Math.max(18, 28 * s)}px ${CONFIG.HUD_FONT}`;
      ctx.fillStyle = "rgba(0,229,255,0.9)";
      ctx.fillText("⏸ PAUSED", g.width / 2, g.height / 2 - 28 * s);
      ctx.font      = `600 ${Math.max(13, 17 * s)}px ${CONFIG.HUD_FONT}`;
      ctx.fillStyle = "rgba(232,240,254,0.6)";
      ctx.fillText("ESC or ⏸ to resume", g.width / 2, g.height / 2 + 8 * s);
      ctx.font      = `600 ${Math.max(11, 14 * s)}px ${CONFIG.HUD_FONT}`;
      ctx.fillStyle = "rgba(232,240,254,0.35)";
      ctx.fillText("Q — Quit to Main Menu  |  E / Shift — cycle weapon", g.width / 2, g.height / 2 + 34 * s);

      // Stats panel — single muted line below controls hint
      if (state === GameState.PAUSED) {
        const ws = g.player?.weaponShots || { default: 0, spread: 0, laser: 0 };
        const statLine = `Wave ${g.wave} · Kills ${g.kills} · ${g.gameTime.toFixed(1)}s` +
          ` · GUN:${ws.default} SHOT:${ws.spread} LASER:${ws.laser}`;
        ctx.font      = `600 ${Math.max(10, 12 * s)}px ${CONFIG.HUD_FONT}`;
        ctx.fillStyle = "rgba(232,240,254,0.22)";
        ctx.fillText(statLine, g.width / 2, g.height / 2 + 58 * s);
      }
      ctx.textAlign = "left";
    }

    if (state === GameState.GAME_OVER) {
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fillRect(0, 0, g.width, g.height);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ff2d55";
      ctx.font      = `900 ${Math.max(28, 52 * s)}px ${CONFIG.HUD_FONT}`;
      ctx.fillText("MISSION FAILED", g.width / 2, g.height / 2 - 60 * s);
      ctx.fillStyle = CONFIG.HUD_COLOR_MAIN;
      ctx.font      = `600 ${Math.max(15, 22 * s)}px ${CONFIG.HUD_FONT}`;
      ctx.fillText(`Wave reached: ${g.wave}   Time: ${g.gameTime.toFixed(1)}s`, g.width / 2, g.height / 2 + 10 * s);
      ctx.textAlign = "left";
    }

    ctx.restore();
    this._drawOnboardingHint(ctx);
  }

  // FIX(feature2): onboarding wave — a short on-canvas control hint shown
  // only during wave 1, fading out over its last 1.5s. Text adapts to
  // input method via the existing _shouldShowMobileUI() check (no new
  // device-detection path added).
  _drawOnboardingHint(ctx) {
    const g = this.game;
    if (g.wave !== 1 || g.fsm.isNot(GameState.PLAYING)) return;
    const t = CONFIG.ONBOARDING_HINT_DURATION - g.gameTime;
    if (t <= 0) return;

    const fade = Utils.clamp(t / 1.5, 0, 1);
    const s    = g.uiScale;
    const text = this._shouldShowMobileUI()
      ? "Joystick to move · Drag right side to aim · FIRE to shoot"
      : "WASD / Arrows to move · Mouse to aim · Click to shoot";

    ctx.save();
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.font         = `700 ${Math.max(13, 16 * s)}px ${CONFIG.HUD_FONT}`;
    ctx.fillStyle    = `rgba(232,240,254,${0.85 * fade})`;
    ctx.fillText(text, g.width / 2, 20 * s);
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    if (w <= 0) return;
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }
}


// =============================================================================
// SECTION 12b — DAMAGE NUMBER  (C2)
// Lightweight floating text that pops up at hit locations and drifts upward.
// =============================================================================
class DamageNumber {
  constructor() {
    this.x = 0; this.y = 0; this.value = 0;
    this.isCrit = false; this.isBoss = false;
    this.life = 0; this.maxLife = 0; this.vy = 0;
  }

  init(x, y, value, isCrit, isBoss) {
    this.x       = x;
    this.y       = y;
    this.value   = value;
    this.isCrit  = isCrit;
    this.isBoss  = isBoss;
    this.life    = 0.85;
    this.maxLife = 0.85;
    this.vy      = -58;
  }

  static get(x, y, value, isCrit, isBoss) {
    const dn = DamageNumber._pool.pop() || new DamageNumber();
    dn.init(x, y, value, isCrit, isBoss);
    return dn;
  }

  static release(dn) {
    DamageNumber._pool.push(dn);
  }

  update(dt) {
    this.y    += this.vy * dt;
    this.life -= dt;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha  = alpha;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    if (this.isBoss) {
      ctx.fillStyle = "#ff2d55";
      ctx.font      = "bold 17px 'Rajdhani', sans-serif";
      ctx.fillText(String(this.value), this.x, this.y);
    } else if (this.isCrit) {
      ctx.fillStyle = "#f1c40f";
      ctx.font      = "bold 17px 'Rajdhani', sans-serif";
      ctx.fillText(`✕${this.value}`, this.x, this.y);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.font      = "bold 14px 'Rajdhani', sans-serif";
      ctx.fillText(String(this.value), this.x, this.y);
    }
    ctx.restore();
  }
}
// Static pool must be declared after the class body
DamageNumber._pool = [];


// =============================================================================
// SECTION 12b — WAVE SYSTEM
// FIX(perf3): extracted from Game to reduce monolith coupling. Owns budget-
// based enemy spawning, boss-wave detection, and inter-wave transition
// timing — previously spread across _spawnWave(), the WAVE_TRANSITION
// branch of _loop(), and the wave-cleared check in _update(). Operates
// directly on the `game` instance passed into each method (rather than
// owning independent state) since wave/boss/timer state is read from many
// other places in Game (HUD draw, XP/coin awards, Boss constructor) that
// weren't part of this pass — moving that state itself would mean touching
// every one of those call sites for no behavior change, which is out of
// scope for a refactor pass. This is a pure extraction: no formula, timing,
// or ordering changed from the original inline code.
// =============================================================================
class WaveSystem {
  static BOSS_WAVE_INTERVAL = 5;

  isBossWave(wave) {
    return wave % WaveSystem.BOSS_WAVE_INTERVAL === 0;
  }

  /**
   * Wave Budget System.
   * Budget formula:  base 8 + wave * 3, capped at 60.
   * Each enemy type has a cost and an unlock wave (see ENEMY_TABLE).
   * We build a weighted pool of affordable, unlocked types each call, then
   * draw from it repeatedly until the budget is exhausted.
   */
  spawnWave(game) {
    const wave = game.wave;
    // FIX(feature2): wave 1 uses the small onboarding budget instead of the
    // normal formula (see CONFIG.ONBOARDING_WAVE1_BUDGET for rationale).
    let budget = (wave === 1) ? CONFIG.ONBOARDING_WAVE1_BUDGET : Math.min(60, 8 + wave * 3);

    // Helper: pick a spawn position on a random edge of the arena
    // FIX(feature3): Math.random() → game.rng() so Daily Challenge mode
    // (a seeded generator) produces the same spawn sequence every time.
    const _edgePos = () => {
      const side = Math.floor(game.rng() * 4);
      return {
        // use width-1 / height-1 so enemies never spawn one pixel outside the canvas
        x: side === 0 ? 0 : side === 1 ? game.width  - 1 : game.rng() * game.width,
        y: side === 2 ? 0 : side === 3 ? game.height - 1 : game.rng() * game.height,
      };
    };

    const wf = Math.max(1, Math.log(wave + 1)) * CONFIG.WAVE_MULTIPLIER;

    while (budget > 0) {
      // Build pool of types affordable at this budget level and unlocked
      const pool = [];
      for (const entry of ENEMY_TABLE) {
        if (entry.cost <= budget && entry.unlockWave <= wave) {
          for (let w = 0; w < entry.weight; w++) pool.push(entry);
        }
      }
      // Safety: if nothing fits (shouldn't happen since rusher/normal cost 1)
      if (pool.length === 0) break;

      const chosen = pool[Math.floor(game.rng() * pool.length)];
      const pos    = _edgePos();
      game.enemies.push(new Enemy(game, pos.x, pos.y, chosen.type, wf));
      budget -= chosen.cost;
    }
  }

  /**
   * Called once per physics tick from Game._update(): checks whether the
   * current wave is cleared and, if so, kicks off the inter-wave countdown.
   * FIX(bug7): boss waves never spawn normal enemies, so game.kills is never
   * incremented on boss waves (only _handleEnemyDeath does that, and it's
   * only called for regular enemies) — the old condition
   * `game.kills >= game.wave` could never become true on a boss wave,
   * permanently softlocking the game after every boss kill. Boss waves now
   * complete purely on the boss dying; normal waves keep the
   * enemies-cleared + kills-quota condition.
   */
  checkWaveCleared(game) {
    const waveCleared = game._isBossWave
      ? !game.boss
      : (game.enemies.length === 0 && game.kills >= game.wave);
    if (waveCleared && game.fsm.is(GameState.PLAYING)) {
      game.kills = 0;
      game._waveTransitionTimer = 3.0;   // 3-second inter-wave countdown
      // Flag boss pre-warning when the NEXT wave (wave+1) is divisible by 5
      game._bossWarning = this.isBossWave(game.wave + 1);
      game.fsm.transition(GameState.WAVE_TRANSITION);
    }
  }

  /**
   * Called once the inter-wave countdown (set by checkWaveCleared) expires:
   * increments the wave, spawns the boss or the next budget-based wave, and
   * periodically regenerates the arena's walls/crates.
   */
  advanceWave(game) {
    game.wave++;
    game._addShake(CONFIG.SHAKE_MAX);
    game._isBossWave = this.isBossWave(game.wave);   // FIX(bug7): recorded per-wave
    if (game._isBossWave) {
      game.boss = new Boss(game);
      game._bossWarning = false;   // clear warning now that boss has spawned
    } else {
      this.spawnWave(game);
    }
    if (game.wave % 3 === 0) game._spawnWalls();
  }
}


// =============================================================================
// SECTION 12c — COMBAT SYSTEM
// FIX(perf3): extracted from Game to reduce monolith coupling. Owns the
// bullet-vs-enemy/boss/wall collision block that previously ran inline in
// _update() — the single most bullet-heavy pass in the tick. Same pattern
// as WaveSystem: operates on the `game` instance rather than owning
// independent state, since bullets/enemies/walls/boss are all game-level
// collections read from many other places. Pure extraction — the one
// incidental change is dropping a redundant enemy→index map build that was
// always overwritten before use (see Game._update()); everything else is
// unchanged from the original inline code.
// =============================================================================
class CombatSystem {
  resolveBulletCollisions(game) {
    // O(1) enemy→index map for _handleEnemyDeath's swap-and-pop bookkeeping
    // inside this loop (see FIX(bug8) comment below). Built once per call,
    // after enemy updates may have already shuffled game.enemies.
    const enemyIndexMap = new Map();
    for (let i = 0; i < game.enemies.length; i++) enemyIndexMap.set(game.enemies[i], i);

    for (let i = 0; i < game.bullets.length; i++) {
      const b = game.bullets[i];
      if (!b.active) continue;

      const bx0 = b.x;
      const by0 = b.y;
      b.update(game._FIXED_STEP);
      game.trailMgr.push(b);

      let hit = false;

      const wall = game.checkWallCollision(b.x, b.y, b.size);
      if (wall) {
        // Only destructible walls have an hp property; crates are indestructible
        if (wall.hp !== undefined) {
          wall.hp -= b.damage;
          if (wall.hp <= 0) {
            // mark dead — compact in a single pass after the loop (avoids O(n) indexOf)
            wall.dead = true;
          }
        }
        game.spawnParticles(b.x, b.y, b.color, 5);
        // FIX(feature4): Ricochet Rounds — a gun bullet's first wall/crate
        // contact bounces instead of dying. Approximates the contact normal
        // from whether the bullet's pre-move position was outside the
        // rect's vertical span (hit a side wall → flip x) or its
        // horizontal span (hit a top/bottom edge → flip y); good enough for
        // a glancing "which axis did this come from" without needing exact
        // swept-collision normals.
        if (!b.isEnemy && b.weaponType === "default" && !b._ricocheted && game.player.mods?.ricochet) {
          b._ricocheted = true;
          const hitSide = bx0 < wall.x || bx0 > wall.x + wall.w;
          if (hitSide) b.dx = -b.dx; else b.dy = -b.dy;
          b.x = bx0; b.y = by0;   // step back so it doesn't immediately re-trigger next tick
        } else {
          hit = true;
        }
      }

      if (!hit) {
        if (b.isEnemy) {
          if (!game.player.alive) {
            hit = true;
          } else {
            const t = Utils.sweepCircle(bx0, by0, b.x, b.y,
              game.player.x, game.player.y, b.size + game.player.size);
            if (t >= 0) {
              if (game.player.buffs.shield <= 0) {
                game.player.health -= b.damage;
                game.triggerDamageFlash(1.0);
                game.audio.playPlayerHit();
                game._addShake(5);
              }
              hit = true;
              if (game.player.health <= 0 && game.player.alive) {
                game.player.alive = false; game.player.health = 0;
              }
            }
          }
        } else {
          const midX = (bx0 + b.x) * 0.5;
          const midY = (by0 + b.y) * 0.5;
          // SpatialHash.query() now dedups boundary-straddling entities internally
          // via its stamp mechanism, so no external Set-based dedup is needed here.
          const candidates = game.spatialHash.query(midX, midY, b.size + 60);

          for (const e of candidates) {
            if (!e.alive) continue;
            const t = Utils.sweepCircle(bx0, by0, b.x, b.y, e.x, e.y, b.size + e.size);
            if (t >= 0) {
              const isCrit  = Math.random() < game.player.critChance;
              const dmgDealt = b.damage * (isCrit ? 2 : 1);
              e.hp -= dmgDealt;
              game.damageNumbers.push(DamageNumber.get(b.x, b.y, Math.ceil(dmgDealt), isCrit, false));
              // count pierce hits; destroy bullet after MAX_PIERCE enemies
              if (b.piercing) {
                b.hitCount++;
                // FIX(feature1): was a hardcoded `4` — now reads the
                // per-bullet cap set in Player._shoot() (see Bullet.init()),
                // so the Piercing Overload synergy can raise it for crits.
                if (b.hitCount >= b.maxPierce) hit = true;
                // FIX(feature4): Beam Split — on a laser bolt's FIRST pierce
                // (hitCount just became 1), fork two thinner child beams off
                // at a slight angle. _forked guards both this bullet and its
                // children so nothing forks more than once.
                if (b.hitCount === 1 && b.weaponType === "laser" && !b._forked && game.player.mods?.beamSplit) {
                  b._forked = true;
                  const baseAngle = Math.atan2(b.dy, b.dx);
                  const speed     = Math.hypot(b.dx, b.dy);
                  for (const off of [-0.25, 0.25]) {
                    const ang = baseAngle + off;
                    const fb  = game.bulletPool.get();
                    fb.init(b.x, b.y, Math.cos(ang) * speed, Math.sin(ang) * speed,
                      b.size * 0.6, b.color, b.damage * 0.5, false, true, b.maxPierce, "laser");
                    fb._forked = true;   // children never fork again
                    game.bullets.push(fb);
                    game.trailMgr.register(fb, fb.color);
                  }
                }
              } else {
                hit = true;
              }
              if (game.player.lifesteal > 0) {
                // FIX(feature1): Vampiric Rage — lifesteal + an active rage
                // buff doubles the heal-back on this hit.
                const healMult = game.player.getSynergies().vampiricRage ? 2 : 1;
                game.player.health = Math.min(
                  game.player.maxHealth,
                  game.player.health + b.damage * game.player.lifesteal * healMult
                );
              }
              // O(1) index lookup via pre-built map
              const ei = enemyIndexMap.get(e);
              if (e.hp <= 0 && ei !== undefined) {
                // FIX(feature4): Detonator Pellets — a spread pellet's kill
                // splashes flat damage to nearby enemies. Flat (not
                // recursive) so a splash-killed enemy can't chain-trigger
                // another detonation; those enemies are cleaned up by the
                // ordinary hp<=0 sweep in Game._update() next tick, same as
                // any other death, so nothing needs a second _handleEnemyDeath
                // call here.
                if (!b.isEnemy && b.weaponType === "spread" && game.player.mods?.detonatorPellets) {
                  const splashR  = 70;
                  const splashRSq = splashR * splashR;
                  for (const other of game.spatialHash.query(e.x, e.y, splashR)) {
                    if (other === e || !other.alive) continue;
                    if (Utils.distSq(e.x, e.y, other.x, other.y) <= splashRSq) {
                      const splashDmg = b.damage * 0.5;
                      other.hp -= splashDmg;
                      game.damageNumbers.push(DamageNumber.get(other.x, other.y, Math.ceil(splashDmg), false, false));
                    }
                  }
                  game.spawnParticles(e.x, e.y, "#ff9f43", 10);
                }
                // FIX(bug8): enemyIndexMap was built once before the bullets
                // loop, but _handleEnemyDeath() below does a swap-and-pop on
                // game.enemies — the enemy that was previously last in the
                // array is moved into slot `ei`. If a *second* bullet in this
                // same loop later kills that moved enemy, the map still held
                // its OLD (now stale) index. Calling removeFast() with that
                // stale index either no-ops on an out-of-bounds slot (leaving
                // a "dead" enemy — alive=false but never spliced out — stuck
                // in game.enemies forever, so enemies.length never reaches 0
                // and the wave can never clear) or, worse, evicts a totally
                // unrelated, still-alive enemy from the array. Patch the map
                // in lockstep with the swap so every later lookup this tick
                // stays correct.
                const lastIdx    = game.enemies.length - 1;
                const movedEnemy = game.enemies[lastIdx];
                game._handleEnemyDeath(e, ei);
                enemyIndexMap.delete(e);
                if (movedEnemy !== e) enemyIndexMap.set(movedEnemy, ei);
              }
              if (hit) break;  // stop scanning once this bullet is spent
            }
          }

          // Also check boss as a target for player bullets
          if (!hit && game.boss?.alive) {
            const t = Utils.sweepCircle(bx0, by0, b.x, b.y, game.boss.x, game.boss.y, b.size + game.boss.size);
            if (t >= 0) {
              const dmgDealt = b.damage * 0.5; // 50 % resistance
              game.boss.hp -= dmgDealt;
              // add boss to seenSet so piercing bullets don't double-hit in same frame
              game.collisionSeenSet.add(game.boss);
              game.damageNumbers.push(DamageNumber.get(b.x, b.y, Math.ceil(dmgDealt), false, true));
              game.spawnParticles(b.x, b.y, b.color, 4);
              if (!b.piercing) hit = true;
            }
          }
        }
      }

      if (!hit) {
        hit = (b.x < -80 || b.x > game.width + 80 || b.y < -80 || b.y > game.height + 80);
      }

      if (hit) {
        b.active = false;
        game.bulletPool.release(b);
        game.trailMgr.unregister(b);
        game._deadBullets++;
      }
    }

    // compact walls that were killed by bullets (dead-flag pattern)
    if (game.walls.some(w => w.dead)) {
      game.walls = game.walls.filter(w => !w.dead);
      // Rebuild wallHash so destroyed walls no longer appear as candidates
      if (game._wallHash) {
        game._wallHash.clear();
        const _insertRect = (r) => {
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          const sz = Math.sqrt(r.w * r.w + r.h * r.h) / 2;
          game._wallHash.insert({ x: cx, y: cy, size: sz, _rect: r });
        };
        for (const w of game.walls)  _insertRect(w);
        for (const c of game.crates) _insertRect(c);
      }
    }
  }
}


// =============================================================================
// SECTION 13 — GAME (Core Engine)
// this.collisionSeenSet hoisted here — cleared each tick, never newed
// _loop computes alpha = accumulator / FIXED_STEP, passes to _draw
// _deadBullets / _deadParticles counters drive threshold compaction
// =============================================================================
class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx    = this.canvas.getContext("2d");

    this.input = new InputManager(this);   // pass game so joystick auto-fire can check FSM state
    this.audio = new AudioEngine();        // FIX: must be created BEFORE UIManager so _bindUI() can safely read this.game.audio
    this.meta  = new MetaProgression();    // FIX: must be created BEFORE UIManager — its constructor calls _renderCoinShop(), which reads this.game.meta
    this.ui    = new UIManager(this);

    this.bulletPool   = new ObjectPool(Bullet,   CONFIG.POOL_BULLETS);
    this.particlePool = new ObjectPool(Particle, CONFIG.POOL_PARTICLES);

    this.spatialHash = new SpatialHash(80);
    this.trailMgr    = new TrailManager(10);

    // FIX(perf3): extracted systems — see their class comments above.
    this.waveSystem   = new WaveSystem();
    this.combatSystem = new CombatSystem();

    this.fsm = new GameFSM();
    this._wireFSM();

    this.cameraShake = 0;
    this.damageFlash = 0;   // seconds remaining for red vignette
    this._shakeTime  = 0;
    // FIX(bug4): low-frequency "thud" layer, tracked independently of the
    // high-frequency rattle above so it decays and oscillates on its own
    // clock — only ever set for high-intensity events (see _addShake()).
    this.thudShake   = 0;
    this._thudTime   = 0;
    // FIX(perf2): low-power mode reduces particle counts and glow-sprite
    // radius (via GlowCache.padScale below) on qualifying devices only.
    // Auto-detected once from hardwareConcurrency (cheap, synchronous,
    // available before a single frame renders); the frame-time watchdog in
    // _loop() can also engage it mid-session if sustained frame time creeps
    // up on a device that reported plenty of cores. One-directional — once
    // engaged it stays on for the session, so a momentary hitch can't cause
    // visible flicker between quality levels. Desktop is untouched unless
    // one of these conditions actually fires.
    this._lowPowerMode = (navigator.hardwareConcurrency || 8) <= 4;
    this._frameTimeWindow    = [];   // rolling ms samples for the watchdog
    this._frameTimeWindowMax = 60;   // ~1s of samples at 60fps
    GlowCache.padScale = this._lowPowerMode ? 0.5 : 1;

    this._rafId      = null;

    // FIX(polish2): respect prefers-reduced-motion — dampen (not eliminate,
    // so damage is still legible) camera shake and the damage-flash vignette.
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this._reducedMotion = reduceMotionQuery.matches;
    const onReducedMotionChange = mq => { this._reducedMotion = mq.matches; };
    reduceMotionQuery.addEventListener
      ? reduceMotionQuery.addEventListener("change", onReducedMotionChange)
      : reduceMotionQuery.addListener(onReducedMotionChange); // Safari < 14 fallback

    // FIX(feature3): default RNG is plain Math.random; start() swaps this
    // for a seeded generator when Daily Challenge mode is active.
    this.dailyMode = false;
    this.rng       = Math.random;

    this._FIXED_STEP  = 1 / 60;
    this._accumulator = 0;

    // hoisted dedup Set — reused via .clear() instead of new Set() each tick
    this.collisionSeenSet = new Set();

    // dead-slot counters for threshold-based compaction
    this._deadBullets   = 0;
    this._deadParticles = 0;

    this._resize();
    window.addEventListener("resize", () => this._resize());

    // auto-pause when player tabs away
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // FIX(feature6): save-on-hide — same trigger as auto-pause below,
        // since "tab hidden" is exactly the moment a closed tab/refresh
        // would otherwise lose the run. saveRunSnapshot() no-ops on its own
        // if there's no run in progress (MENU/GAME_OVER), so this is safe
        // to call unconditionally here.
        this.saveRunSnapshot();
        if (this.fsm.is(GameState.PLAYING)) {
          this.fsm.transition(GameState.PAUSED);
        }
      }
    });

    // FIX(feature6): belt-and-suspenders for the case a tab is closed
    // without ever firing visibilitychange first (some embedded/PWA
    // contexts) — beforeunload is the last reliable moment to persist.
    window.addEventListener("beforeunload", () => this.saveRunSnapshot());

    // auto-pause when a touch device is rotated into portrait — the
    // .rotate-prompt overlay (CSS) covers the screen at the same time,
    // so this just stops the sim from advancing underneath it.
    const portraitQuery = window.matchMedia("(orientation: portrait) and (hover: none) and (pointer: coarse)");
    const onPortraitChange = mq => {
      if (mq.matches && this.fsm.is(GameState.PLAYING)) {
        this.fsm.transition(GameState.PAUSED);
      }
    };
    portraitQuery.addEventListener
      ? portraitQuery.addEventListener("change", onPortraitChange)
      : portraitQuery.addListener(onPortraitChange); // Safari < 14 fallback
  }

  _wireFSM() {
    this.fsm
      .register(GameState.PLAYING, {
        exit: () => { this.lastTime = performance.now(); },
      })
      .register(GameState.PAUSED, {
        enter: () => {
          const btn = document.getElementById("quitBtn");
          if (btn) btn.classList.remove("hidden");
          // FIX(design3): fade out the joystick/FIRE/weapon buttons — they do
          // nothing while paused — so only resume-relevant controls stand out.
          this.ui._el.mobileUI.classList.add("paused");
          // C3-PC: desktop weapon button lives outside #mobileControls, so
          // it needs its own pause-dim toggle alongside the mobile one.
          document.getElementById("weaponBtnPC")?.classList.add("is-disabled");
        },
        exit: () => {
          const btn = document.getElementById("quitBtn");
          if (btn) btn.classList.add("hidden");
          this.ui._el.mobileUI.classList.remove("paused");
          document.getElementById("weaponBtnPC")?.classList.remove("is-disabled");
          this.lastTime = performance.now();
        },
      })
      .register(GameState.GAME_OVER, {
        // FIX(bug11): PAUSED fades out the joystick/FIRE/weapon buttons
        // because they do nothing while paused — GAME_OVER never got the
        // same treatment, so those controls stayed at full opacity and
        // pointer-events:auto, looking fully interactive on the game-over
        // screen even though touching them has no effect. Reuse the same
        // dimming class PAUSED uses, and clear it on exit (covers both the
        // "restart" and "menu" paths, since both go through fsm.transition).
        enter: () => {
          // FIX(feature6): the run just ended — a saved mid-run snapshot
          // (if any) is now stale.
          this.clearSavedRun();
          this.ui.showGameOver();
          this.ui._el.mobileUI.classList.add("paused");
          document.getElementById("weaponBtnPC")?.classList.add("is-disabled");
        },
        exit: () => {
          this.ui._el.mobileUI.classList.remove("paused");
          document.getElementById("weaponBtnPC")?.classList.remove("is-disabled");
        },
      })
      .register(GameState.WAVE_TRANSITION, {
        // No enter/exit side-effects needed; timer is polled in _loop
      })
      .register(GameState.LEVEL_UP, {
        enter: () => {},
        exit:  () => {},
      });
  }

  _resize() {
    this.width  = this.canvas.width  = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    const isLandscapeMobile = window.innerWidth > window.innerHeight && window.innerHeight < 500;
    this.uiScale = isLandscapeMobile
      ? Utils.clamp(Math.min(this.width / 800, this.height / 400), 0.55, 1.2)
      : Utils.clamp(Math.min(this.width / 800, this.height / 600), 0.7, 2.0);
    document.documentElement.style.setProperty("--ui-scale", this.uiScale);
    GlowCache.clear();
  }

  start(options = {}) {
    cancelAnimationFrame(this._rafId);

    // FIX(feature6): a fresh DEPLOY/Restart abandons any saved mid-run
    // snapshot from a previous run — it would otherwise dangle and (if the
    // player later hit Resume from a stale page load) restore the WRONG run.
    this.clearSavedRun();
    this.ui._pendingAscension = null;

    // Drain active entities back to pools before abandoning arrays
    if (this.bullets) {
      for (const b of this.bullets) { b.active = false; this.bulletPool.release(b); }
    }
    if (this.particles) {
      for (const p of this.particles) { p.active = false; this.particlePool.release(p); }
    }

    // FIX(feature3): Daily Challenge mode — same UTC date → same wall
    // layout + enemy spawn sequence for every player, everywhere. `daily`
    // defaults to whatever the previous run used (so Restart / Play Again
    // stays in the mode the player picked) unless explicitly overridden.
    this.dailyMode = options.daily !== undefined ? !!options.daily : !!this.dailyMode;
    this.dailySeedDate = Utils.todayUTCString();
    this.rng = this.dailyMode
      ? Utils.createSeededRNG(`kritikshoot-daily-${this.dailySeedDate}`)
      : Math.random;

    this.player    = new Player(this);
    this.enemies   = [];
    this.bullets   = [];
    this.particles = [];
    this.walls     = [];
    this.crates    = [];
    this.powerups  = [];
    this.boss      = null;    // Boss instance, or null when not active
    // FIX(bug7): tracks whether the CURRENT wave is a boss wave, so wave-
    // progression logic can branch cleanly instead of relying on `this.kills`
    // (which boss waves never increment via _handleEnemyDeath).
    this._isBossWave = false;

    this.wave      = 1;
    this.kills     = 0;
    this.gameTime  = 0;
    this.lastTime  = performance.now();
    this.cameraShake  = 0;
    this.damageFlash  = 0;
    this._shakeTime   = 0;
    this.thudShake    = 0;   // FIX(bug4)
    this._thudTime    = 0;   // FIX(bug4)
    this._accumulator = 0;
    this.trailMgr.clear();

    // reset dead-slot counters
    this._deadBullets   = 0;
    this._deadParticles = 0;

    this.fsm.transition(GameState.PLAYING);
    this.meta.initSession();   // snapshot LS once per run
    this._spawnWalls();
    this.waveSystem.spawnWave(this);   // budget-based wave instead of N random enemies

    this._waveTransitionTimer = 0;

    this.damageNumbers = [];

    this.setWeaponLabel("GUN");

    this._rafId = requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Mid-run persistence (save & resume) ──────────────────────────────────
  // FIX(feature6): a closed tab or refresh used to lose the run outright.
  // saveRunSnapshot() is called from visibilitychange (tab hidden) and
  // beforeunload (see the constructor); it serializes the minimum state
  // needed to resume — player stats/upgrades/health/position, current wave,
  // kills, gameTime, the actual wall/crate layout (serializing the literal
  // rects rather than replaying the RNG stream, since a non-daily run's rng
  // is Math.random and can't be seeded-replayed anyway), and active enemies
  // (position/type/hp only, per spec). Mid-flight bullets/particles are
  // intentionally dropped — they're a few-hundred-ms visual, not run state.
  // Guarded with the same try/catch pattern MetaProgression.save() uses.

  saveRunSnapshot() {
    if (!this.player || !this.player.alive) return;
    if (this.fsm.is(GameState.MENU) || this.fsm.is(GameState.GAME_OVER)) return;
    try {
      const p = this.player;
      const snap = {
        v: 1,
        dailyMode:            this.dailyMode,
        dailySeedDate:        this.dailySeedDate,
        wave:                 this.wave,
        kills:                this.kills,
        gameTime:             this.gameTime,
        isBossWave:           this._isBossWave,
        bossWarning:          this._bossWarning,
        waveTransitionTimer:  this._waveTransitionTimer,
        fsmState:             this.fsm.state,
        // FIX(feature6): so a save mid-LEVEL_UP knows which panel to re-show
        pendingAscension:     !!this.ui._pendingAscension,
        player: {
          x: p.x, y: p.y, health: p.health, alive: p.alive,
          stats:               { ...p.stats },
          upgrades:            { ...p.upgrades },
          weapon:               p.weapon,
          weaponShots:          { ...p.weaponShots },
          mods:                 { ...p.mods },
          ascensionLevelsSeen:  Array.from(p._ascensionLevelsSeen),
        },
        walls:   this.walls.map(w => ({ x: w.x, y: w.y, w: w.w, h: w.h, hp: w.hp, maxHp: w.maxHp })),
        crates:  this.crates.map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h, isPillar: c.isPillar })),
        enemies: this.enemies.filter(e => e.alive)
          .map(e => ({ x: e.x, y: e.y, type: e.type, hp: e.hp, maxHp: e.maxHp })),
        boss: (this.boss && this.boss.alive)
          ? { x: this.boss.x, y: this.boss.y, hp: this.boss.hp, maxHp: this.boss.maxHp }
          : null,
      };
      localStorage.setItem("ks_saved_run", JSON.stringify(snap));
    } catch { /* best-effort — quota errors / private mode shouldn't break gameplay */ }
  }

  hasSavedRun() {
    try { return !!localStorage.getItem("ks_saved_run"); } catch { return false; }
  }

  loadRunSnapshot() {
    try {
      const raw = localStorage.getItem("ks_saved_run");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // FIX(bug10)-style guard: a corrupted/older-schema value shouldn't
      // throw partway through resumeRun() with entities half-restored.
      if (!parsed || typeof parsed !== "object") return null;
      if (!Array.isArray(parsed.enemies) || !Array.isArray(parsed.walls) || !parsed.player) return null;
      return parsed;
    } catch { return null; }
  }

  clearSavedRun() {
    try { localStorage.removeItem("ks_saved_run"); } catch { /* best-effort */ }
  }

  /**
   * Restores a run from ks_saved_run. Returns true on success, false if
   * there was nothing valid to resume (caller falls back to a fresh start).
   * Mirrors start()'s reset sequence but restores saved values instead of
   * generating fresh ones.
   */
  resumeRun() {
    const snap = this.loadRunSnapshot();
    if (!snap) return false;

    cancelAnimationFrame(this._rafId);

    if (this.bullets)   for (const b of this.bullets)   { b.active = false; this.bulletPool.release(b); }
    if (this.particles) for (const p of this.particles) { p.active = false; this.particlePool.release(p); }

    this.dailyMode     = !!snap.dailyMode;
    this.dailySeedDate = snap.dailySeedDate || Utils.todayUTCString();
    // FIX(feature6): a resumed run keeps generating NEW walls (every-3-waves
    // refresh) with a fresh rng — the seed only ever guaranteed the
    // INITIAL layout matched across players, and we're restoring the
    // literal already-generated layout below rather than replaying it.
    this.rng = this.dailyMode
      ? Utils.createSeededRNG(`kritikshoot-daily-${this.dailySeedDate}`)
      : Math.random;

    this.player = new Player(this);
    this.player.x       = snap.player.x;
    this.player.y       = snap.player.y;
    this.player.prevX   = snap.player.x;   // avoid a one-frame interpolation slide from the reset() default
    this.player.prevY   = snap.player.y;
    this.player.health  = snap.player.health;
    this.player.alive   = snap.player.alive;
    this.player.weapon  = snap.player.weapon || "default";
    this.player.stats       = { ...snap.player.stats };
    this.player.upgrades    = { ...this.player.upgrades, ...snap.player.upgrades };
    this.player.weaponShots = { ...this.player.weaponShots, ...snap.player.weaponShots };
    this.player.mods        = { ...(snap.player.mods || {}) };
    this.player._ascensionLevelsSeen = new Set(snap.player.ascensionLevelsSeen || []);

    // FIX(feature6): restore wave/kills/gameTime BEFORE constructing
    // enemies/boss below — both read game.gameTime/game.wave in their
    // constructors (Enemy._lastShot, Boss's maxHp formula), so this order
    // avoids seeding them off a stale pre-resume value.
    this.wave     = snap.wave;
    this.kills    = snap.kills;
    this.gameTime = snap.gameTime;
    this._isBossWave          = !!snap.isBossWave;
    this._bossWarning         = !!snap.bossWarning;
    this._waveTransitionTimer = snap.waveTransitionTimer || 0;

    // waveFactor is irrelevant here — hp/maxHp are overwritten from the
    // snapshot immediately after construction.
    this.enemies = snap.enemies.map(e => {
      const en = new Enemy(this, e.x, e.y, e.type, 1);
      en.hp = e.hp; en.maxHp = e.maxHp;
      return en;
    });
    this.bullets   = [];
    this.particles = [];
    this.walls   = snap.walls.map(w => ({ ...w }));
    this.crates  = snap.crates.map(c => ({ ...c }));
    this._rebuildWallHash();

    this.boss = null;
    if (snap.boss) {
      this.boss = new Boss(this);
      this.boss.hp    = snap.boss.hp;
      this.boss.maxHp = snap.boss.maxHp;
      this.boss.x     = snap.boss.x;
      this.boss.y     = snap.boss.y;
    }

    this.cameraShake = 0; this.damageFlash = 0; this._shakeTime = 0;
    this.thudShake    = 0; this._thudTime  = 0;
    this._accumulator = 0;
    this.trailMgr.clear();
    this._deadBullets = 0; this._deadParticles = 0;
    this.damageNumbers = [];

    this.setWeaponLabel({ default: "GUN", spread: "SHOTGUN", laser: "LASER" }[this.player.weapon] || "GUN");

    this.clearSavedRun();   // one-shot — consumed on resume
    this.ui._updateResumeButton();

    // FIX(feature6): resume into the exact FSM state the snapshot was taken
    // in — WAVE_TRANSITION keeps its countdown running, LEVEL_UP re-shows
    // the pending choice (normal grid or Ascension) so it isn't silently
    // lost. Anything else (PLAYING/PAUSED) resumes straight into PLAYING.
    const targetState = (snap.fsmState === GameState.WAVE_TRANSITION) ? GameState.WAVE_TRANSITION
                       : (snap.fsmState === GameState.LEVEL_UP)        ? GameState.LEVEL_UP
                       : GameState.PLAYING;
    this.fsm.transition(targetState);
    this.lastTime = performance.now();

    if (targetState === GameState.LEVEL_UP) {
      if (snap.pendingAscension) this.ui.showAscensionChoice();
      else                       this.ui.showLevelUp();
    }

    this._rafId = requestAnimationFrame(ts => this._loop(ts));
    return true;
  }

  // ── Game Loop ──────────────────────────────────────────────────────────────

  _loop(now) {
    this._rafId = requestAnimationFrame(ts => this._loop(ts));

    const frameDt = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;

    // FIX(perf2): frame-time watchdog — engages low-power mode mid-session
    // if sustained frame time creeps past ~20ms, even on hardware that
    // passed the hardwareConcurrency check at startup (throttled laptop,
    // background load, etc). Stops sampling once engaged — one-directional,
    // see constructor comment.
    if (!this._lowPowerMode) {
      const w = this._frameTimeWindow;
      w.push(frameDt * 1000);
      if (w.length > this._frameTimeWindowMax) w.shift();
      if (w.length === this._frameTimeWindowMax) {
        let sum = 0;
        for (const ms of w) sum += ms;
        if (sum / w.length > 20) {
          this._lowPowerMode  = true;
          GlowCache.padScale  = 0.5;
        }
      }
    }

    this._handleInputEvents();

    if (this.fsm.is(GameState.PLAYING)) {
      this._accumulator += frameDt;
      while (this._accumulator >= this._FIXED_STEP) {
        this._update(this._FIXED_STEP);
        this._accumulator -= this._FIXED_STEP;
      }
    }

    if (this.fsm.is(GameState.WAVE_TRANSITION)) {
      this._waveTransitionTimer -= frameDt;
      if (this._waveTransitionTimer <= 0) {
        // Timer expired — increment wave, spawn, resume play.
        // See WaveSystem.advanceWave() for the full boss-wave/wall-refresh logic.
        this.waveSystem.advanceWave(this);
        this.fsm.transition(GameState.PLAYING);
        this.lastTime = performance.now();
      }
    }

    // temporal interpolation factor — fraction of a physics tick
    // already elapsed at the moment we're rendering this frame.
    // Passed to _draw so every entity renders at its sub-tick position.
    const alpha = this._accumulator / this._FIXED_STEP;
    this._draw(alpha);
  }

  _handleInputEvents() {
    const state = this.fsm.state;

    if (this.input.keys["escape"] || this.input._pausePressed) {
      this.input.keys["escape"] = false;
      this.input._pausePressed  = false;
      if (this.player?.alive) {
        if (state === GameState.PLAYING) this.fsm.transition(GameState.PAUSED);
        else if (state === GameState.PAUSED) this.fsm.transition(GameState.PLAYING);
      }
    }

    if ((this.input.keys["q"] || this.input._quitPressed) && state === GameState.PAUSED) {
      this.input.keys["q"]    = false;
      this.input._quitPressed = false;
      this.ui.quitToMenu();
    }

    // weapon cycle on E or Shift — Tab hijacks browser focus, Q is quit
    // also handle _weaponPressed from mobile weapon button
    // FIX(bug3): flags are consumed/cleared on this frame regardless of state,
    // so a press registered while PAUSED/LEVEL_UP/GAME_OVER can't silently
    // trigger a weapon cycle the instant play resumes.
    const weaponSwitchRequested =
      this.input.keys["e"] || this.input.keys["shift"] || this.input._weaponPressed;
    this.input.keys["e"]      = false;
    this.input.keys["shift"]  = false;
    this.input._weaponPressed = false;
    if (weaponSwitchRequested && state === GameState.PLAYING) {
      const modes = ["default", "spread", "laser"];
      const idx   = modes.indexOf(this.player.weapon);
      this.player.weapon = modes[(idx + 1) % modes.length];
      const labels = { default: "GUN", spread: "SHOT", laser: "LASER" };
      const label  = labels[this.player.weapon] || "GUN";
      this.setWeaponLabel(label);
    }
  }

  // FIX(polish3): #weaponBtn (mobile) and #weaponBtnPC (desktop) always
  // mirror the same label. This used to be a duplicated null-check-and-set
  // pair at both call sites (start() and the weapon-cycle handler here);
  // now there's exactly one place that knows about both DOM nodes.
  setWeaponLabel(label) {
    const weaponBtn = document.getElementById("weaponBtn");
    if (weaponBtn) weaponBtn.textContent = label;
    const weaponBtnPC = document.getElementById("weaponBtnPC");
    if (weaponBtnPC) weaponBtnPC.textContent = label;
  }

  // ── Fixed-step physics update ──────────────────────────────────────────────

  _update(dt) {
    // _update is only ever called from the fixed-step accumulator loop with
    // this._FIXED_STEP, so dt should never vary — assert loudly if it does
    // rather than silently clamping.
    // FIX(polish1): gated behind DEBUG — this ran on every physics tick
    // (up to 60x/sec) unconditionally in production before.
    if (DEBUG) console.assert(dt === this._FIXED_STEP, "_update called with non-fixed dt:", dt);
    this.gameTime += dt;

    // FIX(bug12): this Set's own class-level comment says it's "cleared each
    // tick, never newed" but nothing actually called .clear() on it — it
    // silently retained a reference to every Boss instance ever fought for
    // the rest of the session (a small but permanent per-run memory leak).
    this.collisionSeenSet.clear();

    this.spatialHash.clear();
    for (const e of this.enemies) this.spatialHash.insert(e);

    this.player.update(dt, this.input);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      e.update(dt, this.player);
      if (e.hp <= 0) this._handleEnemyDeath(e, i);
    }

    // Rebuild index map after enemy deaths may have shuffled the array
    // (moved into CombatSystem.resolveBulletCollisions — see that class for
    // the full bullet-vs-wall/enemy/boss collision pass, including the
    // FIX(bug8) index-map bookkeeping and the post-loop wall compaction).
    this.combatSystem.resolveBulletCollisions(this);
    if (this._deadBullets > 0 &&
        this._deadBullets / this.bullets.length >= CONFIG.COMPACT_THRESHOLD_BULLETS) {
      // Single linear pass — filter in place, no secondary array allocation
      let write = 0;
      for (let read = 0; read < this.bullets.length; read++) {
        if (this.bullets[read].active) this.bullets[write++] = this.bullets[read];
      }
      this.bullets.length = write;
      this._deadBullets   = 0;
    }

    // Powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      if (Utils.distSq(this.player.x, this.player.y, pu.x, pu.y) < (this.player.size + pu.size) ** 2) {
        this._applyPowerup(pu.type);
        this.spawnParticles(pu.x, pu.y, pu.color, 20);
        Utils.removeFast(this.powerups, i);
      }
    }

    // ── Particles ─────────────────────────────────────────────────────────
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.update(dt);

      if (p.life <= 0) {
        p.active = false;
        this.particlePool.release(p);
        this._deadParticles++;
      }
    }

    // bulk-compact particles at threshold
    if (this._deadParticles > 0 &&
        this._deadParticles / this.particles.length >= CONFIG.COMPACT_THRESHOLD_PARTICLES) {
      let write = 0;
      for (let read = 0; read < this.particles.length; read++) {
        if (this.particles[read].active) this.particles[write++] = this.particles[read];
      }
      this.particles.length = write;
      this._deadParticles   = 0;
    }

    // ── Boss ──────────────────────────────────────────────────────────────
    if (this.boss) {
      this.boss.update(this._FIXED_STEP, this.player);
      if (!this.boss.isAlive) {
        this.boss.alive = false;   // gate any same-tick collision checks
        this.spawnParticles(this.boss.x, this.boss.y, this.boss.color, 60);
        this.audio.playEnemyDeath();
        this._addShake(CONFIG.SHAKE_MAX * 2, true);   // FIX(bug4): high-intensity — thud
        // Big coin bonus for killing the boss
        this.meta.awardCoins(this.wave * 3, 0);
        // FIX(bug7 review): normal enemy deaths award XP via _handleEnemyDeath
        // (this.kills++ + player.addXP()) but the boss-death branch previously
        // awarded neither — same "boss wave forgot a normal-wave-only counter"
        // pattern as the softlock bug below, just for XP instead of wave
        // progression. Award a lump XP bonus scaled with wave, consistent
        // with the boss's outsized coin bonus.
        this.player.addXP(50 + this.wave * 5);
        this.boss = null;
      }
    }

    // Wave progression — see WaveSystem.checkWaveCleared() for the FIX(bug7)
    // boss-wave softlock fix and full rationale.
    this.waveSystem.checkWaveCleared(this);

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      this.damageNumbers[i].update(dt);
      if (this.damageNumbers[i].life <= 0) {
        DamageNumber.release(this.damageNumbers[i]);
        this.damageNumbers.splice(i, 1);
      }
    }

    if (this.cameraShake > 0) {
      this._shakeTime  += dt;
      this.cameraShake *= Math.exp(-CONFIG.SHAKE_DECAY * dt);
      if (this.cameraShake < 0.05) { this.cameraShake = 0; this._shakeTime = 0; }
    }
    // FIX(bug4): thud layer decays on the same curve, independent clock.
    if (this.thudShake > 0) {
      this._thudTime  += dt;
      this.thudShake  *= Math.exp(-CONFIG.SHAKE_DECAY * dt);
      if (this.thudShake < 0.05) { this.thudShake = 0; this._thudTime = 0; }
    }

    if (this.player && !this.player.alive && this.fsm.isNot(GameState.GAME_OVER)) {
      this.fsm.transition(GameState.GAME_OVER);
    }
  }

  // ── Batched render pipeline ────────────────────────────────────────────────

  // alpha parameter drives all entity lerp calls
  _draw(alpha) {
    const ctx = this.ctx;

    ctx.fillStyle = "#050810";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();

    if (this.cameraShake > 0.05 || this.thudShake > 0.05) {
      let ox = 0, oy = 0;
      if (this.cameraShake > 0.05) {
        ox += Math.sin(this._shakeTime * CONFIG.SHAKE_FREQ * Math.PI * 2)       * this.cameraShake;
        oy += Math.sin(this._shakeTime * CONFIG.SHAKE_FREQ * Math.PI * 2 + 1.5) * this.cameraShake;
      }
      // FIX(bug4): low-frequency thud, summed on top of the rattle above —
      // only ever non-zero for high-intensity events (see _addShake()), so
      // big hits get a structurally different shake, not just a bigger one.
      if (this.thudShake > 0.05) {
        ox += Math.sin(this._thudTime * CONFIG.SHAKE_THUD_FREQ * Math.PI * 2)       * this.thudShake;
        oy += Math.sin(this._thudTime * CONFIG.SHAKE_THUD_FREQ * Math.PI * 2 + 2.1) * this.thudShake;
      }
      ctx.translate(ox, oy);
    }

    // ── Walls (body → HP bg → HP fg, single pass per wall) ─────────────────
    for (const w of this.walls) {
      ctx.fillStyle = CONFIG.WALL_COLOR;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = CONFIG.WALL_HP_COLOR;
      ctx.fillRect(w.x, w.y - 9, w.w, 4);
      ctx.fillStyle = CONFIG.WALL_HP_GOOD_COLOR;
      ctx.fillRect(w.x, w.y - 9, w.w * Utils.clamp(w.hp / w.maxHp, 0, 1), 4);
    }

    // ── Crates & Pillars (indestructible environment) ─────────────────────
    if (this.crates) {
      // shadowBlur is only toggled on state *transitions* (crate->pillar or
      // pillar->crate) instead of unconditionally every pillar iteration —
      // consecutive pillars now reuse the already-active shadow state.
      // Guaranteed off before any crate draw, so visual output is unchanged.
      let shadowActive = false;
      for (const c of this.crates) {
        if (c.isPillar) {
          // Pillar: dark core + bright neon outline
          ctx.fillStyle   = "#0d1220";
          ctx.fillRect(c.x, c.y, c.w, c.h);
          ctx.strokeStyle = "rgba(0,229,255,0.55)";
          ctx.lineWidth   = 2;
          if (!shadowActive) {
            ctx.shadowColor = "#00e5ff";
            ctx.shadowBlur  = 8;
            shadowActive = true;
          }
          ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
          // Vertical light stripe
          ctx.fillStyle = "rgba(0,229,255,0.08)";
          ctx.fillRect(c.x + c.w * 0.35, c.y, c.w * 0.3, c.h);
        } else {
          if (shadowActive) { ctx.shadowBlur = 0; shadowActive = false; }
          // Crate: warm steel box with rivets
          ctx.fillStyle = "#1c2535";
          ctx.fillRect(c.x, c.y, c.w, c.h);
          ctx.strokeStyle = "rgba(255,180,60,0.5)";
          ctx.lineWidth   = 1.5;
          ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
          // Cross hatching
          ctx.strokeStyle = "rgba(255,180,60,0.15)";
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.w, c.y + c.h);
          ctx.moveTo(c.x + c.w, c.y); ctx.lineTo(c.x, c.y + c.h);
          ctx.stroke();
          // Corner rivets
          ctx.fillStyle = "rgba(255,180,60,0.55)";
          const rv = 3;
          for (const [rx, ry] of [[c.x+rv, c.y+rv],[c.x+c.w-rv, c.y+rv],[c.x+rv, c.y+c.h-rv],[c.x+c.w-rv, c.y+c.h-rv]]) {
            ctx.beginPath(); ctx.arc(rx, ry, rv * 0.7, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      ctx.shadowBlur = 0;
    }

    // ── Powerups (batched by color) ───────────────────────────────────────
    if (this.powerups.length > 0) {
      const pulse = Math.sin(this.gameTime * 5) * 2;
      for (const pu of this.powerups) {
        ctx.fillStyle = pu.color;
        ctx.beginPath();
        ctx.moveTo(pu.x + pu.size + pulse, pu.y);
        ctx.arc(pu.x, pu.y, pu.size + pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      // FIX(bug2): colorblind accessibility — draw a distinct glyph per
      // type on top of the glow sprite above so type reads without relying
      // on hue. Dark offset copy + white top copy gives a cheap outline
      // that stays legible against every powerup color.
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      for (const pu of this.powerups) {
        const glyph = CONFIG.POWERUP_GLYPHS[pu.type];
        if (!glyph) continue;
        ctx.font = `700 ${Math.max(10, (pu.size + pulse) * 1.15)}px ${CONFIG.HUD_FONT}`;
        ctx.fillStyle = "rgba(5,8,16,0.85)";
        ctx.fillText(glyph, pu.x, pu.y + 1);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(glyph, pu.x, pu.y);
      }
      ctx.textAlign    = "left";
      ctx.textBaseline = "alphabetic";
    }

    // ── Particles ──────────────────────────────────────────────────────
    for (const p of this.particles) p.draw(ctx, alpha);
    ctx.globalAlpha = 1;

    // ── Bullet trails ─────────────────────────────────────────────────────
    this.trailMgr.draw(ctx);

    // ── Bullets: glow layer ───────────────────────────────────────────────
    for (const b of this.bullets) {
      if (!b.active) continue;
      const rx   = Utils.lerp(b.prevX, b.x, alpha);
      const ry   = Utils.lerp(b.prevY, b.y, alpha);
      const glow = GlowCache.get(b.color, b.size, b.size * 3);
      ctx.drawImage(glow.canvas, rx - glow.half, ry - glow.half);
    }
    // Bullet white-core batch pass
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    for (const b of this.bullets) {
      if (!b.active) continue;
      const rx = Utils.lerp(b.prevX, b.x, alpha);
      const ry = Utils.lerp(b.prevY, b.y, alpha);
      ctx.moveTo(rx + b.size * 0.35, ry);
      ctx.arc(rx, ry, b.size * 0.35, 0, Math.PI * 2);
    }
    ctx.fill();

    // ── Enemies: neon polygon draw (each enemy handles its own glow) ─────
    for (const e of this.enemies) e.draw(ctx, alpha);

    // ── Boss ─────────────────────────────────────────────────────────────
    if (this.boss) this.boss.draw(ctx, alpha);

    // ── Enemy HP bars (interpolated positions) ────────────────────────────
    ctx.fillStyle = CONFIG.WALL_HP_COLOR;
    for (const e of this.enemies) {
      const rx  = Utils.lerp(e.prevX, e.x, alpha);
      const ry  = Utils.lerp(e.prevY, e.y, alpha);
      const barW = 44 * this.uiScale;
      const barH = 5  * this.uiScale;
      ctx.fillRect(rx - barW / 2, ry - e.size - barH - 6, barW, barH);
    }
    ctx.fillStyle = CONFIG.WALL_HP_GOOD_COLOR;
    for (const e of this.enemies) {
      const rx   = Utils.lerp(e.prevX, e.x, alpha);
      const ry   = Utils.lerp(e.prevY, e.y, alpha);
      const barW = 44 * this.uiScale;
      const barH = 5  * this.uiScale;
      ctx.fillRect(rx - barW / 2, ry - e.size - barH - 6, barW * Utils.clamp(e.hp / e.maxHp, 0, 1), barH);
    }

    // ── Player ─────────────────────────────────────────────────────────
    this.player.draw(ctx, this.input, alpha);

    ctx.restore();

    this.ui.drawHUD(ctx);

    // ── Damage vignette flash ──────────────────────────────────────────────
    if (this.damageFlash > 0) {
      const a    = Utils.clamp(this.damageFlash, 0, 0.72);
      const grad = ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.height * 0.25,
        this.width / 2, this.height / 2, this.height * 0.85
      );
      grad.addColorStop(0,   "rgba(255,0,30,0)");
      grad.addColorStop(0.6, `rgba(255,0,30,${(a * 0.55).toFixed(3)})`);
      grad.addColorStop(1,   `rgba(255,0,30,${a.toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
      this.damageFlash = Math.max(0, this.damageFlash - 1.8 / 60);
    }

    if (this.fsm.is(GameState.WAVE_TRANSITION)) {
      const countdown = Math.ceil(this._waveTransitionTimer);
      ctx.save();
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      // Line 1: wave incoming
      ctx.font         = `900 52px 'Orbitron', monospace`;
      ctx.fillStyle    = "#00e5ff";
      ctx.shadowColor  = "#00e5ff";
      ctx.shadowBlur   = 20;
      ctx.fillText(`WAVE ${this.wave + 1} INCOMING`, this.width / 2, this.height / 2 - 40);
      // Line 2: countdown integer
      ctx.font         = `700 28px 'Rajdhani', sans-serif`;
      ctx.fillStyle    = "rgba(255,255,255,0.7)";
      ctx.shadowBlur   = 0;
      ctx.fillText(String(countdown), this.width / 2, this.height / 2 + 20);
      // Line 3: boss pre-warning
      if (this._bossWarning) {
        ctx.font        = `700 22px 'Rajdhani', sans-serif`;
        ctx.fillStyle   = "#ff2d55";
        ctx.shadowColor = "#ff2d55";
        ctx.shadowBlur  = 12;
        ctx.fillText("⚠ BOSS INCOMING", this.width / 2, this.height / 2 + 60);
      }
      ctx.restore();
    }

    if (this.damageNumbers && this.damageNumbers.length > 0) {
      for (const dn of this.damageNumbers) dn.draw(ctx);
    }
  }

  // ── Spawning helpers ───────────────────────────────────────────────────────
  // FIX(perf3): _spawnWave() moved to WaveSystem.spawnWave(game) — see that
  // class for the wave-budget system this used to implement here.

  _spawnWalls() {
    this.walls   = [];
    this.crates  = [];   // indestructible static obstacles (crates & pillars)

    // player spawn is at (width/2, height/2); reject any placement within 90px
    const cx = this.width / 2;
    const cy = this.height / 2;
    const EXCLUSION = 90;
    const _tooClose = (rx, ry, rw, rh) => {
      // Check if the rect comes within EXCLUSION px of the centre spawn
      const nearX = Utils.clamp(cx, rx, rx + rw);
      const nearY = Utils.clamp(cy, ry, ry + rh);
      return Utils.distSq(cx, cy, nearX, nearY) < EXCLUSION * EXCLUSION;
    };

    // ── Destructible walls (existing behaviour) ─────────────────────────────
    // FIX(feature3): Math.random() → this.rng() throughout this method, so
    // Daily Challenge mode's seeded generator reproduces the same wall/
    // crate layout for the same UTC date.
    const wCount = Math.floor(this.rng() * 6) + 5;
    for (let i = 0; i < wCount; i++) {
      let wx, wy, w, h;
      let attempts = 0;
      do {
        w  = 100 + this.rng() * 110;
        h  = 18  + this.rng() * 28;
        wx = this.rng() * (this.width  - w - 40) + 20;
        wy = this.rng() * (this.height - h - 40) + 20;
        attempts++;
      } while (_tooClose(wx, wy, w, h) && attempts < 20);
      // generate hp first so maxHp can mirror it — HP bar starts full at spawn
      const hp = Math.floor(this.rng() * 5) + 3;
      this.walls.push({ x: wx, y: wy, w, h, hp, maxHp: hp });
    }

    // ── Indestructible crates / pillars ─────────────────────────────────────
    // Mix of square "crates" and taller "pillar" rectangles
    const cCount = Math.floor(this.rng() * 5) + 4;
    const margin = 60;
    for (let i = 0; i < cCount; i++) {
      let cx2, cy2, w, h;
      const isPillar = this.rng() < 0.35;
      let attempts = 0;
      do {
        w = isPillar ? 22 + this.rng() * 14 : 38 + this.rng() * 30;
        h = isPillar ? 70 + this.rng() * 50 : w * (0.8 + this.rng() * 0.4);
        cx2 = this.rng() * (this.width  - w - margin * 2) + margin;
        cy2 = this.rng() * (this.height - h - margin * 2) + margin;
        attempts++;
      } while (_tooClose(cx2, cy2, w, h) && attempts < 20);
      this.crates.push({ x: cx2, y: cy2, w, h, isPillar });
    }

    // Build wallHash for broad-phase collision queries in checkWallCollision.
    this._rebuildWallHash();
  }

  // FIX(feature6): factored out of _spawnWalls() so Game.resumeRun() can
  // rebuild the hash for a restored wall/crate layout without duplicating
  // this insertion logic a third time (CombatSystem's post-collision
  // compaction already has its own copy — left alone since it's tested,
  // Part 2 code; this one is shared between the two Part 3 call sites).
  // Each rect is inserted as a pseudo-entity centred on its AABB midpoint
  // with size = half-diagonal so the hash bucket covers the entire rect.
  _rebuildWallHash() {
    this._wallHash = new SpatialHash(120);
    const _insertRect = (r) => {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const sz = Math.sqrt(r.w * r.w + r.h * r.h) / 2;
      this._wallHash.insert({ x: cx, y: cy, size: sz, _rect: r });
    };
    for (const w of this.walls)  _insertRect(w);
    for (const c of this.crates) _insertRect(c);
  }

  spawnParticles(x, y, color, count = 20) {
    // FIX(perf2): low-power devices get a reduced particle budget — the
    // gate below (count >= 15) still checks the *requested* intensity, so
    // low-power mode changes how many particles an event costs, not
    // which events get the bigger ring-burst treatment.
    const n = this._lowPowerMode ? Math.max(1, Math.round(count * 0.5)) : count;

    // Standard scatter
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 0.8;
      const p     = this.particlePool.get();
      p.init(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        color, Math.random() * 4 + 1.5, Math.random() * 0.55 + 0.35);
      this.particles.push(p);
    }

    // Ring burst only for large explosions (count >= 15); skip for small hits like wall sparks
    if (count >= 15) {
      const shards = this._lowPowerMode ? 6 : 12;
      for (let i = 0; i < shards; i++) {
        const angle = (i / shards) * Math.PI * 2;
        const speed = 6.5 + Math.random() * 2.5;
        const p     = this.particlePool.get();
        p.init(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
          "#ffffff", 2.5, 0.4 + Math.random() * 0.2);
        this.particles.push(p);
      }
    }
  }

  checkWallCollision(x, y, size) {
    // Broad-phase via wallHash; falls back to full iteration if hash not ready.
    if (this._wallHash) {
      const candidates = this._wallHash.query(x, y, size + 80);
      for (const proxy of candidates) {
        const r = proxy._rect;
        if (Utils.circleRect(x, y, size, r.x, r.y, r.w, r.h)) return r;
      }
      return null;
    }
    // Fallback (first frame before _spawnWalls runs)
    for (const w of this.walls) {
      if (Utils.circleRect(x, y, size, w.x, w.y, w.w, w.h)) return w;
    }
    if (this.crates) {
      for (const c of this.crates) {
        if (Utils.circleRect(x, y, size, c.x, c.y, c.w, c.h)) return c;
      }
    }
    return null;
  }

  _handleEnemyDeath(enemy, index) {
    enemy.alive = false;   // gate all further collision/update checks this tick
    if (Math.random() < 0.2) {
      const type = CONFIG.POWERUP_TYPES[Math.floor(Math.random() * CONFIG.POWERUP_TYPES.length)];
      this.powerups.push({ x: enemy.x, y: enemy.y, type, size: 12 * this.uiScale, color: CONFIG.POWERUP_COLORS[type] });
    }
    this.kills++;
    this.player.addXP(10 + Math.floor(Math.log2(this.wave + 1)) * 2);
    this.spawnParticles(enemy.x, enemy.y, enemy.color, 22);
    this.audio.playEnemyDeath();
    Utils.removeFast(this.enemies, index);
  }

  // FIX(bug4): `big` opts a hit into the low-frequency thud layer (summed
  // with the normal rattle in _draw()) — pass true for high-intensity
  // events only (boss death, exploder, boss dash contact).
  triggerDamageFlash(intensity = 1.0, big = false) {
    // FIX(polish2): reduced-motion dampens the vignette flash and its
    // paired shake to ~35% strength rather than removing the feedback
    // entirely — players still need to know they were hit.
    const rm = this._reducedMotion ? 0.35 : 1;
    this.damageFlash  = Math.min(1, this.damageFlash + 0.35 * intensity * rm);
    this._addShake(CONFIG.SHAKE_MAX * 0.6 * intensity, big);
  }

  // FIX(polish2): centralizes every "bump the camera shake" call site so
  // reduced-motion dampening only has to live in one place.
  // FIX(bug4): `big` also feeds the independent thud layer.
  _addShake(amount, big = false) {
    const rm = this._reducedMotion ? 0.35 : 1;
    this.cameraShake = Math.max(this.cameraShake, amount * rm);
    if (big) this.thudShake = Math.max(this.thudShake, amount * rm);
  }

  _applyPowerup(type) {
    switch (type) {
      case "health":      this.player.health = Math.min(this.player.maxHealth, this.player.health + 35); break;
      case "xp":          this.player.addXP(30); break;
      case "shield":      this.player.buffs.shield     = 10; break;
      case "triple_shot": this.player.buffs.tripleShot = 8;  break;
      case "speed_boost": this.player.buffs.speedBoost = 7;  break;
      case "rage":        this.player.buffs.rage       = 5;  break;
      default: console.warn(`Unknown powerup type: ${type}`);
    }
  }
}


// =============================================================================
// SECTION 14 — GLOBAL ERROR HANDLING
// FIX(polish4): an uncaught exception anywhere (init, the rAF loop, an
// event handler) previously either silently froze the game or spammed the
// console with no player-visible feedback. Log it, stop the loop so it
// doesn't keep re-throwing every frame, and show a minimal reload prompt.
// =============================================================================
let _fatalErrorShown = false;

function showFatalErrorOverlay(err) {
  if (_fatalErrorShown) return;   // only ever show the overlay once
  _fatalErrorShown = true;

  // Stop the rAF loop so a repeating per-frame error can't keep firing.
  try { if (window.kGame && window.kGame._rafId) cancelAnimationFrame(window.kGame._rafId); } catch {}

  const overlay = document.createElement("div");
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-label", "Error");
  overlay.style.cssText = [
    "position:fixed", "inset:0", "z-index:99999",
    "display:flex", "flex-direction:column",
    "align-items:center", "justify-content:center",
    "gap:16px", "padding:24px", "text-align:center",
    "background:rgba(5,8,16,0.92)", "color:#e8f0fe",
    "font-family:'Rajdhani',sans-serif", "font-size:20px",
  ].join(";");
  overlay.innerHTML = `
    <div>Something went wrong — reload to keep playing.</div>
    <button type="button" style="
      font:inherit; font-weight:700; padding:10px 24px; cursor:pointer;
      background:#00e5ff; color:#050810; border:none; border-radius:6px;
    ">Reload</button>`;
  overlay.querySelector("button").addEventListener("click", () => window.location.reload());
  document.body.appendChild(overlay);
}

window.addEventListener("error", e => {
  console.error("KritikShoot fatal error:", e.error || e.message, e);
  showFatalErrorOverlay(e.error || e.message);
});

window.addEventListener("unhandledrejection", e => {
  console.error("KritikShoot unhandled rejection:", e.reason);
  showFatalErrorOverlay(e.reason);
});


// =============================================================================
// SECTION 15 — BOOTSTRAP
// =============================================================================
window.addEventListener("load", () => {
  try {
    window.kGame = new Game();
  } catch (err) {
    showFatalErrorOverlay(err);
  }
});
