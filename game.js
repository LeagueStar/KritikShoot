
"use strict";

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

  ONBOARDING_WAVE1_BUDGET: 4,
  ONBOARDING_HINT_DURATION: 6,

  AMBIENT_MAX_GAIN:     0.06,

  CORRUPTION_START_WAVE:   10,
  CORRUPTION_START_RADIUS: 18,
  CORRUPTION_MAX_RADIUS:   150,
  CORRUPTION_SPREAD_RATE:  12,
  CORRUPTION_LIFETIME:     18,
  CORRUPTION_FADE_TIME:    2.5,
  CORRUPTION_DPS:          8,
  CORRUPTION_MOTE_COUNT:   9,

  SHAKE_MAX:            14,
  SHAKE_DECAY:          6.5,
  SHAKE_FREQ:           55,
  SHAKE_THUD_FREQ:      10,

  PARTICLE_FRICTION:    0.88,
  PARTICLE_DECAY:       0.94,

  POOL_BULLETS:         300,
  POOL_PARTICLES:       500,

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
  POWERUP_GLYPHS: {
    health:       "+",
    xp:           "\u2726",
    shield:       "\u25C8",
    triple_shot:  "\u039E",
    speed_boost:  "\u00BB",
    rage:         "\u2739",
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


// ── ENEMY_TABLE ─────────────────────────────────────────────────
const ENEMY_TABLE = Object.freeze([
  { type: "normal",   cost: 1, unlockWave: 1, weight: 5 },
  { type: "rusher",   cost: 1, unlockWave: 1, weight: 4 },
  { type: "fast",     cost: 2, unlockWave: 2, weight: 3 },
  { type: "ranged",   cost: 2, unlockWave: 3, weight: 3 },
  { type: "spread",   cost: 2, unlockWave: 4, weight: 2 },
  { type: "exploder", cost: 3, unlockWave: 5, weight: 2 },
  { type: "tank",     cost: 3, unlockWave: 6, weight: 1 },
]);

// ── ENEMY_TYPES ─────────────────────────────────────────────────
const ENEMY_TYPES = Object.freeze({
  normal: {
    color: "#2ecc71", baseSize: 20, speed: CONFIG.BASE_ENEMY_SPEED,
    hpMul: 1.0, shootDelay: 2.0, sides: 4, rotSpeed: 1.2,
  },
  rusher: {
    color: "#e74c3c", baseSize: 14, speed: 240,
    hpMul: 0.4, shootDelay: 99, sides: 3, rotSpeed: 4.0,
    meleeCooldown: 0.4, meleeDamageMult: 1.0,
  },
  fast: {
    color: "#f1c40f", baseSize: 16, speed: 185,
    hpMul: 0.6, shootDelay: 1.5, sides: 3, rotSpeed: 4.0,
  },
  ranged: {
    color: "#00e5ff", baseSize: 18, speed: 60,
    hpMul: 0.8, shootDelay: 1.2, sides: 8, rotSpeed: 1.2,
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
    hpMul: 2.5, shootDelay: 99, sides: 6, rotSpeed: 0.3,
    meleeCooldown: 0.9, meleeDamageMult: 2.5,
  },
});

// ── WEAPON_TUNING ───────────────────────────────────────────────
const WEAPON_TUNING = Object.freeze({
  spread: {
    pellets:              6,
    spreadHalfAngle:      0.35,
    damageMult:           0.38,
    critRageDamageMult:   2,
    velocitySpreadMin:    0.85,
    velocitySpreadRange:  0.3,
    bulletSizeNormal:     4,
    bulletSizeCrit:       6,
    maxPierce:            4,
  },
  laser: {
    baseMultiplier:              1.4,
    critMultiplier:              1.8,
    overchargedBeamBonusPerTier: 0.08,
    velocityMultiplier:          1.5,
    bulletSizeNormal:            7,
    bulletSizeCrit:               9,
    maxPierceBase:                4,
    maxPiercePiercingOverload:    6,
  },
  default: {
    tripleShotSpreadAngle: 0.2,
    critRageDamageMult:    2,
    bulletSizeNormal:      5,
    bulletSizeCrit:        7,
    maxPierce:             4,
  },
});

// ── ASCENSION_LEVELS ────────────────────────────────────────────
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

    sweepCircle(x0, y0, x1, y1, cx, cy, combinedR) {
    const dx  = x1 - x0,  dy  = y1 - y0;
    const fx  = x0 - cx,  fy  = y0 - cy;
    const rSq = combinedR * combinedR;
    const c0   = fx * fx + fy * fy - rSq;
    if (c0 <= 0) return 0;
    const a   = dx * dx + dy * dy;
    if (a < 1e-10) return -1;
    const b    = 2 * (fx * dx + fy * dy);
    const c    = c0;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return (t >= 0 && t <= 1) ? t : -1;
  },

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

  hashStringToSeed(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
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

  todayUTCString() {
    return new Date().toISOString().slice(0, 10);
  },
};


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


// ── SpatialHash ─────────────────────────────────────────────────
class SpatialHash {
  constructor(cellSize = 80) {
    this._cell    = cellSize;
    this._map     = new Map();
    this._scratch = [];
    this._stamp   = 0;
    this._bucketPool = [];
  }

  clear() {
    for (const bucket of this._map.values()) {
      bucket.length = 0;
      this._bucketPool.push(bucket);
    }
    this._map.clear();
  }

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
  WAVE_TRANSITION: "WAVE_TRANSITION",
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
    if (obj._pooled) {
      console.warn("ObjectPool.release() called on an already-released object; ignoring.");
      return;
    }
    obj._pooled = true;
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
  padScale: 1,

  get(color, radius, pad = null) {
    pad = (pad ?? radius * 1.5) * GlowCache.padScale;
    const key = `${color}:${radius | 0}:${pad | 0}`;
    let   g   = this._map.get(key);
    if (g) {
      this._map.delete(key);
      this._map.set(key, g);
    } else {
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


// ── BackgroundLayer ─────────────────────────────────────────────
const BackgroundLayer = {
  _gridTile:  null,
  _vignette:  null,
  _scrollX: 0, _scrollY: 0,

  _buildGridTile() {
    const size = 64;
    const oc   = document.createElement("canvas");
    oc.width = oc.height = size;
    const octx = oc.getContext("2d");
    octx.strokeStyle = "rgba(0,229,255,0.05)";
    octx.lineWidth   = 1;
    octx.beginPath();
    octx.moveTo(0.5, 0);   octx.lineTo(0.5, size);
    octx.moveTo(0, 0.5);   octx.lineTo(size, 0.5);
    octx.stroke();
    this._gridTile = oc;
  },

  _buildVignette(width, height, color) {
    const oc = document.createElement("canvas");
    oc.width = width; oc.height = height;
    const octx = oc.getContext("2d");
    const grad = octx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.22,
      width / 2, height / 2, Math.max(width, height) * 0.72,
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, color);
    octx.fillStyle = grad;
    octx.fillRect(0, 0, width, height);
    this._vignette = { key: `${width}x${height}:${color}`, canvas: oc };
  },

  draw(ctx, width, height, dt, waveLevel, bossActive) {
    if (!this._gridTile) this._buildGridTile();

    this._scrollX = (this._scrollX + dt * 6) % 64;
    this._scrollY = (this._scrollY + dt * 3) % 64;
    ctx.save();
    ctx.translate(-this._scrollX, -this._scrollY);
    ctx.fillStyle = ctx.createPattern(this._gridTile, "repeat");
    ctx.fillRect(0, 0, width + 64, height + 64);
    ctx.restore();

    const color = bossActive
      ? "rgba(255,45,85,0.22)"
      : `rgba(0,10,20,${(0.35 + waveLevel * 0.25).toFixed(3)})`;
    const key = `${width}x${height}:${color}`;
    if (!this._vignette || this._vignette.key !== key) this._buildVignette(width, height, color);
    ctx.drawImage(this._vignette.canvas, 0, 0);
  },
};


// ── TrailManager ────────────────────────────────────────────────
class TrailManager {
  constructor(maxLength = 10) {
    this._maxLen = maxLength;
    this._trails = new Map();
  }

  register(entity, color) {
    const pts = new Array(this._maxLen).fill(null);
    this._trails.set(entity, { pts, color, writeIdx: 0, count: 0 });
  }

  unregister(entity) {
    this._trails.delete(entity);
  }

  push(entity) {
    const t = this._trails.get(entity);
    if (!t) return;
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


// ── AudioEngine ─────────────────────────────────────────────────
class AudioEngine {
  constructor() {
    this._ctx = null;
    try { this.muted = localStorage.getItem("ks_muted") === "true"; }
    catch { this.muted = false; }
    this._ambientNodes = null;
    this._ambientLevel = 0;
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === "suspended") this._ctx.resume();
    return this._ctx;
  }

  _play(setupFn, duration = 0.25) {
    if (this.muted) return;
    try {
      const ctx  = this._getCtx();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      const node = setupFn(ctx, gain);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration + 0.02);
      if (node && typeof node.addEventListener === "function") {
        node.addEventListener("ended", () => gain.disconnect(), { once: true });
      } else if (node && node.onended !== undefined) {
        node.onended = () => gain.disconnect();
      }
    } catch (e) {  }
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem("ks_muted", this.muted); } catch {}
    if (this._ambientNodes) {
      const ctx = this._ambientNodes.gain.context;
      const target = this.muted ? 0 : this._ambientLevel * CONFIG.AMBIENT_MAX_GAIN;
      this._ambientNodes.gain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.3);
    }
  }

  startAmbient() {
    if (this._ambientNodes) return;
    try {
      const ctx = this._getCtx();

      const master = ctx.createGain();
      master.gain.setValueAtTime(this.muted ? 0 : 0, ctx.currentTime);
      master.connect(ctx.destination);

      const mk = (freq, type, gainVal) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        const g = ctx.createGain();
        g.gain.setValueAtTime(gainVal, ctx.currentTime);
        osc.connect(g);
        g.connect(master);
        osc.start(ctx.currentTime);
        return osc;
      };

      const oscA = mk(55,    "sine",     1.0);
      const oscB = mk(82.5,  "sine",     0.55);
      const oscC = mk(110.3, "triangle", 0.3);

      const lfo     = ctx.createOscillator();
      lfo.type      = "sine";
      lfo.frequency.setValueAtTime(1 / 8, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.15, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
      lfo.start(ctx.currentTime);

      this._ambientNodes = { gain: master, oscA, oscB, oscC, lfo, lfoGain };
      this.setAmbientIntensity(this._ambientLevel);
    } catch (e) {  }
  }

  setAmbientIntensity(level) {
    this._ambientLevel = Utils.clamp(level, 0, 1);
    if (!this._ambientNodes) return;
    const ctx    = this._ambientNodes.gain.context;
    const target = this.muted ? 0 : this._ambientLevel * CONFIG.AMBIENT_MAX_GAIN;
    this._ambientNodes.gain.gain.linearRampToValueAtTime(target, ctx.currentTime + 1.5);
    this._ambientNodes.oscC.detune.linearRampToValueAtTime(this._ambientLevel * 12, ctx.currentTime + 1.5);
  }

  stopAmbient() {
    if (!this._ambientNodes) return;
    const { gain, oscA, oscB, oscC, lfo } = this._ambientNodes;
    try {
      const ctx = gain.context;
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      for (const osc of [oscA, oscB, oscC, lfo]) {
        osc.stop(ctx.currentTime + 0.45);
        osc.addEventListener("ended", () => osc.disconnect(), { once: true });
      }
      setTimeout(() => gain.disconnect(), 500);
    } catch (e) {  }
    this._ambientNodes = null;
  }

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
      return osc;
    });
  }

  playPlayerHit() {
    this._play((ctx, gain) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.31);

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
      src.onended = () => noiseGain.disconnect();
      return osc;
    }, 0.31);
  }

  playEnemyDeath() {
    this._play((ctx, gain) => {
      const bufLen = ctx.sampleRate * 0.18;
      const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data   = buffer.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

      const src    = ctx.createBufferSource();
      src.buffer   = buffer;

      const bpf    = ctx.createBiquadFilter();
      bpf.type     = "bandpass";
      bpf.frequency.value = 1800;
      bpf.Q.value  = 1.2;

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      src.connect(bpf);
      bpf.connect(gain);
      src.start(ctx.currentTime);
      return src;
    }, 0.19);
  }

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
        osc.onended = () => g2.disconnect();
        if (!firstOsc) firstOsc = osc;
      }
      return firstOsc;
    }, 0.15);
  }
}


