const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI elements
const restartBtn = document.getElementById('restartBtn');
const mobileControls = document.getElementById('mobileControls');
const joystick = document.getElementById('joystick');
const shootBtn = document.getElementById('shootBtn');
const startBtn = document.getElementById('startBtn');
const nicknameInput = document.getElementById('nicknameInput');
const levelUpScreen = document.getElementById('levelUpScreen');

// Leaderboard
const leaderboard = {
  maxEntries: 10,
  scores: JSON.parse(localStorage.getItem('leaderboard')) || [],
  
  addScore: function(nickname, wave, time, level) {
    this.scores.push({
      nickname,
      wave,
      time,
      level,
      date: new Date().toLocaleDateString()
    });
    
    // Sort by wave then time
    this.scores.sort((a, b) => b.wave - a.wave || b.time - a.time);
    
    // Keep only top scores
    if (this.scores.length > this.maxEntries) {
      this.scores = this.scores.slice(0, this.maxEntries);
    }
    
    localStorage.setItem('leaderboard', JSON.stringify(this.scores));
    this.display();
  },
  
  display: function(elementId = 'localLeaderboard') {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    if (this.scores.length === 0) {
      container.innerHTML = '<h3>No scores yet!</h3>';
      return;
    }
    
    let html = '<h3>Leaderboard</h3><table style="width:100%; border-collapse:collapse;">';
    html += '<tr><th>Rank</th><th>Name</th><th>Wave</th><th>Time</th></tr>';
    
    this.scores.forEach((score, index) => {
      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${score.nickname || 'Anonymous'}</td>
          <td>${score.wave}</td>
          <td>${score.time.toFixed(1)}s</td>
        </tr>
      `;
    });
    
    html += '</table>';
    container.innerHTML = html;
  }
};

// Resize canvas to fit window
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game state variables
let isPaused = false;
let bullets = [];
let keys = {};
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let enemies = [];
let enemyBullets = [];
let walls = [];
let powerups = [];
let kills = 0;
let waveCount = 1;
let gameTime = 0;
let isMobile = false;
let particles = [];
let cameraShake = 0;
const MAX_SHAKE = 10;

const POWERUP_TYPES = {
  HEALTH: 'health',
  XP: 'xp',
  SHIELD: 'shield',
  TRIPLE_SHOT: 'triple_shot',
  SPEED_BOOST: 'speed_boost',
  RAGE: 'rage'
};

const activePowerups = {
  shield: { active: false, endTime: 0 },
  tripleShot: { active: false, endTime: 0 },
  speedBoost: { active: false, endTime: 0 },
  rage: { active: false, endTime: 0 }
};

// Player progression
const playerStats = {
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  upgrades: {
    speed: 0,
    health: 0,
    damage: 0,
    fireRate: 0,
    bulletSpeed: 0,
    critChance: 0,
    lifesteal: 0
  }
};

// Player object
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  color: 'white',
  baseSpeed: 5,
  get speed() { 
    return this.baseSpeed + 
           playerStats.upgrades.speed * 0.5 + 
           (activePowerups.speedBoost.active ? 3 : 0); 
  },
  health: 200,
  baseMaxHealth: 200,
  get maxHealth() { return this.baseMaxHealth + playerStats.upgrades.health * 20; },
  alive: true,
  lastShot: 0,
  baseShootDelay: 200,
  get shootDelay() { return this.baseShootDelay - playerStats.upgrades.fireRate * 10; },
  baseDamage: 10,
  get damage() { return this.baseDamage + playerStats.upgrades.damage * 2; },
  get bulletSpeed() { return 10 + playerStats.upgrades.bulletSpeed * 0.5; },
  get critChance() { return playerStats.upgrades.critChance * 0.01; },
  get lifesteal() { return playerStats.upgrades.lifesteal * 0.01; }
};

// Camera shake effect
function applyCameraShake() {
  if (cameraShake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * cameraShake,
      (Math.random() - 0.5) * cameraShake
    );
    cameraShake *= 0.9; // Decay
    if (cameraShake < 0.1) cameraShake = 0;
  }
}

// Enemy spawning with scaling difficulty
function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  
  if (side === 0) { x = 0; y = Math.random() * canvas.height; }
  else if (side === 1) { x = canvas.width; y = Math.random() * canvas.height; }
  else if (side === 2) { x = Math.random() * canvas.width; y = 0; }
  else { x = Math.random() * canvas.width; y = canvas.height; }

  const waveFactor = Math.log2(waveCount) * 0.2;
  const enemyType = Math.random() < 0.15 ? 'tank' : 
                   Math.random() < 0.3 ? 'fast' : 
                   Math.random() < 0.45 ? 'spread' : 
                   Math.random() < 0.6 ? 'exploder' : 
                   'normal';
  
  const baseEnemy = {
    x,
    y,
    size: 20,
    lastShot: Date.now(),
    health: 20 + Math.floor(waveFactor * 10),
    maxHealth: 20 + Math.floor(waveFactor * 10),
    damage: 10 + Math.floor(waveFactor * 2)
  };

  switch(enemyType) {
    case 'tank':
      enemies.push({
        ...baseEnemy,
        color: 'blue',
        size: 30,
        speed: 0.8 + Math.random() * 0.3,
        health: baseEnemy.health * 2,
        maxHealth: baseEnemy.maxHealth * 2,
        shootDelay: 3000,
        type: 'tank'
      });
      break;
    case 'fast':
      enemies.push({
        ...baseEnemy,
        color: 'yellow',
        speed: 3 + Math.random() * 0.5,
        health: baseEnemy.health * 0.7,
        maxHealth: baseEnemy.maxHealth * 0.7,
        shootDelay: 1500,
        type: 'fast'
      });
      break;
    case 'spread':
      enemies.push({
        ...baseEnemy,
        color: 'purple',
        speed: 1.2 + Math.random() * 0.3,
        shootDelay: 2500,
        type: 'spread'
      });
      break;
    case 'exploder':
      enemies.push({
        ...baseEnemy,
        color: 'orange',
        speed: 1.0 + Math.random() * 0.2,
        shootDelay: 4000,
        type: 'exploder'
      });
      break;
    default:
      enemies.push({
        ...baseEnemy,
        color: 'lime',
        speed: 1.5 + Math.random() * 0.5,
        shootDelay: 2000 + Math.random() * 1000 - Math.min(1000, waveFactor * 200),
        type: 'normal'
      });
  }
}

// Wall spawning
function spawnWalls() {
  walls = [];
  const count = Math.floor(Math.random() * 6) + 5; // 5-10 walls

  for (let i = 0; i < count; i++) {
    walls.push({
      x: Math.random() * (canvas.width - 200),
      y: Math.random() * (canvas.height - 100),
      width: Math.random() * 100 + 100,
      height: 20 + Math.random() * 30,
      health: Math.floor(Math.random() * 5) + 3,
      maxHealth: 10
    });
  }
}

// Input handlers
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Escape') isPaused = !isPaused;
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

window.addEventListener('click', (e) => {
  if (!player.alive || isPaused) return;
  if (isMobile && e.target !== shootBtn) return;
  
  shoot();
});

// Mobile touch controls
let joystickActive = false;
let joystickStartX = 0;
let joystickStartY = 0;
let joystickX = 0;
let joystickY = 0;

joystick.addEventListener('touchstart', (e) => {
  joystickActive = true;
  const touch = e.touches[0];
  joystickStartX = touch.clientX;
  joystickStartY = touch.clientY;
  joystick.style.left = (touch.clientX - 40) + 'px';
  joystick.style.top = (touch.clientY - 40) + 'px';
  e.preventDefault();
});

document.addEventListener('touchmove', (e) => {
  if (!joystickActive) return;
  const touch = e.touches[0];
  joystickX = touch.clientX - joystickStartX;
  joystickY = touch.clientY - joystickStartY;
  
  // Limit joystick movement
  const distance = Math.sqrt(joystickX * joystickX + joystickY * joystickY);
  if (distance > 40) {
    joystickX = (joystickX / distance) * 40;
    joystickY = (joystickY / distance) * 40;
  }
  
  joystick.style.transform = `translate(${joystickX}px, ${joystickY}px)`;
  e.preventDefault();
});

document.addEventListener('touchend', () => {
  joystickActive = false;
  joystickX = 0;
  joystickY = 0;
  joystick.style.transform = 'translate(0, 0)';
});

shootBtn.addEventListener('touchstart', (e) => {
  if (!player.alive || isPaused) return;
  shoot();
  e.preventDefault();
});

function shoot() {
  const now = Date.now();
  if (now - player.lastShot < player.shootDelay) return;
  
  let angles = [];
  
  // Determine shooting angles
  if (activePowerups.tripleShot.active) {
    const mainAngle = isMobile ? 
      (enemies.length > 0 ? Math.atan2(enemies[0].y - player.y, enemies[0].x - player.x) : Math.random() * Math.PI * 2) :
      Math.atan2(mouseY - player.y, mouseX - player.x);
    
    angles = [mainAngle, mainAngle - 0.3, mainAngle + 0.3];
  } else {
    let angle;
    if (isMobile) {
      if (enemies.length > 0) {
        angle = Math.atan2(enemies[0].y - player.y, enemies[0].x - player.x);
      } else {
        angle = Math.random() * Math.PI * 2;
      }
    } else {
      angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    }
    angles = [angle];
  }
  
  // Create bullets
  angles.forEach(angle => {
    const isCrit = Math.random() < player.critChance;
    const damage = activePowerups.rage.active ? 
      player.damage * 2 : 
      (isCrit ? player.damage * 1.5 : player.damage);
    
    bullets.push({
      x: player.x,
      y: player.y,
      dx: Math.cos(angle) * player.bulletSpeed,
      dy: Math.sin(angle) * player.bulletSpeed,
      size: isCrit ? 7 : 5,
      color: isCrit ? 'gold' : 'red',
      damage
    });
  });
  
  player.lastShot = now;
}

// Collision detection
function checkCollision(x, y, size) {
  for (let wall of walls) {
    if (
      x + size > wall.x &&
      x - size < wall.x + wall.width &&
      y + size > wall.y &&
      y - size < wall.y + wall.height
    ) {
      return true;
    }
  }
  return false;
}

// Add XP and level up
function addXP(amount) {
  playerStats.xp += amount;
  if (playerStats.xp >= playerStats.xpToNextLevel) {
    playerStats.level++;
    playerStats.xp -= playerStats.xpToNextLevel;
    playerStats.xpToNextLevel = Math.floor(playerStats.xpToNextLevel * 1.2);
    
    // Show level up screen
    showLevelUp();
  }
}

// Show level up options
function showLevelUp() {
  isPaused = true;
  levelUpScreen.style.display = 'block';
  
  document.getElementById('upgradeSpeed').onclick = () => {
    playerStats.upgrades.speed++;
    levelUpScreen.style.display = 'none';
    isPaused = false;
  };
  
  document.getElementById('upgradeHealth').onclick = () => {
    playerStats.upgrades.health++;
    player.health = player.maxHealth; // Heal to full when upgrading health
    levelUpScreen.style.display = 'none';
    isPaused = false;
  };
  
  document.getElementById('upgradeDamage').onclick = () => {
    playerStats.upgrades.damage++;
    levelUpScreen.style.display = 'none';
    isPaused = false;
  };
  
  document.getElementById('upgradeFireRate').onclick = () => {
    playerStats.upgrades.fireRate++;
    levelUpScreen.style.display = 'none';
    isPaused = false;
  };
  
  document.getElementById('upgradeBulletSpeed').onclick = () => {
    playerStats.upgrades.bulletSpeed++;
    levelUpScreen.style.display = 'none';
    isPaused = false;
  };
  
  document.getElementById('upgradeCritChance').onclick = () => {
    playerStats.upgrades.critChance++;
    levelUpScreen.style.display = 'none';
    isPaused = false;
  };
  
  document.getElementById('upgradeLifesteal').onclick = () => {
    playerStats.upgrades.lifesteal++;
    levelUpScreen.style.display = 'none';
    isPaused = false;
  };
}

// Enemy Death Particles
function createParticles(x, y, color, count = 20) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    particles.push({
      x,
      y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      size: Math.random() * 4 + 2,
      color,
      life: 30 + Math.random() * 30
    });
  }
}

// Game update logic
function update() {
  if (!player.alive || isPaused) return;
  
  gameTime += 16; // Assuming 60fps (~16ms per frame)

  // Player movement
  let moveX = 0;
  let moveY = 0;
  
  if (isMobile && joystickActive) {
    moveX = joystickX / 8;
    moveY = joystickY / 8;
  } else {
    if (keys['w'] || keys['arrowup']) moveY -= player.speed;
    if (keys['s'] || keys['arrowdown']) moveY += player.speed;
    if (keys['a'] || keys['arrowleft']) moveX -= player.speed;
    if (keys['d'] || keys['arrowright']) moveX += player.speed;
  }
  
  // Normalize diagonal movement
  if (moveX !== 0 && moveY !== 0) {
    moveX *= 0.7071; // 1/sqrt(2)
    moveY *= 0.7071;
  }
  
  let nextX = player.x + moveX;
  let nextY = player.y + moveY;

  if (!checkCollision(nextX, player.y, player.size)) player.x = nextX;
  if (!checkCollision(player.x, nextY, player.size)) player.y = nextY;

  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));

  // Enemy update
  enemies.forEach(enemy => {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    
    let nextX = enemy.x + Math.cos(angle) * enemy.speed;
    let nextY = enemy.y + Math.sin(angle) * enemy.speed;

    if (!checkCollision(nextX, nextY, enemy.size)) {
      enemy.x = nextX;
      enemy.y = nextY;
    }

    // Enemy shooting
    if (Date.now() - enemy.lastShot > enemy.shootDelay && 
        !checkCollision(enemy.x, enemy.y, enemy.size)) {
    
      if (enemy.type === 'spread') {
        // Spread shooter - fires 3 bullets
        for (let i = -1; i <= 1; i++) {
          const spreadAngle = angle + i * 0.3;
          enemyBullets.push({
            x: enemy.x,
            y: enemy.y,
            dx: Math.cos(spreadAngle) * 6,
            dy: Math.sin(spreadAngle) * 6,
            size: 5,
            color: 'purple',
            damage: enemy.damage
          });
        }
      } else {
        // Normal shooting
        enemyBullets.push({
          x: enemy.x,
          y: enemy.y,
          dx: Math.cos(angle) * 6,
          dy: Math.sin(angle) * 6,
          size: 5,
          color: enemy.type === 'tank' ? 'blue' : 
                 enemy.type === 'fast' ? 'yellow' : 
                 enemy.type === 'exploder' ? 'orange' : 'red',
          damage: enemy.damage
        });
      }
      
      enemy.lastShot = Date.now();
      
      if (enemy.type === 'exploder') {
        // Exploding enemy dies after shooting
        createParticles(enemy.x, enemy.y, 'orange', 30);
        enemies.splice(enemies.indexOf(enemy), 1);
        
        // Explosion damage to player
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer < 100) {
          const damage = enemy.damage * 2 * (1 - distToPlayer / 100);
          player.health -= damage;
          cameraShake = MAX_SHAKE * 1.5;
        }
      }
    }
  });

  // Particle update
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.life--;
    
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  // Enemy bullet update
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const bullet = enemyBullets[i];
    bullet.x += bullet.dx;
    bullet.y += bullet.dy;

    // Wall collision
    for (let j = walls.length - 1; j >= 0; j--) {
      const wall = walls[j];
      if (
        bullet.x > wall.x && bullet.x < wall.x + wall.width &&
        bullet.y > wall.y && bullet.y < wall.y + wall.height
      ) {
        wall.health -= bullet.damage;
        enemyBullets.splice(i, 1);
        if (wall.health <= 0) walls.splice(j, 1);
        break;
      }
    }

    // Player collision
    const dist = Math.hypot(bullet.x - player.x, bullet.y - player.y);
    if (dist < player.size + bullet.size) {
      if (!activePowerups.shield.active) {
        player.health -= bullet.damage;
      }
      enemyBullets.splice(i, 1);
      if (player.health <= 0) player.alive = false;
      continue;
    }

    // Boundary check
    if (
      bullet.x < 0 || bullet.x > canvas.width ||
      bullet.y < 0 || bullet.y > canvas.height
    ) {
      enemyBullets.splice(i, 1);
    }
  }

  // Powerup collection
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    const dist = Math.hypot(player.x - p.x, player.y - p.y);
    if (dist < player.size + p.size) {
      switch(p.type) {
        case POWERUP_TYPES.HEALTH:
          player.health = Math.min(player.maxHealth, player.health + 20);
          break;
        case POWERUP_TYPES.XP:
          addXP(25);
          break;
        case POWERUP_TYPES.SHIELD:
          activePowerups.shield.active = true;
          activePowerups.shield.endTime = Date.now() + 10000; // 10 seconds
          break;
        case POWERUP_TYPES.TRIPLE_SHOT:
          activePowerups.tripleShot.active = true;
          activePowerups.tripleShot.endTime = Date.now() + 8000; // 8 seconds
          break;
        case POWERUP_TYPES.SPEED_BOOST:
          activePowerups.speedBoost.active = true;
          activePowerups.speedBoost.endTime = Date.now() + 7000; // 7 seconds
          break;
        case POWERUP_TYPES.RAGE:
          activePowerups.rage.active = true;
          activePowerups.rage.endTime = Date.now() + 5000; // 5 seconds
          break;
      }
      createParticles(p.x, p.y, p.color);
      powerups.splice(i, 1);
    }
  }

  // Check powerup expiration
  const now = Date.now();
  for (const type in activePowerups) {
    if (activePowerups[type].active && now > activePowerups[type].endTime) {
      activePowerups[type].active = false;
    }
  }

  // Player bullet update
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += bullet.dx;
    bullet.y += bullet.dy;

    let hit = false;

    // Wall collision
    for (let j = walls.length - 1; j >= 0; j--) {
      const wall = walls[j];
      if (
        bullet.x > wall.x && bullet.x < wall.x + wall.width &&
        bullet.y > wall.y && bullet.y < wall.y + wall.height
      ) {
        wall.health -= bullet.damage;
        bullets.splice(i, 1);
        hit = true;
        if (wall.health <= 0) walls.splice(j, 1);
        break;
      }
    }

    // Enemy collision
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);

      if (dist < bullet.size + enemy.size) {
        enemy.health -= bullet.damage;
        bullets.splice(i, 1);
        hit = true;

        // Apply lifesteal
        if (player.lifesteal > 0) {
          player.health = Math.min(player.maxHealth, player.health + bullet.damage * player.lifesteal);
        }

        if (enemy.health <= 0) {
          // Chance to drop powerup
          if (Math.random() < 0.2) {
            const powerupType = Math.random() < 0.7 ? POWERUP_TYPES.HEALTH : 
                               Math.random() < 0.8 ? POWERUP_TYPES.XP :
                               Math.random() < 0.85 ? POWERUP_TYPES.SHIELD :
                               Math.random() < 0.9 ? POWERUP_TYPES.TRIPLE_SHOT :
                               Math.random() < 0.95 ? POWERUP_TYPES.SPEED_BOOST :
                               POWERUP_TYPES.RAGE;
            
            powerups.push({
              x: enemy.x,
              y: enemy.y,
              type: powerupType,
              size: 10,
              color: powerupType === POWERUP_TYPES.HEALTH ? 'pink' : 
                     powerupType === POWERUP_TYPES.XP ? 'yellow' :
                     powerupType === POWERUP_TYPES.SHIELD ? 'cyan' :
                     powerupType === POWERUP_TYPES.TRIPLE_SHOT ? 'magenta' :
                     powerupType === POWERUP_TYPES.SPEED_BOOST ? 'lime' :
                     'red'
            });
          }
          
          enemies.splice(j, 1);
          kills++;
          addXP(10 + Math.floor(Math.log2(waveCount)) * 2);

          // Wave progression
          if (kills >= waveCount) {
            kills = 0;
            waveCount += 2;
            for (let k = 0; k < waveCount; k++) {
              setTimeout(spawnEnemy, k * 500); // Staggered spawning
            }
            spawnWalls();
          }
        }
        break;
      }
    }

    // Boundary check
    if (!hit && (
      bullet.x < 0 || bullet.x > canvas.width ||
      bullet.y < 0 || bullet.y > canvas.height
    )) {
      bullets.splice(i, 1);
    }
  }
}

// Drawing functions
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  applyCameraShake();
  
  // Draw walls
  walls.forEach(wall => {
    ctx.fillStyle = '#444';
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    
    // Health bar
    ctx.fillStyle = 'red';
    ctx.fillRect(wall.x, wall.y - 10, wall.width, 5);
    ctx.fillStyle = 'lime';
    ctx.fillRect(wall.x, wall.y - 10, (wall.health / wall.maxHealth) * wall.width, 5);
  });

  // Draw powerups
  powerups.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw player (as rotated triangle)
  if (player.alive) {
    const angle = isMobile && enemies.length > 0 ? 
      Math.atan2(enemies[0].y - player.y, enemies[0].x - player.x) : 
      Math.atan2(mouseY - player.y, mouseX - player.x);
    
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(angle);
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.moveTo(20, 0);     // pointy front
    ctx.lineTo(-10, -10);  // back left
    ctx.lineTo(-10, 10);   // back right
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Draw bullets
  bullets.forEach(bullet => {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw particles
  particles.forEach(p => {
    ctx.globalAlpha = p.life / 60; // Fade out
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Draw enemies
  enemies.forEach(enemy => {
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Enemy health bar
    ctx.fillStyle = 'red';
    ctx.fillRect(enemy.x - 20, enemy.y - 25, 40, 5);
    ctx.fillStyle = 'lime';
    ctx.fillRect(enemy.x - 20, enemy.y - 25, (enemy.health / enemy.maxHealth) * 40, 5);
  });

  // Draw enemy bullets
  enemyBullets.forEach(bullet => {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw UI
  // Player health bar
  ctx.fillStyle = 'red';
  ctx.fillRect(20, 20, 200, 20);
  ctx.fillStyle = 'lime';
  ctx.fillRect(20, 20, (player.health / player.maxHealth) * 200, 20);
  ctx.strokeStyle = 'white';
  ctx.strokeRect(20, 20, 200, 20);

  // Game info
  ctx.fillStyle = 'white';
  ctx.font = '18px Arial';
  ctx.fillText(`Wave: ${Math.floor(Math.log2(waveCount)) + 1} | Kills: ${kills}/${waveCount}`, 20, 60);
  ctx.fillText(`Health: ${Math.floor(player.health)}/${player.maxHealth}`, 20, 90);
  ctx.fillText(`Time: ${(gameTime/1000).toFixed(1)}s`, 20, 120);
  ctx.fillText(`Level: ${playerStats.level} (${playerStats.xp}/${playerStats.xpToNextLevel} XP)`, 20, 150);

  // Active powerups
  let powerupY = 180;
  for (const type in activePowerups) {
    if (activePowerups[type].active) {
      const timeLeft = (activePowerups[type].endTime - Date.now()) / 1000;
      if (timeLeft > 0) {
        ctx.fillText(`${type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${timeLeft.toFixed(1)}s`, 20, powerupY);
        powerupY += 30;
      }
    }
  }

  // Pause screen
  if (isPaused && levelUpScreen.style.display === 'none') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
    ctx.font = '24px Arial';
    ctx.fillText('Press ESC to resume', canvas.width / 2, canvas.height / 2 + 50);
  }

  // Game over screen
  if (!player.alive) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 80);
    ctx.font = '24px Arial';
    ctx.fillText(`Reached Wave ${Math.floor(Math.log2(waveCount)) + 1}`, canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillText(`Survived for ${(gameTime/1000).toFixed(1)} seconds`, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText(`Level ${playerStats.level}`, canvas.width / 2, canvas.height / 2 + 50);
    
    // Add to leaderboard
    const nickname = localStorage.getItem('playerNickname') || 'Player';
    leaderboard.addScore(nickname, Math.floor(Math.log2(waveCount)) + 1, gameTime/1000, playerStats.level);
    
    restartBtn.style.display = 'block';
  }

  ctx.restore();
}

function initGame() {
  // Reset game state
  bullets = [];
  enemies = [];
  enemyBullets = [];
  walls = [];
  powerups = [];
  particles = [];
  kills = 0;
  waveCount = 1;
  gameTime = 0;
  cameraShake = 0;
  
  // Reset player
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.health = player.maxHealth;
  player.alive = true;
  isPaused = false;
  
  // Reset player stats
  playerStats.level = 1;
  playerStats.xp = 0;
  playerStats.xpToNextLevel = 100;
  playerStats.upgrades = {
    speed: 0,
    health: 0,
    damage: 0,
    fireRate: 0,
    bulletSpeed: 0,
    critChance: 0,
    lifesteal: 0
  };
  
  // Reset powerups
  for (const type in activePowerups) {
    activePowerups[type].active = false;
  }
  
  // Spawn initial enemies and walls
  for (let i = 0; i < 3; i++) {
    spawnEnemy();
  }
  spawnWalls();
  
  // Check if mobile
  isMobile = /Mobi|Android/i.test(navigator.userAgent);
  mobileControls.style.display = isMobile ? 'flex' : 'none';
  
  // Hide restart button
  restartBtn.style.display = 'none';
  
  // Hide level up screen
  levelUpScreen.style.display = 'none';
}

// Game loop function
function gameLoop() {
  if (!isPaused) {
    update();
  }
  draw();
  requestAnimationFrame(gameLoop);
}

// Initialize the game
function initialize() {
  // Load nickname if exists
  const savedName = localStorage.getItem('playerNickname');
  if (savedName) {
    nicknameInput.value = savedName;
  }
  leaderboard.display();
  
  // Set up start button handler
  startBtn.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim() || 'Player';
    localStorage.setItem('playerNickname', nickname);
    
    initGame();
    gameLoop();
  });
  
  // Set up restart button handler
  restartBtn.addEventListener('click', () => {
    initGame();
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    resizeCanvas();
  });
}

// Start everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);
