const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const waveEl = document.getElementById("wave");
const healthEl = document.getElementById("health");
const powerEl = document.getElementById("power");
const highScoreEl = document.getElementById("highScore");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const finalScoreEl = document.getElementById("finalScore");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const pauseBtn = document.getElementById("pauseBtn");
const pauseScreen = document.getElementById("pauseScreen");
const resumeBtn = document.getElementById("resumeBtn");
const playerNameInput = document.getElementById("playerName");
const leaderboardListEl = document.getElementById("leaderboardList");
const gameOverLeaderboardListEl = document.getElementById("gameOverLeaderboardList");
const muteBtn = document.getElementById("muteBtn");
const movePad = document.getElementById("movePad");
const moveKnob = movePad.querySelector("span");
const firePad = document.getElementById("firePad");

const leaderboardKey = "murderlandLeaderboard";
const world = { width: 960, height: 640 };
const keys = new Set();
const pointer = { x: world.width / 2, y: world.height / 2, active: false };
const touchMove = { id: null, x: 0, y: 0 };
const neonColors = {
  player: "#8dfcff",
  bullet: "#fff56b",
  grid: "#24d8ff",
  stalker: "#ff2cff",
  slicer: "#7cff00",
  orbiter: "#ff9f1c",
  boss: "#ffe66d",
  heal: "#24ff8a",
  power: "#ff7a18"
};

let player;
let bullets;
let enemies;
let particles;
let powerups;
let gridRipples;
let score;
let wave;
let gameState = "start";
let lastTime = 0;
let shotTimer = 0;
let spawnTimer = 0;
let enemiesToSpawn = 0;
let activePower = null;
let powerTimer = 0;
let flashTimer = 0;
let shakeTimer = 0;
let shakePower = 0;
let shakeDuration = 0;
let currentPlayerName = "PLAYER";
let leaderboard = readLeaderboard();
let highScore = getLeaderboardHighScore();
let audioContext = null;
let muted = false;
let audioUnlocked = false;

// Leaderboard storage keeps the top 10 named runs and migrates the old single high score.
function readLeaderboard() {
  let scores = [];
  try {
    scores = JSON.parse(localStorage.getItem(leaderboardKey) || "[]");
    if (!Array.isArray(scores)) scores = [];
    const legacyHighScore = Number(localStorage.getItem("murderlandHighScore") || 0);
    if (legacyHighScore > 0 && scores.length === 0) {
      scores.push({ name: "PLAYER", score: legacyHighScore, wave: 1 });
    }
  } catch {
    scores = [];
  }
  return normalizeLeaderboard(scores);
}

function normalizeLeaderboard(scores) {
  return scores
    .map(entry => ({
      name: cleanPlayerName(entry.name),
      score: Math.max(0, Number(entry.score) || 0),
      wave: Math.max(1, Number(entry.wave) || 1)
    }))
    .sort((a, b) => b.score - a.score || b.wave - a.wave)
    .slice(0, 10);
}