// ── MetaProgression ─────────────────────────────────────────────
class MetaProgression {
  static UPGRADES = [
    {
      id:      "fireRate",
      label:   "⚡ Fire Rate",
      desc:    "+5% fire rate per tier",
      maxTier: 5,
      cost:    tier => 40 + tier * 20,
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
    {
      id:      "startShield",
      label:   "🛡 Starting Ward",
      desc:    "+3s of starting shield per tier — a cushion for the opening seconds of every run",
      maxTier: 3,
      cost:    tier => 60 + tier * 30,
      bonus:   tiers => tiers * 3,
    },
    {
      id:      "pickupRadius",
      label:   "🧲 Magnetism",
      desc:    "+15% powerup pickup radius per tier — fewer risky detours to grab drops",
      maxTier: 4,
      cost:    tier => 35 + tier * 18,
      bonus:   tiers => tiers * 0.15,
    },
    {
      id:      "startWeapon",
      label:   "🔫 Loadout Swap",
      desc:    "One-time: every run now starts with Shotgun equipped instead of the default Gun",
      maxTier: 1,
      cost:    () => 150,
      bonus:   tiers => tiers,
    },
  ];

  constructor() {
    // ── Session cache (populated once per run by initSession()) ─────────────
    this._cache = null;
    this._coins = 0;

    this._upgradeMap = null;
  }

    initSession() {
    try {
      const parsed = JSON.parse(localStorage.getItem("ks_meta") || "{}");
      this._cache = (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
    } catch {
      this._cache = {};
    }
    let rawCoins = 0;
    try { rawCoins = parseInt(localStorage.getItem("ks_coins") || "0", 10); } catch { rawCoins = 0; }
    this._coins = Number.isFinite(rawCoins) ? Math.max(0, rawCoins) : 0;
  }

    load() {
    return this._cache ?? {};
  }

    save(data) {
    this._cache = data;
    try { localStorage.setItem("ks_meta", JSON.stringify(data)); } catch {  }
  }

  getCoins() {
    return this._coins;
  }

  setCoins(n) {
    this._coins = Number.isFinite(n) ? Math.max(0, n) : this._coins;
    try { localStorage.setItem("ks_coins", String(this._coins)); } catch {  }
  }

  awardCoins(wave, gameTime) {
    const earned = wave * 10 + Math.floor(gameTime / 5);
    this.setCoins(this.getCoins() + earned);
    return earned;
  }

  getBonus(id) {
    if (!this._upgradeMap) {
      this._upgradeMap = new Map(MetaProgression.UPGRADES.map(u => [u.id, u]));
    }
    const cache = this._cache ?? {};
    const tiers = cache[id] || 0;
    const entry = this._upgradeMap.get(id);
    return entry ? entry.bonus(tiers) : 0;
  }

  purchase(id) {
    if (!this._upgradeMap) {
      this._upgradeMap = new Map(MetaProgression.UPGRADES.map(u => [u.id, u]));
    }
    const entry = this._upgradeMap.get(id);
    if (!entry) return false;
    const data  = { ...this.load() };
    const tiers = data[id] || 0;
    if (tiers >= entry.maxTier) return false;
    const cost  = entry.cost(tiers);
    const coins = this.getCoins();
    if (coins < cost) return false;
    this.setCoins(coins - cost);
    data[id] = tiers + 1;
    this.save(data);
    return true;
  }
}


// ── Bullet ──────────────────────────────────────────────────────
class Bullet {
  constructor() {
    this.active  = false;
    this.prevX   = 0;
    this.prevY   = 0;
    this._pooled = true;
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
    this.hitCount = 0;
    this.maxPierce = maxPierce;
    this.weaponType  = weaponType;
    this._ricocheted = false;
    this._forked     = false;
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


// ── Particle ────────────────────────────────────────────────────
class Particle {
  constructor() {
    this.active  = false;
    this.prevX   = 0;
    this.prevY   = 0;
    this._pooled = true;
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


// ── Player ──────────────────────────────────────────────────────
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
    this.buffs    = { shield: this.game.meta.getBonus("startShield"), tripleShot: 0, speedBoost: 0, rage: 0 };
    this._lastShot = 0;

    this.mods = {};
    this._ascensionLevelsSeen = new Set();

    this.weapon   = (this.game.meta.getBonus("startWeapon") > 0) ? "spread" : "default";

    this.weaponShots = { default: 0, spread: 0, laser: 0 };

    this._cachedAimAngle = 0;
  }

  get maxHealth()  { return CONFIG.PLAYER_BASE_HEALTH + this.upgrades.health * 20    + this.game.meta.getBonus("health"); }
  get speed()      { return Math.min(800, CONFIG.PLAYER_BASE_SPEED + (this.upgrades.speed * 30) + (this.buffs.speedBoost > 0 ? 150 : 0) + this.game.meta.getBonus("speed")); }
  get damage()     { return CONFIG.PLAYER_BASE_DAMAGE + (this.upgrades.damage * 2)   + this.game.meta.getBonus("damage"); }
  get shootDelay() { return Math.max(0.05, CONFIG.PLAYER_SHOOT_DELAY - (this.upgrades.fireRate * 0.02) - this.game.meta.getBonus("fireRate")); }
  get bulletSpd()  { return CONFIG.PLAYER_BULLET_SPEED + (this.upgrades.bulletSpeed * 30) + this.game.meta.getBonus("bulletSpeed"); }
  get critChance() { return this.upgrades.critChance * 0.05; }
  get lifesteal()  { return this.upgrades.lifesteal  * 0.05; }

  static SYNERGY_TIER = 3;

  getSynergies() {
    const u = this.upgrades;
    return {
      piercingOverload: this.weapon === "laser" && u.critChance >= Player.SYNERGY_TIER,
      vampiricRage: this.buffs.rage > 0 && u.lifesteal >= Player.SYNERGY_TIER,
      overchargedBeam: this.weapon === "laser" && u.fireRate >= Player.SYNERGY_TIER,
    };
  }

  _computeAimAngle(input) {
    if (!input.isMobile) {
      let ax = 0, ay = 0;
      if (input.keys["arrowup"])    ay -= 1;
      if (input.keys["arrowdown"])  ay += 1;
      if (input.keys["arrowleft"])  ax -= 1;
      if (input.keys["arrowright"]) ax += 1;
      if (ax !== 0 || ay !== 0) return Math.atan2(ay, ax);
    }

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

    this._cachedAimAngle = this._computeAimAngle(input);

    for (const key in this.buffs) {
      if (this.buffs[key] > 0) this.buffs[key] = Math.max(0, this.buffs[key] - dt);
    }

    let dx = 0, dy = 0;
    if (input.joystickActive) {
      dx = input.joystickX;
      dy = input.joystickY;
    } else {
      if (input.keys["w"]) dy -= 1;
      if (input.keys["s"]) dy += 1;
      if (input.keys["a"]) dx -= 1;
      if (input.keys["d"]) dx += 1;
    }

    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }

    const nx = this.x + dx * this.speed * dt;
    const ny = this.y + dy * this.speed * dt;
    if (!this.game.checkWallCollision(nx, this.y, this.size)) this.x = nx;
    if (!this.game.checkWallCollision(this.x, ny, this.size)) this.y = ny;

    this.x = Utils.clamp(this.x, this.size, this.game.width  - this.size);
    this.y = Utils.clamp(this.y, this.size, this.game.height - this.size);

    const wantsShoot = input.isShooting || input._shootBuffer;
    if (wantsShoot && (this.game.gameTime - this._lastShot) >= this.shootDelay) {
      input._shootBuffer = false;
      this._shoot(input);
    }
  }

  _shoot(input) {
    this._lastShot = this.game.gameTime;
    const audio    = this.game.audio;

    const angle = this._cachedAimAngle;

    this.weaponShots[this.weapon] = (this.weaponShots[this.weapon] || 0) + 1;

    // ── Weapon dispatch ────────────────────────────────────────────────────
    if (this.weapon === "spread") {
      const T = WEAPON_TUNING.spread;
      audio.playSpread();
      for (let i = 0; i < T.pellets; i++) {
        const spreadOff = (i / (T.pellets - 1) - 0.5) * T.spreadHalfAngle * 2;
        const ang    = angle + spreadOff;
        const isCrit = Math.random() < this.critChance;
        const isRage = this.buffs.rage > 0;
        const dmg    = ((isRage || isCrit) ? this.damage * T.critRageDamageMult : this.damage) * T.damageMult;
        const color  = isCrit ? "#f1c40f" : isRage ? "#ff4757" : "#ff9f43";
        const velMul = T.velocitySpreadMin + Math.random() * T.velocitySpreadRange;
        const b      = this.game.bulletPool.get();
        b.init(this.x, this.y,
          Math.cos(ang) * this.bulletSpd * velMul,
          Math.sin(ang) * this.bulletSpd * velMul,
          (isCrit ? T.bulletSizeCrit : T.bulletSizeNormal) * this.game.uiScale, color, dmg, false, false, T.maxPierce, "spread");
        this.game.bullets.push(b);
        this.game.trailMgr.register(b, b.color);
      }
      return;
    }

    if (this.weapon === "laser") {
      const T = WEAPON_TUNING.laser;
      audio.playLaser();
      const synergy = this.getSynergies();
      const isCrit = Math.random() < this.critChance;
      const isRage = this.buffs.rage > 0;
      let   dmg    = (isRage || isCrit) ? this.damage * T.critMultiplier : this.damage * T.baseMultiplier;
      if (synergy.overchargedBeam) {
        dmg *= 1 + (this.upgrades.fireRate - Player.SYNERGY_TIER + 1) * T.overchargedBeamBonusPerTier;
      }
      const color  = "#00e5ff";
      const b      = this.game.bulletPool.get();
      const maxPierce = (synergy.piercingOverload && isCrit) ? T.maxPiercePiercingOverload : T.maxPierceBase;
      b.init(this.x, this.y,
        Math.cos(angle) * this.bulletSpd * T.velocityMultiplier,
        Math.sin(angle) * this.bulletSpd * T.velocityMultiplier,
        (isCrit ? T.bulletSizeCrit : T.bulletSizeNormal) * this.game.uiScale, color, dmg, false, true, maxPierce, "laser");
      this.game.bullets.push(b);
      this.game.trailMgr.register(b, b.color);
      return;
    }

    // ── Default gun (original logic, tripleShot buff preserved) ───────────
    const T = WEAPON_TUNING.default;
    audio.playShoot();
    const baseAngles = (this.buffs.tripleShot > 0)
      ? [angle, angle - T.tripleShotSpreadAngle, angle + T.tripleShotSpreadAngle]
      : [angle];

    for (const ang of baseAngles) {
      const isCrit = Math.random() < this.critChance;
      const isRage = this.buffs.rage > 0;
      const dmg    = (isRage || isCrit) ? this.damage * T.critRageDamageMult : this.damage;
      const color  = isCrit ? "#f1c40f" : isRage ? "#ff4757" : "#e74c3c";
      const size   = (isCrit ? T.bulletSizeCrit : T.bulletSizeNormal) * this.game.uiScale;

      const b = this.game.bulletPool.get();
      b.init(this.x, this.y, Math.cos(ang) * this.bulletSpd, Math.sin(ang) * this.bulletSpd, size, color, dmg, false, false, T.maxPierce, "default");
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
      this.game._vibrate(25);
      if (ASCENSION_LEVELS.includes(this.stats.level) && !this._ascensionLevelsSeen.has(this.stats.level)) {
        this._ascensionLevelsSeen.add(this.stats.level);
        this.game.ui.showAscensionChoice();
      } else {
        this.game.ui.showLevelUp();
      }
    }
  }

    draw(ctx, input, alpha) {
    if (!this.alive) return;

    const rx = Utils.lerp(this.prevX, this.x, alpha);
    const ry = Utils.lerp(this.prevY, this.y, alpha);

    const angle = this._cachedAimAngle;

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(angle);

    const s = this.size;

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

    ctx.fillStyle = "rgba(0,229,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(s * 0.45, 0, s * 0.18, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}


// ── Enemy ───────────────────────────────────────────────────────
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

    const def = ENEMY_TYPES[type] || ENEMY_TYPES.normal;
    this.color      = def.color;
    this.size       = def.baseSize * game.uiScale;
    this.speed      = def.speed;
    this.hp         = baseHp * def.hpMul;
    this.shootDelay = def.shootDelay;

    if (def.preferredDistMul !== undefined) {
      this._preferredDist = def.preferredDistMul * game.uiScale;
      this.orbitDirection = Math.random() < 0.5 ? 1 : -1;
    }
    if (def.meleeCooldown !== undefined) {
      this.meleeCooldown   = def.meleeCooldown;
      this.meleeDamageMult = def.meleeDamageMult;
    }

    this.maxHp = this.hp;
  }

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

    let sdx, sdy;
    if (this.type === "ranged" && this._preferredDist) {
      const diff = dist - this._preferredDist;
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
            this.game._vibrate(20);
            if (player.health <= 0) { player.alive = false; player.health = 0; }
          }
        }
      }
    }

