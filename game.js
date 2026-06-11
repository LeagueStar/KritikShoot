/**
 * KritikShoot — game.js  (v3 — Micro-Optimized)
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW in this version:
 *  1. Fighter-jet ship shape  — sharp swept-back triangle, dark stroke edge,
 *                               toned-down glow so the hull is never washed out
 *  2. GC fix — hoisted Set    — this.collisionSeenSet reused every tick
 *  3. Temporal interpolation  — prevX/prevY cached; draw() lerps to alpha pos
 *  4. Dead-flag compaction    — bullets/particles use active flag + threshold
 *                               bulk-compact instead of per-removal splice
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";


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

  SHAKE_MAX:            14,
  SHAKE_DECAY:          6.5,
  SHAKE_FREQ:           55,

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

  HUD_FONT:             "'Rajdhani', monospace",
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
// SECTION 2 — UTILITIES
// =============================================================================
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
    const a   = dx * dx + dy * dy;
    if (a < 1e-10) return -1;
    const b    = 2 * (fx * dx + fy * dy);
    const c    = fx * fx + fy * fy - rSq;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return (t >= 0 && t <= 1) ? t : -1;
  },
};


// =============================================================================
// SECTION 3 — SPATIAL HASH GRID
// =============================================================================
class SpatialHash {
  constructor(cellSize = 80) {
    this._cell = cellSize;
    this._map  = new Map();
  }

  clear() { this._map.clear(); }

  _key(gx, gy) { return ((gx & 0xFFFF) << 16) | (gy & 0xFFFF); }

  insert(entity) {
    const r    = entity.size || 8;
    const minX = Math.floor((entity.x - r) / this._cell);
    const minY = Math.floor((entity.y - r) / this._cell);
    const maxX = Math.floor((entity.x + r) / this._cell);
    const maxY = Math.floor((entity.y + r) / this._cell);
    for (let gx = minX; gx <= maxX; gx++) {
      for (let gy = minY; gy <= maxY; gy++) {
        const k = this._key(gx, gy);
        if (!this._map.has(k)) this._map.set(k, []);
        this._map.get(k).push(entity);
      }
    }
  }

  query(x, y, r) {
    const minX = Math.floor((x - r) / this._cell);
    const minY = Math.floor((y - r) / this._cell);
    const maxX = Math.floor((x + r) / this._cell);
    const maxY = Math.floor((y + r) / this._cell);
    const out  = [];
    for (let gx = minX; gx <= maxX; gx++) {
      for (let gy = minY; gy <= maxY; gy++) {
        const bucket = this._map.get(this._key(gx, gy));
        if (bucket) for (const e of bucket) out.push(e);
      }
    }
    return out;
  }
}


// =============================================================================
// SECTION 4 — FINITE STATE MACHINE
// =============================================================================
const GameState = Object.freeze({
  MENU:      "MENU",
  PLAYING:   "PLAYING",
  PAUSED:    "PAUSED",
  LEVEL_UP:  "LEVEL_UP",
  GAME_OVER: "GAME_OVER",
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
  constructor(FactoryClass, initialSize = 100) {
    this._factory = FactoryClass;
    this._pool    = Array.from({ length: initialSize }, () => new FactoryClass());
  }

  get()        { return this._pool.length > 0 ? this._pool.pop() : new this._factory(); }
  release(obj) { this._pool.push(obj); }
  get size()   { return this._pool.length; }
}


// =============================================================================
// SECTION 6 — GLOW SPRITE CACHE
// =============================================================================
const GlowCache = {
  _map: new Map(),

  get(color, radius, pad = null) {
    pad = pad ?? radius * 1.5;
    const key = `${color}:${radius | 0}:${pad | 0}`;
    let   g   = this._map.get(key);
    if (!g) {
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
// SECTION 7 — BULLET
// FIX 3 (interpolation): prevX/prevY cached before each move.
// FIX 4 (dead-flag):     active=false on death; pool release is caller's job.
//                        draw() skips inactive bullets; compaction done in bulk.
// =============================================================================
class Bullet {
  constructor() {
    this.active = false;
    this.prevX  = 0;
    this.prevY  = 0;
  }

  init(x, y, dx, dy, size, color, damage, isEnemy) {
    this.x       = x;
    this.y       = y;
    this.prevX   = x;   // no interpolation artifact on first frame
    this.prevY   = y;
    this.dx      = dx;
    this.dy      = dy;
    this.size    = size;
    this.color   = color;
    this.damage  = damage;
    this.isEnemy = isEnemy;
    this.active  = true;
  }

  // FIX 3: cache previous position before integrating
  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.dx * dt;
    this.y += this.dy * dt;
  }

  // FIX 3: render at interpolated position — eliminates micro-stutter at 120/144 Hz
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
// FIX 3 (interpolation): prevX/prevY cached before each move.
// FIX 4 (dead-flag):     active flag; draw skips inactive entries.
// =============================================================================
class Particle {
  constructor() {
    this.active = false;
    this.prevX  = 0;
    this.prevY  = 0;
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

  // FIX 3: cache previous position before integrating
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

  // FIX 3: interpolated draw position
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
// FIX 1 (visual):        sharp fighter-jet triangle, toned glow, dark stroke
// FIX 3 (interpolation): prevX/prevY cached; draw() lerps render position
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
  }

  get maxHealth()  { return CONFIG.PLAYER_BASE_HEALTH + this.upgrades.health * 20; }
  get speed()      { return CONFIG.PLAYER_BASE_SPEED  + (this.upgrades.speed * 30) + (this.buffs.speedBoost > 0 ? 150 : 0); }
  get damage()     { return CONFIG.PLAYER_BASE_DAMAGE + (this.upgrades.damage * 2); }
  get shootDelay() { return Math.max(0.05, CONFIG.PLAYER_SHOOT_DELAY - (this.upgrades.fireRate * 0.02)); }
  get bulletSpd()  { return CONFIG.PLAYER_BULLET_SPEED + (this.upgrades.bulletSpeed * 30); }
  get critChance() { return this.upgrades.critChance * 0.05; }
  get lifesteal()  { return this.upgrades.lifesteal  * 0.05; }

  // FIX 3: cache previous position before integrating
  update(dt, input) {
    if (!this.alive) return;

    this.prevX = this.x;
    this.prevY = this.y;

    for (const key in this.buffs) {
      if (this.buffs[key] > 0) this.buffs[key] = Math.max(0, this.buffs[key] - dt);
    }

    let dx = 0, dy = 0;
    if (input.joystickActive) {
      dx = input.joystickX / 40;
      dy = input.joystickY / 40;
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

    if (input.isShooting && (this.game.gameTime - this._lastShot) >= this.shootDelay) {
      this._shoot(input);
    }
  }

  _shoot(input) {
    this._lastShot = this.game.gameTime;

    let angle;
    if (input.isMobile && this.game.enemies.length > 0) {
      let nearestDSq = Infinity, nearest = this.game.enemies[0];
      for (const e of this.game.enemies) {
        const dSq = Utils.distSq(this.x, this.y, e.x, e.y);
        if (dSq < nearestDSq) { nearestDSq = dSq; nearest = e; }
      }
      angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
    } else {
      angle = Math.atan2(input.mouseY - this.y, input.mouseX - this.x);
    }

    const angles = (this.buffs.tripleShot > 0)
      ? [angle, angle - 0.2, angle + 0.2]
      : [angle];

    for (const ang of angles) {
      const isCrit = Math.random() < this.critChance;
      const isRage = this.buffs.rage > 0;
      const dmg    = (isRage || isCrit) ? this.damage * 2 : this.damage;
      const color  = isCrit ? "#f1c40f" : isRage ? "#ff4757" : "#e74c3c";
      const size   = (isCrit ? 7 : 5) * this.game.uiScale;

      const b = this.game.bulletPool.get();
      b.init(this.x, this.y, Math.cos(ang) * this.bulletSpd, Math.sin(ang) * this.bulletSpd, size, color, dmg, false);
      this.game.bullets.push(b);
    }
  }

  addXP(amount) {
    this.stats.xp += amount;
    if (this.stats.xp >= this.stats.xpToNext) {
      this.stats.level++;
      this.stats.xp      -= this.stats.xpToNext;
      this.stats.xpToNext = Math.floor(this.stats.xpToNext * 1.2);
      this.game.ui.showLevelUp();
    }
  }

  /**
   * FIX 1: Sharp fighter-jet ship.
   * - Glow pad reduced to 0.6× radius (was 1.8×) so it halos, not floods
   * - globalAlpha 0.45 on glow layer keeps it atmospheric without washing out
   * - New path: long needle nose, swept-back delta wings, deep engine notch
   * - Dark stroke gives hard separation from the neon background
   *
   * FIX 3: Render position is lerped between prevX/prevY and x/y via alpha.
   */
  draw(ctx, input, alpha) {
    if (!this.alive) return;

    // Interpolated render position
    const rx = Utils.lerp(this.prevX, this.x, alpha);
    const ry = Utils.lerp(this.prevY, this.y, alpha);

    let angle;
    if (input.isMobile && this.game.enemies.length > 0) {
      let nearestDSq = Infinity, nearest = this.game.enemies[0];
      for (const e of this.game.enemies) {
        const dSq = Utils.distSq(this.x, this.y, e.x, e.y);
        if (dSq < nearestDSq) { nearestDSq = dSq; nearest = e; }
      }
      angle = Math.atan2(nearest.y - ry, nearest.x - rx);
    } else {
      angle = Math.atan2(input.mouseY - ry, input.mouseX - rx);
    }

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

    // FIX 1: Reduced-intensity glow — pad is 0.6× instead of 1.8×
    // so the gradient halos the hull edge rather than flooding the whole body.
    const glow = GlowCache.get(this.color, s, s * 0.6);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(glow.canvas, -glow.half, -glow.half);
    ctx.globalAlpha = 1.0;

    // FIX 1: Thruster flame (drawn before hull so hull renders on top)
    const flicker   = 0.8 + Math.sin(this.game.gameTime * 40) * 0.2;
    const flameGrad = ctx.createLinearGradient(-s * 0.25, 0, -s * 1.1 * flicker, 0);
    flameGrad.addColorStop(0, `rgba(255,200,80,${0.95 * flicker})`);
    flameGrad.addColorStop(0.5, `rgba(255,120,20,${0.6 * flicker})`);
    flameGrad.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    // Flame widens slightly at the engine notch then tapers to a point
    ctx.moveTo(-s * 0.22,  s * 0.18);
    ctx.lineTo(-s * 1.1 * flicker, 0);
    ctx.lineTo(-s * 0.22, -s * 0.18);
    ctx.closePath();
    ctx.fill();

    // FIX 1: Fighter-jet hull path
    //   - Extended needle nose:  tip at  +1.1s
    //   - Swept delta wings:     tips at (-0.35s, ±0.85s)
    //   - Deep engine notch:     indent at (-0.22s, 0) between the wing roots
    //   - Wing roots meet hull:  (-0.5s, ±0.22s) → engine notch → mirror
    ctx.beginPath();
    ctx.moveTo( s * 1.1,   0);              // nose tip
    ctx.lineTo( s * 0.1,   s * 0.18);      // right leading-edge shoulder
    ctx.lineTo(-s * 0.35,  s * 0.85);      // right wingtip
    ctx.lineTo(-s * 0.5,   s * 0.22);      // right wing root
    ctx.lineTo(-s * 0.22,  0);             // engine notch (centre indent)
    ctx.lineTo(-s * 0.5,  -s * 0.22);      // left wing root
    ctx.lineTo(-s * 0.35, -s * 0.85);      // left wingtip
    ctx.lineTo( s * 0.1,  -s * 0.18);      // left leading-edge shoulder
    ctx.closePath();

    // Solid white fill
    ctx.fillStyle = this.color;
    ctx.fill();

    // FIX 1: Dark hard-edge stroke — makes the hull pop against glows
    ctx.strokeStyle = "rgba(5,8,16,0.8)";
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Cockpit highlight — small tinted ellipse near the nose
    ctx.fillStyle = "rgba(0,229,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(s * 0.45, 0, s * 0.18, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}


// =============================================================================
// SECTION 10 — ENEMY
// FIX 3 (interpolation): prevX/prevY cached; draw() lerps render position
// =============================================================================
class Enemy {
  constructor(game, x, y, type, waveFactor) {
    this.game  = game;
    this.x     = x;
    this.y     = y;
    this.prevX = x;
    this.prevY = y;
    this.type  = type;

    const baseHp   = 20 + Math.floor(waveFactor * 10);
    this.damage    = 10 + Math.floor(waveFactor * 2);
    this._lastShot = game.gameTime;

    switch (type) {
      case "tank":
        this.color = "#3498db"; this.size = 30 * game.uiScale; this.speed = 40;
        this.hp = baseHp * 2; this.shootDelay = 3.0; break;
      case "fast":
        this.color = "#f1c40f"; this.size = 16 * game.uiScale; this.speed = 185;
        this.hp = baseHp * 0.6; this.shootDelay = 1.5; break;
      case "spread":
        this.color = "#9b59b6"; this.size = 20 * game.uiScale; this.speed = 70;
        this.hp = baseHp; this.shootDelay = 2.5; break;
      case "exploder":
        this.color = "#e67e22"; this.size = 22 * game.uiScale; this.speed = 105;
        this.hp = baseHp; this.shootDelay = 4.0; break;
      default:
        this.color = "#2ecc71"; this.size = 20 * game.uiScale; this.speed = CONFIG.BASE_ENEMY_SPEED;
        this.hp = baseHp; this.shootDelay = 2.0;
    }
    this.maxHp = this.hp;
  }

  // FIX 3: cache previous position before integrating
  update(dt, player) {
    this.prevX = this.x;
    this.prevY = this.y;

    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    let sdx = Math.cos(angle) * this.speed;
    let sdy = Math.sin(angle) * this.speed;

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

    const timeSinceShot = this.game.gameTime - this._lastShot;
    if (timeSinceShot >= this.shootDelay && !this.game.checkWallCollision(this.x, this.y, this.size)) {
      this._lastShot = this.game.gameTime;

      if (this.type === "exploder") {
        this.game.spawnParticles(this.x, this.y, this.color, 35);
        this.hp = 0;
        const blastRadSq = (105 * this.game.uiScale) ** 2;
        const dSq        = Utils.distSq(this.x, this.y, player.x, player.y);
        if (dSq < blastRadSq && player.alive) {
          const falloff = 1 - (Math.sqrt(dSq) / Math.sqrt(blastRadSq));
          player.health -= this.damage * 2 * falloff;
          this.game.cameraShake = Math.max(this.game.cameraShake, CONFIG.SHAKE_MAX * 1.5);
          if (player.health <= 0) { player.alive = false; player.health = 0; }
        }
        return;
      }

      const shootAngle = Math.atan2(player.y - this.y, player.x - this.x);
      const angles     = (this.type === "spread")
        ? [shootAngle, shootAngle - 0.28, shootAngle + 0.28]
        : [shootAngle];

      for (const ang of angles) {
        const b = this.game.bulletPool.get();
        b.init(this.x, this.y,
          Math.cos(ang) * CONFIG.ENEMY_BULLET_SPEED,
          Math.sin(ang) * CONFIG.ENEMY_BULLET_SPEED,
          5 * this.game.uiScale, this.color, this.damage, true);
        this.game.bullets.push(b);
      }
    }
  }

  // FIX 3: interpolated draw position
  draw(ctx, alpha) {
    const rx   = Utils.lerp(this.prevX, this.x, alpha);
    const ry   = Utils.lerp(this.prevY, this.y, alpha);
    const glow = GlowCache.get(this.color, this.size, this.size * 1.4);
    ctx.drawImage(glow.canvas, rx - glow.half, ry - glow.half);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(rx, ry, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}


// =============================================================================
// SECTION 11 — INPUT MANAGER  (unchanged)
// =============================================================================
class InputManager {
  constructor() {
    this.keys           = {};
    this.mouseX         = 0;
    this.mouseY         = 0;
    this.isShooting     = false;
    this.joystickActive = false;
    this.joystickX      = 0;
    this.joystickY      = 0;
    this.isMobile       = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
    this._pausePressed  = false;
    this._quitPressed   = false;
    this._bindListeners();
  }

  _bindListeners() {
    const canvas   = document.getElementById("gameCanvas");
    const joy      = document.getElementById("joystick");
    const knob     = joy.querySelector(".joystick__knob");
    const shootBtn = document.getElementById("shootBtn");

    window.addEventListener("keydown", e => { this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener("keyup",   e => { this.keys[e.key.toLowerCase()] = false; });

    window.addEventListener("mousemove", e => {
      const rect  = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });
    window.addEventListener("mousedown", () => { this.isShooting = true; });
    window.addEventListener("mouseup",   () => { this.isShooting = false; });

    let jBaseX = 0, jBaseY = 0;

    joy.addEventListener("touchstart", e => {
      e.preventDefault();
      this.joystickActive = true;
      joy.classList.add("joystick--active");
      const r = joy.getBoundingClientRect();
      jBaseX  = r.left + r.width  / 2;
      jBaseY  = r.top  + r.height / 2;
      this._updateJoystick(e.touches[0], jBaseX, jBaseY, knob);
    });

    document.addEventListener("touchmove", e => {
      if (!this.joystickActive) return;
      e.preventDefault();
      this._updateJoystick(e.touches[0], jBaseX, jBaseY, knob);
    }, { passive: false });

    document.addEventListener("touchend", () => {
      this.joystickActive = false;
      this.joystickX = 0;
      this.joystickY = 0;
      knob.style.transform = "translate(-50%, -50%)";
      joy.classList.remove("joystick--active");
    });

    shootBtn.addEventListener("touchstart", e => { e.preventDefault(); this.isShooting = true; });
    shootBtn.addEventListener("touchend",   e => { e.preventDefault(); this.isShooting = false; });

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
  }

  _updateJoystick(touch, baseX, baseY, knob) {
    const maxRadius = 40;
    let dx = touch.clientX - baseX;
    let dy = touch.clientY - baseY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
    this.joystickX = dx;
    this.joystickY = dy;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}


// =============================================================================
// SECTION 12 — UI MANAGER  (unchanged)
// =============================================================================
class UIManager {
  constructor(game) {
    this.game = game;

    this._el = {
      startScreen:     document.getElementById("startScreen"),
      levelUp:         document.getElementById("levelUpScreen"),
      gameOverActions: document.getElementById("gameOverActions"),
      mobileUI:        document.getElementById("mobileControls"),
      leaderboard:     document.getElementById("localLeaderboard"),
    };

    this._bindUI();
    this._renderLeaderboard();
  }

  _bindUI() {
    document.getElementById("startBtn").addEventListener("click", () => {
      const raw  = document.getElementById("nicknameInput").value.trim();
      const name = raw.length > 0 ? raw : "Ghost";
      localStorage.setItem("ks_nickname", name);
      this._el.startScreen.classList.add("hidden");
      if (this.game.input.isMobile || window.innerWidth <= 768) {
        this._el.mobileUI.classList.add("mobile-ui--active");
      }
      this.game.start();
    });

    document.getElementById("restartBtn").addEventListener("click", () => {
      this._el.gameOverActions.classList.add("hidden");
      if (this.game.input.isMobile || window.innerWidth <= 768) {
        this._el.mobileUI.classList.add("mobile-ui--active");
      }
      this.game.start();
    });

    document.getElementById("menuBtn").addEventListener("click", () => {
      this._el.gameOverActions.classList.add("hidden");
      this._el.mobileUI.classList.remove("mobile-ui--active");
      this._renderLeaderboard();
      this._el.startScreen.classList.remove("hidden");
      cancelAnimationFrame(this.game._rafId);
      this.game.fsm.transition(GameState.MENU);
    });

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

  showLevelUp() {
    this.game.fsm.transition(GameState.LEVEL_UP);
    this._el.levelUp.classList.remove("hidden");
  }

  quitToMenu() {
    cancelAnimationFrame(this.game._rafId);
    this.game.fsm.transition(GameState.MENU);
    this._el.gameOverActions.classList.add("hidden");
    this._el.levelUp.classList.add("hidden");
    this._el.mobileUI.classList.remove("mobile-ui--active");
    const qb = document.getElementById("quitBtn");
    if (qb) qb.classList.add("hidden");
    this._renderLeaderboard();
    this._el.startScreen.classList.remove("hidden");
  }

  showGameOver() {
    const name = localStorage.getItem("ks_nickname") || "Ghost";
    this._saveScore(name, this.game.wave, this.game.gameTime, this.game.player.stats.level);
    this._renderLeaderboard();
    this._el.gameOverActions.classList.remove("hidden");
  }

  _saveScore(name, wave, time, level) {
    const stored = JSON.parse(localStorage.getItem("ks_scores") || "[]");
    stored.push({ name, wave, time: +time.toFixed(1), level, date: new Date().toLocaleDateString() });
    stored.sort((a, b) => b.wave - a.wave || b.time - a.time);
    const seen = new Set();
    const unique = stored.filter(s => {
      const key = `${s.name}|${s.wave}|${s.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    localStorage.setItem("ks_scores", JSON.stringify(unique.slice(0, 10)));
  }

  _renderLeaderboard() {
    const scores = JSON.parse(localStorage.getItem("ks_scores") || "[]");
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
    ctx.fillText(`WAVE ${g.wave}   KILLS ${g.kills}/${g.wave}   ENEMIES ${g.enemies.length}`, m, m);

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

    let buffY = xbY + xbH + 28 * s;
    for (const key in p.buffs) {
      if (p.buffs[key] > 0) {
        ctx.font      = `700 ${Math.max(11, 13 * s)}px ${CONFIG.HUD_FONT}`;
        ctx.fillStyle = CONFIG.POWERUP_COLORS[key] || "#fff";
        ctx.fillText(`${key.toUpperCase()}  ${p.buffs[key].toFixed(1)}s`, m, buffY);
        buffY += lh;
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
      ctx.fillText("Q — Quit to Main Menu", g.width / 2, g.height / 2 + 34 * s);
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
// SECTION 13 — GAME (Core Engine)
// FIX 2: this.collisionSeenSet hoisted here — cleared each tick, never newed
// FIX 3: _loop computes alpha = accumulator / FIXED_STEP, passes to _draw
// FIX 4: _deadBullets / _deadParticles counters drive threshold compaction
// =============================================================================
class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx    = this.canvas.getContext("2d");

    this.input = new InputManager();
    this.ui    = new UIManager(this);

    this.bulletPool   = new ObjectPool(Bullet,   CONFIG.POOL_BULLETS);
    this.particlePool = new ObjectPool(Particle, CONFIG.POOL_PARTICLES);

    this.spatialHash = new SpatialHash(80);

    this.fsm = new GameFSM();
    this._wireFSM();

    this.cameraShake = 0;
    this._shakeTime  = 0;
    this._rafId      = null;

    this._FIXED_STEP  = 1 / 60;
    this._accumulator = 0;

    // FIX 2: hoisted dedup Set — reused via .clear() instead of new Set() each tick
    this.collisionSeenSet = new Set();

    // FIX 4: dead-slot counters for threshold-based compaction
    this._deadBullets   = 0;
    this._deadParticles = 0;

    this._resize();
    window.addEventListener("resize", () => this._resize());
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
        },
        exit: () => {
          const btn = document.getElementById("quitBtn");
          if (btn) btn.classList.add("hidden");
          this.lastTime = performance.now();
        },
      })
      .register(GameState.GAME_OVER, {
        enter: () => { this.ui.showGameOver(); },
      });
  }

  _resize() {
    this.width  = this.canvas.width  = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    this.uiScale = Utils.clamp(Math.min(this.width / 800, this.height / 600), 0.7, 2.0);
    document.documentElement.style.setProperty("--ui-scale", this.uiScale);
    GlowCache.clear();
  }

  start() {
    cancelAnimationFrame(this._rafId);

    // Drain active entities back to pools before abandoning arrays
    if (this.bullets) {
      for (const b of this.bullets) { b.active = false; this.bulletPool.release(b); }
    }
    if (this.particles) {
      for (const p of this.particles) { p.active = false; this.particlePool.release(p); }
    }

    this.player    = new Player(this);
    this.enemies   = [];
    this.bullets   = [];
    this.particles = [];
    this.walls     = [];
    this.powerups  = [];

    this.wave      = 1;
    this.kills     = 0;
    this.gameTime  = 0;
    this.lastTime  = performance.now();
    this.cameraShake  = 0;
    this._shakeTime   = 0;
    this._accumulator = 0;

    // FIX 4: reset dead-slot counters
    this._deadBullets   = 0;
    this._deadParticles = 0;

    this.fsm.transition(GameState.PLAYING);
    this._spawnWalls();
    for (let i = 0; i < 2; i++) this._spawnEnemy();

    this._rafId = requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Game Loop ──────────────────────────────────────────────────────────────

  _loop(now) {
    this._rafId = requestAnimationFrame(ts => this._loop(ts));

    const frameDt = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;

    this._handleInputEvents();

    if (this.fsm.is(GameState.PLAYING)) {
      this._accumulator += frameDt;
      while (this._accumulator >= this._FIXED_STEP) {
        this._update(this._FIXED_STEP);
        this._accumulator -= this._FIXED_STEP;
      }
    }

    // FIX 3: temporal interpolation factor — fraction of a physics tick
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
  }

  // ── Fixed-step physics update ──────────────────────────────────────────────

  _update(dt) {
    this.gameTime += dt;

    this.spatialHash.clear();
    for (const e of this.enemies) this.spatialHash.insert(e);

    this.player.update(dt, this.input);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this.player);
      if (e.hp <= 0) this._handleEnemyDeath(e, i);
    }

    // ── Bullets ───────────────────────────────────────────────────────────
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      // FIX 4: skip already-dead slots; they'll be compacted in bulk below
      if (!b.active) continue;

      const bx0 = b.x;
      const by0 = b.y;
      b.update(dt);

      let hit = false;

      const wall = this.checkWallCollision(b.x, b.y, b.size);
      if (wall) {
        wall.hp -= b.damage;
        if (wall.hp <= 0) {
          const wi = this.walls.indexOf(wall);
          if (wi !== -1) Utils.removeFast(this.walls, wi);
        }
        this.spawnParticles(b.x, b.y, b.color, 5);
        hit = true;
      }

      if (!hit) {
        if (b.isEnemy) {
          if (!this.player.alive) {
            hit = true;
          } else {
            const t = Utils.sweepCircle(bx0, by0, b.x, b.y,
              this.player.x, this.player.y, b.size + this.player.size);
            if (t >= 0) {
              if (this.player.buffs.shield <= 0) {
                this.player.health -= b.damage;
                this.cameraShake = Math.max(this.cameraShake, 5);
              }
              hit = true;
              if (this.player.health <= 0 && this.player.alive) {
                this.player.alive = false; this.player.health = 0;
              }
            }
          }
        } else {
          const midX = (bx0 + b.x) * 0.5;
          const midY = (by0 + b.y) * 0.5;
          const candidates = this.spatialHash.query(midX, midY, b.size + 60);

          // FIX 2: reuse hoisted Set — clear() is O(n) on entries, not an allocation
          this.collisionSeenSet.clear();

          for (const e of candidates) {
            if (this.collisionSeenSet.has(e)) continue;
            this.collisionSeenSet.add(e);
            const t = Utils.sweepCircle(bx0, by0, b.x, b.y, e.x, e.y, b.size + e.size);
            if (t >= 0) {
              e.hp -= b.damage;
              hit   = true;
              if (this.player.lifesteal > 0) {
                this.player.health = Math.min(
                  this.player.maxHealth,
                  this.player.health + b.damage * this.player.lifesteal
                );
              }
              const ei = this.enemies.indexOf(e);
              if (e.hp <= 0 && ei !== -1) this._handleEnemyDeath(e, ei);
              break;
            }
          }
        }
      }

      if (!hit) {
        hit = (b.x < -80 || b.x > this.width + 80 || b.y < -80 || b.y > this.height + 80);
      }

      if (hit) {
        // FIX 4: mark dead + release to pool; do NOT splice here
        b.active = false;
        this.bulletPool.release(b);
        this._deadBullets++;
      }
    }

    // FIX 4: bulk-compact bullets when dead slots exceed threshold fraction
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
      // FIX 4: skip dead slots
      if (!p.active) continue;

      p.update(dt);

      if (p.life <= 0) {
        // FIX 4: mark dead + release; no splice
        p.active = false;
        this.particlePool.release(p);
        this._deadParticles++;
      }
    }

    // FIX 4: bulk-compact particles at threshold
    if (this._deadParticles > 0 &&
        this._deadParticles / this.particles.length >= CONFIG.COMPACT_THRESHOLD_PARTICLES) {
      let write = 0;
      for (let read = 0; read < this.particles.length; read++) {
        if (this.particles[read].active) this.particles[write++] = this.particles[read];
      }
      this.particles.length = write;
      this._deadParticles   = 0;
    }

    // Wave progression
    if (this.enemies.length === 0 && this.kills >= this.wave) {
      this.kills = 0;
      this.wave++;
      this.cameraShake = Math.max(this.cameraShake, CONFIG.SHAKE_MAX);
      const toSpawn = Math.min(30, 2 + this.wave);
      for (let k = 0; k < toSpawn; k++) this._spawnEnemy();
      if (this.wave % 3 === 0) this._spawnWalls();
    }

    if (this.cameraShake > 0) {
      this._shakeTime  += dt;
      this.cameraShake *= Math.exp(-CONFIG.SHAKE_DECAY * dt);
      if (this.cameraShake < 0.05) { this.cameraShake = 0; this._shakeTime = 0; }
    }

    if (this.player && !this.player.alive && this.fsm.isNot(GameState.GAME_OVER)) {
      this.fsm.transition(GameState.GAME_OVER);
    }
  }

  // ── Batched render pipeline ────────────────────────────────────────────────

  // FIX 3: alpha parameter drives all entity lerp calls
  _draw(alpha) {
    const ctx = this.ctx;

    ctx.fillStyle = "#050810";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();

    if (this.cameraShake > 0.05) {
      const ox = Math.sin(this._shakeTime * CONFIG.SHAKE_FREQ * Math.PI * 2)       * this.cameraShake;
      const oy = Math.sin(this._shakeTime * CONFIG.SHAKE_FREQ * Math.PI * 2 + 1.5) * this.cameraShake;
      ctx.translate(ox, oy);
    }

    // ── Walls ────────────────────────────────────────────────────────────
    ctx.fillStyle = CONFIG.WALL_COLOR;
    for (const w of this.walls) ctx.fillRect(w.x, w.y, w.w, w.h);

    ctx.fillStyle = CONFIG.WALL_HP_COLOR;
    for (const w of this.walls) ctx.fillRect(w.x, w.y - 9, w.w, 4);
    ctx.fillStyle = CONFIG.WALL_HP_GOOD_COLOR;
    for (const w of this.walls) {
      ctx.fillRect(w.x, w.y - 9, w.w * Utils.clamp(w.hp / w.maxHp, 0, 1), 4);
    }

    // ── Powerups (batched by color) ───────────────────────────────────────
    if (this.powerups.length > 0) {
      const pulse   = Math.sin(this.gameTime * 5) * 2;
      const byColor = new Map();
      for (const pu of this.powerups) {
        if (!byColor.has(pu.color)) byColor.set(pu.color, []);
        byColor.get(pu.color).push(pu);
      }
      for (const [color, pus] of byColor) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (const pu of pus) {
          ctx.moveTo(pu.x + pu.size + pulse, pu.y);
          ctx.arc(pu.x, pu.y, pu.size + pulse, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }

    // ── Particles — FIX 3: pass alpha; FIX 4: draw() skips inactive ──────
    for (const p of this.particles) p.draw(ctx, alpha);
    ctx.globalAlpha = 1;

    // ── Bullets: glow layer — FIX 3: draw() lerps; FIX 4: skips inactive ─
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

    // ── Enemies: glow layer then batched body fills ───────────────────────
    for (const e of this.enemies) {
      const rx   = Utils.lerp(e.prevX, e.x, alpha);
      const ry   = Utils.lerp(e.prevY, e.y, alpha);
      const glow = GlowCache.get(e.color, e.size, e.size * 1.4);
      ctx.drawImage(glow.canvas, rx - glow.half, ry - glow.half);
    }
    const enemyByColor = new Map();
    for (const e of this.enemies) {
      if (!enemyByColor.has(e.color)) enemyByColor.set(e.color, []);
      enemyByColor.get(e.color).push(e);
    }
    for (const [color, group] of enemyByColor) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const e of group) {
        const rx = Utils.lerp(e.prevX, e.x, alpha);
        const ry = Utils.lerp(e.prevY, e.y, alpha);
        ctx.moveTo(rx + e.size, ry);
        ctx.arc(rx, ry, e.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }

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

    // ── Player — FIX 1 + FIX 3 ───────────────────────────────────────────
    this.player.draw(ctx, this.input, alpha);

    ctx.restore();

    this.ui.drawHUD(ctx);
  }

  // ── Spawning helpers ───────────────────────────────────────────────────────

  _spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    const ex   = side === 0 ? 0 : side === 1 ? this.width  : Math.random() * this.width;
    const ey   = side === 2 ? 0 : side === 3 ? this.height : Math.random() * this.height;
    const wf   = Math.max(1, Math.log(this.wave + 1)) * CONFIG.WAVE_MULTIPLIER;
    const r    = Math.random();
    const type = r < 0.15 ? "tank" : r < 0.30 ? "fast" : r < 0.45 ? "spread" : r < 0.60 ? "exploder" : "normal";
    this.enemies.push(new Enemy(this, ex, ey, type, wf));
  }

  _spawnWalls() {
    this.walls = [];
    const count = Math.floor(Math.random() * 6) + 5;
    for (let i = 0; i < count; i++) {
      const w = 100 + Math.random() * 110;
      const h = 18  + Math.random() * 28;
      this.walls.push({
        x: Math.random() * (this.width  - w - 40) + 20,
        y: Math.random() * (this.height - h - 40) + 20,
        w, h,
        hp:    Math.floor(Math.random() * 5) + 3,
        maxHp: 10,
      });
    }
  }

  spawnParticles(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 0.8;
      const p     = this.particlePool.get();
      p.init(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        color, Math.random() * 4 + 1.5, Math.random() * 0.5 + 0.4);
      this.particles.push(p);
    }
  }

  checkWallCollision(x, y, size) {
    for (const w of this.walls) {
      if (Utils.circleRect(x, y, size, w.x, w.y, w.w, w.h)) return w;
    }
    return null;
  }

  _handleEnemyDeath(enemy, index) {
    if (Math.random() < 0.2) {
      const type = CONFIG.POWERUP_TYPES[Math.floor(Math.random() * CONFIG.POWERUP_TYPES.length)];
      this.powerups.push({ x: enemy.x, y: enemy.y, type, size: 12 * this.uiScale, color: CONFIG.POWERUP_COLORS[type] });
    }
    this.kills++;
    this.player.addXP(10 + Math.floor(Math.log2(this.wave + 1)) * 2);
    this.spawnParticles(enemy.x, enemy.y, enemy.color, 22);
    Utils.removeFast(this.enemies, index);
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
// SECTION 14 — BOOTSTRAP
// =============================================================================
window.addEventListener("load", () => {
  window.kGame = new Game();
});
