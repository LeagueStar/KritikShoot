#restart 1 (23/08)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Scaling variables
let uiScale = 1;
let baseFontSize = 18;

// UI elements
const restartBtn = document.getElementById('restartBtn');
const mobileControls = document.getElementById('mobileControls');
const joystick = document.getElementById('joystick');
const shootBtn = document.getElementById('shootBtn');
const startBtn = document.getElementById('startBtn');
const nicknameInput = document.getElementById('nicknameInput');
const levelUpScreen = document.getElementById('levelUpScreen');

// Leaderboard implementation
const leaderboard = {
    maxEntries: 10,
    get scores() {
        const saved = localStorage.getItem('globalLeaderboard');
        return saved ? JSON.parse(saved) : [];
    },
    set scores(value) {
        localStorage.setItem('globalLeaderboard', JSON.stringify(value));
    },
    
    addScore: function(nickname, wave, time, level) {
        const newScore = {
            nickname,
            wave,
            time,
            level,
            date: new Date().toISOString()
        };
        
        let scores = this.scores;
        scores.push(newScore);
        
        // Sort by wave descending, then by time descending
        scores.sort((a, b) => b.wave - a.wave || b.time - a.time);
        
        // Remove duplicates and limit entries
        const uniqueScores = [];
        const seen = new Set();
        
        scores.forEach(score => {
            const key = `${score.nickname}-${score.wave}-${score.time.toFixed(1)}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueScores.push(score);
            }
        });
        
        this.scores = uniqueScores.slice(0, this.maxEntries);
        this.display();
    },
    
    display: function(elementId = 'localLeaderboard') {
        const container = document.getElementById(elementId);
        if (!container) return;
        
        const scores = this.scores;
        
        if (scores.length === 0) {
            container.innerHTML = '<h3>No scores yet!</h3>';
            return;
        }
        
        let html = '<h3>Global Leaderboard</h3><table style="width:100%; border-collapse:collapse;">';
        html += '<tr><th>Rank</th><th>Name</th><th>Wave</th><th>Time</th><th>Level</th><th>Date</th></tr>';
        
        scores.forEach((score, index) => {
            const date = new Date(score.date);
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${score.nickname || 'Anonymous'}</td>
                    <td>${score.wave}</td>
                    <td>${score.time.toFixed(1)}s</td>
                    <td>${score.level}</td>
                    <td>${date.toLocaleDateString()}</td>
                </tr>
            `;
        });
        
        html += '</table>';
        container.innerHTML = html;
    }
};

// Resize canvas to fit window with proper scaling
function resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;
    
    // Calculate scaling factor based on screen size
    uiScale = Math.max(0.8, Math.min(width / 800, height / 600));
    document.documentElement.style.setProperty('--ui-scale', uiScale);
    baseFontSize = Math.max(14, 18 * uiScale); // Minimum font size of 14px
    
    // Update CSS variables for mobile controls
    if (isMobile) {
        const joystickRect = joystick.getBoundingClientRect();
        joystickBaseX = joystickRect.left + joystickRect.width / 2;
        joystickBaseY = joystickRect.top + joystickRect.height / 2;
    }
    
    // Reposition player if canvas resizes during game
    if (player.alive) {
        player.x = Math.max(player.size, Math.min(width - player.size, player.x));
        player.y = Math.max(player.size, Math.min(height - player.size, player.y));
    }
}

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

    const waveFactor = Math.max(1, Math.log(waveCount + 1)) * 0.5;
    const enemyType = Math.random() < 0.15 ? 'tank' : 
                     Math.random() < 0.3 ? 'fast' : 
                     Math.random() < 0.45 ? 'spread' : 
                     Math.random() < 0.6 ? 'exploder' : 
                     'normal';
    
    const baseEnemy = {
        x,
        y,
        size: 20 * uiScale, // Scale enemy size
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
                size: 30 * uiScale,
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

// Wall spawning with scaling
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
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

window.addEventListener('click', (e) => {
    if (!player.alive || isPaused) return;
    if (isMobile && e.target !== shootBtn) return;
    
    shoot();
});

// Mobile touch controls
let joystickBaseX = 0;
let joystickBaseY = 0;
let joystickActive = false;
let joystickX = 0;
let joystickY = 0;

function initJoystick() {
    const rect = joystick.getBoundingClientRect();
    joystickBaseX = rect.left + rect.width / 2;
    joystickBaseY = rect.top + rect.height / 2;
}

joystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joystickActive = true;
    const touch = e.touches[0];
    joystickStartX = touch.clientX - joystickBaseX;
    joystickStartY = touch.clientY - joystickBaseY;
    initJoystick();
});

document.addEventListener('touchmove', (e) => {
    if (!joystickActive) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    joystickX = touch.clientX - joystickBaseX - joystickStartX;
    joystickY = touch.clientY - joystickBaseY - joystickStartY;
    
    // Limit joystick movement
    const maxDistance = 40 * uiScale;
    const distance = Math.sqrt(joystickX * joystickX + joystickY * joystickY);
    
    if (distance > maxDistance) {
        joystickX = (joystickX / distance) * maxDistance;
        joystickY = (joystickY / distance) * maxDistance;
    }
    
    // Update joystick visual position
    joystick.style.transform = `translate(${joystickX}px, ${joystickY}px)`;
});

