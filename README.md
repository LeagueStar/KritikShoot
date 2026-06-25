# KritikShoot 🚀

![KritikShoot](https://img.shields.io/badge/Status-Active-success) ![JavaScript](https://img.shields.io/badge/Language-Vanilla%20JS-F7DF1E) ![HTML5 Canvas](https://img.shields.io/badge/Graphics-HTML5%20Canvas-E34F26)

**KritikShoot** is a high-performance, dependency-free HTML5 Canvas top-down survival shooter. Survive endless waves of geometric neon enemies, defeat challenging multi-phase bosses, and earn coins to permanently upgrade your fighter jet. 

Designed with a sleek Neon-Noir/Cyberpunk aesthetic, KritikShoot features a custom-built 2D game engine optimized for high refresh rates and minimal garbage collection.

## ✨ Features

### 🎮 Gameplay
* **Endless Wave Survival:** Fight through increasingly difficult waves with dynamic enemy spawning.
* **Boss Encounters:** Every 5th wave features a Boss with massive health pools and multi-phase attack patterns (Radial Bullet Hell & Telegraphed Charge Dashes).
* **Meta-Progression (Coin Shop):** Earn coins based on your score and wave reached. Spend them in the main menu to buy persistent upgrades (Max HP, Damage, Fire Rate, Speed).
* **In-Run Leveling:** Collect XP gems from fallen enemies to level up and choose temporary run-based stat buffs.
* **Weapon Loadouts:** Cycle between Default (Blaster), Spread (Shotgun), and Piercing Laser modes.
* **Powerups:** Find drops for Shields, Triple Shot, Speed Boosts, and Rage mode.

### 🛠️ Custom Engine Tech
* **Zero Dependencies:** 100% Vanilla JavaScript, HTML, and CSS.
* **Procedural Web Audio:** All sound effects (lasers, explosions, UI clicks) are generated dynamically using the Web Audio API `OscillatorNode` (no external audio files needed).
* **Micro-Optimized Physics & Rendering:**
  * **Temporal Interpolation:** Sub-tick rendering ensures perfectly smooth movement on 120Hz/144Hz monitors.
  * **Spatial Hash Grid:** O(1) broad-phase collision detection handles hundreds of entities efficiently.
  * **Object Pooling & Dead-Flag Compaction:** Arrays are bulk-compacted and objects are recycled to eliminate JavaScript Garbage Collection (GC) micro-stutters.
* **Global Leaderboards:** Local storage caching with a built-in REST API hook ready for Supabase integration.

## 🕹️ Controls

KritikShoot features responsive controls for both desktop and mobile devices.

### Desktop
* **Move:** `W` `A` `S` `D` or `Arrow Keys`
* **Aim & Shoot:** `Mouse Cursor` & `Left Click`
* **Switch Weapon:** `TAB`
* **Pause:** `ESC`

### Mobile (Touch)
* **Move:** Virtual Joystick (Left side of the screen)
* **Aim & Shoot:** Touch and drag anywhere on the right side of the screen
* **UI Controls:** On-screen buttons for pausing and manual firing.

## 🚀 Running Locally

Because the game uses ES modules and the Fetch API (for the leaderboard), it needs to be run through a local web server (opening the `index.html` directly in the browser via `file://` will result in CORS errors).

1. **Clone the repository:**
```bash
   git clone [https://github.com/LeagueStar/KritikShoot.git](https://github.com/LeagueStar/KritikShoot.git)
   cd KritikShoot
2. **Start a local web server:**
   * **If using VS Code:** Install the Live Server extension and click "Go Live".
   * **If using Python:** ```bash
     python -m http.server 8000
     ```
   * **If using Node.js:** ```bash
     npx serve .
     ```

3. **Open your browser:** Navigate to `http://localhost:8000` (or the port provided by your server).

## 🗄️ Setting up the Leaderboard (Supabase)

The game includes frontend logic to post high scores to a REST endpoint on Game Over. To activate this:

1. Create a [Supabase](https://supabase.com/) project and set up a `scores` table with the following columns: `name` (text), `wave` (int), `time` (float), `level` (int), `kills` (int).
2. Open `game.js` and locate the `_postScoreRemote` function inside the `UIManager` class.
3. Replace the placeholder URLs and Keys with your project's details:
   ```javascript
   const LEADERBOARD_URL = "https://YOUR_PROJECT.supabase.co/rest/v1/scores";
   const ANON_KEY        = "YOUR_SUPABASE_ANON_KEY";