function cleanPlayerName(name) {
  const cleaned = String(name || "").trim().toUpperCase().replace(/\s+/g, " ").slice(0, 12);
  return cleaned || "PLAYER";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function getLeaderboardHighScore() {
  return leaderboard.length ? leaderboard[0].score : 0;
}

function saveLeaderboard() {
  try {
    localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
  } catch {
    // Private or restricted browsing can disable storage; gameplay should continue.
  }
}

function saveLeaderboardScore() {
  leaderboard = normalizeLeaderboard([
    ...leaderboard,
    { name: currentPlayerName, score, wave }
  ]);
  highScore = getLeaderboardHighScore();
  saveLeaderboard();
  renderLeaderboards();
}

function renderLeaderboards() {
  const rows = leaderboard.length
    ? leaderboard.map((entry, index) => `
      <div class="leaderboard-row">
        <span>#${index + 1}</span>
        <span>${escapeHtml(entry.name)}</span>
        <span>${entry.score}</span>
        <span>W${entry.wave}</span>
      </div>
    `).join("")
    : `<p class="leaderboard-empty">No scores yet</p>`;
  const html = `
    <div class="leaderboard-row leaderboard-head">
      <span>Rank</span>
      <span>Name</span>
      <span>Score</span>
      <span>Wave</span>
    </div>
    ${rows}
  `;

  leaderboardListEl.innerHTML = html;
  gameOverLeaderboardListEl.innerHTML = html;
  highScoreEl.textContent = highScore;
}

// Web Audio sound effects are generated locally and unlocked by the first user gesture.
function unlockAudio() {
  if (audioUnlocked) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  audioContext = audioContext || new AudioCtor();
  if (audioContext.state === "suspended") audioContext.resume();
  audioUnlocked = true;
}

function setMuted(nextMuted) {
  muted = nextMuted;
  muteBtn.textContent = muted ? "Sound Off" : "Sound On";
  muteBtn.setAttribute("aria-pressed", String(muted));
}

function playTone(frequency, duration, type = "square", volume = 0.08, glideTo = frequency) {
  if (muted || !audioContext) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playNoise(duration, volume = 0.08) {
  if (muted || !audioContext) return;
  const now = audioContext.currentTime;
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();

  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(gain);
  gain.connect(audioContext.destination);
  source.start(now);
}

function playSound(name) {
  if (muted || !audioContext) return;
  if (name === "shoot") playTone(420, 0.06, "square", 0.045, 190);
  if (name === "hit") playTone(130, 0.07, "sawtooth", 0.05, 70);
  if (name === "damage") {
    playNoise(0.18, 0.11);
    playTone(90, 0.16, "sawtooth", 0.06, 45);
  }
  if (name === "powerup") {
    playTone(520, 0.08, "triangle", 0.06, 880);
    window.setTimeout(() => playTone(760, 0.08, "triangle", 0.045, 1040), 70);
  }
  if (name === "wave") {
    playTone(330, 0.1, "triangle", 0.055, 520);
    window.setTimeout(() => playTone(660, 0.12, "triangle", 0.05, 990), 90);
  }
  if (name === "gameover") {
    playTone(190, 0.18, "sawtooth", 0.075, 120);
    window.setTimeout(() => playTone(110, 0.28, "sawtooth", 0.07, 55), 150);
  }
}

function resetGame() {
  player = {
    x: world.width / 2,
    y: world.height / 2,
    r: 17,
    speed: 250,
    health: 100,
    maxHealth: 100,
    invuln: 0
  };
  bullets = [];
  enemies = [];
  particles = [];
  powerups = [];
  gridRipples = [];
  score = 0;
  wave = 1;
  shotTimer = 0;
  spawnTimer = 0;
  activePower = null;
  powerTimer = 0;
  flashTimer = 0;
  shakeTimer = 0;
  shakePower = 0;
  shakeDuration = 0;
  startWave();
  updateHud();
}

function startWave() {
  enemiesToSpawn = wave % 5 === 0 ? 0 : 6 + wave * 3;
  spawnTimer = 0.35;
  if (wave % 5 === 0) spawnBoss();
}

function startGame() {
  unlockAudio();
  currentPlayerName = cleanPlayerName(playerNameInput.value);
  playerNameInput.value = currentPlayerName === "PLAYER" ? "" : currentPlayerName;
  resetControls();
  resetGame();
  gameState = "playing";
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  pauseBtn.disabled = false;
  pauseBtn.textContent = "Pause";
}

function endGame() {
  gameState = "gameover";
  resetControls();
  pauseBtn.disabled = true;
  pauseBtn.textContent = "Pause";
  saveLeaderboardScore();
  playSound("gameover");
  finalScoreEl.textContent = `${currentPlayerName} | Score: ${score} | Wave: ${wave} | High: ${highScore}`;
  gameOverScreen.classList.remove("hidden");
}

function setPaused(nextPaused) {
  if (nextPaused && gameState !== "playing") return;
  if (!nextPaused && gameState !== "paused") return;
  gameState = nextPaused ? "paused" : "playing";
  pauseScreen.classList.toggle("hidden", !nextPaused);
  pauseBtn.textContent = nextPaused ? "Resume" : "Pause";
  resetControls();
}

function togglePause() {
  if (gameState === "playing") {
    setPaused(true);
  } else if (gameState === "paused") {
    setPaused(false);
  }
}

function updateHud() {
  scoreEl.textContent = score;
  waveEl.textContent = wave;
  healthEl.textContent = Math.max(0, Math.ceil(player.health));
  powerEl.textContent = activePower ? `${activePower} ${Math.ceil(powerTimer)}s` : "Ready";
  highScoreEl.textContent = Math.max(highScore, score);
}

function addShake(power, duration) {
  if (power >= shakePower || duration > shakeTimer) {
    shakePower = power;
    shakeDuration = duration;
  }
  shakeTimer = Math.max(shakeTimer, duration);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(canvas.width / world.width, 0, 0, canvas.height / world.height, 0, 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function enemyNeonColor(enemy) {
  if (enemy.boss) return neonColors.boss;
  return neonColors[enemy.type] || neonColors.stalker;
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  const pos = [
    { x: rand(0, world.width), y: -28 },
    { x: world.width + 28, y: rand(0, world.height) },
    { x: rand(0, world.width), y: world.height + 28 },
    { x: -28, y: rand(0, world.height) }
  ][edge];
  const roll = Math.random();
  const type = roll < 0.42 ? "stalker" : roll < 0.74 ? "slicer" : "orbiter";
  const specs = {
    stalker: { r: 16, speed: 104 + wave * 6, health: 2, score: 35, color: "#ff1d25" },
    slicer: { r: 12, speed: 150 + wave * 7, health: 1, score: 30, color: "#ff6b00" },
    orbiter: { r: 18, speed: 88 + wave * 5, health: 3, score: 50, color: "#7a1115" }
  };
  const spec = specs[type];

  enemies.push({
    x: pos.x,
    y: pos.y,
    r: spec.r,
    speed: spec.speed,
    health: spec.health,
    maxHealth: spec.health,
    score: spec.score,
    color: spec.color,
    type,
    angle: rand(0, Math.PI * 2),
    phase: rand(0, Math.PI * 2),
    hitTimer: 0,
    boss: false
  });
}

function spawnBoss() {
  enemies.push({
    x: world.width / 2,
    y: -70,
    r: 46,
    speed: 78 + wave * 3,
    health: 36 + wave * 6,
    maxHealth: 36 + wave * 6,
    score: 600 + wave * 70,
    color: "#c1121f",
    type: "boss",
    angle: Math.PI / 2,
    phase: 0,
    hitTimer: 0,
    boss: true
  });
}

function shoot() {
  const dx = pointer.x - player.x;
  const dy = pointer.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  const spread = activePower === "Triple" ? [-0.18, 0, 0.18] : [0];

  for (const angleOffset of spread) {
    const base = Math.atan2(dy, dx) + angleOffset;
    bullets.push({
      x: player.x + Math.cos(base) * player.r,
      y: player.y + Math.sin(base) * player.r,
      vx: Math.cos(base) * 620,
      vy: Math.sin(base) * 620,
      r: activePower === "Blaster" ? 7 : 5,
      damage: activePower === "Blaster" ? 2 : 1,
      life: 1.1
    });
  }
  addShake(activePower === "Blaster" ? 4 : 2.5, 0.07);
  playSound("shoot");
}

function spawnBurst(x, y, color, amount) {
  for (let i = 0; i < amount; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(120, 360);
    const life = rand(0.55, 0.72);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      color,
      size: rand(2, 4.5)
    });
  }
}

function addGridRipple(x, y, strength = 1) {
  gridRipples.push({
    x,
    y,
    strength,
    life: 0.85,
    maxLife: 0.85
  });
}

function maybeDropPowerup(x, y) {
  if (Math.random() > 0.18) return;
  const types = ["Heal", "Triple", "Blaster", "Slow"];
  powerups.push({
    x,
    y,
    r: 13,
    type: types[Math.floor(Math.random() * types.length)],
    pulse: 0
  });
}

function applyPowerup(type) {
  if (type === "Heal") {
    player.health = clamp(player.health + 24, 0, player.maxHealth);
  } else {
    activePower = type;
    powerTimer = type === "Slow" ? 7 : 9;
  }
}

function update(dt) {
  if (gameState !== "playing") return;

  let mx = 0;
  let my = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) my -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) my += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
  mx += touchMove.x;
  my += touchMove.y;

  const moveLen = Math.hypot(mx, my);
  if (moveLen > 0) {
    player.x += (mx / moveLen) * player.speed * dt;
    player.y += (my / moveLen) * player.speed * dt;
  }
  player.x = clamp(player.x, player.r, world.width - player.r);
  player.y = clamp(player.y, player.r, world.height - player.r);
  player.invuln = Math.max(0, player.invuln - dt);
  flashTimer = Math.max(0, flashTimer - dt);
  shakeTimer = Math.max(0, shakeTimer - dt);
  if (shakeTimer === 0) {
    shakePower = 0;
    shakeDuration = 0;
  }

  if (activePower) {
    powerTimer -= dt;
    if (powerTimer <= 0) {
      activePower = null;
      powerTimer = 0;
    }
  }

  shotTimer -= dt;
  const wantsFire = pointer.active || keys.has("Space");
  const fireRate = activePower === "Blaster" ? 0.16 : 0.22;
  if (wantsFire && shotTimer <= 0) {
    shoot();
    shotTimer = fireRate;
  }

  spawnTimer -= dt;
  if (enemiesToSpawn > 0 && spawnTimer <= 0) {
    spawnEnemy();
    enemiesToSpawn--;
    spawnTimer = Math.max(0.18, 0.78 - wave * 0.035);
  }
  if (enemiesToSpawn === 0 && enemies.length === 0) {
    wave++;
    score += 120 + wave * 15;
    playSound("wave");
    startWave();
  }

  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }
  bullets = bullets.filter(b => b.life > 0 && b.x > -40 && b.x < world.width + 40 && b.y > -40 && b.y < world.height + 40);

  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    const slow = activePower === "Slow" ? 0.55 : 1;
    const tx = dx / len;
    const ty = dy / len;
    enemy.phase += dt;

    if (enemy.type === "slicer") {
      const side = Math.sin(enemy.phase * 6 + enemy.angle) * 0.85;
      enemy.x += (tx + -ty * side) * enemy.speed * slow * dt;
      enemy.y += (ty + tx * side) * enemy.speed * slow * dt;
    } else if (enemy.type === "orbiter") {
      const orbit = enemy.r + 95 + Math.sin(enemy.phase * 2.4) * 30;
      const desiredAngle = Math.atan2(dy, dx) + Math.sin(enemy.phase * 1.8 + enemy.angle) * 1.15;
      const targetX = player.x - Math.cos(desiredAngle) * orbit;
      const targetY = player.y - Math.sin(desiredAngle) * orbit;
      enemy.x += clamp(targetX - enemy.x, -enemy.speed, enemy.speed) * slow * dt;
      enemy.y += clamp(targetY - enemy.y, -enemy.speed, enemy.speed) * slow * dt;
    } else if (enemy.type === "boss") {
      enemy.x += Math.sin(enemy.phase * 1.6) * enemy.speed * 0.55 * dt;
      enemy.y += ty * enemy.speed * 0.72 * slow * dt;
      if (enemy.y > 122) {
        enemy.y = 122 + Math.sin(enemy.phase * 1.8) * 18;
        enemy.x += tx * enemy.speed * 0.52 * slow * dt;
      }
      enemy.x = clamp(enemy.x, enemy.r + 24, world.width - enemy.r - 24);
    } else {
      enemy.x += tx * enemy.speed * slow * dt;
      enemy.y += ty * enemy.speed * slow * dt;
    }
    enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
  }

  for (const bullet of bullets) {
    for (const enemy of enemies) {
      if (bullet.life <= 0 || enemy.health <= 0 || distance(bullet, enemy) > bullet.r + enemy.r) continue;
      bullet.life = 0;
      enemy.health -= bullet.damage;
      enemy.hitTimer = 0.08;
      playSound("hit");
      addGridRipple(bullet.x, bullet.y, 0.45);
      spawnBurst(bullet.x, bullet.y, enemyNeonColor(enemy), 5);
      if (enemy.health <= 0) {
        score += enemy.score;
        addGridRipple(enemy.x, enemy.y, enemy.boss ? 1.6 : 1);
        spawnBurst(enemy.x, enemy.y, enemyNeonColor(enemy), Math.floor(rand(12, 17)));
        maybeDropPowerup(enemy.x, enemy.y);
      }
    }
  }
  enemies = enemies.filter(e => e.health > 0);

  for (const enemy of enemies) {
    if (player.invuln > 0 || distance(player, enemy) > player.r + enemy.r) continue;
    player.health -= enemy.r > 18 ? 22 : 14;
    player.invuln = 0.75;
    flashTimer = 0.18;
    addShake(enemy.boss ? 18 : 11, 0.28);
    playSound("damage");
    addGridRipple(player.x, player.y, 0.8);
    spawnBurst(player.x, player.y, "#ffffff", 16);
    if (player.health <= 0) {
      player.health = 0;
      endGame();
      break;
    }
  }

  for (const powerup of powerups) {
    powerup.pulse += dt * 5;
    if (distance(player, powerup) <= player.r + powerup.r + 8) {
      applyPowerup(powerup.type);
      powerup.collected = true;
      score += 40;
      playSound("powerup");
      spawnBurst(powerup.x, powerup.y, neonColors.heal, 14);
    }
  }
  powerups = powerups.filter(p => !p.collected);

  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.9;
    particle.vy *= 0.9;
    particle.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);

  for (const ripple of gridRipples) {
    ripple.life -= dt;
  }
  gridRipples = gridRipples.filter(r => r.life > 0);

  updateHud();
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function colorAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function mixColor(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const mix = channel => Math.round(ca[channel] + (cb[channel] - ca[channel]) * t);
  return `#${[mix("r"), mix("g"), mix("b")].map(value => value.toString(16).padStart(2, "0")).join("")}`;
}

