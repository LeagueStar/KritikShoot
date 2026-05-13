<div align="center">

# ✧ KRITIKSHOOT ✧

**A High-Performance Neon-Noir Survival Shooter**

[![HTML5](https://img.shields.io/badge/HTML5-050810?style=for-the-badge&logo=html5&logoColor=00e5ff)](#)
[![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-050810?style=for-the-badge&logo=javascript&logoColor=00e5ff)](#)
[![CSS3](https://img.shields.io/badge/CSS3-050810?style=for-the-badge&logo=css3&logoColor=00e5ff)](#)

> *No frameworks. No bloat. Pure frame-perfect performance.*

<br>

</div>

<br>

## ⟡ The Vision
**KritikShoot** is a relentlessly fast-paced, wave-based survival shooter built entirely from scratch. Engineered with a custom rendering loop and strict memory management, it delivers a flawless, stutter-free neon experience across both desktop and mobile platforms.

<br>

## ⟡ Mechanics & Features

<details>
<summary><b>View Gameplay Features</b></summary>
<br>

- 🩸 **RPG Progression:** Dynamic wave scaling with 5 distinct enemy archetypes (Tank, Fast, Spread, Exploder, Normal).
- ⚡ **Tactical Upgrades:** Interactive level-up system featuring Lifesteal, Fire Rate, Crit Chance, and Bullet Speed.
- 🕹️ **Universal Input:** Native WASD/Mouse tracking for desktop + custom multi-touch virtual joysticks for mobile.
- 🏆 **Local Persistence:** Integrated high-score leaderboards directly linked to browser LocalStorage.

</details>

<br>

## ⟡ Under The Hood
This isn't just a game; it's a lightweight custom engine. 

* **Zero GC Stutter:** Built with strict **Object Pooling** for bullets and particles, ensuring memory isn't constantly allocated and destroyed during intense waves.
* **Optimized Physics:** Utilizes `distanceSq` calculations to completely bypass expensive `Math.sqrt()` operations in hot collision loops.
* **Cinematic Rendering:** Layered `ctx.shadowBlur` glowing entities, coupled with sine-wave exponential decay camera shake for smooth, satisfying impact physics.
* **Resolution Agnostic:** Custom CSS variables (`--ui-scale`) dynamically adapt the Glassmorphism HUD to any viewport size perfectly.

<br>

## ⟡ Deployment
Because KritikShoot is 100% vanilla, getting started takes seconds. No `npm install`. No build steps.

```bash
# 1. Clone the repository
git clone [https://github.com/LeagueStar/KritikShoot.git](https://github.com/LeagueStar/KritikShoot.git)

# 2. Navigate to the directory
cd KritikShoot