document.addEventListener('touchend', () => {
    joystickActive = false;
    joystickX = 0;
    joystickY = 0;
    joystick.style.transform = 'translate(0, 0)';
});

shootBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!player.alive || isPaused) return;
    shoot();
    // Visual feedback
    shootBtn.style.transform = 'scale(0.9)';
    setTimeout(() => {
        shootBtn.style.transform = 'scale(1)';
    }, 100);
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
            size: (isCrit ? 7 : 5) * uiScale,
            color: isCrit ? 'gold' : 'red',
            damage
        });
    });
    
    player.lastShot = now;
}

// Collision detection with scaling
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
    
    // Create a single handler function to avoid repetition
    const createUpgradeHandler = (upgradeType, extraAction = null) => {
        return () => {
            playerStats.upgrades[upgradeType]++;
            if (extraAction) extraAction();
            levelUpScreen.style.display = 'none';
            
            requestAnimationFrame(() => {
                isPaused = false;
                canvas.focus();
                
                if (!player.alive) return;
                update();
                draw();
            });
        };
    };

    // Clear existing handlers
    const clearHandler = (id) => {
        const el = document.getElementById(id);
        if (el) {
            el.onclick = null;
            if (el._upgradeHandler) {
                el.removeEventListener('click', el._upgradeHandler);
            }
        }
    };

    // Clear all handlers
    clearHandler('upgradeSpeed');
    clearHandler('upgradeHealth');
    clearHandler('upgradeDamage');
    clearHandler('upgradeFireRate');
    clearHandler('upgradeBulletSpeed');
    clearHandler('upgradeCritChance');
    clearHandler('upgradeLifesteal');

    // Set up new handlers
    const setHandler = (id, upgradeType, extraAction = null) => {
        const el = document.getElementById(id);
        if (el) {
            el._upgradeHandler = createUpgradeHandler(upgradeType, extraAction);
            el.onclick = el._upgradeHandler;
        }
    };

    setHandler('upgradeSpeed', 'speed');
    setHandler('upgradeHealth', 'health', () => {
        player.health = player.maxHealth;
    });
    setHandler('upgradeDamage', 'damage');
    setHandler('upgradeFireRate', 'fireRate');
    setHandler('upgradeBulletSpeed', 'bulletSpeed');
    setHandler('upgradeCritChance', 'critChance');
    setHandler('upgradeLifesteal', 'lifesteal');
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

