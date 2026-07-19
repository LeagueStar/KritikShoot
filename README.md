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

**KritikShoot** is a high-octane survival game featuring a sleek "Neon-Noir / Cyberpunk" aesthetic. You pilot a sharp, swept-back delta-wing fighter, battling relentless swarms of neon geometric enemies. Built purely on vanilla web technologies, it features dynamic wave generation, deep in-run powerups, a persistent meta-progression economy, daily challenges, and intense boss encounters.<!--[cite: 1, 2] -->

---

## 🛠️ Core Engine Architecture & Micro-Optimizations

The engine is engineered for flawless high-Hz performance, implementing advanced game development patterns natively in JavaScript:

* **Fixed-Step Physics with Temporal Interpolation:** The game loop uses an accumulator to decouple physics logic (fixed at 60Hz) from the render loop.<!--[cite: 1] --> Entities cache their previous positions, and rendering uses linear interpolation (`lerp`), eliminating micro-stutters and ensuring smooth movement on 120Hz/144Hz displays.<!--[cite: 1] -->
* **Decoupled System Architecture:** Uses a lightweight `EventBus` to prevent tight coupling between the UI manager and the core game loop, and extracts spawning/combat logic into standalone `WaveSystem` and `CombatSystem` classes.<!--[cite: 1] -->
* **Adaptive Performance Budgeting:** Actively monitors frame-times via a rolling watchdog and detects hardware concurrency.<!--[cite: 1] --> If the device struggles, a one-way `lowPowerMode` seamlessly halves particle emissions and downscales glow resolution without interrupting gameplay.<!--[cite: 1] -->
* **Advanced Memory Pooling & Compaction:** Bullets, particles, and floating damage numbers are managed via custom object pools.<!--[cite: 1] --> The SpatialHash grid now pools its bucket arrays to eliminate per-tick GC allocation overhead.<!--[cite: 1] --> When dead slots in entity arrays exceed 35%, a lightning-fast bulk compaction replaces expensive `Array.splice()` operations.<!--[cite: 1] -->
* **O(1) Circular Buffer Trails:** Entity neon trails are managed using a pre-allocated ring buffer with modulo indexing, replacing costly `Array.shift()` array copy operations with `O(1)` pointer advancements.<!--[cite: 1] -->
* **Batched Rendering Passes:** Canvas state changes (`ctx.save()` / `restore()`) are batched by category (e.g., grouping all critical hit numbers together) to drastically reduce draw call overhead.<!--[cite: 1] -->
* **Fault-Tolerant Storage & Save States:** Features a robust mid-run save/resume system hooked to tab visibility, capable of safely restoring precise finite state machine phases (including mid-level-up screens).<!--[cite: 1] -->

---

## 🎮 Gameplay Systems

### Dynamic Wave Budgeting & Daily Challenges
Instead of random spawning, the game uses a **Threat Budget System** that increases dynamically: `Math.min(60, 8 + wave * 3)`.<!--[cite: 1] -->
* The engine purchases enemies from an unlocked bestiary until the budget is exhausted, ensuring a balanced, escalating difficulty curve.<!--[cite: 1] -->
* **Daily Challenge Mode:** Players can toggle a daily seeded run driven by a `Mulberry32` PRNG.<!--[cite: 1, 2] --> Includes a rolling 30-day streak tracker and a Wordle-style "Copy Result" clipboard feature.<!--[cite: 1, 2] -->

### Environment, Cover & Hazards
* **Line-of-Sight (LoS) AI:** Ranged enemies and Bosses utilize Liang–Barsky parametric clipping raycasts to check LoS against cover.<!--[cite: 1] -->
* **Environmental Destruction:** Starting at wave 13, the arena dynamically targets central cover blocks for destruction on a 3-wave cadence, forcing players to adapt as cover degrades.<!--[cite: 1] --> A pulsing HUD warning alerts players when arena cover drops below 30%.<!--[cite: 1] -->
* **Corruption Zones:** From wave 10 onward, defeated bosses leave behind a spreading, persistent Damage-over-Time (DoT) zone of dark purple corruption that damages both players and enemies.<!--[cite: 1] -->

