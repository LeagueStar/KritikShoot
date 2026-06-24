<div align="center">

# 🌌 KritikShoot 

**A high-octane, dependency-free HTML5 top-down shooter.**

[![Play Game](https://img.shields.io/badge/Play-Now-00e5ff?style=for-the-badge)](https://LeagueStar.github.io/KritikShoot)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)]()
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-E34F26?style=for-the-badge&logo=html5&logoColor=white)]()

*Intense wave-based survival. Neon geometry. Pure arcade juice.*

<br />

<img src="https://via.placeholder.com/800x400/050810/00e5ff?text=Drop+a+cool+gameplay+GIF+here" alt="KritikShoot Gameplay Banner" width="100%">

<br />

</div>

## ✨ About The Game

**KritikShoot** is a hyper-optimized, web-based arcade shooter built entirely from scratch without external frameworks[cite: 1]. Survive endless waves of geometric enemies, upgrade your ship, and chase high scores in a visually striking "Neon Geometry" world[cite: 1]. 

Designed for both desktop and mobile, it features a custom-built object pooling system, spatial hashing, and temporal rendering interpolation to guarantee a buttery-smooth 60+ FPS experience even on low-end devices[cite: 1].

---

## 🚀 Key Features

### 🎨 **Neon Arcade Aesthetics**
*   **Fighter-Jet Hull:** Pilot a sharp, swept-back delta ship with dark strokes and dynamic thruster flames[cite: 1].
*   **Game "Juice":** Visceral feedback featuring massive particle bursts, camera screenshake, glowing bullet trails, and red damage vignette flashes[cite: 1].
*   **Canvas Glows:** Extensive use of `shadowBlur` and radial gradients cached to off-screen canvases for high-performance neon lighting[cite: 1].

### 💥 **Deep Gameplay & Upgrades**
*   **Diverse Arsenal:** Cycle between the Default Blaster, a wide-arc Spread Shotgun, and a Piercing Laser that melts through hordes[cite: 1].
*   **Dynamic Enemies:** Face off against fragile Rushers, heavy Tanks, kiting Ranged attackers, and unpredictable Exploders[cite: 1].
*   **RPG Mechanics:** Earn XP, level up mid-combat, and invest in 7 different stats (Speed, Damage, Fire Rate, Lifesteal, etc.)[cite: 1].
*   **Powerups:** Turn the tide with temporary buffs like Rage, Triple Shot, Shields, and Speed Boosts[cite: 1].

### 🎧 **Dependency-Free Audio**
*   **Procedural Web Audio:** All sound effects are generated dynamically using the native Web Audio API (`OscillatorNode`)[cite: 1].
*   Experience retro synth "pews", sub-bass thuds on player hits, and filtered noise-burst crunches for enemy deaths—all without loading a single `.mp3` or `.wav`[cite: 1].

---

## 🕹️ Controls

Seamlessly swap between desktop and mobile devices.

| Action | Desktop (Mouse & Keyboard) | Mobile (Touch) |
| :--- | :--- | :--- |
| **Movement** | `W` `A` `S` `D` / Arrow Keys | Left-side Virtual Joystick[cite: 1] |
| **Aim** | Mouse cursor | Right-side Screen Tap[cite: 1] |
| **Shoot** | Left Mouse Button | Auto-fires while aiming/moving[cite: 1] |
| **Switch Weapon**| `TAB` | Auto-equips via UI/Powerups[cite: 1] |
| **Pause** | `ESC` | Pause Button[cite: 1] |

---

## ⚙️ Under The Hood (v3 Engine Optimizations)

While KritikShoot looks simple, the underlying engine is engineered for maximum browser performance:

*   **Fixed-Step Physics & Interpolation:** Physics run at a fixed 60Hz step (`1/60`), while the `draw()` function lerps entity positions between previous and current frames based on a sub-tick alpha accumulator. This completely eliminates micro-stutters on 120Hz/144Hz displays[cite: 1].
*   **Zero-Allocation Game Loop:** 
    *   **Object Pooling:** Bullets and particles are drawn from pre-allocated arrays (`ObjectPool`), preventing runtime memory allocation and garbage collection spikes[cite: 1].
    *   **Dead-Flag Compaction:** Arrays are never modified with costly `splice()` calls during gameplay. Dead entities are flagged as `active = false` and skipped during rendering. When the pool crosses a dead-slot threshold (`35%`), the array is bulk-compacted in a single linear pass[cite: 1].
    *   **Hoisted Sets:** Collision detection utilizes a hoisted, cleared `Set` rather than instantiating new `Set` objects every tick[cite: 1].
*   **Spatial Hash Grid:** Entities are sorted into an $80 \times 80$ spatial grid, reducing collision checks from $O(n^2)$ to $O(n)$[cite: 1].

---

## 🛠️ Quick Start

Because KritikShoot is entirely vanilla HTML/JS, there are no build steps, node modules, or bundlers required.

1. Clone the repository:
```bash
   git clone [https://github.com/LeagueStar/KritikShoot.git](https://github.com/LeagueStar/KritikShoot.git)
