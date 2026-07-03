<div align="center">

# 🛸 KritikShoot
**Neon-Noir Survival Shooter**

[![Play Live](https://img.shields.io/badge/Play-Live_Demo-00e5ff?style=for-the-badge&logo=googlechrome&logoColor=white)](https://leaguestar.github.io/KritikShoot/)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)]()
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-e34f26?style=for-the-badge&logo=html5&logoColor=white)]()
[![Web Audio API](https://img.shields.io/badge/Web_Audio-Procedural-9b59b6?style=for-the-badge&logo=webaudio&logoColor=white)]()

*A lightning-fast, highly optimized top-down arena shooter built entirely from scratch without external libraries, game engines, or image assets.*

</div>

## 🌌 Overview

**KritikShoot** is a high-octane survival game featuring a sleek "Neon-Noir / Cyberpunk" aesthetic. You pilot a sharp, swept-back delta-wing fighter, battling relentless swarms of neon geometric enemies. Built purely on vanilla web technologies, it features dynamic wave generation, deep in-run powerups, a persistent meta-progression economy, and intense boss encounters.

---

## 🛠️ Core Engine Architecture & Micro-Optimizations

The engine is engineered for flawless high-Hz performance, implementing advanced game development patterns natively in JavaScript:

* **Fixed-Step Physics with Temporal Interpolation:** The game loop uses an accumulator to decouple physics logic (fixed at 60Hz) from the render loop. Entities cache their previous positions, and rendering uses linear interpolation (`lerp`), eliminating micro-stutters and ensuring smooth movement on 120Hz/144Hz displays.
* **Dead-Flag Object Pooling & Compaction:** Bullets, particles, and floating damage numbers are managed via custom object pools to prevent garbage collection pauses. Instead of using expensive `Array.splice()`, dead entities are flagged and skipped during rendering. When dead slots exceed a 35% threshold, the array undergoes a lightning-fast bulk compaction.
* **Spatial Hash Grid Collisions:** Swept-circle continuous collision detection (CCD) is optimized through a custom Spatial Hash Grid. This includes a dedicated broad-phase `wallHash` for environment boundaries, allowing for massive enemy swarms and bullet counts without tanking frame rates.
* **O(1) Circular Buffer Trails:** Entity neon trails are managed using a pre-allocated ring buffer with modulo indexing, replacing costly `Array.shift()` array copy operations with `O(1)` pointer advancements.
* **LRU Glow Sprite Cache:** Canvas-drawn radial gradients (neon glows) are expensive. The `GlowCache` dynamically renders and caches sprites based on color and size, utilizing an auto-evicting 128-entry LRU (Least Recently Used) cache to prevent unbound memory growth.
* **Finite State Machine (FSM):** Clean architectural transitions between `MENU`, `PLAYING`, `PAUSED`, `LEVEL_UP`, `WAVE_TRANSITION`, and `GAME_OVER` states.
* **State & Concurrency Safety:** Entities like Enemies and Bosses utilize strict `alive` boolean flags to prevent simultaneous double-death triggers during concurrent collision and update loops.
* **Fault-Tolerant Storage:** All `localStorage` interactions are guarded by `try/catch` blocks.[cite: 1] This ensures the game will not crash if browser storage quotas are exceeded or if strict privacy modes block local storage access.[cite: 1]

---

## 🎮 Gameplay Systems

### Dynamic Wave Budgeting
Instead of random spawning, the game uses a **Threat Budget System**. 
* The budget increases dynamically: `Math.min(60, 8 + wave * 3)`.
* Enemies have designated "costs" and "unlock waves".
* The engine dynamically purchases enemies from the unlocked bestiary until the wave budget is exhausted, ensuring a balanced, escalating difficulty curve.
* A dedicated Boss pre-warning indicator ("⚠ BOSS INCOMING") alerts players during the inter-wave countdown immediately preceding a boss wave.

### Line-of-Sight (LoS) AI & Flocking
* Ranged enemies and Bosses utilize Liang–Barsky parametric clipping raycasts to check Line-of-Sight against the environment. They will hold their fire if a wall or crate is blocking the player.
* Enemies utilize Boids-style separation forces to naturally swarm without overlapping into a single point.

### Environment & Destructibility
* **Destructible Walls:** Procedurally generated rectangular blocks with integrated HP bars that can be destroyed to open up the arena.
* **Indestructible Crates & Pillars:** Solid metallic crates and glowing neon pillars provide permanent cover for LoS breaking.
* **Combat Feedback:** Enemies dynamically display floating 4px inline health bars when damaged, providing clear combat feedback without cluttering the UI.

---

## ⚔️ Arsenal & Progression

### Weapons (Cycle with `E` / `Shift`)
1. **Default Gun:** High fire-rate, reliable single-target damage.
2. **Shotgun (Spread):** Fires a dense 6-pellet burst in a 40° cone. Perfect for close-quarters crowd control. Total DPS output is mathematically balanced to match laser efficiency at mid-range (~1.9x base damage).
3. **Piercing Laser:** Fires a high-velocity, high-damage cyan bolt that penetrates up to 4 enemies before dissipating.

### In-Run Leveling & Powerups
Defeating enemies grants XP. Leveling up pauses the game and allows you to choose one of the following stackable session upgrades:
* ⚡ Move Speed | ❤ Max Health | 💥 Damage | 🔥 Fire Rate | 🚀 Bullet Speed | 🎯 Crit Chance | 🩸 Lifesteal

Enemies have a 20% chance to drop temporary timed buffs:
* **Health (Pink):** Instant +35 HP heal.
* **XP (Yellow):** Instant +30 XP boost.
* **Shield (Cyan):** 10-second invulnerability aura.
* **Triple Shot (Orange):** 8-second 3-way spread for the default gun.
* **Speed Boost (Green):** 7-second massive speed overdrive.
* **Rage (Red):** 5-second double-damage multiplier.

### 🪙 Persistent Meta-Progression (Local Storage)
Coins are earned based on wave completion and survival time (`wave * 10 + floor(gameTime / 5)`). Visit the **Upgrade Depot** in the main menu to purchase permanent, multi-tiered upgrades that persist between sessions:
* ⚡ Fire Rate (+5% per tier)
* ❤ Max HP (+25 per tier)
* 💥 Damage (+5 per tier)
* 🏃 Move Speed (+15 per tier)
* 🚀 Bullet Speed (+40 per tier)

---

## 👾 Enemy Bestiary

Prepare to face a diverse swarm of glowing geometric threats:

| Type | Aesthetic | Behavior |
| :--- | :--- | :--- |
| **Normal** | 🟢 Green Square | Standard rusher, balanced HP and speed. |
| **Rusher** | 🔴 Red Triangle | Fragile but incredibly fast. Melee damage only. |
| **Fast** | 🟡 Yellow Triangle | Agile hit-and-run flanker. |
| **Ranged** | 🌐 Cyan Octagon | Technological sniper. Maintains a 260px distance, uses LoS raycasting, and randomly assigns CW/CCW orbital strafing directions upon spawning. |
| **Spread** | 🟣 Purple Pentagon | Fires a deadly 3-way bullet spread. |
| **Exploder**| 🟠 Orange Square | Detonates on proximity, causing massive AoE damage and intense screen shake. |
| **Tank** | 🔵 Blue Hexagon | Massive, slow-moving behemoth with 250% base HP. |

### ☠️ Boss Encounters
Every 5th wave halts standard spawning and summons a **Boss**.
* Takes 50% reduced damage from all player attacks.
* **Phase 1: Radial Hell:** Fires expanding, interleaved rings of bullets (bullet-hell style).
* **Phase 2: Rest & Volley:** Pauses, tracking the player with a targeted 3-round burst if LoS is clear.
* **Phase 3: Charge Dash:** Telegraphs by flashing gold for 1.2s, then executes a hyper-speed, high-damage dash at the player's last known location.

---

## 🎵 Procedural Audio Engine

**Zero audio files are loaded.** 100% of the game's sound is synthesized in real-time using the Web Audio API (`OscillatorNode`, `BiquadFilterNode`, `GainNode`):
* **Pew:** Rapid descending square wave chirp.
* **Boom (Hit):** Deep sine sub-bass thud layered with a white noise crackle.
* **Crunch (Death):** Band-pass filtered noise burst.
* **Laser:** Sawtooth wave with rapid frequency modulation.
* **Thwump (Spread):** Two slightly detuned triangle/sine oscillators creating a chunky shotgun feel.
* **Audio Engine Polish:** The engine utilizes `linearRampToValueAtTime` for volume decay, effectively eliminating harsh audio clicking or popping artifacts.[cite: 1] The audio system also features a fully functional mute toggle that safely bypasses oscillator generation.[cite: 1]
* *Note: The engine includes automated `GainNode` garbage collection via `onended` hooks to prevent memory leaks.*

---

## ⌨️ Controls & Input Management

The `InputManager` supports simultaneous, sub-tick buffered inputs across all device types. State-safe input flags are unconditionally read and cleared every frame.[cite: 1] This logic prevents stale inputs (like weapon cycling) from silently triggering when returning from paused or leveling states.[cite: 1]

### Desktop
* **Move:** `W`, `A`, `S`, `D` or `Arrow Keys`
* **Aim & Fire:** `Mouse Cursor` & `Left Click`
* **Cycle Weapon:** `E` or `Shift`
* **Pause:** `ESC`
* **Quit (While Paused):** `Q`

### Mobile (Touch)
* **Move:** Left-side Dynamic Virtual Joystick (Normalized [-1,1] vectoring).
* **Aim:** Right-side Touch & Drag (Dual-Touch support).
* **Fire:** Auto-fires while joystick is active, or use the on-screen `FIRE` button.

---

## 🎨 UI/UX & Design System

* **Glassmorphism:** Overlays, menus, and the Shop utilize deep blur backdrops (`backdrop-filter: blur`) with glowing neon borders.
* **Typography:** `Orbitron` is used for sharp, futuristic display headers, while `Rajdhani` provides highly legible HUD metrics.
* **Dynamic HUD:** Real-time interpolated HP/XP bars, active buff timers, and wave counters are featured on the canvas.[cite: 1] The redundant on-canvas weapon text was removed to maintain the DOM button as the single source of truth for the current weapon.[cite: 1]
* **PWA Ready:** Implements `mobile-web-app-capable` and `apple-mobile-web-app-capable` meta tags.[cite: 2] To improve accessibility, the viewport permits pinch-zooming up to a 3.0 scale (`maximum-scale=3.0`) without breaking the core fixed-canvas layout.[cite: 2]
* **Landscape Optimization:** Features a dedicated media query for landscape mobile devices, dynamically scaling the UI, repositioning virtual joysticks, and ensuring menus remain fully scrollable. 
* **Ergonomic Positioning:** The mobile weapon switch button is situated in the top-right cluster to eliminate visual overlap with the canvas-drawn HUD statistics.[cite: 3]
* **Smart Overlay States:** Non-interactive mobile controls, such as the joystick and fire buttons, elegantly fade out when the game is paused to emphasize the active menu UI.[cite: 1, 3]
* **Run Summary Stats:** The pause menu features a real-time statistical breakdown of the current run, tracking wave count, total kills, time elapsed, and weapon usage metrics.
* **Quit-With-Progress:** Quitting a session mid-run securely banks earned coins and preserves leaderboard data.[cite: 1] This action triggers a lightweight, self-dismissing CSS-animated toast notification to confirm the save without requiring an intrusive modal.[cite: 1, 3]
* **Strict CSS Tokenization:** Replaces hardcoded hex values with a unified set of custom properties (`var(--col-*)`) for seamless theming and rendering consistency.
* **Local Leaderboard:** Saves top 10 unique scores securely to `localStorage`, entirely decoupled from remote backends for absolute privacy and offline play.

---

<div align="center">

## Built with ❤️ by **LeagueStar**

**Happy Shooting! 🚀**

</div>
