/**
 * KritikShoot — game.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Architecture  : ES6 Classes, single-responsibility, no global state
 * Game Loop     : requestAnimationFrame + Delta-Time (dt) — frame-rate agnostic
 * Memory        : Object Pools for Bullets and Particles (zero GC stutter)
 * Collision     : distanceSq optimisation — avoids sqrt in hot loops
 * Rendering     : ctx.shadowBlur neon glows, layered draw order
 * Camera Shake  : sine-wave decay (smooth, not chaotic)
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

// =============================================================================
// SECTION 1 — CONFIGURATION
// Central source of truth for every magic number in the game.
// Changing a value here propagates everywhere; no hunting through code.
// =============================================================================
const CONFIG = Object.freeze({

  // ── Player ─────────────────────────────────────────────────────────────────
  PLAYER_SIZE:          20,          // half-width of the ship triangle (px)
  PLAYER_BASE_SPEED:    300,         // px / second
  PLAYER_BASE_HEALTH:   200,
  PLAYER_SHOOT_DELAY:   0.20,        // seconds between shots
  PLAYER_BULLET_SPEED:  600,         // px / second
  PLAYER_BASE_DAMAGE:   10,

  // ── Enemies ────────────────────────────────────────────────────────────────
  BASE_ENEMY_SPEED:     90,          // px / second (normal type)
  ENEMY_BULLET_SPEED:   360,
  WAVE_MULTIPLIER:      0.5,

  // ── Camera Shake ───────────────────────────────────────────────────────────
  SHAKE_MAX:            14,          // maximum pixel displacement
  SHAKE_DECAY:          6.5,         // exponential decay per second (higher = faster)
  SHAKE_FREQ:           55,          // Hz of sine oscillation

  // ── Particles ──────────────────────────────────────────────────────────────
  PARTICLE_FRICTION:    0.88,        // per-frame velocity multiplier
  PARTICLE_DECAY:       0.94,        // per-frame size multiplier

  // ── Object Pool sizes ──────────────────────────────────────────────────────
  POOL_BULLETS:         300,
  POOL_PARTICLES:       500,

  // ── Powerups ───────────────────────────────────────────────────────────────
  POWERUP_TYPES:   ["health", "xp", "shield", "triple_shot", "speed_boost", "rage"],
  POWERUP_COLORS: {
    health:       "#ff6b81",
    xp:           "#feca57",
    shield:       "#48dbfb",
    triple_shot:  "#ff9f43",
    speed_boost:  "#1dd1a1",
    rage:         "#ff4757",
  },

  // ── HUD Colours ────────────────────────────────────────────────────────────
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
// Pure, stateless helper functions. No side effects.
// =============================================================================
const Utils = {

  /**
   * Squared Euclidean distance — avoids expensive Math.sqrt in collision loops.
   * Compare against (r1 + r2)² instead of Math.sqrt(…) < r1 + r2.
   */
  distSq(x1, y1, x2, y2) {
    return (x2 - x1) ** 2 + (y2 - y1) ** 2;
  },

  /**
   * O(1) array removal — swaps target with last element, then pops.
   * Avoids the O(n) shift caused by Array.splice at arbitrary indices.
   * ORDER IS NOT PRESERVED — acceptable for unordered game-object lists.
   */
  removeFast(arr, index) {
    arr[index] = arr[arr.length - 1];
    arr.pop();
  },

  /**
   * Circle vs Axis-Aligned Rectangle collision.
   * Projects the closest point on the rect to the circle centre, then
   * tests against the circle radius.
   */
  circleRect(cx, cy, r, rx, ry, rw, rh) {
    const clampX = Math.max(rx, Math.min(cx, rx + rw));
    const clampY = Math.max(ry, Math.min(cy, ry + rh));
    return Utils.distSq(cx, cy, clampX, clampY) <= r * r;
  },

  /**
   * Linear interpolation.
   * Used for smooth camera shake decay and any value transitions.
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  /**
   * Clamp a value between min and max.
   */
  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  },
};


// =============================================================================
// SECTION 3 — OBJECT POOL
// Pre-allocates a reservoir of reusable objects at game start.
// During gameplay, get() checks the reservoir before allocating new memory.
// release() returns objects to the reservoir.
// This eliminates Garbage Collector pauses during intense wave moments.
// =============================================================================
class ObjectPool {
  /**
   * @param {Function} FactoryClass — constructor for the pooled type
   * @param {number}   initialSize  — objects to pre-warm on startup
   */
  constructor(FactoryClass, initialSize = 100) {
    this._factory = FactoryClass;
    // Pre-warm the pool so the first wave costs zero allocations
    this._pool = Array.from({ length: initialSize }, () => new FactoryClass());
  }

  /** Retrieve an object. Falls back to `new` if the pool is empty. */
  get() {
    return this._pool.length > 0 ? this._pool.pop() : new this._factory();
  }

  /** Return an object to the pool. Call after marking it inactive. */
  release(obj) {
    this._pool.push(obj);
  }

  /** Current size of the warm pool (useful for debugging). */
  get size() {
    return this._pool.length;
  }
}


// =============================================================================
// SECTION 4 — POOLABLE ENTITIES
// Bullet and Particle are designed to be reused via ObjectPool.
// Constructor sets a minimal "inactive" state.
// init() acts as a re-constructor when retrieved from the pool.
// =============================================================================

// ── Bullet ──────────────────────────────────────────────────────────────────
class Bullet {
  constructor() {
    this.active = false;
  }

