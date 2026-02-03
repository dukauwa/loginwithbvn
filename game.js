/**
 * VORTEX RUNNER - High-Speed Tunnel Racing Game
 * A visually stunning tunnel runner with obstacles, power-ups, and escalating difficulty
 */

// ==================== GAME CONFIGURATION ====================
const CONFIG = {
    // Tunnel settings
    tunnel: {
        segments: 120,
        segmentDepth: 25,
        baseRadius: 280,
        minRadius: 120,
        sides: 24,
        bendStrength: 0.015,
        colorShiftSpeed: 0.001
    },

    // Player settings
    player: {
        size: 18,
        moveSpeed: 0.08,
        maxAngle: Math.PI * 0.75,
        hitboxRadius: 12
    },

    // Game settings
    game: {
        baseSpeed: 8,
        maxSpeed: 28,
        speedIncrement: 0.0015,
        obstacleSpawnRate: 0.025,
        powerUpSpawnRate: 0.008,
        difficultyScaleRate: 0.0001
    },

    // Visual settings
    visual: {
        particleCount: 80,
        starCount: 200,
        glowIntensity: 1.0
    }
};

// ==================== COLOR PALETTES ====================
const PALETTES = [
    { primary: '#00f5ff', secondary: '#ff00ff', accent: '#ffff00', name: 'cyber' },
    { primary: '#ff6600', secondary: '#ff0066', accent: '#ffcc00', name: 'inferno' },
    { primary: '#00ff88', secondary: '#00ccff', accent: '#ffffff', name: 'matrix' },
    { primary: '#ff00ff', secondary: '#00ffff', accent: '#ff88ff', name: 'vapor' },
    { primary: '#8800ff', secondary: '#ff0088', accent: '#00ff88', name: 'dream' },
    { primary: '#ff3366', secondary: '#3366ff', accent: '#33ff66', name: 'neon' }
];

// ==================== GAME STATE ====================
const gameState = {
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    highScore: parseInt(localStorage.getItem('vortexHighScore')) || 0,
    speed: CONFIG.game.baseSpeed,
    distance: 0,
    difficulty: 1,

    // Player state
    player: {
        angle: 0,
        targetAngle: 0,
        radiusOffset: 0,
        hasShield: false,
        shieldTime: 0,
        isInvincible: false,
        invincibleTime: 0
    },

    // Power-up state
    powerUp: {
        current: null,
        active: false,
        duration: 0
    },

    // Multiplier state
    multiplier: {
        value: 1,
        time: 0
    },

    // Time manipulation
    timeScale: 1,
    slowMoTime: 0,

    // Visual state
    tunnelOffset: 0,
    colorPhase: 0,
    currentPalette: 0,
    screenShake: 0,

    // Collections
    obstacles: [],
    powerUps: [],
    particles: [],
    stars: [],
    tunnelBends: []
};

// ==================== CANVAS SETUP ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let centerX, centerY;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ==================== INPUT HANDLING ====================
const keys = {
    left: false,
    right: false,
    space: false
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === ' ') {
        keys.space = true;
        if (gameState.running && !gameState.paused) {
            activatePowerUp();
        }
    }
    if (e.key === 'Escape' && gameState.running) {
        togglePause();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if (e.key === ' ') keys.space = false;
});

// Touch controls
let touchStartX = 0;
canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touchX = e.touches[0].clientX;
    const deltaX = touchX - touchStartX;
    gameState.player.targetAngle = (deltaX / canvas.width) * Math.PI * 2;
    gameState.player.targetAngle = Math.max(-CONFIG.player.maxAngle,
        Math.min(CONFIG.player.maxAngle, gameState.player.targetAngle));
});

canvas.addEventListener('touchend', () => {
    gameState.player.targetAngle = 0;
});

// ==================== UI ELEMENTS ====================
const UI = {
    startScreen: document.getElementById('start-screen'),
    gameUI: document.getElementById('game-ui'),
    pauseScreen: document.getElementById('pause-screen'),
    gameoverScreen: document.getElementById('gameover-screen'),
    score: document.getElementById('score'),
    finalScore: document.getElementById('final-score'),
    highScore: document.getElementById('high-score'),
    speedFill: document.getElementById('speed-fill'),
    multiplierContainer: document.getElementById('multiplier-container'),
    multiplier: document.getElementById('multiplier'),
    powerUpSlot: document.getElementById('power-up-slot'),
    powerUpIcon: document.getElementById('power-up-icon'),
    powerUpName: document.getElementById('power-up-name'),
    shieldIndicator: document.getElementById('shield-indicator'),
    flashOverlay: document.getElementById('flash-overlay'),
    slowmoOverlay: document.getElementById('slowmo-overlay'),
    warpLines: document.getElementById('warp-lines')
};