---

## ⚔️ Arsenal & Progression

### Weapons (Cycle with `E` / `Shift`)
1. **Default Gun:** High fire-rate, reliable single-target damage.<!--[cite: 1] -->
2. **Shotgun (Spread):** Fires a dense 6-pellet burst in a 40° cone. Total DPS output is mathematically balanced to match laser efficiency at mid-range.<!--[cite: 1] -->
3. **Piercing Laser:** Fires a high-velocity cyan bolt that penetrates up to 4 enemies before dissipating.<!--[cite: 1] -->

### In-Run Leveling & Build-Defining Mods
Defeating enemies grants XP.<!--[cite: 1] --> Leveling up pauses the game and offers stackable session upgrades:
* **Standard Upgrades:** ⚡ Move Speed | ❤ Max Health | 💥 Damage | 🔥 Fire Rate | 🚀 Bullet Speed | 🎯 Crit Chance | 🩸 Lifesteal<!--[cite: 2] -->
* **Build Mods (Level 3+):** Run-altering tradeoffs, such as *Glass Cannon Core* (+40% damage, -25% max HP), *Kinetic Overload* (non-crits ricochet into nearby enemies, -5% crit chance), or *Corrosive Rounds* (kills trigger corruption pulses, -10% damage).<!--[cite: 1] -->
* **Ascension Mods (Levels 10/20/30):** Weapon-specific augments like *Ricochet Rounds*, *Detonator Pellets*, or *Beam Split*.<!--[cite: 1, 2] -->

### 🪙 Persistent Meta-Progression (Local Storage)
Coins are earned based on wave completion and survival time.<!--[cite: 1] --> Visit the **Upgrade Depot** to purchase multi-tiered, permanent upgrades:<!--[cite: 1] -->
* ⚡ Fire Rate | ❤ Max HP | 💥 Damage | 🏃 Move Speed | 🚀 Bullet Speed<!--[cite: 1] -->
* 🛡 **Starting Ward** (Spawn with a temporary shield)<!--[cite: 1] -->
* 🧲 **Magnetism** (Increased powerup pull radius)<!--[cite: 1] -->
* 🔫 **Loadout Swap** (Permanently spawn with the Shotgun equipped)<!--[cite: 1] -->

---

## 👾 Enemy Bestiary

| Type | Aesthetic | Behavior |
| :--- | :--- | :--- |
| **Normal** | 🟢 Green Square | Standard rusher, balanced HP and speed.<!--[cite: 1] --> |
| **Rusher** | 🔴 Red Triangle | Fragile but incredibly fast. Uses primitive proximity checks for direct melee damage.<!--[cite: 1] --> |
| **Fast** | 🟡 Yellow Triangle | Agile hit-and-run flanker.<!--[cite: 1] --> |
| **Ranged** | 🌐 Cyan Octagon | Technological sniper. Maintains a 260px distance, uses LoS raycasting, and randomly assigns CW/CCW orbital strafing directions.<!--[cite: 1] --> |
| **Spread** | 🟣 Purple Pentagon | Fires a deadly 3-way bullet spread.<!--[cite: 1] --> |
| **Exploder**| 🟠 Orange Square | Detonates on proximity, causing massive AoE damage and intense screen shake.<!--[cite: 1] --> |
| **Tank** | 🔵 Blue Hexagon | Massive, slow-moving behemoth with 250% base HP and a heavy melee attack.<!--[cite: 1] --> |

### ☠️ Boss Encounters
Every 5th wave halts standard spawning and summons a **Boss**.<!--[cite: 1] -->
* **Phase 1: Radial Hell:** Fires expanding, interleaved rings of bullets.<!--[cite: 1] -->
* **Phase 2: Rest & Volley:** Pauses, tracking the player with a targeted 3-round burst.<!--[cite: 1] -->
* **Phase 3: Charge Dash:** Telegraphs by flashing, then executes a hyper-speed dash at the player's last known location.<!--[cite: 1] -->