  /**
   * (Re-)initialise a bullet retrieved from the pool.
   * @param {number}  x, y       — spawn position
   * @param {number}  dx, dy     — velocity in px/s
   * @param {number}  size       — radius in px
   * @param {string}  color      — CSS colour string
   * @param {number}  damage
   * @param {boolean} isEnemy    — true for enemy projectiles
   */
  init(x, y, dx, dy, size, color, damage, isEnemy) {
    this.x       = x;
    this.y       = y;
    this.dx      = dx;
    this.dy      = dy;
    this.size    = size;
    this.color   = color;
    this.damage  = damage;
    this.isEnemy = isEnemy;
    this.active  = true;
  }

  /**
   * Move the bullet forward.
   * @param {number} dt — elapsed seconds since last frame
   */
  update(dt) {
    this.x += this.dx * dt;
    this.y += this.dy * dt;
  }

  /** Render the bullet with a neon glow. */
  draw(ctx) {
    ctx.save();
    ctx.shadowBlur  = 14;
    ctx.shadowColor = this.color;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    // Bright core dot for extra crispness
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}


// ── Particle ─────────────────────────────────────────────────────────────────
class Particle {
  constructor() {
    this.active = false;
  }

  /**
   * @param {number} x, y      — spawn position
   * @param {number} dx, dy    — velocity (arbitrary units, scaled to ~60fps equiv)
   * @param {string} color
   * @param {number} size      — starting radius in px
   * @param {number} life      — lifetime in seconds
   */
  init(x, y, dx, dy, color, size, life) {
    this.x       = x;
    this.y       = y;
    this.dx      = dx;
    this.dy      = dy;
    this.color   = color;
    this.size    = size;
    this.life    = life;
    this.maxLife = life;
    this.active  = true;
  }

  /**
   * Simulate friction and scale-down as the particle fades.
   * Velocity is kept in "pixel/frame units", scaled to a 60 fps equivalent
   * so the visual feel stays consistent regardless of refresh rate.
   */
  update(dt) {
    // Scale frame-relative velocity by the actual elapsed time
    this.x   += this.dx * dt * 60;
    this.y   += this.dy * dt * 60;
    // Friction slows each component multiplicatively
    this.dx  *= CONFIG.PARTICLE_FRICTION;
    this.dy  *= CONFIG.PARTICLE_FRICTION;
    // Particle shrinks as it ages
    this.size = Math.max(0, this.size * CONFIG.PARTICLE_DECAY);
    this.life -= dt;
  }

  /** Alpha driven by remaining lifetime for a smooth fade. */
  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur  = 6;
    ctx.shadowColor = this.color;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.1, this.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}


// =============================================================================
// SECTION 5 — PLAYER
// Encapsulates movement, shooting, upgrades, buffs, XP, and drawing.
// All tunable values are read from CONFIG; all upgrades are additive offsets.
// =============================================================================
class Player {
  /**
   * @param {Game} game — back-reference to the owning Game instance
   */
  constructor(game) {
    this.game = game;
    this.reset();
  }

  /** Called at game start and restart to return to a clean state. */
  reset() {
    this.x      = this.game.width  / 2;
    this.y      = this.game.height / 2;
    this.size   = CONFIG.PLAYER_SIZE;
    this.color  = "#ffffff";
    this.alive  = true;
    this.health = CONFIG.PLAYER_BASE_HEALTH;

    // RPG progression
    this.stats = { level: 1, xp: 0, xpToNext: 100 };

    // Persistent level-up upgrades (additive stacking)
    this.upgrades = {
      speed: 0, health: 0, damage: 0,
      fireRate: 0, bulletSpeed: 0, critChance: 0, lifesteal: 0,
    };

    // Timed buff durations in seconds (countdown to 0)
    this.buffs = {
      shield: 0, tripleShot: 0, speedBoost: 0, rage: 0,
    };

    this._lastShot = 0; // gameTime stamp of last fired bullet
  }

  // ── Derived stats (read-only getters) ──────────────────────────────────────

  get maxHealth()  { return CONFIG.PLAYER_BASE_HEALTH + this.upgrades.health * 20; }
  get speed()      { return CONFIG.PLAYER_BASE_SPEED  + (this.upgrades.speed   * 30) + (this.buffs.speedBoost > 0 ? 150 : 0); }
  get damage()     { return CONFIG.PLAYER_BASE_DAMAGE + (this.upgrades.damage   * 2); }
  get shootDelay() { return Math.max(0.05, CONFIG.PLAYER_SHOOT_DELAY - (this.upgrades.fireRate * 0.02)); }
  get bulletSpd()  { return CONFIG.PLAYER_BULLET_SPEED + (this.upgrades.bulletSpeed * 30); }
  get critChance() { return this.upgrades.critChance * 0.05; }   // 5 % per upgrade point
  get lifesteal()  { return this.upgrades.lifesteal  * 0.05; }   // 5 % per upgrade point

  /**
   * Main update — runs every frame while the player is alive.
   * @param {number}       dt    — seconds since last frame
   * @param {InputManager} input — current input snapshot
   */
  update(dt, input) {
    if (!this.alive) return;

    // ── Count down buff timers ──────────────────────────────────────────────
    for (const key in this.buffs) {
      if (this.buffs[key] > 0) this.buffs[key] = Math.max(0, this.buffs[key] - dt);
    }

    // ── Directional input (keyboard or joystick) ────────────────────────────
    let dx = 0, dy = 0;

    if (input.joystickActive) {
      // Joystick value ±40 px from centre → normalise to unit vector
      dx = input.joystickX / 40;
      dy = input.joystickY / 40;
    } else {
      if (input.keys["w"] || input.keys["arrowup"])    dy -= 1;
      if (input.keys["s"] || input.keys["arrowdown"])  dy += 1;
      if (input.keys["a"] || input.keys["arrowleft"])  dx -= 1;
      if (input.keys["d"] || input.keys["arrowright"]) dx += 1;
    }

    // Normalise diagonal movement so we don't move ~41 % faster diagonally
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }

    // ── Attempt movement, wall-check each axis independently ───────────────
    const nx = this.x + dx * this.speed * dt;
    const ny = this.y + dy * this.speed * dt;

    if (!this.game.checkWallCollision(nx, this.y, this.size)) this.x = nx;
    if (!this.game.checkWallCollision(this.x, ny, this.size)) this.y = ny;

    // Hard boundary clamp
    this.x = Utils.clamp(this.x, this.size, this.game.width  - this.size);
    this.y = Utils.clamp(this.y, this.size, this.game.height - this.size);

    // ── Shooting ────────────────────────────────────────────────────────────
    if (input.isShooting && (this.game.gameTime - this._lastShot) >= this.shootDelay) {
      this._shoot(input);
    }
  }

  /**
   * Fire one (or three) bullets toward the cursor / nearest enemy.
   * @param {InputManager} input
   */
  _shoot(input) {
    this._lastShot = this.game.gameTime;

    // Mobile: auto-aim at closest enemy; desktop: aim at mouse cursor
    const angle = input.isMobile && this.game.enemies.length > 0
      ? Math.atan2(this.game.enemies[0].y - this.y, this.game.enemies[0].x - this.x)
      : Math.atan2(input.mouseY - this.y, input.mouseX - this.x);

    // Triple-shot buff adds two spread shots
    const angles = (this.buffs.tripleShot > 0)
      ? [angle, angle - 0.2, angle + 0.2]
      : [angle];

    for (const ang of angles) {
      const isCrit  = Math.random() < this.critChance;
      const isRage  = this.buffs.rage > 0;
      const dmg     = (isRage || isCrit) ? this.damage * 2 : this.damage;
      const color   = isCrit  ? "#f1c40f"
                    : isRage  ? "#ff4757"
                    : "#e74c3c";
      const size    = (isCrit ? 7 : 5) * this.game.uiScale;

      const b = this.game.bulletPool.get();
      b.init(
        this.x, this.y,
        Math.cos(ang) * this.bulletSpd,
        Math.sin(ang) * this.bulletSpd,
        size, color, dmg, false
      );
      this.game.bullets.push(b);
    }
  }

