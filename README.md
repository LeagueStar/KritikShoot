<div align="center">

# 🛸 KritikShoot

### Neon-Noir Survival Shooter

*A lightning-fast, highly optimized top-down arena shooter built entirely with Vanilla JavaScript.*

<p>
  <img src="https://img.shields.io/github/license/LeagueStar/KritikShoot?style=for-the-badge">
  <img src="https://img.shields.io/github/stars/LeagueStar/KritikShoot?style=for-the-badge">
  <img src="https://img.shields.io/github/forks/LeagueStar/KritikShoot?style=for-the-badge">
  <img src="https://img.shields.io/github/languages/top/LeagueStar/KritikShoot?style=for-the-badge">
</p>

> ⚡ No Game Engine • No Images • No Audio Assets • Pure HTML5 Canvas

</div>

---

# 🌌 Overview

**KritikShoot** is a fast-paced **Neon-Noir / Cyberpunk** survival shooter where you pilot a sleek delta-wing fighter through endless waves of glowing geometric enemies.

Fight to survive, level up during each run, unlock powerful upgrades, defeat massive bosses, and earn permanent upgrades that make every future run stronger.

Everything is built from scratch using **Vanilla JavaScript**, **HTML5 Canvas**, and the **Web Audio API**—without relying on any external game engine or rendering framework.

---

# ✨ Features

## 🎮 Gameplay

- 🌊 Endless wave-based survival
- 👑 Boss battles every 5th wave
- ⭐ RPG-style leveling system
- 🎁 Upgrade selection after every level
- 🪙 Persistent meta-progression
- 🏆 Local leaderboard
- 💾 Automatic save using LocalStorage

---

## 🔫 Weapons

Switch between multiple weapons during gameplay.

- 🔴 Rapid Fire Rifle
- 🟠 5-Pellet Spread Shotgun
- 🔵 Piercing Laser Cannon

Each weapon offers a completely different combat style.

---

## ⚡ Power-ups

Collect temporary buffs including

- 🛡 Shield
- 🚀 Speed Boost
- 🔥 Rage Mode
- 🎯 Triple Shot
- ❤️ Health Pickup
- ⭐ XP Boost

---

## 👾 Enemy Types

Every enemy behaves differently.

| Enemy | Description |
|--------|-------------|
| 🟢 Basic | Standard chaser |
| 🟡 Fast | Quick melee attacker |
| 🔵 Tank | High health, slow movement |
| 🔴 Rusher | Extremely fast charger |
| 🔷 Ranged | Keeps distance while shooting |
| 🟣 Spread | Fires a three-way bullet spread |
| 🟠 Exploder | Self-destructs with massive AoE damage |
| 👑 Boss | Multi-phase bullet hell encounter |

---

# 🚀 Boss Battles

Every fifth wave introduces a massive boss featuring multiple attack phases.

### ☢ Radial Hell

- Expanding bullet rings
- Increasing bullet density
- Bullet-hell style combat

### ⚡ Charge Dash

- Telegraph warning
- High-speed dash attack
- Requires careful positioning to dodge

---

# 📈 Progression

## During a Run

Earn XP by defeating enemies.

Leveling up lets you choose upgrades like

- ⚡ Fire Rate
- ❤️ Max Health
- 💥 Damage
- 🚀 Bullet Speed
- 🏃 Movement Speed
- 🎯 Critical Chance
- 🩸 Lifesteal

---

## Permanent Progression

Every completed run rewards Coins.

Spend Coins on permanent upgrades including

- Fire Rate
- Health
- Damage
- Speed
- Bullet Speed

All progress is automatically saved using **LocalStorage**.

---

# 🎨 Visuals

KritikShoot features a clean cyberpunk visual style built entirely with Canvas.

Effects include

- ✨ Neon glow rendering
- 🌠 Bullet trails
- 💥 Dynamic particle explosions
- 📳 Camera shake
- 🔥 Thruster animations
- 💎 Glassmorphism menus
- 🌌 Animated HUD
- ⚡ Smooth interpolation rendering

No sprite sheets or texture files are used.

---

# 🔊 Audio

Every sound effect is generated procedurally using the **Web Audio API**.

Includes

- Laser shots
- Explosions
- Enemy destruction
- Player damage
- Spread weapons

No audio assets are included.

---

# ⚙ Performance Optimizations

KritikShoot was engineered for smooth gameplay even with hundreds of entities on screen.

### 🚀 Engine Features

- Object Pooling
- Spatial Hash Grid
- Continuous Collision Detection (CCD)
- Cached Glow Sprite Rendering
- Dead Object Compaction
- Temporal Interpolation
- Optimized Collision Detection
- Finite State Machine (FSM)

Designed to minimize garbage collection and maintain stable frame rates.

---

# 🎮 Controls

## Desktop

| Key | Action |
|------|--------|
| **W A S D** | Move |
| **Arrow Keys** | Move |
| **Mouse** | Aim |
| **Left Click** | Shoot |
| **Q** | Change Weapon |
| **ESC** | Pause |

---

## Mobile

- 🎮 Virtual Joystick
- 🔥 Fire Button
- ⏸ Pause Button

Optimized for touch devices.

---

# 📸 Gameplay

> Replace these placeholders with screenshots or GIFs.

## Main Menu

```
assets/menu.png
```

## Gameplay

```
assets/gameplay.gif
```

## Boss Fight

```
assets/boss.png
```

## Upgrade Screen

```
assets/upgrades.png
```

---

# 🛠 Built With

- HTML5
- CSS3
- Vanilla JavaScript (ES6)
- HTML5 Canvas API
- Web Audio API

---

# 🚀 Getting Started

Clone the repository

```bash
git clone https://github.com/LeagueStar/KritikShoot.git
```

Navigate into the project

```bash
cd KritikShoot
```

Run a local server

Using Node

```bash
npx serve .
```

or using Python

```bash
python -m http.server 8000
```

Open your browser and visit

```
http://localhost:8000
```

---

# 📂 Project Structure

```text
KritikShoot/
│
├── assets/
├── game.js
├── style.css
├── index.html
├── README.md
└── LICENSE
```

---

# 🎯 Roadmap

- [ ] Additional Bosses
- [ ] New Weapons
- [ ] More Enemy Variants
- [ ] Achievements
- [ ] Online Leaderboards
- [ ] Daily Challenges
- [ ] Multiple Maps
- [ ] Co-op Multiplayer

---

# 🤝 Contributing

Contributions are welcome!

1. Fork the repository.
2. Create a feature branch.

```bash
git checkout -b feature/NewFeature
```

3. Commit your changes.

```bash
git commit -m "Add NewFeature"
```

4. Push your branch.

```bash
git push origin feature/NewFeature
```

5. Open a Pull Request.

---

# ⭐ Support

If you enjoyed this project, consider leaving a ⭐ on the repository.

It helps the project reach more developers and motivates future updates.

---

<div align="center">

## Built with ❤️ by **LeagueStar**

**Happy Shooting! 🚀**

</div>
