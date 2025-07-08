const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI elements
const restartBtn = document.getElementById('restartBtn');
const mobileControls = document.getElementById('mobileControls');
const joystick = document.getElementById('joystick');
const shootBtn = document.getElementById('shootBtn');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

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

// Player progression
const playerStats = {
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  upgrades: {
    speed: 0,
    health: 0,
    damage: 0,
    fireRate: 0
  }
};

// Player object
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  color: 'white',
  baseSpeed: 5,
  get speed() { return this.baseSpeed + playerStats.upgrades.speed * 0.5; },
  health: 200,
  baseMaxHealth: 200,
  get maxHealth() { return this.baseMaxHealth + playerStats.upgrades.health * 20; },
  alive: true,
  lastShot: 0,
  baseShootDelay: 200,
  get shootDelay() { return this.baseShootDelay - playerStats.upgrades.fireRate * 10; },
  baseDamage: 10,
  get damage() { return this.baseDamage + playerStats.upgrades.damage * 2; }
};

// Initialize game elements
function initGame() {
  bullets = [];
  enemies = [];
  enemyBullets = [];
  powerups = [];
  kills = 0;
  waveCount = 1;
  gameTime = 0;
  player.health = player.maxHealth;
  spawnWalls();
  spawnEnemy();
  
  // Check if mobile
  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    mobileControls.style.display = 'flex';
  } else {
    mobileControls.style.display = 'none';
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
  
  enemies.push({
    x,
    y,
    size: 20,
    color: 'lime',
    speed: 1.5 + Math.random() * 0.5 + waveFactor,
    lastShot: Date.now(),
    shootDelay: 2000 + Math.random() * 1000 - Math.min(1000, waveFactor * 200),
    health: 20 + Math.floor(waveFactor * 10),
    maxHealth: 20 + Math.floor(waveFactor * 10),
    damage: 10 + Math.floor(waveFactor * 2)
  });
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
  if (isMobile && e.target !== shootBtn) return; // Don't shoot when tapping elsewhere on mobile
  
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
  
  let angle;
  if (isMobile) {
    // Auto-aim to nearest enemy
    let closestEnemy = null;
    let minDist = Infinity;
    
    enemies.forEach(enemy => {
      const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (dist < minDist) {
        minDist = dist;
        closestEnemy = enemy;
      }
    });
    
    if (closestEnemy) {
      angle = Math.atan2(closestEnemy.y - player.y, closestEnemy.x - player.x);
    } else {
      // No enemies, shoot in random direction
      angle = Math.random() * Math.PI * 2;
    }
  } else {
    angle = Math.atan2(mouseY - player.y, mouseX - player.x);
  }
  
  const speed = 10;
  bullets.push({
    x: player.x,
    y: player.y,
    dx: Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed,
    size: 5,
    color: 'red',
    damage: player.damage
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
  const levelUpScreen = document.getElementById('levelUpScreen');
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
    if (keys['w']) moveY -= player.speed;
    if (keys['s']) moveY += player.speed;
    if (keys['a']) moveX -= player.speed;
    if (keys['d']) moveX += player.speed;
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
      enemyBullets.push({
        x: enemy.x,
        y: enemy.y,
        dx: Math.cos(angle) * 6,
        dy: Math.sin(angle) * 6,
        size: 5,
        color: 'orange',
        damage: enemy.damage
      });
      enemy.lastShot = Date.now();
    }
  });

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
      player.health -= bullet.damage;
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
      if (p.type === 'health') {
        player.health = Math.min(player.maxHealth, player.health + 20);
      } else if (p.type === 'xp') {
        addXP(25);
      }
      powerups.splice(i, 1);
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

        if (enemy.health <= 0) {
          // Chance to drop powerup
          if (Math.random() < 0.2) {
            powerups.push({
              x: enemy.x,
              y: enemy.y,
              type: Math.random() < 0.7 ? 'health' : 'xp',
              size: 10,
              color: Math.random() < 0.7 ? 'pink' : 'yellow'
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
  ctx.fillText(`Health: ${player.health}/${player.maxHealth}`, 20, 90);
  ctx.fillText(`Time: ${(gameTime/1000).toFixed(1)}s`, 20, 120);
  ctx.fillText(`Level: ${playerStats.level} (${playerStats.xp}/${playerStats.xpToNextLevel} XP)`, 20, 150);

  // Pause screen
  if (isPaused && document.getElementById('levelUpScreen').style.display === 'none') {
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
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    ctx.font = '24px Arial';
    ctx.fillText(`Reached Wave ${Math.floor(Math.log2(waveCount)) + 1}`, canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText(`Survived for ${(gameTime/1000).toFixed(1)} seconds`, canvas.width / 2, canvas.height / 2 + 90);
    ctx.fillText(`Level ${playerStats.level}`, canvas.width / 2, canvas.height / 2 + 130);
    restartBtn.style.display = 'block';
  }
}

// Game loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Restart handler
restartBtn.addEventListener('click', () => {
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
    fireRate: 0
  };
  
  initGame();
  restartBtn.style.display = 'none';
  document.getElementById('levelUpScreen').style.display = 'none';
});

// Handle window resize
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// Start the game
initGame();
gameLoop();