    const timeSinceShot = this.game.gameTime - this._lastShot;
    const canFire = (this.type === "ranged")
      ? timeSinceShot >= this.shootDelay && this._hasLineOfSight(player)
      : timeSinceShot >= this.shootDelay && !this.game.checkWallCollision(this.x, this.y, this.size);

    if (canFire) {
      this._lastShot = this.game.gameTime;

      if (this.type === "exploder") {
        this.game.spawnParticles(this.x, this.y, this.color, 35);
        this.hp = 0;
        this.game.triggerHitStop(2);
        const blastRadSq = (105 * this.game.uiScale) ** 2;
        const dSq        = Utils.distSq(this.x, this.y, player.x, player.y);
        if (dSq < blastRadSq && player.alive) {
          const falloff = 1 - (Math.sqrt(dSq) / Math.sqrt(blastRadSq));
          player.health -= this.damage * 2 * falloff;
          this.game.triggerDamageFlash(1.5, true);
          this.game.audio.playPlayerHit();
          this.game._vibrate(30);
          this.game._addShake(CONFIG.SHAKE_MAX * 1.5, true);
          if (player.health <= 0) { player.alive = false; player.health = 0; }
        }
        return;
      }

      if (this.type === "tank" || this.type === "rusher") return;

      const shootAngle = Math.atan2(player.y - this.y, player.x - this.x);

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

  draw(ctx, alpha) {
    const rx   = Utils.lerp(this.prevX, this.x, alpha);
    const ry   = Utils.lerp(this.prevY, this.y, alpha);
    const s    = this.size;
    const t    = this.game.gameTime;

    const glow = GlowCache.get(this.color, s, s * 1.4);
    ctx.drawImage(glow.canvas, rx - glow.half, ry - glow.half);

    ctx.save();
    ctx.translate(rx, ry);

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

    ctx.fillStyle   = "rgba(5,8,16,0.7)";
    ctx.fill();
    const shapeOnlyID = this.game.accessibility.shapeOnlyID;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = shapeOnlyID ? 4 : 2.5;
    ctx.shadowColor = this.color;
    ctx.shadowBlur  = 14;
    ctx.stroke();
    if (shapeOnlyID) {
      ctx.shadowBlur  = 0;
      ctx.lineWidth   = 1.5;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();
    }

    ctx.shadowBlur  = 10;
    ctx.fillStyle   = this.color;
    ctx.globalAlpha = 0.5 + Math.sin(t * 6 + this.x) * 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();

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
      const hue     = Math.round(frac * 120);
      ctx.fillStyle = `hsl(${hue},100%,50%)`;
      ctx.fillRect(barX, barY, barW * frac, barH);
      ctx.restore();
    }
  }
}


// ── Boss ────────────────────────────────────────────────────────
class Boss {
  constructor(game) {
    this.game   = game;
    this.x      = game.width  / 2;
    this.y      = -80;
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

    this._phase        = "enter";
    this._phaseTimer   = 0;
    this._targetX      = game.width  / 2;
    this._targetY      = game.height / 2;
    this._dashDx       = 0;
    this._dashDy       = 0;
    this._radialCount  = 0;
    this._flashToggle  = false;
    this._flashTimer   = 0;
    this._lastShot     = 0;
    this._shootInterval = 0.18;
    this._burstShots    = 0;
    this._burstTarget   = 16;
  }