function withGlow(color, blur, draw) {
  const previousBlur = ctx.shadowBlur;
  const previousColor = ctx.shadowColor;
  ctx.shadowBlur = blur;
  ctx.shadowColor = color;
  draw();
  ctx.shadowBlur = previousBlur;
  ctx.shadowColor = previousColor;
}

function gridPoint(x, y) {
  let ox = 0;
  let oy = 0;
  const now = performance.now() * 0.001;

  for (const ripple of gridRipples) {
    const dx = x - ripple.x;
    const dy = y - ripple.y;
    const dist = Math.hypot(dx, dy) || 1;
    const age = 1 - ripple.life / ripple.maxLife;
    const shell = Math.sin(dist * 0.052 - age * 18);
    const envelope = Math.exp(-dist / 260) * Math.sin(Math.PI * age) * ripple.strength;
    const amount = shell * envelope * 18;
    ox += (dx / dist) * amount;
    oy += (dy / dist) * amount;
  }

  ox += Math.sin(y * 0.018 + now * 1.4) * 1.5;
  oy += Math.cos(x * 0.016 + now * 1.1) * 1.5;
  return { x: x + ox, y: y + oy };
}

function drawGridPath(points, color, alpha, width) {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = colorAlpha(color, alpha);
  ctx.lineWidth = width;
  withGlow(color, 12, () => ctx.stroke());
}