---

## 🎵 Procedural Audio & Haptics Engine

**Zero audio files are loaded.** 100% of the game's sound is synthesized in real-time using the Web Audio API (`OscillatorNode`, `BiquadFilterNode`, `GainNode`):<!--[cite: 1] -->
* **Dynamic Ambient Bed:** A procedural background track featuring detuned sine/triangle drones and a slow breathing LFO that dynamically scales intensity based on wave progress and enemy density.<!--[cite: 1] -->
* **SFX Jitter:** Hit and shooting SFX employ randomized frequency sweeps to ensure every impact feels distinct and avoids auditory fatigue.<!--[cite: 1] -->
* **Hit-Stop & Haptics:** Boss deaths and heavy explosions freeze the physics accumulator for a few frames (Hit-stop), add low-frequency camera thuds, and trigger mobile device vibrations (`navigator.vibrate`) for intense tactile feedback.<!--[cite: 1] -->

---

## ⌨️ Controls & Input Management

The `InputManager` supports simultaneous, sub-tick buffered inputs. State-safe input flags are unconditionally read and cleared every frame, ensuring seamless FSM transitions.<!--[cite: 1] -->

### Desktop (Dual-Stick Parity)
* **Move:** `W`, `A`, `S`, `D`<!--[cite: 2] -->
* **Aim:** `Mouse Cursor` OR `Arrow Keys` (Arrow keys automatically override the mouse for true dual-stick keyboard play).<!--[cite: 1, 2] -->
* **Fire:** `Left Click` or `Spacebar`<!--[cite: 1, 2] -->
* **Cycle Weapon:** `E` or `Shift`<!--[cite: 2] -->
* **Pause / Quit:** `ESC` to pause, `Q` to quit to menu.<!--[cite: 2] -->

### Mobile (Touch)
* **Move:** Left-side Dynamic Virtual Joystick (ignores inner dead-zone micro-jitters).<!--[cite: 1, 2] -->
* **Aim & Fire:** Right-side Touch & Drag (prioritizes manual touch inputs over auto-aim fallbacks).<!--[cite: 1, 2] --> Auto-fires while the joystick is active, or via the on-screen `FIRE` button.<!--[cite: 1, 2] -->

---

## 🎨 UI/UX, Design System, & Accessibility

* **Robust Accessibility Options:** Players can toggle high-contrast "Shape-Only ID" outlines for enemies, manually scale all HUD/DOM text in three steps, and adjust screen shake intensity via a dedicated settings modal.<!--[cite: 1, 2, 3] -->
* **Reduced Motion Compliance:** Seamlessly hooks into OS-level `@media (prefers-reduced-motion)` preferences to automatically dampen screen shake, reduce particle emissions, and scale down hit-stop flashes.<!--[cite: 1, 3] -->
* **Colorblind-Friendly Powerups:** All drops feature distinct Unicode glyphs (e.g., ✚ for Health, ✦ for XP, ◈ for Shield) layered over their neon glows.<!--[cite: 1] -->
* **Responsive Docking:** On small or landscape viewports, floating UI elements like the Coin Shop intelligently reparent into the main DOM flow to prevent layout overlapping.<!--[cite: 1, 3] -->
* **Glassmorphism:** Overlays, menus, and the Shop utilize deep blur backdrops (`backdrop-filter: blur`) with glowing neon borders.<!--[cite: 3] -->
* **Zero-Cost Dev HUD:** Pressing the backtick (``` ` ```) key toggles an on-screen performance monitor tracking frametimes and entity counts (fully stripped from the runtime loop when disabled via a boolean debug flag).<!--[cite: 1] -->

---

<div align="center">

## Built with ❤️ by **LeagueStar**

**Happy Shooting! 🚀**

</div>
