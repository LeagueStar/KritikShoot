🛸 KritikShoot
Neon-Noir Survival Shooter

A lightning-fast, highly optimized top-down arena shooter built entirely without external libraries or image assets.

🌌 Overview
KritikShoot is a high-octane survival game featuring a sleek "Neon-Noir / Cyberpunk HUD aesthetic"[cite: 3]. You pilot a sharp, swept-back delta-wing fighter[cite: 1], battling relentless swarms of neon geometric enemies[cite: 1]. Survive as long as possible, gather XP to level up mid-run, and earn coins to purchase persistent meta-upgrades[cite: 1].

✨ Key Features
Dependency-Free Engine: Built purely with vanilla JavaScript, HTML5 Canvas, and CSS3[cite: 1, 2, 3].

Procedural Audio: 100% synthesized, dependency-free sound effects (lasers, explosions, hits) generated dynamically via the Web Audio API OscillatorNode[cite: 1].

Deep Meta-Progression: A persistent coin economy stored in localStorage allows players to upgrade their base Fire Rate, Max HP, Damage, Movement Speed, and Bullet Speed between runs[cite: 1].

Dynamic Arsenal: Cycle seamlessly between the standard rapid-fire gun, a 5-pellet spread shotgun, and a high-damage piercing laser[cite: 1].

Intense Boss Fights: Every 5th wave spawns a Boss featuring a two-phase attack cycle: an expanding "Radial Hell" bullet-hell burst and a lightning-fast "Charge Dash"[cite: 1].

Responsive Controls: Native support for desktop (Keyboard & Mouse) and mobile devices (Virtual Joystick & Dual-Touch aiming)[cite: 1].

🛠️ Under the Hood (Micro-Optimizations)
KritikShoot is engineered for flawless high-Hz performance using advanced game development patterns:

Temporal Interpolation: Positions are cached and rendered using linear interpolation (lerp), eliminating micro-stutters on 120/144Hz displays[cite: 1].

Object Pooling & Dead-Flag Compaction: Bullets and particles are recycled from pre-allocated arrays, and dead entities are bulk-compacted once they cross a 35% threshold to eliminate expensive garbage collection spikes[cite: 1].

Spatial Hash Grid: Swept-circle collision detection (CCD) is optimized through spatial hashing, allowing massive enemy counts without frame drops[cite: 1].

Finite State Machine (FSM): Clean architectural transitions between MENU, PLAYING, PAUSED, LEVEL_UP, and GAME_OVER states[cite: 1].

👾 Enemy Bestiary
Prepare to face a diverse swarm of glowing geometric threats:

Normal / Fast: Green and yellow flankers that rush your position[cite: 1].

Tank: Massive, slow-moving blue hexagons with extremely high HP[cite: 1].

Rusher: Fragile but incredibly fast red chargers[cite: 1].

Ranged: Technological cyan octagons that maintain a specific distance and fire accurate shots[cite: 1].

Exploder: Orange squares that detonate on proximity, causing massive AoE screen-shake damage[cite: 1].

Spread: Purple pentagons that fire a deadly 3-way spread[cite: 1].

🎮 Controls
Desktop
Move: W A S D or Arrow Keys[cite: 1]

Aim / Fire: Mouse Movement & Left Click[cite: 1]

Cycle Weapon: TAB[cite: 1]

Pause: ESC[cite: 1]

Mobile
Move: Left-side Virtual Joystick[cite: 1]

Aim / Fire: Right-side Touch & Drag, or the on-screen FIRE button[cite: 1]

🎨 Design System
The UI utilizes a striking glassmorphism style featuring blur backdrops, neon glows, and custom typography (Orbitron for display text and Rajdhani for HUD elements)[cite: 3]. Player upgrades are tracked via glowing, rounded progress bars directly on the gameplay HUD[cite: 1, 3].

🚀 Quick Start (Local Development)
Because KritikShoot uses zero external image or sound files, running it locally is incredibly simple.

Clone the repository:

git clone https://github.com/LeagueStar/KritikShoot.git

2. Open the directory and serve the files. You can use any local web server (e.g., Python, VS Code Live Server, or Node):
   ```bash
npx serve .
# or
python -m http.server 8000
Open http://localhost:8000 in your browser and Deploy!
