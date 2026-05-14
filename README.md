<div align="center">

# ░▒▓█ ＫＲＩＴＩＫＳＨＯＯＴ █▓▒░

**A Zero-Dependency, Frame-Perfect HTML5 Survival Shooter**

[![Engine](https://img.shields.io/badge/Engine-Vanilla_JS-050810?style=for-the-badge&logo=javascript&logoColor=00e5ff)](#)
[![UI](https://img.shields.io/badge/UI-Glassmorphism-050810?style=for-the-badge&logo=css3&logoColor=00e5ff)](#)
[![Status](https://img.shields.io/badge/Status-Deployed-050810?style=for-the-badge&logo=html5&logoColor=2ecc71)](#)

> *No frameworks. No bloat. Pure, unadulterated performance.*

</div>

<br>

## ▰▰▰ ENGINE ARCHITECTURE ▰▰▰

This project is more than a game; it is a custom-built, lightweight rendering engine engineered for absolute performance across desktop and mobile.

* **Zero GC Stutter:** Implements strict Object Pooling for all bullets (300 pool) and particles (500 pool), pre-allocating memory to ensure flawless performance during heavy waves without Garbage Collection pauses.
* **O(1) Memory Management:** Utilizes fast array removal techniques, bypassing expensive `Array.splice` operations for entity tracking.
* **Optimized Physics:** Hot-loop collision detection relies entirely on `distanceSq` calculations, completely avoiding CPU-heavy `Math.sqrt()` calls.
* **Frame-Rate Agnostic:** Driven by a robust `requestAnimationFrame` loop utilizing Delta-Time (`dt`), ensuring game speed is perfectly consistent regardless of monitor refresh rate.

<br>

## ▰▰▰ VISUAL DESIGN SYSTEM ▰▰▰

The aesthetic is driven by a strict Neon-Noir and Cyberpunk design language.

* **Glassmorphism UI:** Panels feature backdrop-blur, saturation boosts, and subtle gradient shines to simulate refractive glass.
* **Cinematic Camera:** Screen shake relies on sine-wave oscillation and exponential decay, providing smooth, heavy impacts rather than chaotic random displacement.
* **Dynamic Resolution:** The HUD utilizes a custom `--ui-scale` CSS variable injected dynamically to ensure perfect proportions across all devices.
* **Layered Rendering:** Employs `ctx.shadowBlur` extensively for glowing entities, paired with custom HTML canvas composite rendering.

<br>

## ▰▰▰ GAMEPLAY MECHANICS ▰▰▰

* **RPG Progression:** Earn XP to access a dynamic upgrade tree (Speed, Health, Damage, Fire Rate, Bullet Speed, Crit Chance, Lifesteal).
* **Dynamic Scaling:** Encounter 5 unique enemy archetypes (Normal, Tank, Fast, Spread, Exploder) whose health and damage scale via a logarithmic wave factor.
* **Universal Input:** Seamlessly handles desktop (WASD + Mouse) and mobile platforms via a custom-built multi-touch virtual joystick.
* **Persistent Glory:** Integrated LocalStorage leaderboards track the top 10 runs, sorted by wave reached and completion time.

<br>

## ▰▰▰ DEPLOYMENT PROTOCOL ▰▰▰

Because KritikShoot is 100% vanilla, initialization is instant. No package managers required.

```bash
# 1. Clone the repository
git clone [https://github.com/LeagueStar/KritikShoot.git](https://github.com/LeagueStar/KritikShoot.git)

# 2. Access the directory
cd KritikShoot