function drawGrid() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, world.width, world.height);

  const tint = mixColor("#24d8ff", "#9d4dff", clamp((wave - 1) / 18, 0, 1));
  const cell = 48;
  const sample = 24;

  for (let x = 0; x <= world.width; x += cell) {
    const points = [];
    for (let y = 0; y <= world.height; y += sample) points.push(gridPoint(x, y));
    drawGridPath(points, tint, 0.34, 1.2);
  }

  for (let y = 0; y <= world.height; y += cell) {
    const points = [];
    for (let x = 0; x <= world.width; x += sample) points.push(gridPoint(x, y));
    drawGridPath(points, tint, 0.34, 1.2);
  }

  ctx.fillStyle = colorAlpha(tint, 0.42);
  withGlow(tint, 9, () => {
    for (let x = 0; x <= world.width; x += cell) {
      for (let y = 0; y <= world.height; y += cell) {
        const point = gridPoint(x, y);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  const vignette = ctx.createRadialGradient(
    world.width / 2,
    world.height / 2,
    world.width * 0.22,
    world.width / 2,
    world.height / 2,
    world.width * 0.74
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.82)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, world.width, world.height);
}

function drawPlayer() {
  const angle = Math.atan2(pointer.y - player.y, pointer.x - player.x);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);
  ctx.globalAlpha = player.invuln > 0 && Math.floor(performance.now() / 80) % 2 ? 0.55 : 1;

  withGlow("#ff7a18", 18, () => {
    ctx.fillStyle = "rgba(255, 122, 24, 0.55)";
    ctx.beginPath();
    ctx.moveTo(-16, -7);
    ctx.lineTo(-34 - Math.random() * 8, 0);
    ctx.lineTo(-16, 7);
    ctx.closePath();
    ctx.fill();
  });

  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.lineTo(-18, -17);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-18, 17);
  ctx.closePath();
  withGlow(neonColors.player, 22, () => {
    ctx.strokeStyle = colorAlpha(neonColors.player, 0.42);
    ctx.lineWidth = 8;
    ctx.stroke();
  });
  ctx.strokeStyle = neonColors.player;
  ctx.lineWidth = 2.5;
  withGlow(neonColors.player, 10, () => ctx.stroke());
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fill();
  ctx.restore();

  withGlow(player.health > 35 ? neonColors.heal : neonColors.stalker, 12, () => {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(player.x - 23, player.y + 26, 46, 6);
    ctx.fillStyle = player.health > 35 ? neonColors.heal : neonColors.stalker;
    ctx.fillRect(player.x - 23, player.y + 26, 46 * (player.health / player.maxHealth), 6);
  });
}