// Button handlers
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('resume-btn').addEventListener('click', togglePause);

// ==================== TUNNEL GENERATION ====================
function initializeTunnel() {
    gameState.tunnelBends = [];
    for (let i = 0; i < CONFIG.tunnel.segments + 50; i++) {
        gameState.tunnelBends.push({
            x: 0,
            y: 0,
            radius: CONFIG.tunnel.baseRadius,
            rotation: 0,
            colorOffset: 0
        });
    }
}

function updateTunnelBends(deltaTime) {
    const bendNoise = performance.now() * 0.0003;

    for (let i = gameState.tunnelBends.length - 1; i > 0; i--) {
        gameState.tunnelBends[i].x = gameState.tunnelBends[i - 1].x;
        gameState.tunnelBends[i].y = gameState.tunnelBends[i - 1].y;
        gameState.tunnelBends[i].radius = gameState.tunnelBends[i - 1].radius;
        gameState.tunnelBends[i].rotation = gameState.tunnelBends[i - 1].rotation;
        gameState.tunnelBends[i].colorOffset = gameState.tunnelBends[i - 1].colorOffset;
    }

    // Generate new bend at front
    const bendStrength = CONFIG.tunnel.bendStrength * (1 + gameState.difficulty * 0.3);
    const targetX = Math.sin(bendNoise * 2.3) * bendStrength * 100;
    const targetY = Math.cos(bendNoise * 1.7) * bendStrength * 60;

    gameState.tunnelBends[0].x = targetX;
    gameState.tunnelBends[0].y = targetY;

    // Dynamic radius (tunnel narrowing)
    const radiusNoise = Math.sin(bendNoise * 3.1) * 0.5 + 0.5;
    const minRadius = CONFIG.tunnel.minRadius + (CONFIG.tunnel.baseRadius - CONFIG.tunnel.minRadius) * (1 - gameState.difficulty * 0.3);
    gameState.tunnelBends[0].radius = minRadius + radiusNoise * (CONFIG.tunnel.baseRadius - minRadius);

    // Tunnel rotation
    gameState.tunnelBends[0].rotation = Math.sin(bendNoise * 1.5) * 0.3;

    // Color shifting
    gameState.tunnelBends[0].colorOffset = (performance.now() * CONFIG.tunnel.colorShiftSpeed) % 1;
}

function getTunnelPosition(segmentIndex, angle) {
    const bend = gameState.tunnelBends[segmentIndex] || gameState.tunnelBends[gameState.tunnelBends.length - 1];
    const depth = segmentIndex * CONFIG.tunnel.segmentDepth;
    const perspective = 1 / (1 + depth * 0.008);

    // Accumulate bends for proper curve
    let accX = 0, accY = 0, accRotation = 0;
    for (let i = 0; i <= segmentIndex && i < gameState.tunnelBends.length; i++) {
        accX += gameState.tunnelBends[i].x * perspective;
        accY += gameState.tunnelBends[i].y * perspective;
        accRotation += gameState.tunnelBends[i].rotation * 0.1;
    }

    const adjustedAngle = angle + accRotation;
    const radius = bend.radius * perspective;

    return {
        x: centerX + accX + Math.cos(adjustedAngle) * radius,
        y: centerY + accY + Math.sin(adjustedAngle) * radius,
        depth: depth,
        perspective: perspective,
        radius: radius,
        colorOffset: bend.colorOffset
    };
}

// ==================== RENDERING ====================
function getCurrentPalette() {
    return PALETTES[gameState.currentPalette];
}

function lerpColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    return `rgb(${Math.round(c1.r + (c2.r - c1.r) * t)}, ${Math.round(c1.g + (c2.g - c1.g) * t)}, ${Math.round(c1.b + (c2.b - c1.b) * t)})`;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function drawTunnel() {
    const palette = getCurrentPalette();
    const sides = CONFIG.tunnel.sides;
    const segments = CONFIG.tunnel.segments;

    // Draw from back to front
    for (let seg = segments - 1; seg >= 0; seg--) {
        const segmentProgress = seg / segments;
        const nextSeg = seg + 1;

        for (let side = 0; side < sides; side++) {
            const angle1 = (side / sides) * Math.PI * 2;
            const angle2 = ((side + 1) / sides) * Math.PI * 2;

            const p1 = getTunnelPosition(seg, angle1);
            const p2 = getTunnelPosition(seg, angle2);
            const p3 = getTunnelPosition(nextSeg, angle2);
            const p4 = getTunnelPosition(nextSeg, angle1);

            // Color based on depth and position
            const colorPhase = (gameState.colorPhase + segmentProgress + side / sides) % 1;
            const brightness = Math.max(0.1, 1 - segmentProgress * 0.9);

            let color;
            if (colorPhase < 0.33) {
                color = lerpColor(palette.primary, palette.secondary, colorPhase * 3);
            } else if (colorPhase < 0.66) {
                color = lerpColor(palette.secondary, palette.accent, (colorPhase - 0.33) * 3);
            } else {
                color = lerpColor(palette.accent, palette.primary, (colorPhase - 0.66) * 3);
            }

            // Alternate panels for grid effect
            const isHighlight = (seg + side) % 2 === 0;

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();

            // Fill with gradient
            const alpha = brightness * (isHighlight ? 0.15 : 0.08);
            ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
            ctx.fill();

            // Edge lines
            if (seg % 3 === 0) {
                ctx.strokeStyle = color.replace('rgb', 'rgba').replace(')', `, ${brightness * 0.4})`);
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // Ring lines at intervals
        if (seg % 5 === 0) {
            ctx.beginPath();
            for (let side = 0; side <= sides; side++) {
                const angle = (side / sides) * Math.PI * 2;
                const p = getTunnelPosition(seg, angle);
                if (side === 0) {
                    ctx.moveTo(p.x, p.y);
                } else {
                    ctx.lineTo(p.x, p.y);
                }
            }
            const ringBrightness = Math.max(0.2, 1 - segmentProgress * 0.8);
            ctx.strokeStyle = `rgba(255, 255, 255, ${ringBrightness * 0.3})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

function drawStars() {
    if (gameState.stars.length < CONFIG.visual.starCount) {
        for (let i = gameState.stars.length; i < CONFIG.visual.starCount; i++) {
            gameState.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                z: Math.random() * 1000,
                size: Math.random() * 2 + 0.5
            });
        }
    }

    const palette = getCurrentPalette();

    gameState.stars.forEach(star => {
        star.z -= gameState.speed * gameState.timeScale * 2;
        if (star.z <= 0) {
            star.z = 1000;
            star.x = Math.random() * canvas.width;
            star.y = Math.random() * canvas.height;
        }

        const perspective = 500 / star.z;
        const screenX = centerX + (star.x - centerX) * perspective;
        const screenY = centerY + (star.y - centerY) * perspective;
        const size = star.size * perspective;

        if (screenX > 0 && screenX < canvas.width && screenY > 0 && screenY < canvas.height) {
            const alpha = Math.min(1, perspective * 0.5);
            ctx.beginPath();
            ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();

            // Streak effect at high speed
            if (gameState.speed > 15) {
                const streakLength = (gameState.speed - 15) * 0.5;
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(screenX, screenY + streakLength * perspective);
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
                ctx.lineWidth = size * 0.5;
                ctx.stroke();
            }
        }
    });
}

function drawPlayer() {
    const palette = getCurrentPalette();
    const player = gameState.player;

    // Get player position in tunnel
    const pos = getTunnelPosition(2, player.angle);
    const playerX = pos.x;
    const playerY = pos.y;
    const size = CONFIG.player.size;

    // Apply screen shake
    const shakeX = (Math.random() - 0.5) * gameState.screenShake;
    const shakeY = (Math.random() - 0.5) * gameState.screenShake;

    ctx.save();
    ctx.translate(playerX + shakeX, playerY + shakeY);
    ctx.rotate(player.angle + Math.PI / 2);

    // Shield effect
    if (player.hasShield) {
        ctx.beginPath();
        ctx.arc(0, 0, size * 2.5, 0, Math.PI * 2);
        const shieldGrad = ctx.createRadialGradient(0, 0, size, 0, 0, size * 2.5);
        shieldGrad.addColorStop(0, 'rgba(0, 255, 136, 0)');
        shieldGrad.addColorStop(0.7, 'rgba(0, 255, 136, 0.2)');
        shieldGrad.addColorStop(1, 'rgba(0, 255, 136, 0.5)');
        ctx.fillStyle = shieldGrad;
        ctx.fill();

        // Shield ring
        ctx.beginPath();
        ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Invincibility flash
    if (player.isInvincible && Math.floor(performance.now() / 100) % 2) {
        ctx.restore();
        return;
    }

    // Player ship body
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(-size * 0.7, size * 0.8);
    ctx.lineTo(0, size * 0.4);
    ctx.lineTo(size * 0.7, size * 0.8);
    ctx.closePath();

    // Gradient fill
    const shipGrad = ctx.createLinearGradient(0, -size, 0, size);
    shipGrad.addColorStop(0, palette.primary);
    shipGrad.addColorStop(1, palette.secondary);
    ctx.fillStyle = shipGrad;
    ctx.fill();

    // Glow
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Engine glow
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, size * 0.5);
    ctx.lineTo(0, size * 1.2 + Math.random() * 5);
    ctx.lineTo(size * 0.3, size * 0.5);
    ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 0, 0.8)`;
    ctx.fill();

    ctx.restore();
}

// ==================== OBSTACLES ====================
const OBSTACLE_TYPES = {
    STATIC: 'static',
    ROTATING: 'rotating',
    MOVING: 'moving',
    GATE: 'gate',
    LASER: 'laser'
};

function spawnObstacle() {
    const types = Object.values(OBSTACLE_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];

    const obstacle = {
        type: type,
        segmentIndex: CONFIG.tunnel.segments - 1,
        angle: Math.random() * Math.PI * 2,
        size: 25 + Math.random() * 20,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        moveSpeed: (Math.random() - 0.5) * 0.03,
        moveRange: Math.PI * 0.5,
        baseAngle: 0,
        phase: Math.random() * Math.PI * 2,
        color: getCurrentPalette().secondary
    };

    obstacle.baseAngle = obstacle.angle;

    // Gate type spans part of the tunnel
    if (type === OBSTACLE_TYPES.GATE) {
        obstacle.gapAngle = Math.random() * Math.PI * 2;
        obstacle.gapSize = Math.PI * 0.4 + Math.random() * Math.PI * 0.3;
    }

    // Laser type
    if (type === OBSTACLE_TYPES.LASER) {
        obstacle.laserAngle = Math.random() * Math.PI * 2;
        obstacle.active = true;
        obstacle.cycleTime = 2000 + Math.random() * 2000;
    }

    gameState.obstacles.push(obstacle);
}

function updateObstacles(deltaTime) {
    const speed = gameState.speed * gameState.timeScale;

    gameState.obstacles = gameState.obstacles.filter(obstacle => {
        obstacle.segmentIndex -= speed * 0.1;

        // Update based on type
        switch (obstacle.type) {
            case OBSTACLE_TYPES.ROTATING:
                obstacle.angle += obstacle.rotationSpeed * gameState.timeScale;
                break;
            case OBSTACLE_TYPES.MOVING:
                obstacle.angle = obstacle.baseAngle + Math.sin(performance.now() * 0.002 + obstacle.phase) * obstacle.moveRange;
                break;
            case OBSTACLE_TYPES.LASER:
                obstacle.active = Math.sin(performance.now() / obstacle.cycleTime * Math.PI * 2) > 0;
                obstacle.laserAngle += obstacle.rotationSpeed * gameState.timeScale;
                break;
        }

        return obstacle.segmentIndex > -5;
    });

    // Spawn new obstacles
    if (Math.random() < CONFIG.game.obstacleSpawnRate * gameState.difficulty) {
        spawnObstacle();
    }
}

function drawObstacles() {
    const palette = getCurrentPalette();

    gameState.obstacles.forEach(obstacle => {
        if (obstacle.segmentIndex < 0 || obstacle.segmentIndex >= CONFIG.tunnel.segments) return;

        const segIndex = Math.floor(obstacle.segmentIndex);
        const perspective = 1 / (1 + obstacle.segmentIndex * CONFIG.tunnel.segmentDepth * 0.008);

        switch (obstacle.type) {
            case OBSTACLE_TYPES.STATIC:
            case OBSTACLE_TYPES.ROTATING:
            case OBSTACLE_TYPES.MOVING:
                drawBlockObstacle(obstacle, segIndex, perspective, palette);
                break;
            case OBSTACLE_TYPES.GATE:
                drawGateObstacle(obstacle, segIndex, perspective, palette);
                break;
            case OBSTACLE_TYPES.LASER:
                drawLaserObstacle(obstacle, segIndex, perspective, palette);
                break;
        }
    });
}

function drawBlockObstacle(obstacle, segIndex, perspective, palette) {
    const pos = getTunnelPosition(segIndex, obstacle.angle);
    const size = obstacle.size * perspective;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Outer glow
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
    const glowGrad = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, size * 1.5);
    glowGrad.addColorStop(0, obstacle.color.replace(')', ', 0.5)').replace('rgb', 'rgba'));
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Main body
    ctx.beginPath();
    const sides = 6;
    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 + performance.now() * 0.001;
        const x = Math.cos(angle) * size;
        const y = Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = obstacle.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * perspective;
    ctx.stroke();

    ctx.restore();
}

function drawGateObstacle(obstacle, segIndex, perspective, palette) {
    const sides = 32;
    const gapStart = obstacle.gapAngle;
    const gapEnd = obstacle.gapAngle + obstacle.gapSize;

    ctx.beginPath();

    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const nextAngle = ((i + 1) / sides) * Math.PI * 2;

        // Check if this segment is in the gap
        const inGap = (angle >= gapStart && angle <= gapEnd) ||
                     (angle + Math.PI * 2 >= gapStart && angle + Math.PI * 2 <= gapEnd) ||
                     (angle >= gapStart - Math.PI * 2 && angle <= gapEnd - Math.PI * 2);

        if (inGap) continue;

        const p1 = getTunnelPosition(segIndex, angle);
        const p2 = getTunnelPosition(segIndex, nextAngle);
        const p3 = getTunnelPosition(segIndex + 1, nextAngle);
        const p4 = getTunnelPosition(segIndex + 1, angle);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();

        ctx.fillStyle = `rgba(255, 0, 100, ${0.7 * perspective})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 100, 150, ${perspective})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function drawLaserObstacle(obstacle, segIndex, perspective, palette) {
    if (!obstacle.active) return;

    const startPos = getTunnelPosition(segIndex, obstacle.laserAngle);
    const endPos = getTunnelPosition(segIndex, obstacle.laserAngle + Math.PI);

    // Laser beam
    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(endPos.x, endPos.y);

    ctx.strokeStyle = `rgba(255, 50, 50, ${0.9 * perspective})`;
    ctx.lineWidth = 4 * perspective;
    ctx.stroke();

    // Glow
    ctx.strokeStyle = `rgba(255, 100, 100, ${0.4 * perspective})`;
    ctx.lineWidth = 12 * perspective;
    ctx.stroke();

    // Core
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * perspective})`;
    ctx.lineWidth = 2 * perspective;
    ctx.stroke();
}

// ==================== POWER-UPS ====================
const POWERUP_TYPES = {
    SLOW_TIME: { name: 'FLUX BRAKE', icon: '⏱', color: '#00ccff', duration: 5000 },
    SHIELD: { name: 'VOID SHIELD', icon: '◈', color: '#00ff88', duration: 8000 },
    MULTIPLIER: { name: 'QUANTUM BOOST', icon: '×2', color: '#ffff00', duration: 10000 },
    SPEED_BOOST: { name: 'HYPERDRIVE', icon: '⚡', color: '#ff6600', duration: 3000 }
};

function spawnPowerUp() {
    const types = Object.keys(POWERUP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const info = POWERUP_TYPES[type];

    gameState.powerUps.push({
        type: type,
        ...info,
        segmentIndex: CONFIG.tunnel.segments - 1,
        angle: Math.random() * Math.PI * 2,
        bobPhase: Math.random() * Math.PI * 2,
        collected: false
    });
}

function updatePowerUps(deltaTime) {
    const speed = gameState.speed * gameState.timeScale;

    gameState.powerUps = gameState.powerUps.filter(powerUp => {
        powerUp.segmentIndex -= speed * 0.1;
        powerUp.bobPhase += 0.05;
        return powerUp.segmentIndex > -5 && !powerUp.collected;
    });

    // Spawn new power-ups
    if (Math.random() < CONFIG.game.powerUpSpawnRate && gameState.powerUp.current === null) {
        spawnPowerUp();
    }
}

function drawPowerUps() {
    gameState.powerUps.forEach(powerUp => {
        if (powerUp.segmentIndex < 0 || powerUp.segmentIndex >= CONFIG.tunnel.segments) return;

        const segIndex = Math.floor(powerUp.segmentIndex);
        const bobOffset = Math.sin(powerUp.bobPhase) * 0.1;
        const pos = getTunnelPosition(segIndex, powerUp.angle + bobOffset);
        const perspective = 1 / (1 + powerUp.segmentIndex * CONFIG.tunnel.segmentDepth * 0.008);
        const size = 20 * perspective;

        ctx.save();
        ctx.translate(pos.x, pos.y);

        // Outer ring
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = powerUp.color;
        ctx.lineWidth = 2 * perspective;
        ctx.stroke();

        // Pulsing glow
        const pulseSize = size * (1.5 + Math.sin(performance.now() * 0.005) * 0.3);
        const glowGrad = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, pulseSize);
        glowGrad.addColorStop(0, powerUp.color.replace(')', ', 0.8)').replace('#', 'rgba(').replace(/([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})/i, (m, r, g, b) => `${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}`));
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();

        // Icon
        ctx.font = `bold ${size}px Orbitron, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(powerUp.icon, 0, 0);

        ctx.restore();
    });
}

function collectPowerUp(powerUp) {
    powerUp.collected = true;
    gameState.powerUp.current = powerUp.type;

    // Update UI
    UI.powerUpSlot.classList.remove('hidden');
    UI.powerUpIcon.textContent = powerUp.icon;
    UI.powerUpName.textContent = powerUp.name;
    UI.powerUpName.style.color = powerUp.color;

    // Visual feedback
    flashScreen(powerUp.color, 0.3);
    spawnCollectParticles(powerUp);
}

function activatePowerUp() {
    if (!gameState.powerUp.current) return;

    const type = gameState.powerUp.current;
    const info = POWERUP_TYPES[type];

    switch (type) {
        case 'SLOW_TIME':
            gameState.timeScale = 0.3;
            gameState.slowMoTime = info.duration;
            UI.slowmoOverlay.classList.remove('hidden');
            break;

        case 'SHIELD':
            gameState.player.hasShield = true;
            gameState.player.shieldTime = info.duration;
            UI.shieldIndicator.classList.remove('hidden');
            break;

        case 'MULTIPLIER':
            gameState.multiplier.value = 2;
            gameState.multiplier.time = info.duration;
            UI.multiplierContainer.classList.remove('hidden');
            break;

        case 'SPEED_BOOST':
            gameState.speed = Math.min(CONFIG.game.maxSpeed, gameState.speed + 8);
            flashScreen('#ff6600', 0.5);
            break;
    }

    gameState.powerUp.current = null;
    UI.powerUpSlot.classList.add('hidden');
}

// ==================== PARTICLES ====================
function spawnCollectParticles(powerUp) {
    const pos = getTunnelPosition(Math.floor(powerUp.segmentIndex), powerUp.angle);

    for (let i = 0; i < 20; i++) {
        gameState.particles.push({
            x: pos.x,
            y: pos.y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1,
            decay: 0.02 + Math.random() * 0.02,
            size: 3 + Math.random() * 4,
            color: powerUp.color
        });
    }
}

function spawnCollisionParticles() {
    const pos = getTunnelPosition(2, gameState.player.angle);

    for (let i = 0; i < 30; i++) {
        gameState.particles.push({
            x: pos.x,
            y: pos.y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1,
            decay: 0.015 + Math.random() * 0.02,
            size: 4 + Math.random() * 6,
            color: '#ff0066'
        });
    }
}

function updateParticles(deltaTime) {
    gameState.particles = gameState.particles.filter(particle => {
        particle.x += particle.vx * gameState.timeScale;
        particle.y += particle.vy * gameState.timeScale;
        particle.life -= particle.decay * gameState.timeScale;
        particle.vx *= 0.98;
        particle.vy *= 0.98;
        return particle.life > 0;
    });
}

function drawParticles() {
    gameState.particles.forEach(particle => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
        ctx.fillStyle = particle.color.replace(')', `, ${particle.life})`).replace('rgb', 'rgba').replace('#', 'rgba(').replace(/([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})/i, (m, r, g, b) => `${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}`);
        ctx.fill();
    });
}

// ==================== COLLISION DETECTION ====================
function checkCollisions() {
    const playerAngle = gameState.player.angle;
    const playerSegment = 2;
    const hitRadius = CONFIG.player.hitboxRadius;

    // Check obstacles
    for (const obstacle of gameState.obstacles) {
        if (Math.abs(obstacle.segmentIndex - playerSegment) > 2) continue;

        let collision = false;

        switch (obstacle.type) {
            case OBSTACLE_TYPES.STATIC:
            case OBSTACLE_TYPES.ROTATING:
            case OBSTACLE_TYPES.MOVING:
                const angleDiff = Math.abs(normalizeAngle(playerAngle - obstacle.angle));
                const collisionAngle = (obstacle.size / CONFIG.tunnel.baseRadius) + (hitRadius / CONFIG.tunnel.baseRadius);
                collision = angleDiff < collisionAngle && Math.abs(obstacle.segmentIndex - playerSegment) < 1.5;
                break;

            case OBSTACLE_TYPES.GATE:
                const gapStart = obstacle.gapAngle;
                const gapEnd = obstacle.gapAngle + obstacle.gapSize;
                const normPlayerAngle = normalizeAngle(playerAngle);
                const inGap = (normPlayerAngle >= gapStart - 0.2 && normPlayerAngle <= gapEnd + 0.2) ||
                             (normPlayerAngle + Math.PI * 2 >= gapStart - 0.2 && normPlayerAngle + Math.PI * 2 <= gapEnd + 0.2);
                collision = !inGap && Math.abs(obstacle.segmentIndex - playerSegment) < 1;
                break;

            case OBSTACLE_TYPES.LASER:
                if (!obstacle.active) break;
                const laserAngle1 = normalizeAngle(obstacle.laserAngle);
                const laserAngle2 = normalizeAngle(obstacle.laserAngle + Math.PI);
                const playerNorm = normalizeAngle(playerAngle);
                const laserCollisionThreshold = 0.15;
                collision = (Math.abs(normalizeAngle(playerNorm - laserAngle1)) < laserCollisionThreshold ||
                           Math.abs(normalizeAngle(playerNorm - laserAngle2)) < laserCollisionThreshold) &&
                           Math.abs(obstacle.segmentIndex - playerSegment) < 1;
                break;
        }

        if (collision) {
            handleCollision();
            return;
        }
    }

    // Check power-ups
    for (const powerUp of gameState.powerUps) {
        if (powerUp.collected) continue;
        if (Math.abs(powerUp.segmentIndex - playerSegment) > 1.5) continue;

        const angleDiff = Math.abs(normalizeAngle(playerAngle - powerUp.angle));
        if (angleDiff < 0.4 && Math.abs(powerUp.segmentIndex - playerSegment) < 1) {
            collectPowerUp(powerUp);
        }
    }
}

function normalizeAngle(angle) {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
}

function handleCollision() {
    if (gameState.player.isInvincible) return;

    if (gameState.player.hasShield) {
        // Shield absorbs hit
        gameState.player.hasShield = false;
        gameState.player.shieldTime = 0;
        gameState.player.isInvincible = true;
        gameState.player.invincibleTime = 1500;
        UI.shieldIndicator.classList.add('hidden');

        spawnCollisionParticles();
        flashScreen('#00ff88', 0.5);
        gameState.screenShake = 10;
        return;
    }

    // Game over
    gameOver();
}

// ==================== GAME FLOW ====================
function startGame() {
    // Reset state
    gameState.running = true;
    gameState.paused = false;
    gameState.gameOver = false;
    gameState.score = 0;
    gameState.speed = CONFIG.game.baseSpeed;
    gameState.distance = 0;
    gameState.difficulty = 1;
    gameState.timeScale = 1;
    gameState.colorPhase = 0;
    gameState.screenShake = 0;

    gameState.player.angle = 0;
    gameState.player.targetAngle = 0;
    gameState.player.hasShield = false;
    gameState.player.isInvincible = false;

    gameState.powerUp.current = null;
    gameState.multiplier.value = 1;
    gameState.multiplier.time = 0;

    gameState.obstacles = [];
    gameState.powerUps = [];
    gameState.particles = [];

    initializeTunnel();

    // Update UI
    UI.startScreen.classList.add('hidden');
    UI.gameoverScreen.classList.add('hidden');
    UI.gameUI.classList.remove('hidden');
    UI.multiplierContainer.classList.add('hidden');
    UI.powerUpSlot.classList.add('hidden');
    UI.shieldIndicator.classList.add('hidden');
    UI.slowmoOverlay.classList.add('hidden');

    // Change palette randomly
    gameState.currentPalette = Math.floor(Math.random() * PALETTES.length);

    requestAnimationFrame(gameLoop);
}

function togglePause() {
    gameState.paused = !gameState.paused;
    UI.pauseScreen.classList.toggle('hidden', !gameState.paused);

    if (!gameState.paused) {
        requestAnimationFrame(gameLoop);
    }
}

function gameOver() {
    gameState.running = false;
    gameState.gameOver = true;

    // Update high score
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        localStorage.setItem('vortexHighScore', gameState.highScore);
    }

    // Show game over screen
    UI.gameUI.classList.add('hidden');
    UI.gameoverScreen.classList.remove('hidden');
    UI.finalScore.textContent = Math.floor(gameState.score);
    UI.highScore.textContent = Math.floor(gameState.highScore);

    // Visual feedback
    flashScreen('#ff0066', 0.8);
    spawnCollisionParticles();
}

function flashScreen(color, intensity) {
    UI.flashOverlay.style.background = color;
    UI.flashOverlay.style.opacity = intensity;
    setTimeout(() => {
        UI.flashOverlay.style.opacity = 0;
    }, 100);
}

// ==================== GAME LOOP ====================
let lastTime = 0;

function gameLoop(currentTime) {
    if (!gameState.running || gameState.paused) return;

    const deltaTime = Math.min(currentTime - lastTime, 50);
    lastTime = currentTime;

    update(deltaTime);
    render();

    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    const dt = deltaTime / 16.67; // Normalize to 60fps

    // Update timers
    if (gameState.slowMoTime > 0) {
        gameState.slowMoTime -= deltaTime;
        if (gameState.slowMoTime <= 0) {
            gameState.timeScale = 1;
            UI.slowmoOverlay.classList.add('hidden');
        }
    }

    if (gameState.player.shieldTime > 0) {
        gameState.player.shieldTime -= deltaTime;
        if (gameState.player.shieldTime <= 0) {
            gameState.player.hasShield = false;
            UI.shieldIndicator.classList.add('hidden');
        }
    }

    if (gameState.player.invincibleTime > 0) {
        gameState.player.invincibleTime -= deltaTime;
        if (gameState.player.invincibleTime <= 0) {
            gameState.player.isInvincible = false;
        }
    }

    if (gameState.multiplier.time > 0) {
        gameState.multiplier.time -= deltaTime;
        if (gameState.multiplier.time <= 0) {
            gameState.multiplier.value = 1;
            UI.multiplierContainer.classList.add('hidden');
        }
    }

    // Screen shake decay
    gameState.screenShake *= 0.9;

    // Player input
    if (keys.left) {
        gameState.player.targetAngle -= CONFIG.player.moveSpeed * dt * gameState.timeScale;
    }
    if (keys.right) {
        gameState.player.targetAngle += CONFIG.player.moveSpeed * dt * gameState.timeScale;
    }

    // Clamp player angle
    gameState.player.targetAngle = Math.max(-CONFIG.player.maxAngle,
        Math.min(CONFIG.player.maxAngle, gameState.player.targetAngle));

    // Smooth player movement
    gameState.player.angle += (gameState.player.targetAngle - gameState.player.angle) * 0.15 * gameState.timeScale;

    // Update game systems
    updateTunnelBends(deltaTime);
    updateObstacles(deltaTime);
    updatePowerUps(deltaTime);
    updateParticles(deltaTime);
    checkCollisions();

    // Update score and difficulty
    const scoreIncrement = gameState.speed * 0.1 * gameState.multiplier.value * gameState.timeScale;
    gameState.score += scoreIncrement;
    gameState.distance += gameState.speed * gameState.timeScale * 0.1;

    // Increase speed over time
    gameState.speed = Math.min(CONFIG.game.maxSpeed,
        gameState.speed + CONFIG.game.speedIncrement * gameState.timeScale);

    // Increase difficulty
    gameState.difficulty = Math.min(3, 1 + gameState.distance * CONFIG.game.difficultyScaleRate);

    // Color phase update
    gameState.colorPhase += 0.001 * gameState.timeScale;

    // Palette shift at milestones
    if (Math.floor(gameState.score / 5000) > Math.floor((gameState.score - scoreIncrement) / 5000)) {
        gameState.currentPalette = (gameState.currentPalette + 1) % PALETTES.length;
    }

    // Update UI
    UI.score.textContent = Math.floor(gameState.score);
    UI.speedFill.style.width = `${((gameState.speed - CONFIG.game.baseSpeed) / (CONFIG.game.maxSpeed - CONFIG.game.baseSpeed)) * 100}%`;

    // Warp lines at high speed
    UI.warpLines.style.opacity = Math.max(0, (gameState.speed - 15) / 13);
}

function render() {
    // Clear with dark background
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply screen shake
    ctx.save();
    if (gameState.screenShake > 0.5) {
        ctx.translate(
            (Math.random() - 0.5) * gameState.screenShake,
            (Math.random() - 0.5) * gameState.screenShake
        );
    }

    // Draw layers
    drawStars();
    drawTunnel();
    drawObstacles();
    drawPowerUps();
    drawPlayer();
    drawParticles();

    ctx.restore();

    // Speed lines effect at high speeds
    if (gameState.speed > 18) {
        drawSpeedLines();
    }
}

function drawSpeedLines() {
    const intensity = (gameState.speed - 18) / 10;
    const lineCount = Math.floor(intensity * 30);

    ctx.save();
    ctx.globalAlpha = intensity * 0.3;

    for (let i = 0; i < lineCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const startRadius = 50 + Math.random() * 100;
        const endRadius = startRadius + 100 + Math.random() * 200;

        const startX = centerX + Math.cos(angle) * startRadius;
        const startY = centerY + Math.sin(angle) * startRadius;
        const endX = centerX + Math.cos(angle) * endRadius;
        const endY = centerY + Math.sin(angle) * endRadius;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.restore();
}

// ==================== INITIALIZATION ====================
initializeTunnel();

// Initial render for background
function renderStartScreen() {
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    gameState.colorPhase += 0.0005;
    drawStars();

    // Slowly rotate tunnel for background effect
    gameState.tunnelBends.forEach((bend, i) => {
        bend.rotation = Math.sin(performance.now() * 0.0005 + i * 0.1) * 0.1;
    });
    drawTunnel();

    requestAnimationFrame(renderStartScreen);
}

renderStartScreen();
