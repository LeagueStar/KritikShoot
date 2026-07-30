<div align="center">

# 🩸 KritikShoot
**Crimson-Void Survival Shooter**

[![Play Live](https://img.shields.io/badge/Play-Live_Demo-CD1C18?style=for-the-badge&logo=googlechrome&logoColor=white)](https://leaguestar.github.io/KritikShoot/)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)]()
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-e34f26?style=for-the-badge&logo=html5&logoColor=white)]()
[![Web Audio API](https://img.shields.io/badge/Web_Audio-Procedural-9400D3?style=for-the-badge&logo=webaudio&logoColor=white)]()
[![No Dependencies](https://img.shields.io/badge/Dependencies-Zero-CD1C18?style=for-the-badge)]()

*A lightning-fast, highly optimized top-down arena shooter built entirely from scratch — no external libraries, no game engine, no image assets.*

</div>

---

## 🌌 Overview

**KritikShoot** is a high-octane survival game wrapped in a **crimson-and-violet-on-deep-void** aesthetic — blood-red primaries, electric violet accents, and lavender highlights burning against a near-black backdrop. You pilot a sharp, swept-back delta-wing fighter, battling relentless swarms of neon geometric enemies. Built purely on vanilla web technologies, it features dynamic wave generation, deep in-run progression, a persistent meta-economy, daily seeded challenges, and multi-phase boss encounters — all running at a locked, interpolated 60Hz.

---

## 🛠️ Core Engine Architecture & Micro-Optimizations

The engine is built for flawless high-Hz performance using patterns implemented natively in JavaScript — no framework, no engine:

* **Fixed-Timestep Physics + Temporal Interpolation:** An accumulator decouples physics (locked 60Hz) from the render loop. Every entity caches `prevX`/`prevY` and renders via `lerp`, eliminating micro-stutter on 120Hz/144Hz displays.
* **Swept-Circle CCD Collision:** Fast-moving bullets and entities are resolved with continuous collision detection instead of naive per-frame circle overlap, so nothing tunnels through at high speed.
* **SpatialHash Broad-Phase:** O(N) collision queries via a spatial hash grid with pooled bucket arrays — zero per-tick GC allocation from the collision system.
* **GameFSM State Management:** A finite state machine drives menu, playing, paused, level-up, ascension, and game-over transitions, with fault-tolerant save/resume hooked to tab visibility.
* **GlowCache Pre-Rendering:** Every glow effect is pre-rendered to an offscreen canvas and cached by color/size, eliminating expensive live `shadowBlur` calls entirely.
* **Adaptive Performance Budgeting:** A rolling frame-time watchdog detects `hardwareConcurrency` and struggling hardware, triggering a one-way `lowPowerMode` that halves particle emission and shrinks glow padding without interrupting gameplay.
* **Advanced Memory Pooling & Compaction:** Bullets, particles, and floating damage numbers run through custom object pools. Dead-flagged entities are bulk-compacted rather than spliced one-by-one, and trail buffers use a pre-allocated ring buffer with `O(1)` pointer advancement instead of `Array.shift()`.
* **Batched Rendering Passes:** `ctx.save()` / `restore()` calls are grouped by category to minimize draw-call overhead.

---

## 📱 Full Mobile Parity

KritikShoot isn't a desktop game with touch bolted on — mobile is a first-class target:

* **Device-Aware Rendering:** Detects mobile/low-power hardware and renders to an internally downscaled target with nearest-neighbor blit, keeping frame times smooth without a blurry upscale look.
* **Orientation Lock & Rotate Prompt:** Locks to landscape where supported and shows a rotate prompt if the device is held in portrait.
* **Dynamic Virtual Joystick:** Left-side touch joystick with dead-zone filtering to ignore micro-jitter; right-side drag for aim, with manual touch prioritized over auto-aim fallback.
* **Reduced Particle Budgets & Auto-Aim:** Mobile profiles trim particle counts and offer auto-aim assistance to keep input friendly on a touchscreen.
* **Haptics:** Boss kills, explosions, and heavy hits fire `navigator.vibrate` pulses for tactile feedback.

---

## 🎮 Gameplay Systems

### Dynamic Wave Budgeting & Daily Challenges
Enemies are spawned via a **Threat Budget System** that scales with `Math.min(60, 8 + wave * 3)`, purchasing enemies from an unlocked bestiary until the budget is spent — a smooth, escalating difficulty curve instead of flat random spawns.

* **Daily Challenge Mode:** A seeded run driven by a `Mulberry32` PRNG, keyed to the current UTC date. Includes a rolling daily-history strip and a Wordle-style "Copy Result" clipboard export.

### Environment, Cover & Hazards
* **Line-of-Sight AI:** Ranged enemies and bosses use Liang–Barsky parametric clipping raycasts to check cover before engaging.
* **Environmental Destruction:** From wave 13 onward, the arena targets central cover blocks for destruction on a rolling cadence, with a pulsing HUD warning once cover drops below 30%.
* **Corruption Zones:** From wave 10 onward, defeated bosses leave a spreading, persistent damage-over-time zone that damages both player and enemies alike.

### End-of-Run Sequence
Dying triggers a full multi-stage cinematic: a staged death animation, a physics-driven debris burst, and an animated stats card with count-up scoring, medal tiers, and personal-best detection — backed by a composite score formula that weights combo streaks and kill chains.

---

## ⚔️ Arsenal & Progression

### Weapons (Cycle with `E` / `Shift`)
1. **Default Gun:** High fire-rate, reliable single-target damage.
2. **Shotgun (Spread):** A dense 6-pellet burst in a 40° cone, DPS-balanced against the laser at mid-range.
3. **Piercing Laser:** A high-velocity cyan bolt that punches through up to 4 enemies before dissipating.

### In-Run Leveling
Defeating enemies grants XP. Leveling up pauses the game and offers a stackable upgrade:

⚡ Move Speed · ❤ Max Health · 💥 Damage · 🔥 Fire Rate · 🚀 Bullet Speed · 🎯 Crit Chance · 🩸 Lifesteal

* **Weapon Synergies:** Stack crit chance high enough on the laser to unlock *Piercing Overload*, or lifesteal high enough during a rage buff to trigger *Vampiric Rage*.
* **Ascension Mods (milestone levels):** Weapon-specific augments — *Ricochet Rounds*, *Detonator Pellets*, *Beam Split*, and more — chosen from a dedicated ascension screen.

### 🪙 Persistent Meta-Progression (Local Storage)
Coins earned from wave completion and survival time carry over between runs and unlock permanent upgrades in the **Upgrade Depot**:

⚡ Fire Rate · ❤ Max HP · 💥 Damage · 🏃 Move Speed · 🚀 Bullet Speed · 🛡 Starting Ward · 🧲 Magnetism · 🔫 Loadout Swap

---

## 👾 Enemy Bestiary

| Type | Aesthetic | Behavior |
| :--- | :--- | :--- |
| **Normal** | 🟢 Green Square | Standard rusher, balanced HP and speed. |
| **Rusher** | 🔴 Red Triangle | Fragile but incredibly fast; proximity-based melee. |
| **Fast** | 🟡 Yellow Triangle | Agile hit-and-run flanker. |
| **Ranged** | 🌐 Cyan Octagon | Holds distance, uses LoS raycasting, orbital strafing. |
| **Spread** | 🟣 Purple Pentagon | Fires a deadly 3-way bullet spread. |
| **Exploder** | 🟠 Orange Square | Detonates on proximity — massive AoE and screen shake. |
| **Tank** | 🔵 Blue Hexagon | Slow behemoth with 250% base HP and heavy melee. |

### ☠️ Boss Encounters
Every 5th wave halts standard spawning for a three-phase boss fight:

* **Phase 1 — Radial Hell:** Expanding, interleaved rings of bullets.
* **Phase 2 — Rest & Volley:** Tracks the player with a targeted 3-round burst.
* **Phase 3 — Charge Dash:** Telegraphed flash, then a hyper-speed dash to the player's last known position.

---

## 🎵 Procedural Audio & Haptics

**Zero audio files.** All sound is synthesized live via the Web Audio API (`OscillatorNode`, `BiquadFilterNode`, `GainNode`):

* **Dynamic Ambient Bed:** Detuned drones with a slow breathing LFO that scales with wave progress and enemy density.
* **SFX Jitter:** Randomized frequency sweeps on hit/shoot SFX to avoid auditory fatigue.
* **Hit-Stop:** Boss deaths and heavy explosions briefly freeze the physics accumulator and thud the camera, paired with mobile vibration.

---

## ⌨️ Controls

### Desktop
| Action | Key |
| :--- | :--- |
| Move | `W` `A` `S` `D` |
| Aim | `Mouse` or `Arrow Keys` (arrows override mouse while held) |
| Fire | `Left Click` or `Space` |
| Switch Weapon | `E` or `Shift` |
| Pause | `Esc` |
| Quit to Menu | `Q` (while paused) |

### Mobile
| Action | Control |
| :--- | :--- |
| Move | Left-side virtual joystick |
| Aim | Right-side touch & drag |
| Fire | `FIRE` button (or auto-fire while moving) |
| Switch Weapon | Weapon button |
| Pause | `⏸` |
| Quit to Menu | `⌂` (while paused) |

---

## 🎨 Design System & Accessibility

**Palette — Crimson & Violet on Deep Void**

| Token | Swatch | Hex |
| :--- | :--- | :--- |
| Void Background | ⬛ | `#14040D` |
| Panel Surface | 🟪 | `#2A0A1C` |
| Primary (Crimson) | 🟥 | `#CD1C18` |
| Primary Deep | 🟥 | `#9B1313` |
| Accent Violet | 🟣 | `#9400D3` |
| Accent Magenta | 🩷 | `#ED80E9` |
| Text Highlight | ⬜ | `#D3D3FF` |
| Warm Glow | 🟧 | `#FFA896` |

The primary crimson runs low-contrast on the void background by design, so interactive labels default to white/highlight text rather than color-on-color for readability.

**Accessibility Settings (dedicated in-game panel):**
* 🎚 **Screen Shake Intensity** — adjustable slider, independent of reduced-motion.
* 🔠 **HUD Text Scale** — Normal / Large / X-Large.
* ▲ **Shape-Only Enemy ID** — thicker, high-contrast outlines so enemy type reads from silhouette, not just color.
* 🎨 **Colorblind-Safe Palette** — deuteranopia/protanopia-safe remap for enemies and health bars.
* **Reduced Motion Compliance** — hooks `prefers-reduced-motion` to automatically dampen shake, particles, and hit-stop flashes.

**Other UI touches:**
* Glassmorphism overlays with `backdrop-filter: blur` and glowing borders throughout menus and the shop.
* Colorblind-friendly powerup glyphs (✚ Health, ✦ XP, ◈ Shield) layered over neon glows, independent of color.
* Responsive docking — floating panels like the Coin Shop reparent into normal document flow on small/landscape viewports.
* Zero-cost dev HUD — backtick (`` ` ``) toggles a frametime/entity-count overlay, fully stripped from the loop when off.

---

<div align="center">

## Built with 🩸 by **LeagueStar**

**Happy Shooting! 🚀**

</div>
