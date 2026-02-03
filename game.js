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
        baseSpeed: 3,
        maxSpeed: 18,
        speedIncrement: 0.001,
        obstacleSpawnRate: 0.02,
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
    tunnelBends: [],
    tunnelRings: [], // Rings that fly toward player
    rushingRings: []
};

// ==================== CANVAS SETUP ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let centerX, centerY, tunnelCenterY;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    centerX = canvas.width / 2;
    centerY = canvas.height * 0.35; // Tunnel vanishing point higher up
    tunnelCenterY = canvas.height * 0.35;
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
const TUNNEL_DEPTH = 2000; // How far the tunnel extends
const RING_SPACING = 50;   // Distance between rings
const NUM_RINGS = 50;      // Number of rings in the tunnel

function initializeTunnel() {
    gameState.tunnelBends = [];
    gameState.tunnelRings = [];

    // Create rings at evenly spaced z positions
    for (let i = 0; i < NUM_RINGS; i++) {
        gameState.tunnelRings.push(createTunnelRing(i * RING_SPACING + 100));
    }
}

function createTunnelRing(z) {
    const noise = z * 0.002;
    return {
        z: z,
        radius: CONFIG.tunnel.baseRadius + Math.sin(noise * 2) * 50,
        rotation: Math.sin(noise) * 0.5,
        offsetX: Math.sin(noise * 1.3) * 80,
        offsetY: Math.cos(noise * 0.9) * 40,
        hue: (z * 0.001) % 1,
        thickness: 3 + Math.random() * 2
    };
}

function updateTunnel(deltaTime) {
    const speed = gameState.speed * gameState.timeScale * 20; // Forward speed

    gameState.tunnelRings.forEach(ring => {
        ring.z -= speed;

        // When ring passes camera, respawn it at the back
        if (ring.z < -50) {
            // Find the furthest ring
            let maxZ = 0;
            gameState.tunnelRings.forEach(r => {
                if (r.z > maxZ) maxZ = r.z;
            });

            // Respawn behind the furthest ring
            ring.z = maxZ + RING_SPACING;
            const noise = ring.z * 0.002;
            ring.radius = CONFIG.tunnel.baseRadius + Math.sin(noise * 2) * 50;
            ring.rotation = Math.sin(noise) * 0.5;
            ring.offsetX = Math.sin(noise * 1.3) * 80;
            ring.offsetY = Math.cos(noise * 0.9) * 40;
            ring.hue = (ring.z * 0.001 + gameState.colorPhase) % 1;
        }
    });
}

