<div align="center">

# 🛸 KritikShoot
**Neon-Noir Survival Shooter**

[![Play Live](https://img.shields.io/badge/Play-Live_Demo-00e5ff?style=for-the-badge&logo=googlechrome&logoColor=white)](https://leaguestar.github.io/KritikShoot/)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)]()
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-e34f26?style=for-the-badge&logo=html5&logoColor=white)]()

*A lightning-fast, highly optimized top-down arena shooter built entirely without external libraries or image assets.*

</div>

## 🌌 Overview

**KritikShoot** is a high-octane survival game featuring a sleek "Neon-Noir / Cyberpunk HUD aesthetic". You pilot a sharp, swept-back delta-wing fighter, battling relentless swarms of neon geometric enemies. Survive as long as possible, gather XP to level up mid-run, and earn coins to purchase persistent meta-upgrades. 

## ✨ Key Features

* **Dependency-Free Engine**: Built purely with vanilla JavaScript, HTML5 Canvas, and CSS3.
* **Procedural Audio**: 100% synthesized, dependency-free sound effects (lasers, explosions, hits) generated dynamically via the Web Audio API `OscillatorNode`.
* **Deep Meta-Progression**: A persistent coin economy stored in `localStorage` allows players to upgrade their base Fire Rate, Max HP, Damage, Movement Speed, and Bullet Speed between runs.
* **Dynamic Arsenal**: Cycle seamlessly between the standard rapid-fire gun, a 5-pellet spread shotgun, and a high-damage piercing laser. 
* **Intense Boss Fights**: Every 5th wave spawns a Boss featuring a two-phase attack cycle: an expanding "Radial Hell" bullet-hell burst and a lightning-fast "Charge Dash".
* **Responsive Controls**: Native support for desktop (Keyboard & Mouse) and mobile devices (Virtual Joystick & Dual-Touch aiming).

## 🛠️ Under the Hood (Micro-Optimizations)

KritikShoot is engineered for flawless high-Hz performance using advanced game development patterns:
* **Temporal Interpolation**: Positions are cached and rendered using linear interpolation (`lerp`), eliminating micro-stutters on 120/144Hz displays.
* **Object Pooling & Dead-Flag Compaction**: Bullets and particles are recycled from pre-allocated arrays, and dead entities are bulk-compacted once they cross a 35% threshold to eliminate expensive garbage collection spikes.
* **Spatial Hash Grid**: Swept-circle collision detection (`CCD`) is optimized through spatial hashing, allowing massive enemy counts without frame drops.
* **Finite State Machine (FSM)**: Clean architectural transitions between `MENU`, `PLAYING`, `PAUSED`, `LEVEL_UP`, and `GAME_OVER` states.

## 👾 Enemy Bestiary

Prepare to face a diverse swarm of glowing geometric threats:
* **Normal / Fast**: Green and yellow flankers that rush your position.
* **Tank**: Massive, slow-moving blue hexagons with extremely high HP.
* **Rusher**: Fragile but incredibly fast red chargers.
* **Ranged**: Technological cyan octagons that maintain a specific distance and fire accurate shots.
* **Exploder**: Orange squares that detonate on proximity, causing massive AoE screen-shake damage.
* **Spread**: Purple pentagons that fire a deadly 3-way spread.

## 🎮 Controls

### Desktop
* **Move**: `W` `A` `S` `D` or `Arrow Keys`
* **Aim / Fire**: Mouse Movement & `Left Click`
* **Cycle Weapon**: `TAB`
* **Pause**: `ESC`

### Mobile
* **Move**: Left-side Virtual Joystick
* **Aim / Fire**: Right-side Touch & Drag, or the on-screen `FIRE` button

## 🎨 Design System
The UI utilizes a striking glassmorphism style featuring blur backdrops, neon glows, and custom typography (`Orbitron` for display text and `Rajdhani` for HUD elements). Player upgrades are tracked via glowing, rounded progress bars directly on the gameplay HUD.

<div align="center">

## Built with ❤️ by **LeagueStar**

**Happy Shooting! 🚀**

</div>