  get isAlive() { return this.hp > 0; }

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
        if (this._flashTimer >= 0.12) {
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

        if (player.alive) {
          const dSq = Utils.distSq(nx, ny, player.x, player.y);
          if (dSq < (this.size + player.size) ** 2) {
            if (player.buffs.shield <= 0) {
              player.health -= this.damage * 3;
              this.game.triggerDamageFlash(2.0, true);
              this.game.audio.playPlayerHit();
              this.game._vibrate(30);
              if (player.health <= 0) { player.alive = false; player.health = 0; }
            }
          }
        }

        this.x = nx;
        this.y = ny;

        const oob = nx < -this.size || nx > this.game.width + this.size ||
                    ny < -this.size || ny > this.game.height + this.size;
        if (oob || this._phaseTimer >= 0.65) {
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
    this._burstTarget  = 14 + this._radialCount * 2;
    this._lastShot     = this.game.gameTime;
  }

  draw(ctx, alpha) {
    const rx = Utils.lerp(this.prevX, this.x, alpha);
    const ry = Utils.lerp(this.prevY, this.y, alpha);
    const s  = this.size;
    const t  = this.game.gameTime;

    const drawColor = (this._phase === "telegraph" && this._flashToggle) ? "#f1c40f" : this.color;

    const glow = GlowCache.get(drawColor, s, s * 1.8);
    ctx.drawImage(glow.canvas, rx - glow.half, ry - glow.half);

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(t * 0.6);

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

    ctx.shadowBlur  = 14;
    ctx.fillStyle   = drawColor;
    ctx.globalAlpha = 0.55 + Math.sin(t * 8) * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();

    const barW = s * 3.5;
    const barH = 10 * this.game.uiScale;
    const barX = rx - barW / 2;
    const barY = ry - s - barH - 14;
    const hpR  = Utils.clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = "rgba(255,45,85,0.35)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = "#ff2d55";
    ctx.fillRect(barX, barY, barW * hpR, barH);

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


// ── InputManager ────────────────────────────────────────────────
class InputManager {
  constructor(game) {
    this._game          = game;
    this.keys           = {};
    this.mouseX         = 0;
    this.mouseY         = 0;
    this.isShooting     = false;
    this._shootBuffer   = false;
    this.joystickActive = false;
    this.joystickX      = 0;
    this.joystickY      = 0;
    this._pausePressed  = false;
    this._quitPressed   = false;
    this._weaponPressed = false;

    this._shootSources = { mouse: false, aimTouch: false, fireBtn: false, joystick: false, keyboard: false };

    this._mouseMoved = false;

    this._bindListeners();
  }

  _updateShootState() {
    const s = this._shootSources;
    this.isShooting = s.mouse || s.aimTouch || s.fireBtn || s.joystick || s.keyboard;
  }

  get isMobile() {
    if (window.matchMedia) return window.matchMedia("(pointer: coarse)").matches;
    if ("ontouchstart" in window) return true;
    return /Mobi|Android|iPad|iPhone/i.test(navigator.userAgent) || window.innerWidth <= 1024;
  }

  _bindListeners() {
    const canvas   = document.getElementById("gameCanvas");
    const joy      = document.getElementById("joystick");
    const knob     = joy ? joy.querySelector(".joystick__knob") : null;
    const shootBtn = document.getElementById("shootBtn");

    window.addEventListener("keydown", e => {
      this.keys[e.key.toLowerCase()] = true;
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
      this._mouseMoved = true;
    });
    window.addEventListener("mousedown", () => {
      this._shootSources.mouse = true;
      this._updateShootState();
      this._shootBuffer = true;
    });
    window.addEventListener("mouseup",   () => {
      this._shootSources.mouse = false;
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
          this._shootSources.aimTouch = true;
          this._updateShootState();
          this._shootBuffer = true;
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
          this._shootSources.aimTouch = false;
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
          this._shootSources.joystick = false;
          this._updateShootState();
          if (knob) knob.style.transform = "translate(-50%, -50%)";
          if (joy) joy.classList.remove("joystick--active");
        }
      }
    });

    const _origUpdateJoy = this._updateJoystick.bind(this);
    this._updateJoystick = (touch, bx, by, k) => {
      _origUpdateJoy(touch, bx, by, k);
      const moving = Math.hypot(this.joystickX, this.joystickY) > 0.2;
      const shouldFire = moving && this._game && this._game.fsm.is(GameState.PLAYING);
      this._shootSources.joystick = shouldFire;
      this._updateShootState();
      if (shouldFire) this._shootBuffer = true;
    };

    if (shootBtn) {
      shootBtn.addEventListener("touchstart", e => {
        e.preventDefault();
        this._shootSources.fireBtn = true;
        this._updateShootState();
        this._shootBuffer = true;
      });
      shootBtn.addEventListener("touchend", e => {
        e.preventDefault();
        this._shootSources.fireBtn = false;
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

    const weaponBtnPC = document.getElementById("weaponBtnPC");
    if (weaponBtnPC) {
      weaponBtnPC.addEventListener("click", () => { this._weaponPressed = true; });
    }
  }

  _updateJoystick(touch, baseX, baseY, knob) {
    const maxRadius = 40;
    let dx = touch.clientX - baseX;
    let dy = touch.clientY - baseY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }

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

    try {
      const parsedScores = JSON.parse(localStorage.getItem("ks_scores") || "[]");
      this._scores = Array.isArray(parsedScores) ? parsedScores : [];
    } catch {
      this._scores = [];
    }

    this._el = {
      startScreen:     document.getElementById("startScreen"),
      levelUp:         document.getElementById("levelUpScreen"),
      ascension:       document.getElementById("ascensionScreen"),
      gameOverActions: document.getElementById("gameOverActions"),
      mobileUI:        document.getElementById("mobileControls"),
      leaderboard:     document.getElementById("localLeaderboard"),
      coinShop:        document.getElementById("coinShop"),
      instructions:    document.getElementById("instructionsScreen"),
    };

    this._pendingAscension = null;

    this._bindUI();
    this._renderLeaderboard();
    this._renderCoinShop();
    this._renderDailyHistory();
    this._updateResumeButton();

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

    if (instrPanel) {
      instrPanel.addEventListener("click", e => {
        if (e.target === instrPanel) closeInstructions();
      });
    }

    window.addEventListener("keydown", e => {
      if (e.key === "Escape" && instrPanel && !instrPanel.classList.contains("hidden")) {
        closeInstructions();
      }
    });

    const a11yBtn      = document.getElementById("accessibilityBtn");
    const a11yPanel    = document.getElementById("accessibilityScreen");
    const a11yClose    = document.getElementById("accessibilityCloseBtn");
    const shakeSlider  = document.getElementById("shakeIntensitySlider");
    const shakeValue   = document.getElementById("shakeIntensityValue");
    const textOptions  = document.querySelectorAll("#textSizeOptions .a11y-option");
    const shapeToggle  = document.getElementById("shapeOnlyToggle");

    const refreshA11yControls = () => {
      const a = this.game.accessibility;
      if (shakeSlider) shakeSlider.value = Math.round(a.shakeIntensity * 100);
      if (shakeValue)  shakeValue.textContent = `${Math.round(a.shakeIntensity * 100)}%`;
      textOptions.forEach(btn => {
        btn.classList.toggle("active", parseFloat(btn.dataset.scale) === a.textScale);
      });
      if (shapeToggle) shapeToggle.checked = a.shapeOnlyID;
    };

    const openA11y = () => { refreshA11yControls(); a11yPanel?.classList.remove("hidden"); };
    const closeA11y = () => { a11yPanel?.classList.add("hidden"); };

    if (a11yBtn)   a11yBtn.addEventListener("click", openA11y);
    if (a11yClose) a11yClose.addEventListener("click", closeA11y);
    if (a11yPanel) {
      a11yPanel.addEventListener("click", e => { if (e.target === a11yPanel) closeA11y(); });
    }
    window.addEventListener("keydown", e => {
      if (e.key === "Escape" && a11yPanel && !a11yPanel.classList.contains("hidden")) closeA11y();
    });

    if (shakeSlider) {
      shakeSlider.addEventListener("input", () => {
        this.game.accessibility.shakeIntensity = Utils.clamp(parseInt(shakeSlider.value, 10) / 100, 0, 1);
        if (shakeValue) shakeValue.textContent = `${shakeSlider.value}%`;
        this.game._saveAccessibility();
      });
    }

    textOptions.forEach(btn => {
      btn.addEventListener("click", () => {
        this.game.accessibility.textScale = parseFloat(btn.dataset.scale);
        textOptions.forEach(b => b.classList.toggle("active", b === btn));
        this.game._saveAccessibility();
      });
    });

    if (shapeToggle) {
      shapeToggle.addEventListener("change", () => {
        this.game.accessibility.shapeOnlyID = shapeToggle.checked;
        this.game._saveAccessibility();
      });
    }

    const startBtn = document.getElementById("startBtn");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        const nicknameInput = document.getElementById("nicknameInput");
        const raw  = nicknameInput ? nicknameInput.value.trim() : "";
        const name = raw.length > 0 ? raw : "Ghost";
        try { localStorage.setItem("ks_nickname", name); } catch {  }
        this._el.startScreen.classList.add("hidden");
        this._el.coinShop?.classList.add("hidden");
        if (this._shouldShowMobileUI()) {
          this._el.mobileUI.classList.add("mobile-ui--active");
          attemptLandscapeLock();
        }
        const dailyToggle = document.getElementById("dailyModeToggle");
        this.game.start({ daily: !!dailyToggle?.checked });
      });
    }

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

  _updateResumeButton() {
    const btn = document.getElementById("resumeBtn");
    if (btn) btn.classList.toggle("hidden", !this.game.hasSavedRun());
  }

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

  showAscensionChoice() {
    const pair = this._pickAscensionPair();
    this._pendingAscension = pair;

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

  _pickAscensionPair() {
    const pool = [...ASCENSION_MODS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 2);
  }

  _finalizeRun() {
    const g    = this.game;
    let name = "Ghost";
    try { name = localStorage.getItem("ks_nickname") || "Ghost"; } catch { name = "Ghost"; }
    this._saveScore(name, g.wave, g.gameTime, g.player.stats.level);
    this._renderLeaderboard();
    const coinsEarned = g.meta.awardCoins(g.wave, g.gameTime);
    this._lastCoinsEarned = coinsEarned;
    return coinsEarned;
  }

  quitToMenu() {
    const g = this.game;
    cancelAnimationFrame(g._rafId);
    g.audio.stopAmbient();

    let coinsEarned = 0;
    if (g.player) coinsEarned = this._finalizeRun();

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

  _showQuitToast(message) {
    let toast = document.getElementById("quitToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "quitToast";
      toast.className = "quit-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove("quit-toast--show");
    void toast.offsetWidth;
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
    const existingSummary = this._el.gameOverActions.querySelector(".run-summary");
    if (existingSummary) existingSummary.remove();
    this._el.gameOverActions.prepend(summaryEl);

    this._el.gameOverActions.classList.remove("hidden");

    const coinsEl = document.getElementById("gameOverCoins");
    if (coinsEl) {
      coinsEl.textContent = `+${coinsEarned} coins earned`;
      coinsEl.classList.remove("hidden");
    }

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

    this._updateResumeButton();
  }

  _updateDailyResult(result) {
    const key = `ks_daily_best_${result.date}`;
    let best = null;
    try { best = JSON.parse(localStorage.getItem(key) || "null"); } catch { best = null; }
    const isNewBest = !best || result.wave > best.wave || (result.wave === best.wave && result.time > best.time);
    if (isNewBest) {
      try { localStorage.setItem(key, JSON.stringify(result)); } catch {  }
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
      if (entry.wave > hist[idx].wave || (entry.wave === hist[idx].wave && entry.time > hist[idx].time)) hist[idx] = entry;
    } else {
      hist.push(entry);
    }
    hist.sort((a, b) => a.date.localeCompare(b.date));
    if (hist.length > 30) hist = hist.slice(hist.length - 30);
    try { localStorage.setItem("ks_daily_history", JSON.stringify(hist)); } catch {  }
    this._dailyHistory = hist;
    this._renderDailyHistory();
  }

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

    let streak = 0;
    for (let i = 0; ; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      if (!byDate.has(d.toISOString().slice(0, 10))) break;
      streak++;
    }

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
    this._scores.push({ name, wave, time: +time.toFixed(1), level, date: new Date().toLocaleDateString() });
    this._scores.sort((a, b) => b.wave - a.wave || b.time - a.time);
    const seen = new Set();
    this._scores = this._scores.filter(s => {
      const key = `${s.name}|${s.wave}|${s.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
    try { localStorage.setItem("ks_scores", JSON.stringify(this._scores)); } catch {  }
  }

  _renderLeaderboard() {
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
    const s  = g.uiScale * g.accessibility.textScale;
    const m  = 20 * s;
    const lh = 28 * s;

    ctx.save();
    ctx.textBaseline = "top";

    ctx.font      = `700 ${Math.max(13, 16 * s)}px ${CONFIG.HUD_FONT}`;
    ctx.fillStyle = CONFIG.HUD_COLOR_MAIN;
    const bossLabel = g.boss ? "  ☠ BOSS WAVE" : "";
    const dailyLabel = g.dailyMode ? "  📅 DAILY" : "";
    ctx.fillStyle = g.boss ? "#ff2d55" : CONFIG.HUD_COLOR_MAIN;
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

    let buffY = xbY + xbH + 22 * s;
    for (const key in p.buffs) {
      if (p.buffs[key] > 0) {
        ctx.font      = `700 ${Math.max(11, 13 * s)}px ${CONFIG.HUD_FONT}`;
        ctx.fillStyle = CONFIG.POWERUP_COLORS[key] || "#fff";
        ctx.fillText(`${key.toUpperCase()}  ${p.buffs[key].toFixed(1)}s`, m, buffY);
        buffY += lh;
      }
    }

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

    const coverPct = g.coverRemainingPct();
    if (coverPct < 30) {
      const pulse = 0.6 + 0.4 * Math.sin(g.gameTime * 6);
      ctx.font      = `700 ${Math.max(11, 13 * s)}px ${CONFIG.HUD_FONT}`;
      ctx.fillStyle = `rgba(255,45,85,${pulse})`;
      ctx.fillText(`\u26A0 COVER ${coverPct}%`, m, buffY);
      buffY += lh * 0.8;
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


// ── DamageNumber ────────────────────────────────────────────────
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
    ctx.globalAlpha = this.life / this.maxLife;
    if (this.isBoss) {
      ctx.fillText(String(this.value), this.x, this.y);
    } else if (this.isCrit) {
      ctx.fillText(`✕${this.value}`, this.x, this.y);
    } else {
      ctx.fillText(String(this.value), this.x, this.y);
    }
  }
}
DamageNumber._pool = [];


// ── WaveSystem ──────────────────────────────────────────────────
class WaveSystem {
  static BOSS_WAVE_INTERVAL = 5;
  static ENV_DESTRUCTION_START_WAVE = 10;
  static ENV_DESTRUCTION_INTERVAL   = 3;

  isBossWave(wave) {
    return wave % WaveSystem.BOSS_WAVE_INTERVAL === 0;
  }

  shouldTriggerEnvironmentalDestruction(wave) {
    return wave > WaveSystem.ENV_DESTRUCTION_START_WAVE &&
      (wave - WaveSystem.ENV_DESTRUCTION_START_WAVE) % WaveSystem.ENV_DESTRUCTION_INTERVAL === 0;
  }

    spawnWave(ctx) {
    const wave = ctx.wave;
    let budget = (wave === 1) ? CONFIG.ONBOARDING_WAVE1_BUDGET : Math.min(60, 8 + wave * 3);

    const _edgePos = () => {
      const side = Math.floor(ctx.rng() * 4);
      return {
        x: side === 0 ? 0 : side === 1 ? ctx.width  - 1 : ctx.rng() * ctx.width,
        y: side === 2 ? 0 : side === 3 ? ctx.height - 1 : ctx.rng() * ctx.height,
      };
    };

    const wf = Math.max(1, Math.log(wave + 1)) * CONFIG.WAVE_MULTIPLIER;

    while (budget > 0) {
      const pool = [];
      for (const entry of ENEMY_TABLE) {
        if (entry.cost <= budget && entry.unlockWave <= wave) {
          for (let w = 0; w < entry.weight; w++) pool.push(entry);
        }
      }
      if (pool.length === 0) break;

      const chosen = pool[Math.floor(ctx.rng() * pool.length)];
      const pos    = _edgePos();
      ctx.enemies.push(ctx.createEnemy(pos.x, pos.y, chosen.type, wf));
      budget -= chosen.cost;
    }
  }

    checkWaveCleared(ctx) {
    const waveCleared = ctx.isBossWave
      ? !ctx.boss
      : (ctx.enemies.length === 0 && ctx.kills >= ctx.wave);
    if (waveCleared && ctx.fsm.is(GameState.PLAYING)) {
      ctx.kills = 0;
      ctx.waveTransitionTimer = 3.0;
      ctx.bossWarning = this.isBossWave(ctx.wave + 1);
      ctx.fsm.transition(GameState.WAVE_TRANSITION);
    }
  }

    advanceWave(ctx) {
    ctx.wave++;
    ctx.addShake(CONFIG.SHAKE_MAX);
    ctx.isBossWave = this.isBossWave(ctx.wave);
    if (ctx.isBossWave) {
      ctx.boss = ctx.createBoss();
      ctx.bossWarning = false;
    } else {
      this.spawnWave(ctx);
    }
    if (ctx.wave % 3 === 0) ctx.spawnWalls();
    if (this.shouldTriggerEnvironmentalDestruction(ctx.wave)) {
      ctx.scheduleEnvDestruction();
    }
  }
}


// ── CombatSystem ────────────────────────────────────────────────
class CombatSystem {
  resolveBulletCollisions(ctx) {
    const enemyIndexMap = new Map();
    for (let i = 0; i < ctx.enemies.length; i++) enemyIndexMap.set(ctx.enemies[i], i);

    for (let i = 0; i < ctx.bullets.length; i++) {
      const b = ctx.bullets[i];
      if (!b.active) continue;

      const bx0 = b.x;
      const by0 = b.y;
      b.update(ctx.fixedStep);
      ctx.trailMgr.push(b);

      let hit = false;

      const wall = ctx.checkWallCollision(b.x, b.y, b.size);
      if (wall) {
        if (wall.hp !== undefined) {
          wall.hp -= b.damage;
          if (wall.hp <= 0) {
            wall.dead = true;
          }
        }
        ctx.spawnParticles(b.x, b.y, b.color, 5);
        if (!b.isEnemy && b.weaponType === "default" && !b._ricocheted && ctx.player.mods?.ricochet) {
          b._ricocheted = true;
          const hitSide = bx0 < wall.x || bx0 > wall.x + wall.w;
          if (hitSide) b.dx = -b.dx; else b.dy = -b.dy;
          b.x = bx0; b.y = by0;
        } else {
          hit = true;
        }
      }

      if (!hit) {
        if (b.isEnemy) {
          if (!ctx.player.alive) {
            hit = true;
          } else {
            const t = Utils.sweepCircle(bx0, by0, b.x, b.y,
              ctx.player.x, ctx.player.y, b.size + ctx.player.size);
            if (t >= 0) {
              if (ctx.player.buffs.shield <= 0) {
                ctx.player.health -= b.damage;
                ctx.triggerDamageFlash(1.0);
                ctx.audio.playPlayerHit();
                ctx.addShake(5);
                ctx.vibrate(15);
              }
              hit = true;
              if (ctx.player.health <= 0 && ctx.player.alive) {
                ctx.player.alive = false; ctx.player.health = 0;
              }
            }
          }
        } else {
          const midX = (bx0 + b.x) * 0.5;
          const midY = (by0 + b.y) * 0.5;
          const candidates = ctx.spatialHash.query(midX, midY, b.size + 60);

          for (const e of candidates) {
            if (!e.alive) continue;
            const t = Utils.sweepCircle(bx0, by0, b.x, b.y, e.x, e.y, b.size + e.size);
            if (t >= 0) {
              const isCrit  = Math.random() < ctx.player.critChance;
              const dmgDealt = b.damage * (isCrit ? 2 : 1);
              e.hp -= dmgDealt;
              ctx.damageNumbers.push(DamageNumber.get(b.x, b.y, Math.ceil(dmgDealt), isCrit, false));
              if (b.piercing) {
                b.hitCount++;
                if (b.hitCount >= b.maxPierce) hit = true;
                if (b.hitCount === 1 && b.weaponType === "laser" && !b._forked && ctx.player.mods?.beamSplit) {
                  b._forked = true;
                  const baseAngle = Math.atan2(b.dy, b.dx);
                  const speed     = Math.hypot(b.dx, b.dy);
                  for (const off of [-0.25, 0.25]) {
                    const ang = baseAngle + off;
                    const fb  = ctx.bulletPool.get();
                    fb.init(b.x, b.y, Math.cos(ang) * speed, Math.sin(ang) * speed,
                      b.size * 0.6, b.color, b.damage * 0.5, false, true, b.maxPierce, "laser");
                    fb._forked = true;
                    ctx.bullets.push(fb);
                    ctx.trailMgr.register(fb, fb.color);
                  }
                }
              } else {
                hit = true;
              }
              if (ctx.player.lifesteal > 0) {
                const healMult = ctx.player.getSynergies().vampiricRage ? 2 : 1;
                ctx.player.health = Math.min(
                  ctx.player.maxHealth,
                  ctx.player.health + b.damage * ctx.player.lifesteal * healMult
                );
              }
              const ei = enemyIndexMap.get(e);
              if (e.hp <= 0 && ei !== undefined) {
                if (!b.isEnemy && b.weaponType === "spread" && ctx.player.mods?.detonatorPellets) {
                  const splashR  = 70;
                  const splashRSq = splashR * splashR;
                  for (const other of ctx.spatialHash.query(e.x, e.y, splashR)) {
                    if (other === e || !other.alive) continue;
                    if (Utils.distSq(e.x, e.y, other.x, other.y) <= splashRSq) {
                      const splashDmg = b.damage * 0.5;
                      other.hp -= splashDmg;
                      ctx.damageNumbers.push(DamageNumber.get(other.x, other.y, Math.ceil(splashDmg), false, false));
                    }
                  }
                  ctx.spawnParticles(e.x, e.y, "#ff9f43", 10);
                }
                const lastIdx    = ctx.enemies.length - 1;
                const movedEnemy = ctx.enemies[lastIdx];
                ctx.handleEnemyDeath(e, ei);
                enemyIndexMap.delete(e);
                if (movedEnemy !== e) enemyIndexMap.set(movedEnemy, ei);
              }
              if (hit) break;
            }
          }

          if (!hit && ctx.boss?.alive) {
            const t = Utils.sweepCircle(bx0, by0, b.x, b.y, ctx.boss.x, ctx.boss.y, b.size + ctx.boss.size);
            if (t >= 0) {
              const dmgDealt = b.damage * 0.5;
              ctx.boss.hp -= dmgDealt;
              ctx.collisionSeenSet.add(ctx.boss);
              ctx.damageNumbers.push(DamageNumber.get(b.x, b.y, Math.ceil(dmgDealt), false, true));
              ctx.spawnParticles(b.x, b.y, b.color, 4);
              if (!b.piercing) hit = true;
            }
          }
        }
      }

      if (!hit) {
        hit = (b.x < -80 || b.x > ctx.width + 80 || b.y < -80 || b.y > ctx.height + 80);
      }

      if (hit) {
        b.active = false;
        ctx.bulletPool.release(b);
        ctx.trailMgr.unregister(b);
        ctx.recordDeadBullet();
      }
    }

    if (ctx.walls.some(w => w.dead)) {
      ctx.setWalls(ctx.walls.filter(w => !w.dead));
      ctx.rebuildWallHash();
    }
  }
}


// ── Game ────────────────────────────────────────────────────────
class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx    = this.canvas.getContext("2d");

    this.accessibility = { shakeIntensity: 1, textScale: 1, shapeOnlyID: false };
    try {
      const saved = JSON.parse(localStorage.getItem("ks_accessibility") || "{}");
      if (typeof saved.shakeIntensity === "number") this.accessibility.shakeIntensity = Utils.clamp(saved.shakeIntensity, 0, 1);
      if (typeof saved.textScale === "number")      this.accessibility.textScale      = saved.textScale;
      if (typeof saved.shapeOnlyID === "boolean")   this.accessibility.shapeOnlyID    = saved.shapeOnlyID;
    } catch {  }

    this.input = new InputManager(this);
    this.audio = new AudioEngine();
    this.meta  = new MetaProgression();
    this.ui    = new UIManager(this);

    this.bulletPool   = new ObjectPool(Bullet,   CONFIG.POOL_BULLETS);
    this.particlePool = new ObjectPool(Particle, CONFIG.POOL_PARTICLES);

    this.spatialHash = new SpatialHash(80);
    this.trailMgr    = new TrailManager(10);

    this.waveSystem   = new WaveSystem();
    this.combatSystem = new CombatSystem();

    this.fsm = new GameFSM();
    this._wireFSM();

    this.cameraShake = 0;
    this.damageFlash = 0;
    this._shakeTime  = 0;
    this.thudShake   = 0;
    this._thudTime   = 0;
    this._lowPowerMode = (navigator.hardwareConcurrency || 8) <= 4;
    this._frameTimeWindow    = [];
    this._frameTimeWindowMax = 60;
    GlowCache.padScale = this._lowPowerMode ? 0.5 : 1;

    this._rafId      = null;

    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this._reducedMotion = reduceMotionQuery.matches;
    const onReducedMotionChange = mq => { this._reducedMotion = mq.matches; };
    reduceMotionQuery.addEventListener
      ? reduceMotionQuery.addEventListener("change", onReducedMotionChange)
      : reduceMotionQuery.addListener(onReducedMotionChange);

    this.dailyMode = false;
    this.rng       = Math.random;

    this._FIXED_STEP  = 1 / 60;
    this._accumulator = 0;
    this._hitStopFrames = 0;

    this._bossDeathBursts = [];

    this.corruptionZones = [];

    if (DEBUG) {
      this._debugHudOn    = false;
      this._debugFrameMs  = [];
      window.addEventListener("keydown", e => {
        if (e.key === "`") this._debugHudOn = !this._debugHudOn;
      });
    }

    this.collisionSeenSet = new Set();

    this._pendingDestruction = [];
    this._coverBaseline      = 0;

    this._deadBullets   = 0;
    this._deadParticles = 0;

    this._resize();
    window.addEventListener("resize", () => this._resize());

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.saveRunSnapshot();
        if (this.fsm.is(GameState.PLAYING)) {
          this.fsm.transition(GameState.PAUSED);
        }
      }
    });

