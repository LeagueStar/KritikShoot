<div align="center">

# 🩸 KRITIKSHOOT
### *crimson-void survival, no cap*

<sub>a top-down arena shooter built from absolute scratch — no engine, no libraries, no image assets, just vanilla JS doing the most</sub>

<br/>

[![Play Live](https://img.shields.io/badge/▶_PLAY_NOW-CD1C18?style=for-the-badge&logo=googlechrome&logoColor=white)](https://leaguestar.github.io/KritikShoot/)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)]()
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-9400D3?style=for-the-badge&logo=html5&logoColor=white)]()
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-14040D?style=for-the-badge)]()
[![Web Audio](https://img.shields.io/badge/Audio-Procedural-ED80E9?style=for-the-badge)]()

</div>

<br/>

> **the vibe:** blood-red primaries, electric violet accents, lavender highlights, burning against a near-black void. you fly a delta-wing fighter through relentless neon swarms. every frame is earned, not borrowed.

<br/>

## ⚡ tl;dr

| | |
|---|---|
| 🎮 **genre** | top-down survival arena shooter |
| 🧠 **built with** | pure vanilla JS + Canvas + Web Audio API — zero libraries, zero frameworks |
| 📱 **plays on** | desktop *and* mobile, first-class parity, not bolted-on touch |
| 🔒 **runs at** | locked, interpolated 60Hz |
| 💾 **saves** | persistent meta-progression + local leaderboard, no backend required |
| 🎨 **theme** | "Blood Orchid" — chili-spice reds fused with wisteria-bloom violets |

<br/>

---

## 🌌 overview

**KritikShoot** is a high-octane survival shooter where you pilot a sharp, swept-back delta-wing fighter against escalating waves of neon geometric enemies. Dynamic wave generation, deep in-run progression, a persistent meta-economy, daily seeded challenges, and multi-phase boss fights — all engineered natively, no shortcuts.

<br/>

## 🛠️ core engine & micro-optimizations

built for flawless high-Hz performance, entirely hand-rolled:

- **Fixed-Timestep Physics + Temporal Interpolation** — an accumulator decouples physics (locked 60Hz) from the render loop; every entity caches `prevX`/`prevY` and renders via `lerp`, eliminating stutter on 120Hz/144Hz displays
- **Swept-Circle CCD Collision** — fast bullets and entities resolve with continuous collision detection so nothing tunnels through at speed
- **SpatialHash Broad-Phase** — O(N) collision queries via a spatial hash grid with pooled bucket arrays, zero per-tick GC allocation
- **GameFSM State Management** — a finite state machine drives menu, playing, paused, level-up, ascension, and game-over transitions, with fault-tolerant save/resume hooked to tab visibility
- **GlowCache Pre-Rendering** — every glow effect is pre-rendered to an offscreen canvas and cached by color/size, killing live `shadowBlur` calls
- **Adaptive Performance Budgeting** — a rolling frame-time watchdog detects `hardwareConcurrency` and struggling hardware, triggering a one-way `lowPowerMode` that trims particles and glow without interrupting play
- **Advanced Memory Pooling & Compaction** — bullets, particles, and floating damage numbers run through custom object pools; dead entities are bulk-compacted, trail buffers use a pre-allocated ring buffer instead of `Array.shift()`
- **Batched Rendering Passes** — `ctx.save()`/`restore()` grouped by category to cut draw-call overhead

<br/>

## 📱 full mobile parity

not a desktop game with touch duct-taped on — mobile is a first-class citizen:

- **device-aware rendering** — downscaled target with nearest-neighbor blit for smooth frame times without a blurry upscale
- **orientation lock + rotate prompt** — locks landscape where supported, prompts if held in portrait
- **dynamic virtual joystick** — left-side movement with dead-zone filtering; right-side drag-to-aim, manual touch prioritized over auto-aim fallback
- **reduced particle budgets + auto-aim** — mobile profiles trim particle counts and offer assist for touchscreen play
- **haptics** — boss kills, explosions, and heavy hits fire `navigator.vibrate` pulses

<br/>

## 🎮 gameplay systems

### dynamic wave budgeting & daily challenges
enemies spawn via a **Threat Budget System** scaling with `Math.min(60, 8 + wave * 3)`, buying enemies from an unlocked bestiary until budget's spent — a smooth escalating curve instead of flat random spawns.

- **Daily Challenge Mode** — a seeded run via a `Mulberry32` PRNG keyed to the current UTC date, with a rolling daily-history strip and a Wordle-style "Copy Result" clipboard export

### environment, cover & hazards
- **line-of-sight AI** — ranged enemies and bosses use Liang–Barsky parametric clipping raycasts to check cover before engaging
- **environmental destruction** — from wave 13 on, the arena targets central cover blocks on a rolling cadence, with a pulsing HUD warning under 30% cover
- **corruption zones** — from wave 10 on, defeated bosses leave a spreading, persistent damage-over-time zone that hits player and enemies alike

### end-of-run sequence
dying triggers a full cinematic: staged death animation → physics-driven debris burst → animated stats card with count-up scoring, medal tiers, and personal-best detection, backed by a composite score formula weighting combo streaks and kill chains.

<br/>

## ⚔️ arsenal & progression

### weapons — cycle with `E` / `Shift`
1. **Default Gun** — high fire-rate, reliable single-target damage
2. **Shotgun (Spread)** — dense 6-pellet burst in a 40° cone, DPS-balanced against the laser at mid-range
3. **Piercing Laser** — high-velocity cyan bolt punching through up to 4 enemies

### in-run leveling
kills grant XP. leveling up pauses the game for a stackable upgrade:

`⚡ Move Speed` `❤ Max Health` `💥 Damage` `🔥 Fire Rate` `🚀 Bullet Speed` `🎯 Crit Chance` `🩸 Lifesteal`

- **weapon synergies** — stack crit high enough on the laser for *Piercing Overload*, or lifesteal high enough during a rage buff for *Vampiric Rage*
- **ascension mods** (milestone levels) — weapon-specific augments like *Ricochet Rounds*, *Detonator Pellets*, *Beam Split*, chosen from a dedicated ascension screen

### 🪙 persistent meta-progression
coins earned from wave completion and survival time carry over between runs, spendable in the **Upgrade Depot**:

`⚡ Fire Rate` `❤ Max HP` `💥 Damage` `🏃 Move Speed` `🚀 Bullet Speed` `🛡 Starting Ward` `🧲 Magnetism` `🔫 Loadout Swap`

<br/>

## 👾 enemy bestiary

| type | look | behavior |
|---|---|---|
| **Normal** | 🟢 green square | standard rusher, balanced HP/speed |
| **Rusher** | 🔴 red triangle | fragile, incredibly fast, proximity melee |
| **Fast** | 🟡 yellow triangle | agile hit-and-run flanker |
| **Ranged** | 🌐 cyan octagon | holds distance, LoS raycasting, orbital strafing |
| **Spread** | 🟣 purple pentagon | fires a deadly 3-way bullet spread |
| **Exploder** | 🟠 orange square | detonates on proximity, massive AoE + screen shake |
| **Tank** | 🔵 blue hexagon | slow behemoth, 250% base HP, heavy melee |

### ☠️ boss encounters
every 5th wave halts standard spawning for a three-phase fight:

1. **Radial Hell** — expanding, interleaved bullet rings
2. **Rest & Volley** — tracks the player with a targeted 3-round burst
3. **Charge Dash** — telegraphed flash, then a hyper-speed dash to the player's last known position

<br/>

## 🎵 procedural audio & haptics

**zero audio files.** everything's synthesized live via the Web Audio API (`OscillatorNode`, `BiquadFilterNode`, `GainNode`):

- **dynamic ambient bed** — detuned drones with a slow breathing LFO scaling with wave progress and enemy density
- **SFX jitter** — randomized frequency sweeps on hit/shoot SFX to dodge auditory fatigue
- **hit-stop** — boss deaths and heavy explosions briefly freeze the physics accumulator and thud the camera, paired with mobile vibration

<br/>

## 🖥️ main menu

the menu keeps things clean — everything non-essential lives behind its own modal, launched from a dedicated button:

| button | opens |
|---|---|
| 🏆 | **Leaderboard** — local high scores |
| 🛠 | **Upgrades** — the persistent Upgrade Depot |
| ❓ | **How to Play** — objective, controls, weapons, upgrades |
| ⚙ | **Accessibility** — shake intensity, text scale, shape ID, colorblind palette |
| 🔊 | mute toggle |

plus a callsign field, **DEPLOY** button, and a **Daily Challenge** toggle with today's date and a rolling history strip of past results.

<br/>

## ⌨️ controls

### desktop
| action | key |
|---|---|
| move | `W` `A` `S` `D` |
| aim | `mouse` or `arrow keys` *(arrows override mouse while held)* |
| fire | `left click` or `space` |
| switch weapon | `E` or `Shift` |
| pause | `Esc` |
| quit to menu | `Q` *(while paused)* |

### mobile
| action | control |
|---|---|
| move | left-side virtual joystick |
| aim | right-side touch & drag |
| fire | `FIRE` button *(or auto-fire while moving)* |
| switch weapon | weapon button |
| pause | `⏸` |
| quit to menu | `⌂` *(while paused)* |

<br/>

## 🎨 design system — "blood orchid"

chili-spice reds fused with wisteria-bloom violets, applied across DOM *and* canvas rendering — not just the menu.

| token | swatch | hex |
|---|---|---|
| void background | ⬛ | `#14040D` |
| panel surface | 🟪 | `#2A0A1C` |
| primary crimson | 🟥 | `#CD1C18` |
| primary deep | 🟥 | `#9B1313` |
| accent violet | 🟣 | `#9400D3` |
| accent magenta | 🩷 | `#ED80E9` |
| text highlight | ⬜ | `#D3D3FF` |
| warm glow | 🟧 | `#FFA896` |

> primary crimson runs low-contrast against the void by design — interactive labels default to white/highlight text instead of color-on-color, so nothing gets lost.

**accessibility, built in, not bolted on:**

- 🎚 **screen shake intensity** — adjustable slider, independent of reduced-motion
- 🔠 **HUD text scale** — Normal / Large / X-Large
- ▲ **shape-only enemy ID** — thicker high-contrast outlines so enemy type reads from silhouette alone
- 🎨 **colorblind-safe palette** — deuteranopia/protanopia-safe remap for enemies and health bars
- **reduced motion compliance** — hooks `prefers-reduced-motion` to auto-dampen shake, particles, and hit-stop flashes

**other UI touches:**
- glassmorphism overlays — `backdrop-filter: blur` + glowing borders across every modal
- colorblind-friendly powerup glyphs (`✚` health, `✦` XP, `◈` shield), independent of color
- responsive docking — floating panels reparent into normal flow on small/landscape viewports
- zero-cost dev HUD — backtick (`` ` ``) toggles a frametime/entity-count overlay, fully stripped from the loop when off

<br/>

---

<div align="center">

### built with 🩸 by **LeagueStar**

**happy shooting 🚀**

</div>