  /**
   * Award XP, triggering a level-up if the threshold is reached.
   * @param {number} amount
   */
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
   * Render the player ship as a glowing triangle.
   * Rotates to face the cursor / nearest enemy.
   * @param {CanvasRenderingContext2D} ctx
   * @param {InputManager}            input
   */
  draw(ctx, input) {
    if (!this.alive) return;

    const angle = input.isMobile && this.game.enemies.length > 0
      ? Math.atan2(this.game.enemies[0].y - this.y, this.game.enemies[0].x - this.x)
      : Math.atan2(input.mouseY - this.y, input.mouseX - this.x);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // ── Shield aura ────────────────────────────────────────────────────────
    if (this.buffs.shield > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(72, 219, 251, 0.65)";
      ctx.lineWidth   = 3;
      ctx.shadowBlur  = 20;
      ctx.shadowColor = "#48dbfb";
      ctx.beginPath();
      ctx.arc(0, 0, this.size + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── Ship triangle ──────────────────────────────────────────────────────
    const s = this.size;
    ctx.shadowBlur  = 20;
    ctx.shadowColor = this.color;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.moveTo(s,       0);          // nose (pointing right before rotation)
    ctx.lineTo(-s * 0.6,  s * 0.55); // bottom-left
    ctx.lineTo(-s * 0.3,  0);        // engine recess
    ctx.lineTo(-s * 0.6, -s * 0.55); // top-left
    ctx.closePath();
    ctx.fill();

    // Thruster flame (animated with gameTime)
    const flicker = 0.8 + Math.sin(this.game.gameTime * 40) * 0.2;
    ctx.shadowColor = "#ff9f43";
    ctx.shadowBlur  = 12 * flicker;
    ctx.fillStyle   = `rgba(255, 159, 67, ${0.75 * flicker})`;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3,  s * 0.25);
    ctx.lineTo(-s * 0.9 * flicker, 0);
    ctx.lineTo(-s * 0.3, -s * 0.25);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}


// =============================================================================
// SECTION 6 — ENEMY
// Five distinct archetypes with unique stats, speeds, and attack patterns.
// =============================================================================
class Enemy {
  /**
   * @param {Game}   game
   * @param {number} x, y        — spawn position
   * @param {string} type        — "normal" | "tank" | "fast" | "spread" | "exploder"
   * @param {number} waveFactor  — difficulty scalar derived from current wave
   */
  constructor(game, x, y, type, waveFactor) {
    this.game = game;
    this.x    = x;
    this.y    = y;
    this.type = type;

    const baseHp    = 20 + Math.floor(waveFactor * 10);
    this.damage     = 10 + Math.floor(waveFactor * 2);
    this._lastShot  = game.gameTime;

    // Per-type stat overrides
    switch (type) {
      case "tank":
        this.color     = "#3498db";
        this.size      = 30 * game.uiScale;
        this.speed     = 40;
        this.hp        = baseHp * 2;
        this.shootDelay = 3.0;
        break;
      case "fast":
        this.color     = "#f1c40f";
        this.size      = 16 * game.uiScale;
        this.speed     = 185;
        this.hp        = baseHp * 0.6;
        this.shootDelay = 1.5;
        break;
      case "spread":
        this.color     = "#9b59b6";
        this.size      = 20 * game.uiScale;
        this.speed     = 70;
        this.hp        = baseHp;
        this.shootDelay = 2.5;
        break;
      case "exploder":
        this.color     = "#e67e22";
        this.size      = 22 * game.uiScale;
        this.speed     = 105;
        this.hp        = baseHp;
        this.shootDelay = 4.0;
        break;
      default: // "normal"
        this.color     = "#2ecc71";
        this.size      = 20 * game.uiScale;
        this.speed     = CONFIG.BASE_ENEMY_SPEED;
        this.hp        = baseHp;
        this.shootDelay = 2.0;
    }

    this.maxHp = this.hp;
  }

  /**
   * Move toward the player, checking for wall obstruction, then shoot.
   * @param {number} dt     — seconds since last frame
   * @param {Player} player
   */
  update(dt, player) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const nx    = this.x + Math.cos(angle) * this.speed * dt;
    const ny    = this.y + Math.sin(angle) * this.speed * dt;

    // Only move if the target cell is wall-free
    if (!this.game.checkWallCollision(nx, ny, this.size)) {
      this.x = nx;
      this.y = ny;
    }

    // ── Shooting / special behaviour ───────────────────────────────────────
    const timeSinceShot = this.game.gameTime - this._lastShot;
    if (timeSinceShot >= this.shootDelay && !this.game.checkWallCollision(this.x, this.y, this.size)) {
      this._lastShot = this.game.gameTime;

      if (this.type === "exploder") {
        // Suicide explosion: kills itself, damages nearby player
        this.game.spawnParticles(this.x, this.y, this.color, 35);
        this.hp = 0;

        const blastRadSq = (105 * this.game.uiScale) ** 2;
        const dSq        = Utils.distSq(this.x, this.y, player.x, player.y);
        if (dSq < blastRadSq) {
          // Damage falls off linearly with distance
          const falloff = 1 - (Math.sqrt(dSq) / Math.sqrt(blastRadSq));
          player.health -= this.damage * 2 * falloff;
          this.game.cameraShake = Math.max(this.game.cameraShake, CONFIG.SHAKE_MAX * 1.5);
        }
        return;
      }

      // Spread shoots 3 bullets in a fan; others shoot straight
      const angles = (this.type === "spread")
        ? [angle, angle - 0.28, angle + 0.28]
        : [angle];

      for (const ang of angles) {
        const b = this.game.bulletPool.get();
        b.init(
          this.x, this.y,
          Math.cos(ang) * CONFIG.ENEMY_BULLET_SPEED,
          Math.sin(ang) * CONFIG.ENEMY_BULLET_SPEED,
          5 * this.game.uiScale,
          this.color,
          this.damage,
          true   // isEnemy
        );
        this.game.bullets.push(b);
      }
    }
  }

  /**
   * Render the enemy as a glowing circle with a health bar.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    ctx.save();
    ctx.shadowBlur  = 12;
    ctx.shadowColor = this.color;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Health bar above the enemy ─────────────────────────────────────────
    const barW = 44 * this.game.uiScale;
    const barH = 5  * this.game.uiScale;
    const barX = this.x - barW / 2;
    const barY = this.y - this.size - barH - 6;
    const hpRatio = Utils.clamp(this.hp / this.maxHp, 0, 1);

    ctx.fillStyle = CONFIG.WALL_HP_COLOR;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = CONFIG.WALL_HP_GOOD_COLOR;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
  }
}


// =============================================================================
// SECTION 7 — INPUT MANAGER
// Centralises all input sources (keyboard, mouse, touch joystick).
// The game loop reads a snapshot each frame; it does not subscribe to events.
// =============================================================================
class InputManager {
  constructor() {
    // Keyboard state — key names lowercased
    this.keys = {};

    // Mouse / cursor
    this.mouseX    = 0;
    this.mouseY    = 0;
    this.isShooting = false;

    // Touch joystick
    this.joystickActive = false;
    this.joystickX      = 0;
    this.joystickY      = 0;

    // Detect mobile once at init
    this.isMobile = /Mobi|Android/i.test(navigator.userAgent);

    this._bindListeners();
  }

  _bindListeners() {
    const canvas   = document.getElementById("gameCanvas");
    const joy      = document.getElementById("joystick");
    const knob     = joy.querySelector(".joystick__knob");
    const shootBtn = document.getElementById("shootBtn");

    // ── Keyboard ────────────────────────────────────────────────────────────
    window.addEventListener("keydown", e => {
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener("keyup", e => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // ── Mouse ───────────────────────────────────────────────────────────────
    window.addEventListener("mousemove", e => {
      const rect   = canvas.getBoundingClientRect();
      this.mouseX  = e.clientX - rect.left;
      this.mouseY  = e.clientY - rect.top;
    });
    window.addEventListener("mousedown", ()  => { this.isShooting = true;  });
    window.addEventListener("mouseup",   ()  => { this.isShooting = false; });

    // ── Touch joystick ──────────────────────────────────────────────────────
    let jBaseX = 0, jBaseY = 0;

    joy.addEventListener("touchstart", e => {
      e.preventDefault();
      this.joystickActive = true;
      joy.classList.add("joystick--active");

      const r  = joy.getBoundingClientRect();
      jBaseX   = r.left + r.width  / 2;
      jBaseY   = r.top  + r.height / 2;
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

    // ── Shoot button (mobile) ───────────────────────────────────────────────
    shootBtn.addEventListener("touchstart", e => {
      e.preventDefault();
      this.isShooting = true;
    });
    shootBtn.addEventListener("touchend", e => {
      e.preventDefault();
      this.isShooting = false;
    });
  }

  /**
   * Update the visual knob position and write dx/dy to the input state.
   */
  _updateJoystick(touch, baseX, baseY, knob) {
    const maxRadius = 40;
    let   dx = touch.clientX - baseX;
    let   dy = touch.clientY - baseY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    this.joystickX = dx;
    this.joystickY = dy;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}


// =============================================================================
// SECTION 8 — UI MANAGER
// Owns all DOM interactions: start screen, level-up dialog, leaderboard, HUD.
// HUD is drawn on the canvas each frame; everything else is HTML/CSS overlays.
// =============================================================================
class UIManager {
  /**
   * @param {Game} game
   */
  constructor(game) {
    this.game = game;

    // Cache DOM references once — avoids repeated querySelector
    this._el = {
      startScreen:  document.getElementById("startScreen"),
      levelUp:      document.getElementById("levelUpScreen"),
      restartBtn:   document.getElementById("restartBtn"),
      mobileUI:     document.getElementById("mobileControls"),
      leaderboard:  document.getElementById("localLeaderboard"),
    };

    this._bindUI();
    this._renderLeaderboard();
  }

  _bindUI() {
    // ── Start button ────────────────────────────────────────────────────────
    document.getElementById("startBtn").addEventListener("click", () => {
      const raw  = document.getElementById("nicknameInput").value.trim();
      const name = raw.length > 0 ? raw : "Ghost";
      localStorage.setItem("ks_nickname", name);

      this._el.startScreen.classList.add("hidden");
      if (this.game.input.isMobile) {
        this._el.mobileUI.style.display = "block";
      }
      this.game.start();
    });

    // ── Restart button ───────────────────────────────────────────────────────
    document.getElementById("restartBtn").addEventListener("click", () => {
      this._el.restartBtn.classList.add("hidden");
      this.game.start();
    });

    // ── Upgrade buttons ─────────────────────────────────────────────────────
    document.querySelectorAll(".btn--upgrade").forEach(btn => {
      btn.addEventListener("click", e => {
        const type = e.currentTarget.dataset.type;
        if (!type || !(type in this.game.player.upgrades)) return;

        this.game.player.upgrades[type]++;
        // Health upgrades also refill to the new maximum
        if (type === "health") {
          this.game.player.health = this.game.player.maxHealth;
        }

        this._el.levelUp.classList.add("hidden");
        this.game.isPaused = false;
        // Reset lastTime so a large dt spike doesn't happen after the pause
        this.game.lastTime = performance.now();
      });
    });
  }

  /** Pause the game and reveal the level-up card. */
  showLevelUp() {
    this.game.isPaused = true;
    this._el.levelUp.classList.remove("hidden");
  }

  /** Record the score, refresh the leaderboard, show the restart button. */
  showGameOver() {
    const name  = localStorage.getItem("ks_nickname") || "Ghost";
    this._saveScore(name, this.game.wave, this.game.gameTime, this.game.player.stats.level);
    this._renderLeaderboard();
    this._el.restartBtn.classList.remove("hidden");
  }

  // ── Leaderboard persistence ─────────────────────────────────────────────

  _saveScore(name, wave, time, level) {
    const stored = JSON.parse(localStorage.getItem("ks_scores") || "[]");
    stored.push({ name, wave, time: +time.toFixed(1), level, date: new Date().toLocaleDateString() });

    // Sort by wave (desc) then time (desc) as tiebreaker
    stored.sort((a, b) => b.wave - a.wave || b.time - a.time);

    // Deduplicate identical entries (same play doesn't double-save on reload)
    const seen   = new Set();
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
      `<tr>
        <td>${i + 1}</td>
        <td>${this._esc(s.name)}</td>
        <td>${s.wave}</td>
        <td>${s.time}s</td>
        <td>${s.level}</td>
      </tr>`
    ).join("");

    this._el.leaderboard.innerHTML = `
      <table>
        <thead><tr><th>#</th><th>NAME</th><th>WAVE</th><th>TIME</th><th>LVL</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  /** Minimal HTML-entity escaping to prevent XSS from nickname input. */
  _esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── In-canvas HUD ──────────────────────────────────────────────────────────

  /**
   * Renders all heads-up display elements directly onto the game canvas.
   * Called once per frame from Game.draw().
   * @param {CanvasRenderingContext2D} ctx
   */
  drawHUD(ctx) {
    const g   = this.game;
    const p   = g.player;
    const s   = g.uiScale;
    const m   = 20 * s;                // left/top margin
    const lh  = 28 * s;               // line height

    ctx.save();
    ctx.textBaseline = "top";

    // ── Wave / kill counter (top-left) ─────────────────────────────────────
    ctx.font      = `700 ${Math.max(13, 16 * s)}px ${CONFIG.HUD_FONT}`;
    ctx.fillStyle = CONFIG.HUD_COLOR_MAIN;
    ctx.shadowBlur  = 6;
    ctx.shadowColor = "rgba(0,229,255,0.5)";
    ctx.fillText(`WAVE ${g.wave}   KILLS ${g.kills}/${g.wave}   ENEMIES ${g.enemies.length}`, m, m);
    ctx.shadowBlur  = 0;

    // ── Time & Level (below wave line) ─────────────────────────────────────
    ctx.font      = `600 ${Math.max(12, 14 * s)}px ${CONFIG.HUD_FONT}`;
    ctx.fillStyle = "rgba(232,240,254,0.7)";
    ctx.fillText(`Time: ${g.gameTime.toFixed(1)}s   Level ${p.stats.level}`, m, m + lh);

    // ── Health bar ─────────────────────────────────────────────────────────
    const hbY  = m + lh * 2 + 6;
    const hbW  = 180 * s;
    const hbH  = 10  * s;
    const hpR  = Utils.clamp(p.health / p.maxHealth, 0, 1);

    // Background track
    ctx.fillStyle = CONFIG.HUD_COLOR_HP_BG;
    this._roundRect(ctx, m, hbY, hbW, hbH, 4);

    // Filled segment
    ctx.fillStyle = CONFIG.HUD_COLOR_HP_FG;
    if (hpR > 0) this._roundRect(ctx, m, hbY, hbW * hpR, hbH, 4);

    // HP label
    ctx.font      = `700 ${Math.max(11, 13 * s)}px ${CONFIG.HUD_FONT}`;
    ctx.fillStyle = CONFIG.HUD_COLOR_MAIN;
    ctx.fillText(`HP  ${Math.ceil(p.health)} / ${p.maxHealth}`, m, hbY + hbH + 5);

    // ── XP bar ──────────────────────────────────────────────────────────────
    const xbY  = hbY + hbH + 26 * s;
    const xbW  = 140 * s;
    const xbH  = 6   * s;
    const xpR  = Utils.clamp(p.stats.xp / p.stats.xpToNext, 0, 1);

    ctx.fillStyle = CONFIG.HUD_COLOR_XP_BG;
    this._roundRect(ctx, m, xbY, xbW, xbH, 3);

    ctx.fillStyle = CONFIG.HUD_COLOR_XP_FG;
    if (xpR > 0) this._roundRect(ctx, m, xbY, xbW * xpR, xbH, 3);

    ctx.font      = `600 ${Math.max(10, 12 * s)}px ${CONFIG.HUD_FONT}`;
    ctx.fillStyle = "rgba(0,229,255,0.8)";
    ctx.fillText(`XP  ${p.stats.xp} / ${p.stats.xpToNext}`, m, xbY + xbH + 4);

    // ── Active buff pills ──────────────────────────────────────────────────
    let buffY = xbY + xbH + 28 * s;
    for (const key in p.buffs) {
      if (p.buffs[key] > 0) {
        const col  = CONFIG.POWERUP_COLORS[key] || "#fff";
        const pill = `${key.toUpperCase()}  ${p.buffs[key].toFixed(1)}s`;

        ctx.font         = `700 ${Math.max(11, 13 * s)}px ${CONFIG.HUD_FONT}`;
        ctx.fillStyle    = col;
        ctx.shadowBlur   = 8;
        ctx.shadowColor  = col;
        ctx.fillText(pill, m, buffY);
        ctx.shadowBlur   = 0;
        buffY           += lh;
      }
    }

    // ── Pause indicator ────────────────────────────────────────────────────
    if (g.isPaused) {
      ctx.font      = `900 ${Math.max(18, 28 * s)}px ${CONFIG.HUD_FONT}`;
      ctx.fillStyle = "rgba(0,229,255,0.6)";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", g.width / 2, m);
      ctx.textAlign = "left";
    }

    // ── Game-over overlay ──────────────────────────────────────────────────
    if (!p.alive) {
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fillRect(0, 0, g.width, g.height);

      ctx.textAlign   = "center";
      ctx.fillStyle   = "#ff2d55";
      ctx.shadowBlur  = 30;
      ctx.shadowColor = "rgba(255,45,85,0.7)";
      ctx.font        = `900 ${Math.max(28, 52 * s)}px ${CONFIG.HUD_FONT}`;
      ctx.fillText("MISSION FAILED", g.width / 2, g.height / 2 - 60 * s);

      ctx.shadowBlur  = 0;
      ctx.fillStyle   = CONFIG.HUD_COLOR_MAIN;
      ctx.font        = `600 ${Math.max(15, 22 * s)}px ${CONFIG.HUD_FONT}`;
      ctx.fillText(`Wave reached: ${g.wave}   Time: ${g.gameTime.toFixed(1)}s`, g.width / 2, g.height / 2 + 10 * s);
      ctx.textAlign   = "left";
    }

    ctx.restore();
  }

  /**
   * Helper: fill a rectangle with rounded corners (without Path2D for compat).
   */
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
// SECTION 9 — GAME (Core Engine)
// Owns the game loop, entity lists, pools, camera shake, and wave logic.
// All other classes receive a reference to Game and call back into it.
// =============================================================================
class Game {
  constructor() {
    // ── Canvas & context ───────────────────────────────────────────────────
    this.canvas = document.getElementById("gameCanvas");
    this.ctx    = this.canvas.getContext("2d");

    // ── Subsystems ─────────────────────────────────────────────────────────
    this.input = new InputManager();
    this.ui    = new UIManager(this);

    // ── Object Pools (pre-warmed at construction) ──────────────────────────
    this.bulletPool   = new ObjectPool(Bullet,   CONFIG.POOL_BULLETS);
    this.particlePool = new ObjectPool(Particle, CONFIG.POOL_PARTICLES);

    // ── Camera shake state ─────────────────────────────────────────────────
    // Magnitude is reduced each frame via exponential decay + sine smoothing
    this.cameraShake    = 0;
    this._shakeTime     = 0;  // accumulated time used for sine oscillation

    // ── Initialise canvas size ─────────────────────────────────────────────
    this._resize();
    window.addEventListener("resize", () => this._resize());

    // Bind the loop so `this` is correct inside rAF callbacks
    this._loop = this._loop.bind(this);
  }

  // ── Canvas resize ──────────────────────────────────────────────────────────

  _resize() {
    this.width  = this.canvas.width  = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;

    // uiScale keeps HUD proportional: 1.0 at 800×600, scales with resolution
    this.uiScale = Utils.clamp(
      Math.min(this.width / 800, this.height / 600),
      0.7, 2.0
    );
    document.documentElement.style.setProperty("--ui-scale", this.uiScale);
  }

  // ── Start / restart ────────────────────────────────────────────────────────

  /** Initialise (or reinitialise) all game state and kick off the loop. */
  start() {
    // Entity lists
    this.player    = new Player(this);
    this.enemies   = [];
    this.bullets   = [];
    this.particles = [];
    this.walls     = [];
    this.powerups  = [];

    // Game counters
    this.wave      = 1;
    this.kills     = 0;
    this.gameTime  = 0;
    this.isPaused  = false;
    this.lastTime  = performance.now();

    // Camera
    this.cameraShake = 0;
    this._shakeTime  = 0;

    // Spawn the first wave environment
    this._spawnWalls();
    for (let i = 0; i < 2; i++) this._spawnEnemy();

    requestAnimationFrame(this._loop);
  }

  // ── Game Loop ──────────────────────────────────────────────────────────────

  /**
   * Core rAF callback.
   * Computes dt, caps it to prevent physics tunnelling on tab-return,
   * runs update and draw, then schedules the next frame.
   *
   * @param {DOMHighResTimeStamp} now — provided by the browser
   */
  _loop(now) {
    // Delta time in seconds
    let dt = (now - this.lastTime) / 1000;
    // Cap at 100 ms (10 fps minimum equivalent) to prevent huge physics steps
    // when the tab is hidden or the frame takes too long
    if (dt > 0.1) dt = 0.1;
    this.lastTime = now;

    if (!this.isPaused && this.player.alive) {
      this._update(dt);
    }

    this._draw();

    // Keep looping while the player is alive OR particles are still visible
    if (this.player.alive || this.particles.length > 0) {
      requestAnimationFrame(this._loop);
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  _update(dt) {
    this.gameTime += dt;

    // ESC toggles pause
    if (this.input.keys["escape"]) {
      this.input.keys["escape"] = false;
      this.isPaused = !this.isPaused;
    }

    // ── Player ──────────────────────────────────────────────────────────────
    this.player.update(dt, this.input);

    // ── Enemies ─────────────────────────────────────────────────────────────
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this.player);
      // hp check here catches exploder suicide (hp zeroed inside update)
      if (e.hp <= 0) {
        this._handleEnemyDeath(e, i);
      }
    }

    // ── Bullets ─────────────────────────────────────────────────────────────
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);

      let hit = false;

      // ── Wall hit ──────────────────────────────────────────────────────────
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

      // ── Entity hit ────────────────────────────────────────────────────────
      if (!hit) {
        if (b.isEnemy) {
          // Enemy bullet → test against player
          const dSq = Utils.distSq(b.x, b.y, this.player.x, this.player.y);
          if (dSq < (b.size + this.player.size) ** 2) {
            if (this.player.buffs.shield <= 0) {
              this.player.health -= b.damage;
              this.cameraShake = Math.max(this.cameraShake, 5);
            }
            hit = true;
            if (this.player.health <= 0) {
              this.player.alive = false;
              this.ui.showGameOver();
            }
          }
        } else {
          // Player bullet → test against each enemy
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const e   = this.enemies[j];
            const dSq = Utils.distSq(b.x, b.y, e.x, e.y);

            if (dSq < (b.size + e.size) ** 2) {
              e.hp  -= b.damage;
              hit    = true;

              // Lifesteal: restore a % of damage dealt as HP
              if (this.player.lifesteal > 0) {
                this.player.health = Math.min(
                  this.player.maxHealth,
                  this.player.health + b.damage * this.player.lifesteal
                );
              }
              if (e.hp <= 0) this._handleEnemyDeath(e, j);
              break; // Each bullet hits only one enemy
            }
          }
        }
      }

      // ── Out-of-bounds check ───────────────────────────────────────────────
      if (!hit && (b.x < -80 || b.x > this.width + 80 || b.y < -80 || b.y > this.height + 80)) {
        hit = true;
      }

      // ── Recycle bullet ────────────────────────────────────────────────────
      if (hit) {
        this.bulletPool.release(b);
        Utils.removeFast(this.bullets, i);
      }
    }

    // ── Powerups ────────────────────────────────────────────────────────────
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      if (Utils.distSq(this.player.x, this.player.y, pu.x, pu.y) < (this.player.size + pu.size) ** 2) {
        this._applyPowerup(pu.type);
        this.spawnParticles(pu.x, pu.y, pu.color, 20);
        Utils.removeFast(this.powerups, i);
      }
    }

    // ── Particles ───────────────────────────────────────────────────────────
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.life <= 0) {
        this.particlePool.release(p);
        Utils.removeFast(this.particles, i);
      }
    }

    // ── Wave progression ─────────────────────────────────────────────────────
    if (this.enemies.length === 0 && this.kills >= this.wave) {
      this.kills = 0;
      this.wave++;
      this.cameraShake = Math.max(this.cameraShake, CONFIG.SHAKE_MAX);

      const toSpawn = Math.min(30, 2 + this.wave);
      for (let k = 0; k < toSpawn; k++) this._spawnEnemy();
      // Refresh the arena layout every 3 waves
      if (this.wave % 3 === 0) this._spawnWalls();
    }

    // ── Camera shake decay ───────────────────────────────────────────────────
    // Exponential decay driven by SHAKE_DECAY: shake *= e^(-k*dt)
    if (this.cameraShake > 0) {
      this._shakeTime += dt;
      this.cameraShake *= Math.exp(-CONFIG.SHAKE_DECAY * dt);
      if (this.cameraShake < 0.05) {
        this.cameraShake = 0;
        this._shakeTime  = 0;
      }
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;

    // Clear with a slight trail effect — fully opaque fill ensures clean frame
    ctx.fillStyle = "#050810";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();

    // ── Sine-wave camera shake ────────────────────────────────────────────
    // Oscillates along a sine curve at SHAKE_FREQ Hz for smooth displacement
    // instead of random jitter, which feels disorienting.
    if (this.cameraShake > 0.05) {
      const ox = Math.sin(this._shakeTime * CONFIG.SHAKE_FREQ * Math.PI * 2)        * this.cameraShake;
      const oy = Math.sin(this._shakeTime * CONFIG.SHAKE_FREQ * Math.PI * 2 + 1.5)  * this.cameraShake;
      ctx.translate(ox, oy);
    }

    // ── Walls ─────────────────────────────────────────────────────────────
    this.walls.forEach(w => {
      // Base fill
      ctx.fillStyle = CONFIG.WALL_COLOR;
      ctx.shadowBlur  = 6;
      ctx.shadowColor = "rgba(0,229,255,0.2)";
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.shadowBlur  = 0;

      // Health bar on top of wall
      const hpR = Utils.clamp(w.hp / w.maxHp, 0, 1);
      ctx.fillStyle = CONFIG.WALL_HP_COLOR;
      ctx.fillRect(w.x, w.y - 9, w.w, 4);
      ctx.fillStyle = CONFIG.WALL_HP_GOOD_COLOR;
      ctx.fillRect(w.x, w.y - 9, w.w * hpR, 4);
    });

    // ── Powerups (pulsing glow) ───────────────────────────────────────────
    this.powerups.forEach(pu => {
      const pulse = Math.sin(this.gameTime * 5) * 2;
      ctx.save();
      ctx.shadowBlur  = 18;
      ctx.shadowColor = pu.color;
      ctx.fillStyle   = pu.color;
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, pu.size + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // ── Particles (behind everything else) ───────────────────────────────
    this.particles.forEach(p => p.draw(ctx));

    // ── Bullets ──────────────────────────────────────────────────────────
    this.bullets.forEach(b => b.draw(ctx));

    // ── Enemies ──────────────────────────────────────────────────────────
    this.enemies.forEach(e => e.draw(ctx));

    // ── Player ───────────────────────────────────────────────────────────
    this.player.draw(ctx, this.input);

    ctx.restore(); // pop camera shake transform

    // ── HUD (drawn outside the shake transform — HUD never shakes) ───────
    this.ui.drawHUD(ctx);
  }

  // ── Spawning helpers ───────────────────────────────────────────────────────

  /** Spawn a new enemy at a random edge of the arena. */
  _spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    const ex   = side === 0 ? 0
               : side === 1 ? this.width
               : Math.random() * this.width;
    const ey   = side === 2 ? 0
               : side === 3 ? this.height
               : Math.random() * this.height;

    // waveFactor drives hp/damage scaling; capped with log to avoid runaway
    const waveFactor = Math.max(1, Math.log(this.wave + 1)) * CONFIG.WAVE_MULTIPLIER;

    const r    = Math.random();
    const type = r < 0.15 ? "tank"
               : r < 0.30 ? "fast"
               : r < 0.45 ? "spread"
               : r < 0.60 ? "exploder"
               : "normal";

    this.enemies.push(new Enemy(this, ex, ey, type, waveFactor));
  }

  /** Scatter destructible cover walls across the arena. */
  _spawnWalls() {
    this.walls = [];
    const count = Math.floor(Math.random() * 6) + 5;
    for (let i = 0; i < count; i++) {
      const w = 100 + Math.random() * 110;
      const h = 18  + Math.random() * 28;
      const maxHp = 10;
      this.walls.push({
        x: Math.random() * (this.width  - w - 40) + 20,
        y: Math.random() * (this.height - h - 40) + 20,
        w,
        h,
        hp: Math.floor(Math.random() * 5) + 3,
        maxHp,
      });
    }
  }

  /**
   * Emit a burst of particles at a world position.
   * @param {number} x, y   — emission point
   * @param {string} color  — particle colour
   * @param {number} count  — how many to emit
   */
  spawnParticles(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 0.8;
      const p     = this.particlePool.get();
      p.init(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color,
        Math.random() * 4 + 1.5,    // size
        Math.random() * 0.5 + 0.4   // lifetime
      );
      this.particles.push(p);
    }
  }

  /**
   * Return the first wall that overlaps the given circle, or null.
   * Used by Player, Enemy, and bullet update for obstruction checks.
   *
   * @param {number} x, y  — circle centre
   * @param {number} size  — circle radius
   * @returns {Object|null}
   */
  checkWallCollision(x, y, size) {
    for (const w of this.walls) {
      if (Utils.circleRect(x, y, size, w.x, w.y, w.w, w.h)) return w;
    }
    return null;
  }

  // ── Enemy death / powerup logic ────────────────────────────────────────────

  /**
   * Award XP, maybe drop a powerup, spawn death particles, and remove the
   * enemy from the active list.
   *
   * @param {Enemy}  enemy
   * @param {number} index — index in this.enemies
   */
  _handleEnemyDeath(enemy, index) {
    // 20 % chance to drop a powerup
    if (Math.random() < 0.2) {
      const types = CONFIG.POWERUP_TYPES;
      const type  = types[Math.floor(Math.random() * types.length)];
      this.powerups.push({
        x:     enemy.x,
        y:     enemy.y,
        type,
        size:  12 * this.uiScale,
        color: CONFIG.POWERUP_COLORS[type],
      });
    }

    this.kills++;
    this.player.addXP(10 + Math.floor(Math.log2(this.wave + 1)) * 2);
    this.spawnParticles(enemy.x, enemy.y, enemy.color, 22);
    Utils.removeFast(this.enemies, index);
  }

  /**
   * Apply the effect of a collected powerup to the player.
   * @param {string} type — one of CONFIG.POWERUP_TYPES
   */
  _applyPowerup(type) {
    switch (type) {
      case "health":
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 35);
        break;
      case "xp":
        this.player.addXP(30);
        break;
      case "shield":
        this.player.buffs.shield     = 10;
        break;
      case "triple_shot":
        this.player.buffs.tripleShot = 8;
        break;
      case "speed_boost":
        this.player.buffs.speedBoost = 7;
        break;
      case "rage":
        this.player.buffs.rage       = 5;
        break;
      default:
        console.warn(`Unknown powerup type: ${type}`);
    }
  }
}


// =============================================================================
// SECTION 10 — BOOTSTRAP
// =============================================================================
window.addEventListener("load", () => {
  const game = new Game();

  // Expose to browser console for debugging (e.g., window.kGame.wave)
  // Safe to remove in production.
  window.kGame = game;
});