function getTunnelPosition(z, angle) {
    // Find the ring closest to this z or interpolate
    const perspective = 300 / (z + 300);
    const noise = z * 0.002;

    const offsetX = Math.sin(noise * 1.3) * 80 * perspective;
    const offsetY = Math.cos(noise * 0.9) * 40 * perspective;
    const rotation = Math.sin(noise) * 0.5;
    const radius = (CONFIG.tunnel.baseRadius + Math.sin(noise * 2) * 50) * perspective;

    const adjustedAngle = angle + rotation;

    return {
        x: centerX + offsetX + Math.cos(adjustedAngle) * radius,
        y: centerY + offsetY + Math.sin(adjustedAngle) * radius,
        perspective: perspective,
        radius: radius
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

    // Sort rings by z (far to near)
    const sortedRings = [...gameState.tunnelRings].sort((a, b) => b.z - a.z);

    // Draw tunnel walls connecting rings
    for (let i = 0; i < sortedRings.length - 1; i++) {
        const ring = sortedRings[i];
        const nextRing = sortedRings[i + 1];

        if (ring.z < 0 || ring.z > TUNNEL_DEPTH) continue;

        const perspective1 = 300 / (ring.z + 300);
        const perspective2 = 300 / (nextRing.z + 300);

        if (perspective1 < 0.02) continue;

        // Draw wall segments
        for (let side = 0; side < sides; side++) {
            const angle1 = (side / sides) * Math.PI * 2 + ring.rotation;
            const angle2 = ((side + 1) / sides) * Math.PI * 2 + ring.rotation;
            const nextAngle1 = (side / sides) * Math.PI * 2 + nextRing.rotation;
            const nextAngle2 = ((side + 1) / sides) * Math.PI * 2 + nextRing.rotation;

            const r1 = ring.radius * perspective1;
            const r2 = nextRing.radius * perspective2;

            const ox1 = ring.offsetX * perspective1;
            const oy1 = ring.offsetY * perspective1;
            const ox2 = nextRing.offsetX * perspective2;
            const oy2 = nextRing.offsetY * perspective2;

            const p1 = { x: centerX + ox1 + Math.cos(angle1) * r1, y: centerY + oy1 + Math.sin(angle1) * r1 };
            const p2 = { x: centerX + ox1 + Math.cos(angle2) * r1, y: centerY + oy1 + Math.sin(angle2) * r1 };
            const p3 = { x: centerX + ox2 + Math.cos(nextAngle2) * r2, y: centerY + oy2 + Math.sin(nextAngle2) * r2 };
            const p4 = { x: centerX + ox2 + Math.cos(nextAngle1) * r2, y: centerY + oy2 + Math.sin(nextAngle1) * r2 };

            // Color based on depth
            const colorPhase = (gameState.colorPhase + ring.hue + side / sides) % 1;
            const brightness = Math.min(1, perspective1 * 2);

            let color;
            if (colorPhase < 0.33) {
                color = lerpColor(palette.primary, palette.secondary, colorPhase * 3);
            } else if (colorPhase < 0.66) {
                color = lerpColor(palette.secondary, palette.accent, (colorPhase - 0.33) * 3);
            } else {
                color = lerpColor(palette.accent, palette.primary, (colorPhase - 0.66) * 3);
            }

            const isHighlight = (i + side) % 2 === 0;
            const alpha = brightness * (isHighlight ? 0.2 : 0.1);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
            ctx.fill();
        }
    }

    // Draw ring outlines (these create the "rushing" effect)
    sortedRings.forEach(ring => {
        if (ring.z < 0 || ring.z > TUNNEL_DEPTH) return;

        const perspective = 300 / (ring.z + 300);
        if (perspective < 0.02) return;

        const radius = ring.radius * perspective;
        const ox = ring.offsetX * perspective;
        const oy = ring.offsetY * perspective;

        // Ring brightness increases as it gets closer
        const brightness = Math.min(1, perspective * 2.5);

        // Draw the ring
        ctx.beginPath();
        for (let side = 0; side <= sides; side++) {
            const angle = (side / sides) * Math.PI * 2 + ring.rotation;
            const x = centerX + ox + Math.cos(angle) * radius;
            const y = centerY + oy + Math.sin(angle) * radius;
            if (side === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();

        // Color based on hue
        const colorPhase = (ring.hue + gameState.colorPhase) % 1;
        let color;
        if (colorPhase < 0.5) {
            color = lerpColor(palette.primary, palette.secondary, colorPhase * 2);
        } else {
            color = lerpColor(palette.secondary, palette.primary, (colorPhase - 0.5) * 2);
        }

        ctx.strokeStyle = color.replace('rgb', 'rgba').replace(')', `, ${brightness * 0.8})`);
        ctx.lineWidth = ring.thickness * perspective + 1;
        ctx.stroke();

        // Inner glow for closer rings
        if (perspective > 0.3) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${(perspective - 0.3) * 0.5})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });
}

function drawStars() {
    if (gameState.stars.length < CONFIG.visual.starCount) {
        for (let i = gameState.stars.length; i < CONFIG.visual.starCount; i++) {
            gameState.stars.push({
                x: (Math.random() - 0.5) * canvas.width * 2,
                y: (Math.random() - 0.5) * canvas.height * 2,
                z: Math.random() * 1500,
                size: Math.random() * 2 + 0.5
            });
        }
    }

    const palette = getCurrentPalette();

    gameState.stars.forEach(star => {
        star.z -= gameState.speed * gameState.timeScale * 8;
        if (star.z <= 0) {
            star.z = 1500;
            star.x = (Math.random() - 0.5) * canvas.width * 2;
            star.y = (Math.random() - 0.5) * canvas.height * 2;
        }

        const perspective = 600 / star.z;
        const screenX = centerX + star.x * perspective;
        const screenY = centerY + star.y * perspective;
        const size = star.size * perspective;

        if (screenX > -50 && screenX < canvas.width + 50 && screenY > -50 && screenY < canvas.height + 50) {
            const alpha = Math.min(1, perspective * 0.7);

            // Streak effect - always on, intensity based on speed
            const streakLength = 5 + gameState.speed * 2;
            const streakEndX = screenX + star.x * 0.01 * streakLength;
            const streakEndY = screenY + star.y * 0.01 * streakLength;

            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            ctx.lineTo(streakEndX, streakEndY);

            const streakGrad = ctx.createLinearGradient(screenX, screenY, streakEndX, streakEndY);
            streakGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
            streakGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
            ctx.strokeStyle = streakGrad;
            ctx.lineWidth = size;
            ctx.stroke();

            // Star point
            ctx.beginPath();
            ctx.arc(screenX, screenY, size * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();
        }
    });
}

function drawPlayer() {
    const palette = getCurrentPalette();
    const player = gameState.player;

    // Player is at bottom center of screen, position based on angle
    const playerBaseY = canvas.height * 0.85;
    const lateralRange = canvas.width * 0.35;
    const playerX = centerX + Math.sin(player.angle) * lateralRange;
    const playerY = playerBaseY - Math.abs(Math.sin(player.angle)) * 30; // Slight arc
    const size = CONFIG.player.size * 1.5;

    // Apply screen shake
    const shakeX = (Math.random() - 0.5) * gameState.screenShake;
    const shakeY = (Math.random() - 0.5) * gameState.screenShake;

    ctx.save();
    ctx.translate(playerX + shakeX, playerY + shakeY);

    // Tilt based on movement
    const tilt = player.angle * 0.3;
    ctx.rotate(tilt);

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

    // Draw ship from behind/above perspective (triangle pointing into screen)
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.8); // Nose (pointing up/forward)
    ctx.lineTo(-size, size * 0.6); // Left wing
    ctx.lineTo(-size * 0.3, size * 0.3);
    ctx.lineTo(0, size * 0.8); // Tail
    ctx.lineTo(size * 0.3, size * 0.3);
    ctx.lineTo(size, size * 0.6); // Right wing
    ctx.closePath();

    // Gradient fill
    const shipGrad = ctx.createLinearGradient(0, -size, 0, size);
    shipGrad.addColorStop(0, palette.primary);
    shipGrad.addColorStop(1, palette.secondary);
    ctx.fillStyle = shipGrad;
    ctx.fill();

    // Glow
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 25;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.2, size * 0.25, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 200, 255, 0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Engine trails (going backward/down into the tunnel)
    const trailLength = 20 + gameState.speed * 3;
    for (let i = 0; i < 2; i++) {
        const offsetX = (i === 0 ? -1 : 1) * size * 0.4;
        ctx.beginPath();
        ctx.moveTo(offsetX, size * 0.4);
        ctx.lineTo(offsetX - 3, size * 0.4 + trailLength + Math.random() * 10);
        ctx.lineTo(offsetX + 3, size * 0.4 + trailLength + Math.random() * 10);
        ctx.closePath();

        const trailGrad = ctx.createLinearGradient(0, size * 0.4, 0, size * 0.4 + trailLength);
        trailGrad.addColorStop(0, 'rgba(255, 200, 50, 0.9)');
        trailGrad.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)');
        trailGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
        ctx.fillStyle = trailGrad;
        ctx.fill();
    }

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
    const playerX = centerX + Math.sin(gameState.player.angle) * (canvas.width * 0.35);
    const playerY = canvas.height * 0.85;

    // Sort by depth (far to near)
    const sorted = [...gameState.obstacles].sort((a, b) => b.segmentIndex - a.segmentIndex);

    sorted.forEach(obstacle => {
        if (obstacle.segmentIndex < 0 || obstacle.segmentIndex >= CONFIG.tunnel.segments) return;

        // Calculate perspective based on segment
        const t = 1 - (obstacle.segmentIndex / CONFIG.tunnel.segments);
        const perspective = Math.pow(t, 1.5);

        // Position interpolates from tunnel center toward player area
        const obstacleLateral = Math.sin(obstacle.angle);
        const startX = centerX + obstacleLateral * CONFIG.tunnel.baseRadius * 0.3;
        const endX = centerX + obstacleLateral * (canvas.width * 0.4);
        const obsX = startX + (endX - startX) * t;

        const startY = centerY;
        const endY = playerY - 80;
        const obsY = startY + (endY - startY) * t;

        switch (obstacle.type) {
            case OBSTACLE_TYPES.STATIC:
            case OBSTACLE_TYPES.ROTATING:
            case OBSTACLE_TYPES.MOVING:
                drawBlockObstacle(obstacle, obsX, obsY, perspective, palette);
                break;
            case OBSTACLE_TYPES.GATE:
                drawGateObstacle(obstacle, obsX, obsY, perspective, palette);
                break;
            case OBSTACLE_TYPES.LASER:
                drawLaserObstacle(obstacle, obsX, obsY, perspective, palette);
                break;
        }
    });
}

function drawBlockObstacle(obstacle, obsX, obsY, perspective, palette) {
    const size = (obstacle.size * 1.5) * Math.max(0.2, perspective);

    ctx.save();
    ctx.translate(obsX, obsY);

    // Outer glow
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.8, 0, Math.PI * 2);
    const glowGrad = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size * 1.8);
    glowGrad.addColorStop(0, 'rgba(255, 50, 100, 0.8)');
    glowGrad.addColorStop(0.5, 'rgba(255, 50, 100, 0.3)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Main body - hexagon
    ctx.beginPath();
    const sides = 6;
    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 + performance.now() * 0.002;
        const x = Math.cos(angle) * size;
        const y = Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const obsGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    obsGrad.addColorStop(0, '#ff3366');
    obsGrad.addColorStop(1, '#cc0044');
    ctx.fillStyle = obsGrad;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 3 * perspective);
    ctx.stroke();

    // Inner detail
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 + performance.now() * 0.002;
        const x = Math.cos(angle) * size * 0.5;
        const y = Math.sin(angle) * size * 0.5;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
}