function drawPowerup(powerup) {
  const color = powerup.type === "Heal" ? neonColors.heal : neonColors.power;
  const pulse = Math.sin(powerup.pulse) * 3;
  ctx.save();
  ctx.translate(powerup.x, powerup.y);
  withGlow(color, 18, () => {
    ctx.strokeStyle = colorAlpha(color, 0.5);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, powerup.r + pulse, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  withGlow(color, 10, () => {
    ctx.beginPath();
    ctx.arc(0, 0, powerup.r + pulse * 0.4, 0, Math.PI * 2);
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.moveTo(0, -7);
    ctx.lineTo(0, 7);
    ctx.stroke();
  });
  ctx.restore();
}

function drawBullet(bullet) {
  const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
  const nx = bullet.vx / speed;
  const ny = bullet.vy / speed;
  const trail = 30;
  const gradient = ctx.createLinearGradient(bullet.x - nx * trail, bullet.y - ny * trail, bullet.x, bullet.y);
  gradient.addColorStop(0, colorAlpha(neonColors.bullet, 0));
  gradient.addColorStop(1, colorAlpha(neonColors.bullet, 0.78));

  ctx.strokeStyle = gradient;
  ctx.lineWidth = 3;
  withGlow(neonColors.bullet, 12, () => {
    ctx.beginPath();
    ctx.moveTo(bullet.x - nx * trail, bullet.y - ny * trail);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
  });

  withGlow(neonColors.bullet, 14, () => {
    ctx.fillStyle = colorAlpha(neonColors.bullet, 0.62);
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.r + 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, bullet.r * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

function traceEnemyShape(enemy) {
  const r = enemy.r;
  if (enemy.type === "slicer") {
    ctx.moveTo(0, -r - 10);
    ctx.lineTo(0, r + 10);
    ctx.moveTo(-r - 10, 0);
    ctx.lineTo(r + 10, 0);
    ctx.moveTo(-r * 0.65, -r * 0.65);
    ctx.lineTo(r * 0.65, r * 0.65);
    ctx.moveTo(r * 0.65, -r * 0.65);
    ctx.lineTo(-r * 0.65, r * 0.65);
  } else if (enemy.type === "orbiter") {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.moveTo(r * 0.55, 0);
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  } else if (enemy.type === "boss") {
    ctx.moveTo(r + 16, 0);
    ctx.lineTo(r * 0.05, -r * 0.85);
    ctx.lineTo(-r * 0.72, -r * 0.55);
    ctx.lineTo(-r * 0.18, 0);
    ctx.lineTo(-r * 0.72, r * 0.55);
    ctx.lineTo(r * 0.05, r * 0.85);
    ctx.closePath();
  } else {
    ctx.moveTo(0, -r - 8);
    ctx.lineTo(r + 8, 0);
    ctx.lineTo(0, r + 8);
    ctx.lineTo(-r - 8, 0);
    ctx.closePath();
  }
}

function drawEnemy(enemy) {
  const color = enemy.hitTimer > 0 ? "#ffffff" : enemyNeonColor(enemy);
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(Math.atan2(player.y - enemy.y, player.x - enemy.x));

  ctx.beginPath();
  traceEnemyShape(enemy);
  withGlow(color, 22, () => {
    ctx.strokeStyle = colorAlpha(color, 0.35);
    ctx.lineWidth = 9;
    ctx.stroke();
  });
  ctx.beginPath();
  traceEnemyShape(enemy);
  withGlow(color, 12, () => {
    ctx.strokeStyle = color;
    ctx.lineWidth = enemy.boss ? 3.2 : 2.4;
    ctx.stroke();
  });
  ctx.beginPath();
  traceEnemyShape(enemy);
  ctx.strokeStyle = colorAlpha("#ffffff", enemy.hitTimer > 0 ? 0.95 : 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  if (enemy.boss) {
    withGlow(neonColors.boss, 14, () => {
      ctx.strokeStyle = neonColors.boss;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(220, 28, 520, 12);
      ctx.fillStyle = colorAlpha(neonColors.boss, 0.82);
      ctx.fillRect(220, 28, 520 * (enemy.health / enemy.maxHealth), 12);
    });
  }
}

function drawParticle(particle) {
  const alpha = clamp(particle.life / particle.maxLife, 0, 1);
  withGlow(particle.color, 14, () => {
    ctx.strokeStyle = colorAlpha(particle.color, alpha);
    ctx.lineWidth = particle.size || 3;
    ctx.beginPath();
    ctx.moveTo(particle.x, particle.y);
    ctx.lineTo(particle.x - particle.vx * 0.035, particle.y - particle.vy * 0.035);
    ctx.stroke();
  });
}

function draw() {
  ctx.save();
  if (shakeTimer > 0) {
    const amount = shakePower * (shakeTimer / shakeDuration);
    ctx.translate(rand(-amount, amount), rand(-amount, amount));
  }

  drawGrid();

  for (const powerup of powerups) {
    drawPowerup(powerup);
  }

  for (const bullet of bullets) {
    drawBullet(bullet);
  }

  for (const enemy of enemies) {
    drawEnemy(enemy);
  }

  for (const particle of particles) {
    drawParticle(particle);
  }

  drawPlayer();

  if (flashTimer > 0) {
    ctx.fillStyle = `rgba(255, 29, 37, ${flashTimer * 1.8})`;
    ctx.fillRect(0, 0, world.width, world.height);
  }
  ctx.restore();
}

function loop(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * world.width,
    y: ((clientY - rect.top) / rect.height) * world.height
  };
}

function setPointerFromEvent(event) {
  const pos = canvasToWorld(event.clientX, event.clientY);
  pointer.x = clamp(pos.x, 0, world.width);
  pointer.y = clamp(pos.y, 0, world.height);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", event => {
  unlockAudio();
  if (event.target === playerNameInput) {
    if (event.code === "Enter") startGame();
    return;
  }
  if (event.code === "KeyP" || event.code === "Escape") {
    togglePause();
    event.preventDefault();
    return;
  }
  keys.add(event.code);
  if (event.code === "Space") event.preventDefault();
  if ((gameState === "start" || gameState === "gameover") && event.code === "Enter") startGame();
  if (gameState === "paused" && event.code === "Enter") setPaused(false);
});
window.addEventListener("keyup", event => keys.delete(event.code));

canvas.addEventListener("pointermove", setPointerFromEvent);
canvas.addEventListener("pointerdown", event => {
  unlockAudio();
  pointer.active = true;
  setPointerFromEvent(event);
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointerup", event => {
  pointer.active = false;
  canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
});

function updateMovePadPoint(clientX, clientY) {
  const rect = movePad.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const max = rect.width * 0.42;
  const len = Math.hypot(dx, dy);
  const limited = Math.min(max, len);
  const nx = len ? dx / len : 0;
  const ny = len ? dy / len : 0;
  touchMove.x = nx * Math.min(1, len / max);
  touchMove.y = ny * Math.min(1, len / max);
  moveKnob.style.transform = `translate(calc(-50% + ${nx * limited}px), calc(-50% + ${ny * limited}px))`;
}

function resetMovePad() {
  touchMove.id = null;
  touchMove.x = 0;
  touchMove.y = 0;
  movePad.classList.remove("active");
  moveKnob.style.transform = "translate(-50%, -50%)";
}

function resetControls() {
  pointer.active = false;
  firePad.classList.remove("active");
  resetMovePad();
}

movePad.addEventListener("pointerdown", event => {
  unlockAudio();
  touchMove.id = event.pointerId;
  movePad.classList.add("active");
  movePad.setPointerCapture(event.pointerId);
  updateMovePadPoint(event.clientX, event.clientY);
  event.preventDefault();
});

movePad.addEventListener("pointermove", event => {
  if (event.pointerId !== touchMove.id) return;
  updateMovePadPoint(event.clientX, event.clientY);
  event.preventDefault();
});

movePad.addEventListener("pointerup", event => {
  if (event.pointerId !== touchMove.id) return;
  movePad.releasePointerCapture(event.pointerId);
  resetMovePad();
});

movePad.addEventListener("pointercancel", resetMovePad);

firePad.addEventListener("pointerdown", event => {
  unlockAudio();
  pointer.active = true;
  firePad.classList.add("active");
  firePad.setPointerCapture(event.pointerId);
  event.preventDefault();
});
firePad.addEventListener("pointerup", event => {
  pointer.active = false;
  firePad.classList.remove("active");
  firePad.releasePointerCapture(event.pointerId);
});
firePad.addEventListener("pointercancel", () => {
  pointer.active = false;
  firePad.classList.remove("active");
});

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", () => {
  unlockAudio();
  togglePause();
});
resumeBtn.addEventListener("click", () => setPaused(false));
muteBtn.addEventListener("click", () => {
  unlockAudio();
  setMuted(!muted);
});
playerNameInput.addEventListener("blur", () => {
  const cleanName = cleanPlayerName(playerNameInput.value);
  playerNameInput.value = cleanName === "PLAYER" ? "" : cleanName;
});

resizeCanvas();
resetGame();
renderLeaderboards();
draw();
requestAnimationFrame(loop);
