<div align="center">

# 🚀 KritikShoot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform: Web](https://img.shields.io/badge/Platform-Web-blue.svg)]()
[![Language: JavaScript](https://img.shields.io/badge/Language-JavaScript-F7DF1E.svg?logo=javascript&logoColor=black)]()

An ultra-lightweight, high-performance 2D arcade shooter built entirely with vanilla JavaScript and HTML5 Canvas. No heavy frameworks, no external engine overhead—just pure, hardware-accelerated gameplay straight in the browser.

</div>
---

## 🕹️ Gameplay Preview

<!-- TIP: Record a 5-10 second GIF of your gameplay, upload it to GitHub, and link it here -->
https://github.com/user-attachments/assets/03fbf3a0-84af-472a-aec5-d90084ab02ac

---

## ✨ Core Features

*   **Responsive Canvas Rendering:** Utilizes HTML5 Canvas optimized for smooth 60 FPS rendering and fluid animation loops.
*   **Dynamic Entity Management:** Clean collision handling and life-cycle management for players, projectiles, and scaling enemy waves.
*   **Zero Dependencies:** Built from scratch using native web technologies, ensuring instant load times and optimal performance.
*   **Mobile Friendly Setup:** Configured with a `.nojekyll` manifest to bypass Jekyll build processing, optimizing deployment for GitHub Pages.

---

## 🎮 How to Play

| Action | Control |
| :--- | :--- |
| **Move Up / Down** | `W` / `S` or `Up Arrow` / `Down Arrow` |
| **Move Left / Right** | `A` / `D` or `Left Arrow` / `Right Arrow` |
| **Aim** | `Mouse Cursor` |
| **Fire Projectile** | `Left Mouse Click` / `Spacebar` |

---

## 🛠️ Tech Stack & Architecture

*   **Frontend Interface:** HTML5, CSS3 Custom Properties (Variables)
*   **Game Logic Engine:** Vanilla JavaScript (ES6+)
*   **Deployment:** GitHub Pages 

### File Structure Overview
```text
├── .nojekyll       # Bypasses Jekyll for seamless GitHub Pages deployment
├── LICENSE         # Open-source license terms
├── README.md       # Project documentation
├── index.html      # Game viewport canvas wrapper
├── style.css       # Layout styles and canvas responsiveness
└── game.js         # Core game loop, input handling, and state logic