function drawGateObstacle(obstacle, obsX, obsY, perspective, palette) {
    const t = perspective;
    const width = canvas.width * 0.8 * Math.max(0.1, t);
    const height = 60 * Math.max(0.2, t);

    // Gap position
    const gapCenterNorm = Math.sin(obstacle.gapAngle + obstacle.gapSize / 2);
    const gapWidth = width * (obstacle.gapSize / Math.PI) * 0.8;
    const gapX = obsX + gapCenterNorm * (width * 0.4);

    ctx.save();

    // Left barrier
    const leftWidth = (gapX - gapWidth / 2) - (obsX - width / 2);
    if (leftWidth > 0) {
        ctx.beginPath();
        ctx.rect(obsX - width / 2, obsY - height / 2, leftWidth, height);
        const leftGrad = ctx.createLinearGradient(obsX - width / 2, 0, gapX - gapWidth / 2, 0);
        leftGrad.addColorStop(0, 'rgba(255, 0, 100, 0.9)');
        leftGrad.addColorStop(1, 'rgba(255, 50, 150, 0.9)');
        ctx.fillStyle = leftGrad;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 150, 200, ${t})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Right barrier
    const rightStart = gapX + gapWidth / 2;
    const rightWidth = (obsX + width / 2) - rightStart;
    if (rightWidth > 0) {
        ctx.beginPath();
        ctx.rect(rightStart, obsY - height / 2, rightWidth, height);
        const rightGrad = ctx.createLinearGradient(rightStart, 0, obsX + width / 2, 0);
        rightGrad.addColorStop(0, 'rgba(255, 50, 150, 0.9)');
        rightGrad.addColorStop(1, 'rgba(255, 0, 100, 0.9)');
        ctx.fillStyle = rightGrad;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 150, 200, ${t})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Gap glow
    ctx.beginPath();
    ctx.rect(gapX - gapWidth / 2 + 5, obsY - height / 2, gapWidth - 10, height);
    ctx.strokeStyle = `rgba(0, 255, 136, ${t * 0.8})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
}

function drawLaserObstacle(obstacle, obsX, obsY, perspective, palette) {
    if (!obstacle.active) return;

    const t = Math.max(0.2, perspective);
    const width = canvas.width * 0.7 * t;

    // Laser sweeps across based on angle
    const laserAngle = obstacle.laserAngle + performance.now() * 0.001;

    ctx.save();
    ctx.translate(obsX, obsY);
    ctx.rotate(Math.sin(laserAngle) * 0.3);

    // Outer glow
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(width / 2, 0);
    ctx.strokeStyle = `rgba(255, 50, 50, ${0.3 * t})`;
    ctx.lineWidth = 20 * t;
    ctx.stroke();

    // Middle glow
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(width / 2, 0);
    ctx.strokeStyle = `rgba(255, 100, 100, ${0.6 * t})`;
    ctx.lineWidth = 8 * t;
    ctx.stroke();

    // Core beam
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(width / 2, 0);
    ctx.strokeStyle = `rgba(255, 200, 200, ${0.9 * t})`;
    ctx.lineWidth = 3 * t;
    ctx.stroke();

    // Emitter nodes at ends
    for (const x of [-width / 2, width / 2]) {
        ctx.beginPath();
        ctx.arc(x, 0, 8 * t, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3333';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    ctx.restore();
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
    const playerY = canvas.height * 0.85;

    gameState.powerUps.forEach(powerUp => {
        if (powerUp.segmentIndex < 0 || powerUp.segmentIndex >= CONFIG.tunnel.segments) return;

        // Calculate position rushing toward player
        const t = 1 - (powerUp.segmentIndex / CONFIG.tunnel.segments);
        const perspective = Math.pow(t, 1.5);

        const powerUpLateral = Math.sin(powerUp.angle);
        const startX = centerX + powerUpLateral * CONFIG.tunnel.baseRadius * 0.3;
        const endX = centerX + powerUpLateral * (canvas.width * 0.4);
        const posX = startX + (endX - startX) * t;

        const startY = centerY;
        const endY = playerY - 80;
        const posY = startY + (endY - startY) * t;

        // Bob effect
        const bobOffset = Math.sin(powerUp.bobPhase) * 5 * perspective;

        const size = 25 * Math.max(0.3, perspective);

        ctx.save();
        ctx.translate(posX, posY + bobOffset);

        // Outer ring
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = powerUp.color;
        ctx.lineWidth = Math.max(1, 3 * perspective);
        ctx.stroke();

        // Pulsing glow
        const pulseSize = size * (1.8 + Math.sin(performance.now() * 0.005) * 0.3);
        const rgb = hexToRgb(powerUp.color);
        const glowGrad = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, pulseSize);
        glowGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`);
        glowGrad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();

        // Background circle
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, 0.5)`;
        ctx.fill();

        // Icon
        ctx.font = `bold ${size * 0.8}px Orbitron, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = powerUp.color;
        ctx.shadowBlur = 10;
        ctx.fillText(powerUp.icon, 0, 2);
        ctx.shadowBlur = 0;

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
    const playerX = centerX + Math.sin(gameState.player.angle) * (canvas.width * 0.35);
    const playerY = canvas.height * 0.85;

    for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 10;
        gameState.particles.push({
            x: playerX,
            y: playerY - 40,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            decay: 0.02 + Math.random() * 0.02,
            size: 3 + Math.random() * 5,
            color: powerUp.color
        });
    }
}