    window.addEventListener("beforeunload", () => this.saveRunSnapshot());

    const portraitQuery = window.matchMedia("(orientation: portrait) and (hover: none) and (pointer: coarse)");
    const onPortraitChange = mq => {
      if (mq.matches && this.fsm.is(GameState.PLAYING)) {
        this.fsm.transition(GameState.PAUSED);
      }
    };
    portraitQuery.addEventListener
      ? portraitQuery.addEventListener("change", onPortraitChange)
      : portraitQuery.addListener(onPortraitChange);
  }

  _combatContext() {
    return {
      bullets: this.bullets, enemies: this.enemies, boss: this.boss,
      walls: this.walls, crates: this.crates, player: this.player,
      audio: this.audio, spatialHash: this.spatialHash,
      bulletPool: this.bulletPool, trailMgr: this.trailMgr,
      damageNumbers: this.damageNumbers, collisionSeenSet: this.collisionSeenSet,
      width: this.width, height: this.height, fixedStep: this._FIXED_STEP,
      checkWallCollision: (x, y, size) => this.checkWallCollision(x, y, size),
      spawnParticles: (x, y, color, count) => this.spawnParticles(x, y, color, count),
      addShake: (amount, big) => this._addShake(amount, big),
      triggerDamageFlash: (intensity) => this.triggerDamageFlash(intensity),
      vibrate: (ms) => this._vibrate(ms),
      handleEnemyDeath: (enemy, index) => this._handleEnemyDeath(enemy, index),
      recordDeadBullet: () => { this._deadBullets++; },
      setWalls: (arr) => { this.walls = arr; },
      rebuildWallHash: () => this._rebuildWallHash(),
    };
  }

  _waveContext() {
    const game = this;
    return {
      enemies: this.enemies, width: this.width, height: this.height,
      fsm: this.fsm,
      rng: () => game.rng(),
      createEnemy: (x, y, type, wf) => new Enemy(game, x, y, type, wf),
      createBoss: () => new Boss(game),
      spawnWalls: () => game._spawnWalls(),
      scheduleEnvDestruction: () => game.scheduleEnvironmentalDestruction(),
      addShake: (amount) => game._addShake(amount),
      get wave()               { return game.wave; },
      set wave(v)               { game.wave = v; },
      get kills()               { return game.kills; },
      set kills(v)               { game.kills = v; },
      get boss()               { return game.boss; },
      set boss(v)               { game.boss = v; },
      get isBossWave()          { return game._isBossWave; },
      set isBossWave(v)          { game._isBossWave = v; },
      get bossWarning()         { return game._bossWarning; },
      set bossWarning(v)         { game._bossWarning = v; },
      get waveTransitionTimer() { return game._waveTransitionTimer; },
      set waveTransitionTimer(v) { game._waveTransitionTimer = v; },
    };
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
          this.ui._el.mobileUI.classList.add("paused");
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
        enter: () => {
          this.clearSavedRun();
          this.ui.showGameOver();
          this.audio.stopAmbient();
          this.ui._el.mobileUI.classList.add("paused");
          document.getElementById("weaponBtnPC")?.classList.add("is-disabled");
        },
        exit: () => {
          this.ui._el.mobileUI.classList.remove("paused");
          document.getElementById("weaponBtnPC")?.classList.remove("is-disabled");
        },
      })
      .register(GameState.WAVE_TRANSITION, {
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

    this.clearSavedRun();
    this.ui._pendingAscension = null;

    if (this.bullets) {
      for (const b of this.bullets) { b.active = false; this.bulletPool.release(b); }
    }
    if (this.particles) {
      for (const p of this.particles) { p.active = false; this.particlePool.release(p); }
    }

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
    this.boss      = null;
    this.corruptionZones  = [];
    this._bossDeathBursts = [];
    this._isBossWave = false;

    this.wave      = 1;
    this.kills     = 0;
    this.gameTime  = 0;
    this.lastTime  = performance.now();
    this.cameraShake  = 0;
    this.damageFlash  = 0;
    this._shakeTime   = 0;
    this.thudShake    = 0;
    this._thudTime    = 0;
    this._accumulator = 0;
    this.trailMgr.clear();

    this._deadBullets   = 0;
    this._deadParticles = 0;

    this._pendingDestruction = [];

    this.fsm.transition(GameState.PLAYING);
    this.meta.initSession();
    this._spawnWalls();
    this.waveSystem.spawnWave(this._waveContext());

    this._waveTransitionTimer = 0;

    this.damageNumbers = [];

    this.setWeaponLabel({ default: "GUN", spread: "SHOTGUN", laser: "LASER" }[this.player.weapon] || "GUN");

    this.audio.startAmbient();
    this.audio.setAmbientIntensity(0);

    this._rafId = requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Mid-run persistence (save & resume) ──────────────────────────────────

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
    } catch {  }
  }

  hasSavedRun() {
    try { return !!localStorage.getItem("ks_saved_run"); } catch { return false; }
  }

  loadRunSnapshot() {
    try {
      const raw = localStorage.getItem("ks_saved_run");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (!Array.isArray(parsed.enemies) || !Array.isArray(parsed.walls) || !parsed.player) return null;
      return parsed;
    } catch { return null; }
  }

  clearSavedRun() {
    try { localStorage.removeItem("ks_saved_run"); } catch {  }
  }

    resumeRun() {
    const snap = this.loadRunSnapshot();
    if (!snap) return false;

    cancelAnimationFrame(this._rafId);

    if (this.bullets)   for (const b of this.bullets)   { b.active = false; this.bulletPool.release(b); }
    if (this.particles) for (const p of this.particles) { p.active = false; this.particlePool.release(p); }

    this.dailyMode     = !!snap.dailyMode;
    this.dailySeedDate = snap.dailySeedDate || Utils.todayUTCString();
    this.rng = this.dailyMode
      ? Utils.createSeededRNG(`kritikshoot-daily-${this.dailySeedDate}`)
      : Math.random;

    this.player = new Player(this);
    this.player.x       = snap.player.x;
    this.player.y       = snap.player.y;
    this.player.prevX   = snap.player.x;
    this.player.prevY   = snap.player.y;
    this.player.health  = snap.player.health;
    this.player.alive   = snap.player.alive;
    this.player.weapon  = snap.player.weapon || "default";
    this.player.stats       = { ...snap.player.stats };
    this.player.upgrades    = { ...this.player.upgrades, ...snap.player.upgrades };
    this.player.weaponShots = { ...this.player.weaponShots, ...snap.player.weaponShots };
    this.player.mods        = { ...(snap.player.mods || {}) };
    this.player._ascensionLevelsSeen = new Set(snap.player.ascensionLevelsSeen || []);

    this.wave     = snap.wave;
    this.kills    = snap.kills;
    this.gameTime = snap.gameTime;
    this._isBossWave          = !!snap.isBossWave;
    this._bossWarning         = !!snap.bossWarning;
    this._waveTransitionTimer = snap.waveTransitionTimer || 0;

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
    this._pendingDestruction = [];
    this._coverBaseline      = this.walls.length + this.crates.length;

    this.corruptionZones  = [];
    this._bossDeathBursts = [];

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

    this.clearSavedRun();
    this.ui._updateResumeButton();

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
    this.audio.startAmbient();
    return true;
  }

  // ── Game Loop ──────────────────────────────────────────────────────────────

  _loop(now) {
    this._rafId = requestAnimationFrame(ts => this._loop(ts));

    const frameDt = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;

    if (DEBUG) {
      const w = this._debugFrameMs;
      w.push(frameDt * 1000);
      if (w.length > 30) w.shift();
    }

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
      if (this._hitStopFrames > 0) {
        this._hitStopFrames--;
      } else {
        this._accumulator += frameDt;
        while (this._accumulator >= this._FIXED_STEP) {
          this._update(this._FIXED_STEP);
          this._accumulator -= this._FIXED_STEP;
        }
      }
    }

    if (this.fsm.is(GameState.WAVE_TRANSITION)) {
      this._waveTransitionTimer -= frameDt;
      if (this._waveTransitionTimer <= 0) {
        this.waveSystem.advanceWave(this._waveContext());
        this.fsm.transition(GameState.PLAYING);
        this.lastTime = performance.now();
        const waveLevel    = Utils.clamp(this.wave / 15, 0, 1);
        const densityLevel = Utils.clamp(this.enemies.length / 25, 0, 1);
        this.audio.setAmbientIntensity(waveLevel * 0.7 + densityLevel * 0.3);
      }
    }

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

  setWeaponLabel(label) {
    const weaponBtn = document.getElementById("weaponBtn");
    if (weaponBtn) weaponBtn.textContent = label;
    const weaponBtnPC = document.getElementById("weaponBtnPC");
    if (weaponBtnPC) weaponBtnPC.textContent = label;
  }

  // ── Fixed-step physics update ──────────────────────────────────────────────

  _update(dt) {
    if (DEBUG) console.assert(dt === this._FIXED_STEP, "_update called with non-fixed dt:", dt);
    this.gameTime += dt;

    this.collisionSeenSet.clear();

    this.spatialHash.clear();
    for (const e of this.enemies) this.spatialHash.insert(e);

    this._updateCorruptionZones(dt);

    this.player.update(dt, this.input);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      e.update(dt, this.player);
      if (e.hp <= 0) this._handleEnemyDeath(e, i);
    }

    this.combatSystem.resolveBulletCollisions(this._combatContext());
    if (this._deadBullets > 0 &&
        this._deadBullets / this.bullets.length >= CONFIG.COMPACT_THRESHOLD_BULLETS) {
      let write = 0;
      for (let read = 0; read < this.bullets.length; read++) {
        if (this.bullets[read].active) this.bullets[write++] = this.bullets[read];
      }
      this.bullets.length = write;
      this._deadBullets   = 0;
    }

    const pickupMult = 1 + this.meta.getBonus("pickupRadius");
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      const rad = (this.player.size + pu.size) * pickupMult;
      if (Utils.distSq(this.player.x, this.player.y, pu.x, pu.y) < rad * rad) {
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
        this.boss.alive = false;
        this.spawnParticles(this.boss.x, this.boss.y, this.boss.color, 60);
        this.audio.playEnemyDeath();
        this._addShake(CONFIG.SHAKE_MAX * 2, true);
        this.triggerHitStop(4);
        this._vibrate(40);
        this._bossDeathBursts.push({ x: this.boss.x, y: this.boss.y, age: 0, life: 0.9, color: this.boss.color });
        if (this.wave >= CONFIG.CORRUPTION_START_WAVE) {
          this.scheduleCorruptionZone(this.boss.x, this.boss.y);
        }
        this.meta.awardCoins(this.wave * 3, 0);
        this.player.addXP(50 + this.wave * 5);
        this.boss = null;
      }
    }

    if (this._bossDeathBursts.length > 0) {
      for (let i = this._bossDeathBursts.length - 1; i >= 0; i--) {
        const b = this._bossDeathBursts[i];
        b.age += dt;
        if (b.age >= b.life) this._bossDeathBursts.splice(i, 1);
      }
    }

    this.waveSystem.checkWaveCleared(this._waveContext());

    this._processEnvironmentalDestruction();

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

  _draw(alpha) {
    const ctx = this.ctx;

    ctx.fillStyle = "#050810";
    ctx.fillRect(0, 0, this.width, this.height);

    const waveLevel  = Utils.clamp(this.wave / 15, 0, 1);
    BackgroundLayer.draw(ctx, this.width, this.height, this._FIXED_STEP, waveLevel, !!this.boss);

    ctx.save();

    if (this.cameraShake > 0.05 || this.thudShake > 0.05) {
      let ox = 0, oy = 0;
      if (this.cameraShake > 0.05) {
        ox += Math.sin(this._shakeTime * CONFIG.SHAKE_FREQ * Math.PI * 2)       * this.cameraShake;
        oy += Math.sin(this._shakeTime * CONFIG.SHAKE_FREQ * Math.PI * 2 + 1.5) * this.cameraShake;
      }
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
      this._drawEnvCrackWarning(ctx, w, w.y - 16);
    }

    // ── Crates & Pillars (indestructible environment) ─────────────────────
    if (this.crates) {
      let shadowActive = false;
      for (const c of this.crates) {
        if (c.isPillar) {
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
          ctx.fillStyle = "rgba(0,229,255,0.08)";
          ctx.fillRect(c.x + c.w * 0.35, c.y, c.w * 0.3, c.h);
        } else {
          if (shadowActive) { ctx.shadowBlur = 0; shadowActive = false; }
          ctx.fillStyle = "#1c2535";
          ctx.fillRect(c.x, c.y, c.w, c.h);
          ctx.strokeStyle = "rgba(255,180,60,0.5)";
          ctx.lineWidth   = 1.5;
          ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
          ctx.strokeStyle = "rgba(255,180,60,0.15)";
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.w, c.y + c.h);
          ctx.moveTo(c.x + c.w, c.y); ctx.lineTo(c.x, c.y + c.h);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,180,60,0.55)";
          const rv = 3;
          for (const [rx, ry] of [[c.x+rv, c.y+rv],[c.x+c.w-rv, c.y+rv],[c.x+rv, c.y+c.h-rv],[c.x+c.w-rv, c.y+c.h-rv]]) {
            ctx.beginPath(); ctx.arc(rx, ry, rv * 0.7, 0, Math.PI * 2); ctx.fill();
          }
        }
        if (shadowActive) { ctx.shadowBlur = 0; shadowActive = false; }
        this._drawEnvCrackWarning(ctx, c, c.y - 9);
      }
      ctx.shadowBlur = 0;
    }

    if (this.corruptionZones.length > 0) this._drawCorruptionZones(ctx);

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

    for (const e of this.enemies) e.draw(ctx, alpha);

    // ── Boss ─────────────────────────────────────────────────────────────
    if (this.boss) this.boss.draw(ctx, alpha);

    if (this._bossDeathBursts.length > 0) this._drawBossDeathBursts(ctx);

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
      ctx.font         = `900 52px 'Orbitron', monospace`;
      ctx.fillStyle    = "#00e5ff";
      ctx.shadowColor  = "#00e5ff";
      ctx.shadowBlur   = 20;
      ctx.fillText(`WAVE ${this.wave + 1} INCOMING`, this.width / 2, this.height / 2 - 40);
      ctx.font         = `700 28px 'Rajdhani', sans-serif`;
      ctx.fillStyle    = "rgba(255,255,255,0.7)";
      ctx.shadowBlur   = 0;
      ctx.fillText(String(countdown), this.width / 2, this.height / 2 + 20);
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
      ctx.save();
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";

      ctx.font = "bold 17px 'Rajdhani', sans-serif";
      ctx.fillStyle = "#ff2d55";
      for (const dn of this.damageNumbers) {
        if (dn.life > 0 && dn.isBoss) dn.draw(ctx);
      }

      ctx.fillStyle = "#f1c40f";
      for (const dn of this.damageNumbers) {
        if (dn.life > 0 && !dn.isBoss && dn.isCrit) dn.draw(ctx);
      }

      ctx.font = "bold 14px 'Rajdhani', sans-serif";
      ctx.fillStyle = "#ffffff";
      for (const dn of this.damageNumbers) {
        if (dn.life > 0 && !dn.isBoss && !dn.isCrit) dn.draw(ctx);
      }
      ctx.restore();
    }

    if (DEBUG && this._debugHudOn) this._drawDebugHud(ctx);
  }

  _drawBossDeathBursts(ctx) {
    for (const b of this._bossDeathBursts) {
      const t     = Utils.clamp(b.age / b.life, 0, 1);
      const ease  = 1 - (1 - t) * (1 - t);
      const maxR  = 220 * this.uiScale;
      const r     = 24 * this.uiScale + ease * maxR;
      const alpha = 1 - t;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const gOuter = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      gOuter.addColorStop(0,   `rgba(255,255,255,${0.10 * alpha})`);
      gOuter.addColorStop(0.6, this._hexA(b.color, 0.18 * alpha));
      gOuter.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = gOuter;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();

      const ringR = r * 0.78;
      const gRing = ctx.createRadialGradient(b.x, b.y, ringR * 0.7, b.x, b.y, ringR);
      gRing.addColorStop(0, "rgba(0,0,0,0)");
      gRing.addColorStop(1, this._hexA(b.color, 0.35 * alpha));
      ctx.fillStyle = gRing;
      ctx.beginPath();
      ctx.arc(b.x, b.y, ringR, 0, Math.PI * 2);
      ctx.fill();

      if (t < 0.35) {
        const coreAlpha = (1 - t / 0.35) * 0.8;
        const gCore = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 40 * this.uiScale);
        gCore.addColorStop(0, `rgba(255,255,255,${coreAlpha})`);
        gCore.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gCore;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 40 * this.uiScale, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  _hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  _drawDebugHud(ctx) {
    let msSum = 0;
    for (const ms of this._debugFrameMs) msSum += ms;
    const avgMs = this._debugFrameMs.length ? msSum / this._debugFrameMs.length : 0;

    const lines = [
      `ms/frame: ${avgMs.toFixed(2)}  (${(1000 / (avgMs || 1)).toFixed(0)} fps)`,
      `enemies: ${this.enemies.length}   bullets: ${this.bullets.length}   particles: ${this.particles.length}`,
      `lowPowerMode: ${this._lowPowerMode}`,
      `spatialHash buckets: ${this.spatialHash._map.size}`,
    ];

    ctx.save();
    ctx.font = "600 13px 'Rajdhani', sans-serif";
    const lineH  = 16;
    const padX   = 10;
    const padY   = 8;
    const boxW   = 300;
    const boxH   = padY * 2 + lines.length * lineH;
    ctx.fillStyle = "rgba(5,8,16,0.72)";
    ctx.fillRect(8, 8, boxW, boxH);
    ctx.fillStyle = "#00e5ff";
    ctx.fillText("DEV PERF (`)", 8 + padX, 8 + padY + 10);
    ctx.fillStyle = "#e8f0fe";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 8 + padX, 8 + padY + 10 + (i + 1) * lineH);
    }
    ctx.restore();
  }

  // ── Spawning helpers ───────────────────────────────────────────────────────

  _spawnWalls() {
    this.walls   = [];
    this.crates  = [];

    const cx = this.width / 2;
    const cy = this.height / 2;
    const EXCLUSION = 90;
    const _tooClose = (rx, ry, rw, rh) => {
      const nearX = Utils.clamp(cx, rx, rx + rw);
      const nearY = Utils.clamp(cy, ry, ry + rh);
      return Utils.distSq(cx, cy, nearX, nearY) < EXCLUSION * EXCLUSION;
    };

    // ── Destructible walls (existing behaviour) ─────────────────────────────
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
      const hp = Math.floor(this.rng() * 5) + 3;
      this.walls.push({ x: wx, y: wy, w, h, hp, maxHp: hp });
    }

    // ── Indestructible crates / pillars ─────────────────────────────────────
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

    this._rebuildWallHash();
    this._coverBaseline = this.walls.length + this.crates.length;
  }

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

  // ── Environmental Destruction ────────────────────────────────────────────

  scheduleEnvironmentalDestruction() {
    const cx = this.width  / 2;
    const cy = this.height / 2;
    const radius   = Math.min(this.width, this.height) * 0.35;
    const radiusSq = radius * radius;

    const candidates = [...this.walls, ...this.crates].filter(o => {
      if (o._envDestructAt !== undefined) return false;
      const ox = o.x + o.w / 2;
      const oy = o.y + o.h / 2;
      return Utils.distSq(ox, oy, cx, cy) <= radiusSq;
    });
    if (candidates.length === 0) return;

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const count = Math.min(candidates.length, 1 + Math.floor(this.rng() * 2));
    const WARN_DURATION = 1.6;

    for (let i = 0; i < count; i++) {
      const target = candidates[i];
      target._envWarnStart  = this.gameTime;
      target._envDestructAt = this.gameTime + WARN_DURATION;
      this._pendingDestruction.push(target);
    }
  }

  _processEnvironmentalDestruction() {
    if (this._pendingDestruction.length === 0) return;
    let destroyedAny = false;
    for (let i = this._pendingDestruction.length - 1; i >= 0; i--) {
      const target = this._pendingDestruction[i];
      if (this.gameTime >= target._envDestructAt) {
        this.spawnParticles(target.x + target.w / 2, target.y + target.h / 2, "#ff2d55", 14);
        this._addShake(6);
        target._envDestroyed = true;
        this._pendingDestruction.splice(i, 1);
        destroyedAny = true;
      }
    }
    if (destroyedAny) {
      this.walls  = this.walls.filter(w => !w._envDestroyed);
      this.crates = this.crates.filter(c => !c._envDestroyed);
      this._rebuildWallHash();
    }
  }

  coverRemainingPct() {
    if (!this._coverBaseline) return 100;
    const current = this.walls.length + this.crates.length;
    return Math.round(Utils.clamp(current / this._coverBaseline, 0, 1) * 100);
  }

  spawnParticles(x, y, color, count = 20) {
    const n = this._lowPowerMode ? Math.max(1, Math.round(count * 0.5)) : count;

    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 0.8;
      const p     = this.particlePool.get();
      p.init(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        color, Math.random() * 4 + 1.5, Math.random() * 0.55 + 0.35);
      this.particles.push(p);
    }

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

  _drawEnvCrackWarning(ctx, obj, barY) {
    if (obj._envDestructAt === undefined) return;
    const remain = obj._envDestructAt - this.gameTime;
    if (remain <= 0) return;
    const total = obj._envDestructAt - obj._envWarnStart;
    const frac  = Utils.clamp(remain / total, 0, 1);

    const pulseSpeed = 8 + (1 - frac) * 10;
    const pulse      = 0.12 + 0.14 * Math.sin(this.gameTime * pulseSpeed);
    ctx.fillStyle = `rgba(255,45,85,${pulse})`;
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);

    ctx.fillStyle = "rgba(255,45,85,0.25)";
    ctx.fillRect(obj.x, barY, obj.w, 4);
    ctx.fillStyle = "#ff2d55";
    ctx.fillRect(obj.x, barY, obj.w * frac, 4);
  }

  // ── "Corruption" arena mechanic ──────────────────────────────────────────

  scheduleCorruptionZone(x, y) {
    const motes = [];
    for (let i = 0; i < CONFIG.CORRUPTION_MOTE_COUNT; i++) {
      motes.push({
        angleOffset: this.rng() * Math.PI * 2,
        radiusFrac:  0.35 + this.rng() * 0.6,
        speed:       (0.15 + this.rng() * 0.25) * (this.rng() < 0.5 ? 1 : -1),
        bob:         this.rng() * Math.PI * 2,
      });
    }
    this.corruptionZones.push({
      x, y,
      radius:    CONFIG.CORRUPTION_START_RADIUS,
      maxRadius: CONFIG.CORRUPTION_MAX_RADIUS,
      age:       0,
      motes,
    });
  }

  _updateCorruptionZones(dt) {
    if (this.corruptionZones.length === 0) return;
    for (let i = this.corruptionZones.length - 1; i >= 0; i--) {
      const z = this.corruptionZones[i];
      z.age   += dt;
      z.radius = Math.min(z.maxRadius, z.radius + CONFIG.CORRUPTION_SPREAD_RATE * dt);
      const rSq = z.radius * z.radius;

      if (this.player.alive && this.player.buffs.shield <= 0) {
        const dSq = Utils.distSq(this.player.x, this.player.y, z.x, z.y);
        if (dSq < rSq) {
          this.player.health -= CONFIG.CORRUPTION_DPS * dt;
          if (this.player.health <= 0) { this.player.alive = false; this.player.health = 0; }
        }
      }

      for (const e of this.spatialHash.query(z.x, z.y, z.radius)) {
        if (!e.alive) continue;
        const dSq = Utils.distSq(e.x, e.y, z.x, z.y);
        if (dSq < rSq) e.hp -= CONFIG.CORRUPTION_DPS * dt;
      }

      if (z.age >= CONFIG.CORRUPTION_LIFETIME) this.corruptionZones.splice(i, 1);
    }
  }

  _drawCorruptionZones(ctx) {
    for (const z of this.corruptionZones) {
      const fadeStart = CONFIG.CORRUPTION_LIFETIME - CONFIG.CORRUPTION_FADE_TIME;
      const alpha = z.age > fadeStart
        ? Utils.clamp(1 - (z.age - fadeStart) / CONFIG.CORRUPTION_FADE_TIME, 0, 1)
        : 1;
      if (alpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = alpha;

      const grad = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.radius);
      grad.addColorStop(0,   "rgba(80,10,110,0.5)");
      grad.addColorStop(0.65,"rgba(40,5,60,0.32)");
      grad.addColorStop(1,   "rgba(15,0,25,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.fill();

      for (const m of z.motes) {
        const angle = m.angleOffset + this.gameTime * m.speed;
        const r     = z.radius * m.radiusFrac;
        const mx    = z.x + Math.cos(angle) * r;
        const my    = z.y + Math.sin(angle) * r + Math.sin(this.gameTime * 1.5 + m.bob) * 3;
        ctx.fillStyle = "rgba(210,140,255,0.65)";
        ctx.beginPath();
        ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  checkWallCollision(x, y, size) {
    if (this._wallHash) {
      const candidates = this._wallHash.query(x, y, size + 80);
      for (const proxy of candidates) {
        const r = proxy._rect;
        if (Utils.circleRect(x, y, size, r.x, r.y, r.w, r.h)) return r;
      }
      return null;
    }
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
    enemy.alive = false;
    if (Math.random() < 0.2) {
      const type = CONFIG.POWERUP_TYPES[Math.floor(Math.random() * CONFIG.POWERUP_TYPES.length)];
      this.powerups.push({ x: enemy.x, y: enemy.y, type, size: 12 * this.uiScale, color: CONFIG.POWERUP_COLORS[type] });
    }
    this.kills++;
    this.player.addXP(10 + Math.floor(Math.log2(this.wave + 1)) * 2);
    this.spawnParticles(enemy.x, enemy.y, enemy.color, 22);
    this.audio.playEnemyDeath();
    this._vibrate(10);
    Utils.removeFast(this.enemies, index);
  }

  _saveAccessibility() {
    try { localStorage.setItem("ks_accessibility", JSON.stringify(this.accessibility)); }
    catch {  }
  }

  _vibrate(ms) {
    if (!this.input?.isMobile) return;
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {  }
  }

  triggerHitStop(frames) {
    const rm     = this._reducedMotion ? 0.35 : 1;
    const scaled = Math.max(1, Math.round(frames * rm));
    this._hitStopFrames = Math.max(this._hitStopFrames || 0, scaled);
  }

  triggerDamageFlash(intensity = 1.0, big = false) {
    const rm = this._reducedMotion ? 0.35 : 1;
    this.damageFlash  = Math.min(1, this.damageFlash + 0.35 * intensity * rm);
    this._addShake(CONFIG.SHAKE_MAX * 0.6 * intensity, big);
  }

  _addShake(amount, big = false) {
    const rm     = this._reducedMotion ? 0.35 : 1;
    const scaled = amount * rm * this.accessibility.shakeIntensity;
    this.cameraShake = Math.max(this.cameraShake, scaled);
    if (big) this.thudShake = Math.max(this.thudShake, scaled);
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


// ── _fatalErrorShown ────────────────────────────────────────────
let _fatalErrorShown = false;

function showFatalErrorOverlay(err) {
  if (_fatalErrorShown) return;
  _fatalErrorShown = true;

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