// Update function with optimizations
function update() {
    if (!player.alive || isPaused) return;
    
    gameTime += 16; // Assuming 60fps (~16ms per frame)

    // Player movement
    let moveX = 0;
    let moveY = 0;
    
    if (isMobile && joystickActive) {
        moveX = joystickX / (8 * uiScale); // Scale joystick sensitivity
        moveY = joystickY / (8 * uiScale);
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
                        size: 5 * uiScale,
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
                    size: 5 * uiScale,
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
                if (distToPlayer < 100 * uiScale) {
                    const damage = enemy.damage * 2 * (1 - distToPlayer / (100 * uiScale));
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

        let hit = false;

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
                hit = true;
                break;
            }
        }

        if (hit) continue;

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
            continue;
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

        if (hit) continue;

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
                            size: 10 * uiScale,
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

    // Wave progression - fixed logic
    if (enemies.length === 0 && kills >= waveCount) {
        kills = 0;
        waveCount++;
        
        // Calculate enemies for next wave
        const enemiesToSpawn = Math.min(30, 2 + waveCount);
        
        // Spawn new enemies
        for (let k = 0; k < enemiesToSpawn; k++) {
            spawnEnemy();
        }
        
        // Every 3 waves, spawn new walls
        if (waveCount % 3 === 0) {
            spawnWalls();
        }
        
        cameraShake = 5;
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

// Drawing functions with scaling
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    applyCameraShake();
    
    // Draw walls
    walls.forEach(wall => {
        ctx.fillStyle = '#444';
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
        
        // Health bar
        const healthBarHeight = 5 * uiScale;
        ctx.fillStyle = 'red';
        ctx.fillRect(wall.x, wall.y - healthBarHeight - 2, wall.width, healthBarHeight);
        ctx.fillStyle = 'lime';
        ctx.fillRect(wall.x, wall.y - healthBarHeight - 2, (wall.health / wall.maxHealth) * wall.width, healthBarHeight);
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
        ctx.moveTo(20 * uiScale, 0);     // pointy front
        ctx.lineTo(-10 * uiScale, -10 * uiScale);  // back left
        ctx.lineTo(-10 * uiScale, 10 * uiScale);   // back right
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
        ctx.arc(p.x, p.y, p.size * uiScale, 0, Math.PI * 2);
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
        const healthBarWidth = 40 * uiScale;
        const healthBarHeight = 5 * uiScale;
        ctx.fillStyle = 'red';
        ctx.fillRect(enemy.x - healthBarWidth/2, enemy.y - enemy.size - healthBarHeight - 2, 
                    healthBarWidth, healthBarHeight);
        ctx.fillStyle = 'lime';
        ctx.fillRect(enemy.x - healthBarWidth/2, enemy.y - enemy.size - healthBarHeight - 2, 
                    (enemy.health / enemy.maxHealth) * healthBarWidth, healthBarHeight);
    });

    // Draw enemy bullets
    enemyBullets.forEach(bullet => {
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw UI with scaling
const uiMargin = 20 * uiScale;
const uiLineHeight = 30 * uiScale;
const healthBarWidth = 200 * uiScale;
const healthBarHeight = 20 * uiScale;

// Set font properties
ctx.font = `${baseFontSize}px Arial`;
ctx.fillStyle = 'white';
ctx.textBaseline = 'top'; // Ensure consistent text alignment

// Player health bar (move it down slightly to prevent overlap)
const healthBarY = uiMargin + uiLineHeight;
ctx.fillStyle = 'red';
ctx.fillRect(uiMargin, healthBarY, healthBarWidth, healthBarHeight);
ctx.fillStyle = 'lime';
ctx.fillRect(uiMargin, healthBarY, (player.health / player.maxHealth) * healthBarWidth, healthBarHeight);
ctx.strokeStyle = 'white';
ctx.strokeRect(uiMargin, healthBarY, healthBarWidth, healthBarHeight);

// Game info (positioned above health bar)
let currentY = uiMargin;
ctx.fillText(`Wave: ${waveCount} | Kills: ${kills}/${waveCount} | Enemies: ${enemies.length}`, 
            uiMargin, currentY);
currentY += uiLineHeight;
ctx.fillText(`Health: ${Math.floor(player.health)}/${player.maxHealth}`, uiMargin, currentY);
currentY += uiLineHeight;
ctx.fillText(`Time: ${(gameTime/1000).toFixed(1)}s`, uiMargin, currentY);
currentY += uiLineHeight;
ctx.fillText(`Level: ${playerStats.level} (${playerStats.xp}/${playerStats.xpToNextLevel} XP)`, 
            uiMargin, currentY);
                
    // Active powerups
    let powerupY = 180 * uiScale;
    for (const type in activePowerups) {
        if (activePowerups[type].active) {
            const timeLeft = (activePowerups[type].endTime - Date.now()) / 1000;
            if (timeLeft > 0) {
                ctx.fillText(`${type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${timeLeft.toFixed(1)}s`, 
                            uiMargin, powerupY);
                powerupY += uiLineHeight;
            }
        }
    }

    // Pause screen
    if (isPaused && levelUpScreen.style.display === 'none') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = `${48 * uiScale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
        ctx.font = `${24 * uiScale}px Arial`;
        ctx.fillText('Press ESC to resume', canvas.width / 2, canvas.height / 2 + 50 * uiScale);
    }

    // Game over screen
    if (!player.alive) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = `${48 * uiScale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 80 * uiScale);
        ctx.font = `${24 * uiScale}px Arial`;
        ctx.fillText(`Reached Wave ${waveCount}`, canvas.width / 2, canvas.height / 2 - 30 * uiScale);
        ctx.fillText(`Survived for ${(gameTime/1000).toFixed(1)} seconds`, canvas.width / 2, canvas.height / 2 + 10 * uiScale);
        ctx.fillText(`Level ${playerStats.level}`, canvas.width / 2, canvas.height / 2 + 50 * uiScale);
        
        // Add to leaderboard
        const nickname = localStorage.getItem('playerNickname') || 'Player';
        leaderboard.addScore(nickname, waveCount, gameTime/1000, playerStats.level);
        
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
    
    // Spawn initial enemies (2 for wave 1)
    for (let i = 0; i < 2; i++) {
        spawnEnemy();
    }
    spawnWalls();
    
    // Mobile controls
    isMobile = /Mobi|Android/i.test(navigator.userAgent);
    mobileControls.style.display = isMobile ? 'flex' : 'none';
    
    // UI elements
    restartBtn.style.display = 'none';
    levelUpScreen.style.display = 'none';
    canvas.focus();
    
    // Force a redraw
    if (!player.alive) return;
    update();
    draw();
}

// Game loop function
function gameLoop() {
    if (!isPaused) {
        update();
    }
    draw();
    
    // Add this check to prevent stuck state
    if (levelUpScreen.style.display === 'block') {
        isPaused = true;
    }
    
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
    
    // Get reference to the start screen element
    const startScreen = document.getElementById('startScreen');
    
    // Set up start button handler
    startBtn.addEventListener('click', () => {
        const nickname = nicknameInput.value.trim() || 'Player';
        localStorage.setItem('playerNickname', nickname);
        
        // Hide the start screen
        startScreen.style.display = 'none';
        
        // Focus the canvas for keyboard input
        canvas.focus();
        
        initGame();
        gameLoop();
    });
    
    // Set up restart button handler
    restartBtn.addEventListener('click', () => {
        initGame();
        // Show the start screen again when restarting
        startScreen.style.display = 'block';
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        resizeCanvas();
        // Force a redraw
        draw();
    });
    
    // Initial resize
    resizeCanvas();
}

// Start everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);