function spawnCollisionParticles() {
    const playerX = centerX + Math.sin(gameState.player.angle) * (canvas.width * 0.35);
    const playerY = canvas.height * 0.85;

    for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 15;
        gameState.particles.push({
            x: playerX,
            y: playerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 5,
            life: 1,
            decay: 0.015 + Math.random() * 0.02,
            size: 4 + Math.random() * 8,
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
    const collisionSegment = 3; // When obstacles reach this segment, check collision
    const hitRadius = CONFIG.player.hitboxRadius;

    // Player lateral position (normalized -1 to 1)
    const playerLateral = Math.sin(playerAngle);

    // Check obstacles
    for (const obstacle of gameState.obstacles) {
        if (obstacle.segmentIndex > collisionSegment + 2 || obstacle.segmentIndex < collisionSegment - 1) continue;

        let collision = false;

        // Obstacle lateral position
        const obstacleLateral = Math.sin(obstacle.angle);

        switch (obstacle.type) {
            case OBSTACLE_TYPES.STATIC:
            case OBSTACLE_TYPES.ROTATING:
            case OBSTACLE_TYPES.MOVING:
                const lateralDiff = Math.abs(playerLateral - obstacleLateral);
                const collisionThreshold = 0.35 + (obstacle.size / CONFIG.tunnel.baseRadius);
                collision = lateralDiff < collisionThreshold && obstacle.segmentIndex < collisionSegment + 0.5 && obstacle.segmentIndex > collisionSegment - 1;
                break;

            case OBSTACLE_TYPES.GATE:
                const gapCenterAngle = obstacle.gapAngle + obstacle.gapSize / 2;
                const gapLateral = Math.sin(gapCenterAngle);
                const gapWidth = obstacle.gapSize / Math.PI; // Normalized gap width
                const distFromGap = Math.abs(playerLateral - gapLateral);
                collision = distFromGap > gapWidth * 0.8 && obstacle.segmentIndex < collisionSegment + 0.5 && obstacle.segmentIndex > collisionSegment - 1;
                break;

            case OBSTACLE_TYPES.LASER:
                if (!obstacle.active) break;
                const laserLateral1 = Math.sin(obstacle.laserAngle);
                const laserLateral2 = Math.sin(obstacle.laserAngle + Math.PI);
                const laserThreshold = 0.2;
                collision = (Math.abs(playerLateral - laserLateral1) < laserThreshold ||
                           Math.abs(playerLateral - laserLateral2) < laserThreshold) &&
                           obstacle.segmentIndex < collisionSegment + 0.5 && obstacle.segmentIndex > collisionSegment - 1;
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
        if (powerUp.segmentIndex > collisionSegment + 1.5 || powerUp.segmentIndex < collisionSegment - 1) continue;

        const powerUpLateral = Math.sin(powerUp.angle);
        const lateralDiff = Math.abs(playerLateral - powerUpLateral);
        if (lateralDiff < 0.4 && powerUp.segmentIndex < collisionSegment + 1 && powerUp.segmentIndex > collisionSegment - 1) {
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

    // Restart background animation
    setTimeout(() => renderStartScreen(), 100);
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
    updateTunnel(deltaTime);
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
    UI.warpLines.style.opacity = Math.max(0, (gameState.speed - 10) / 10);
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
    drawParticles();
    drawPlayer(); // Player on top

    ctx.restore();

    // Speed lines effect at high speeds
    if (gameState.speed > 8) {
        drawSpeedLines();
    }
}

function drawSpeedLines() {
    const intensity = (gameState.speed - 12) / 8;
    if (intensity <= 0) return;

    const lineCount = Math.floor(intensity * 40);

    ctx.save();
    ctx.globalAlpha = Math.min(0.5, intensity * 0.4);

    for (let i = 0; i < lineCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const startRadius = 30 + Math.random() * 80;
        const endRadius = startRadius + 150 + Math.random() * 300;

        const startX = centerX + Math.cos(angle) * startRadius;
        const startY = centerY + Math.sin(angle) * startRadius;
        const endX = centerX + Math.cos(angle) * endRadius;
        const endY = centerY + Math.sin(angle) * endRadius;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = getCurrentPalette().primary;
        ctx.lineWidth = 1 + Math.random();
        ctx.stroke();
    }

    ctx.restore();
}

// ==================== INITIALIZATION ====================
initializeTunnel();

// Initial render for background - slow tunnel animation on start screen
let startScreenSpeed = 1;
function renderStartScreen() {
    if (gameState.running) return; // Stop when game starts

    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    gameState.colorPhase += 0.001;

    // Animate tunnel slowly on start screen
    gameState.tunnelRings.forEach(ring => {
        ring.z -= startScreenSpeed;
        if (ring.z < -50) {
            let maxZ = 0;
            gameState.tunnelRings.forEach(r => { if (r.z > maxZ) maxZ = r.z; });
            ring.z = maxZ + RING_SPACING;
            ring.hue = (ring.z * 0.001 + gameState.colorPhase) % 1;
        }
    });

    drawStars();
    drawTunnel();

    requestAnimationFrame(renderStartScreen);
}

renderStartScreen();
