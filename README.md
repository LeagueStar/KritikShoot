<div align="center">

# 🚀 KritikShoot

### A modern top-down survival shooter built from scratch with Vanilla JavaScript & HTML5 Canvas.

Fight endless enemy waves, defeat bosses, unlock upgrades, and survive as long as possible.

<img src="assets/gameplay.gif" width="850">

<br>

![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow?style=for-the-badge)
![Canvas](https://img.shields.io/badge/HTML5-Canvas-orange?style=for-the-badge)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-None-success?style=for-the-badge)
![License](https://img.shields.io/github/license/LeagueStar/KritikShoot?style=for-the-badge)

</div>

---

# 🎮 About

**KritikShoot** is a fast-paced neon-themed survival shooter built entirely from scratch using **Vanilla JavaScript** and the **HTML5 Canvas API**.

No Phaser.

No PixiJS.

No game engine.

Every gameplay system—including rendering, AI, collisions, particles, audio, upgrades, and UI—was implemented manually.

The goal is simple:

> **Survive increasingly difficult waves, defeat bosses, upgrade your ship, and chase the highest score.**

---

# ✨ Features

## Combat

- ⚡ Fast-paced twin-stick shooting
- 🎯 Mouse aiming
- 🔥 Multiple weapons
  - Default Rifle
  - Spread Shot
  - Laser Cannon
- 💥 Critical hits
- ❤️ Lifesteal
- 🛡 Shield buffs
- 🚀 Speed boosts
- 🔺 Triple Shot
- Rage Mode

---

## Enemies

Fight against multiple enemy archetypes.

- 🟢 Standard
- 🔴 Rusher
- 🔵 Tank
- 🟣 Spread Shooter
- 🟠 Exploder
- 🔷 Ranged AI

Every enemy behaves differently.

---

## Boss Battles

Every few waves a massive boss appears featuring

- Multi-phase attacks
- Bullet hell patterns
- Dash attacks
- High health
- Dynamic difficulty

---

## Progression

Gain XP by defeating enemies.

Level up and choose upgrades such as

- Fire Rate
- Damage
- Bullet Speed
- Critical Chance
- Lifesteal
- Speed
- Max Health

Collect coins to permanently improve your ship through the persistent upgrade shop.

---

## Visual Effects

- ✨ Neon rendering
- 💥 Particle engine
- 🌈 Glow sprite caching
- 🎥 Camera shake
- 🚀 Bullet trails
- 💫 Dynamic lighting
- Smooth interpolation
- High refresh rate rendering

---

## Audio

Procedural sound engine using the **Web Audio API**

No external sound assets.

Every sound effect is generated in real time.

- Shoot
- Laser
- Spread Shot
- Enemy Death
- Player Damage

---

## Performance

The game includes several optimization techniques commonly found in real game engines.

- Object Pooling
- Spatial Hash Grid
- Continuous Collision Detection
- Dead Object Compaction
- Render Interpolation
- Cached Glow Sprites
- Memory Reuse
- Optimized Collision Detection

---

# 📸 Screenshots

Replace with your screenshots.

```text
assets/

gameplay.gif
menu.png
boss.png
shop.png
```

---

# 🎮 Controls

| Action | Key |
|---------|-----|
| Move | WASD |
| Aim | Mouse |
| Shoot | Left Click |
| Change Weapon | Q |
| Pause | ESC |

Mobile controls are also supported.

---

# 🛠 Technologies

- Vanilla JavaScript (ES6)
- HTML5 Canvas
- Web Audio API
- Local Storage
- HTML5
- CSS3

No frameworks.

No libraries.

No engines.

---

# 🚀 Running

Clone the repository

```bash
git clone https://github.com/LeagueStar/KritikShoot.git
```

Open the project

```bash
cd KritikShoot
```

Start a local server

Python

```bash
python -m http.server
```

or

Node

```bash
npx serve
```

Visit

```
http://localhost:8000
```

---

# 📂 Project Structure

```text
KritikShoot
│
├── assets/
├── game.js
├── style.css
├── index.html
└── README.md
```

---

# 🧠 Architecture

The project is built around several reusable engine components.

```
Game
│
├── Game FSM
├── Spatial Hash Grid
├── Object Pool
├── Audio Engine
├── Trail Manager
├── Particle Engine
├── Meta Progression
├── Enemy AI
├── Boss AI
├── Weapon System
├── Upgrade System
└── UI System
```

---

# 🎯 Roadmap

- [ ] More bosses
- [ ] More weapons
- [ ] Additional maps
- [ ] Online leaderboard
- [ ] Save files
- [ ] Multiplayer
- [ ] Steam release

---

# ⭐ Why this project?

Unlike many browser shooters, **KritikShoot** focuses on building engine systems manually rather than relying on external frameworks.

The project demonstrates topics such as:

- Game architecture
- Collision systems
- AI behaviours
- Rendering optimization
- Memory management
- Canvas graphics
- Procedural audio
- Performance optimization

making it both a playable game and a learning resource.

---

# 🤝 Contributing

Pull requests are welcome.

Feel free to improve gameplay, optimize performance, or add new enemies and weapons.

---

# 📜 License

MIT License

---

<div align="center">

### Built with ❤️ using nothing but JavaScript & HTML5 Canvas

**Made by LeagueStar**

⭐ Star the repository if you enjoyed the project.

</div>
