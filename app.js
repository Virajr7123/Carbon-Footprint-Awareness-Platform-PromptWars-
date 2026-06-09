/* ═══════════════════════════════════════════════════
   TERRAMO — Carbon Footprint Platform
   app.js — All interactive logic
   ═══════════════════════════════════════════════════ */

'use strict';

// ═══════════════ CINEMATIC HERO VIDEO LOOP ═══════════════
function initHeroVideo() {
  const video = document.getElementById('hero-video');
  if (!video) return;

  const FADE_IN  = 0.5; // seconds to fade in
  const FADE_OUT = 0.5; // seconds to fade out before end
  const GAP_MS   = 100; // ms pause between loops
  let raf;

  function tick() {
    const { currentTime, duration, paused } = video;
    if (!duration || paused) { raf = requestAnimationFrame(tick); return; }

    const remaining = duration - currentTime;

    if (currentTime < FADE_IN) {
      video.style.opacity = Math.min(1, currentTime / FADE_IN).toFixed(3);
    } else if (remaining <= FADE_OUT) {
      video.style.opacity = Math.max(0, remaining / FADE_OUT).toFixed(3);
    } else {
      video.style.opacity = '1';
    }

    raf = requestAnimationFrame(tick);
  }

  video.addEventListener('ended', () => {
    cancelAnimationFrame(raf);
    video.style.opacity = '0';
    setTimeout(() => {
      video.currentTime = 0;
      video.play().catch(() => {});
    }, GAP_MS);
  });

  video.addEventListener('play', () => {
    raf = requestAnimationFrame(tick);
  });

  video.addEventListener('canplay', () => {
    video.style.opacity = '0';
    video.play().catch(() => {});
  }, { once: true });

  // Kick off if already loadable
  if (video.readyState >= 3) {
    video.style.opacity = '0';
    video.play().catch(() => {});
  }
}

// ═══════════════ STATE ═══════════════
const state = {
  transport: {
    ownsCar: true,
    carType: 'petrol',
    carKm: 200,
    shortFlights: 2,
    longFlights: 1,
    transit: 'rarely',
  },
  home: {
    type: 'apartment',
    household: 3,
    heating: 'gas',
    elecBill: 120,
    renewable: false,
  },
  diet: {
    type: 'flexitarian',
    localFood: 'rarely',
    waste: 1,
  },
  shopping: {
    fashion: 80,
    secondhand: false,
    electronics: 2,
    packages: 5,
  },
  selectedActions: new Set(),
  challengeDays: 3,
  streakDays: 14,
};

// ═══════════════ CO₂ CALCULATION ENGINE ═══════════════
function calculateFootprint() {
  // Transport
  const carFactors = { petrol: 0.21, hybrid: 0.11, ev: 0.05 };
  const carFactor = carFactors[state.transport.carType] || 0.21;
  const carCO2 = state.transport.ownsCar
    ? (state.transport.carKm * 52 * carFactor) / 1000
    : 0;

  const shortFlightCO2 = state.transport.shortFlights * 0.255;
  const longFlightCO2 = state.transport.longFlights * 1.2;

  const transitReduce = { rarely: 1.0, sometimes: 0.9, often: 0.75, always: 0.6 };
  const transitFactor = transitReduce[state.transport.transit] || 1.0;

  const transportTotal = (carCO2 + shortFlightCO2 + longFlightCO2) * transitFactor;

  // Home
  const heatingFactors = { gas: 1.6, electric: 0.9, 'heat-pump': 0.4, oil: 2.4 };
  const homeTypeFactors = { apartment: 0.7, semi: 1.0, detached: 1.4 };
  const baseCO2 = (state.home.elecBill / 120) * 1.4;
  const heatingCO2 = heatingFactors[state.home.heating] || 1.6;
  const homeTypeMul = homeTypeFactors[state.home.type] || 1.0;
  const householdDiv = Math.max(1, state.home.household);
  const renewableMul = state.home.renewable ? 0.45 : 1.0;
  const homeTotal = ((baseCO2 + heatingCO2) * homeTypeMul * renewableMul) / householdDiv;

  // Diet
  const dietFactors = { vegan: 0.5, vegetarian: 0.75, flexitarian: 1.1, omnivore: 1.5, 'heavy-meat': 2.1 };
  const localFactors = { rarely: 1.0, sometimes: 0.92, often: 0.82, always: 0.72 };
  const wasteFactors = [0.9, 1.0, 1.12, 1.25];
  const dietTotal =
    (dietFactors[state.diet.type] || 1.1) *
    (localFactors[state.diet.localFood] || 1.0) *
    (wasteFactors[state.diet.waste] || 1.0);

  // Shopping
  const fashionCO2 = (state.shopping.fashion / 100) * 0.5 * (state.shopping.secondhand ? 0.4 : 1.0);
  const electronicsCO2 = state.shopping.electronics * 0.3;
  const packagesCO2 = state.shopping.packages * 12 * 0.01;
  const shopTotal = fashionCO2 + electronicsCO2 + packagesCO2;

  return {
    transport: Math.max(0, parseFloat(transportTotal.toFixed(2))),
    home: Math.max(0, parseFloat(homeTotal.toFixed(2))),
    diet: Math.max(0, parseFloat(dietTotal.toFixed(2))),
    shopping: Math.max(0, parseFloat(shopTotal.toFixed(2))),
    total: 0,
  };
}

function getTotalFootprint() {
  const fp = calculateFootprint();
  fp.total = parseFloat((fp.transport + fp.home + fp.diet + fp.shopping).toFixed(2));
  return fp;
}

// ═══════════════ UI UPDATE ═══════════════
function updateResultPanel() {
  const fp = getTotalFootprint();
  const maxVal = Math.max(fp.transport, fp.home, fp.diet, fp.shopping, 0.1);

  // Main number
  animateNumber('result-number', parseFloat(document.getElementById('result-number').textContent), fp.total, 800);

  // Breakdown bars
  updateBar('bi-transport', 'bi-transport-val', fp.transport, maxVal);
  updateBar('bi-home', 'bi-home-val', fp.home, maxVal);
  updateBar('bi-diet', 'bi-diet-val', fp.diet, maxVal);
  updateBar('bi-shop', 'bi-shop-val', fp.shopping, maxVal);

  // Gauge
  updateGauge(fp.total);

  // Dashboard
  updateDashboard(fp);
  updateSavingsBanner(fp.total);
  updateOffsetTonnes(fp.total);
}

function updateBar(fillId, valId, value, max) {
  const fill = document.getElementById(fillId);
  const val = document.getElementById(valId);
  if (fill) fill.style.width = `${Math.min(100, (value / max) * 100)}%`;
  if (val) val.textContent = value.toFixed(1);
}

function updateGauge(total) {
  const maxT = 16;
  const pct = Math.min(1, total / maxT);
  const arc = document.getElementById('gauge-arc');
  const needle = document.getElementById('gauge-needle');
  const needleLine = document.getElementById('gauge-needle-line');
  if (!arc) return;

  const totalArc = 251;
  const offset = totalArc - pct * totalArc;
  arc.style.strokeDashoffset = offset;

  // Needle position
  const angle = -180 + pct * 180;
  const rad = (angle * Math.PI) / 180;
  const cx = 100, cy = 100, r = 65;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);
  needle.setAttribute('cx', nx);
  needle.setAttribute('cy', ny);
  needleLine.setAttribute('x2', nx);
  needleLine.setAttribute('y2', ny);
}

function updateDashboard(fp) {
  const total = fp.total;

  // Score
  const parisDist = Math.max(0, 1 - (total - 2) / 14) * 100;
  const grade = getGrade(total);
  const el = document.getElementById('score-grade');
  const pct = document.getElementById('score-pct');
  const ring = document.getElementById('score-ring');
  const smiYour = document.getElementById('smi-your');

  if (el) el.textContent = grade;
  if (pct) pct.textContent = Math.round(parisDist) + '%';
  if (ring) {
    const offset = 364 - (parisDist / 100) * 364;
    ring.style.strokeDashoffset = offset;
    const color = total < 3 ? '#4E9136' : total < 6 ? '#7A9B5E' : total < 10 ? '#C8963E' : '#C45878';
    ring.setAttribute('stroke', color);
  }
  if (smiYour) smiYour.textContent = `${total.toFixed(1)}T CO₂`;

  // Equivalencies
  setEl('eq-flights', Math.round(total / 0.85));
  setEl('eq-km', Math.round(total * 3840).toLocaleString());
  setEl('eq-trees', Math.round(total * 50));
  setEl('eq-days', Math.round(total * 107));

  // Compare bar
  const maxT = 16;
  const youBar = document.getElementById('cmp-you');
  const youVal = document.getElementById('cmp-you-val');
  if (youBar) youBar.style.width = `${(total / maxT) * 100}%`;
  if (youVal) youVal.textContent = `${total.toFixed(1)}T`;

  // Chart
  drawTrendChart(total);
  drawRadarChart(fp);
}

function getGrade(t) {
  if (t < 1.5) return 'A+';
  if (t < 2.5) return 'A';
  if (t < 3.5) return 'B+';
  if (t < 5.0) return 'B';
  if (t < 7.0) return 'C+';
  if (t < 9.0) return 'C';
  if (t < 12.0) return 'D';
  return 'F';
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// Animate number counting
function animateNumber(id, from, to, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = (from + (to - from) * ease).toFixed(1);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ═══════════════ CANVAS CHARTS ═══════════════
function drawTrendChart(total) {
  const canvas = document.getElementById('trend-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.offsetWidth;
  canvas.height = 160;

  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const baseData = [5.8, 5.6, 5.3, 5.7, 6.1, 5.9, 5.5, 5.2, 5.0, 4.9, 4.8, total];

  const W = canvas.width, H = canvas.height;
  const padL = 30, padR = 16, padT = 16, padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...baseData) * 1.1;
  const minVal = 0;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH - (i / 4) * chartH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.strokeStyle = 'rgba(78, 145, 54, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Points
  const pts = baseData.map((v, i) => ({
    x: padL + (i / (baseData.length - 1)) * chartW,
    y: padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH,
  }));

  // Area gradient
  const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
  grad.addColorStop(0, 'rgba(78, 145, 54, 0.18)');
  grad.addColorStop(1, 'rgba(78, 145, 54, 0)');

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * 0.5;
    const cp1y = pts[i - 1].y;
    const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) * 0.5;
    const cp2y = pts[i].y;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, pts[i].x, pts[i].y);
  }
  ctx.lineTo(pts[pts.length - 1].x, H - padB);
  ctx.lineTo(pts[0].x, H - padB);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * 0.5;
    const cp1y = pts[i - 1].y;
    const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) * 0.5;
    const cp2y = pts[i].y;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = '#D4854A';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Points
  pts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === pts.length - 1 ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i === pts.length - 1 ? '#4E9136' : 'rgba(78, 145, 54, 0.45)';
    ctx.fill();
    if (i === pts.length - 1) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(78, 145, 54, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  // Month labels
  ctx.fillStyle = 'rgba(74, 82, 64, 0.55)';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  months.forEach((m, i) => {
    if (i % 2 === 0 || i === months.length - 1) {
      ctx.fillText(m, pts[i].x, H - 8);
    }
  });

  // Y labels
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = ((maxVal - minVal) * i) / 4;
    const y = padT + chartH - (i / 4) * chartH;
    ctx.fillText(val.toFixed(1), padL - 4, y + 4);
  }
}

function drawRadarChart(fp) {
  const canvas = document.getElementById('radar-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2 + 10;
  const r = Math.min(W, H) * 0.35;
  const labels = ['Transport', 'Home', 'Diet', 'Shopping', 'Lifestyle'];
  const maxVals = [8, 4, 3, 2, 2];
  const values = [fp.transport, fp.home, fp.diet, fp.shopping, 1.0];
  const n = labels.length;

  // Rings
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
      const rr = (r * ring) / 4;
      const x = cx + rr * Math.cos(angle);
      const y = cy + rr * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(212, 133, 74, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Spokes
  for (let i = 0; i < n; i++) {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    ctx.strokeStyle = 'rgba(212, 133, 74, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Data polygon
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    const pct = Math.min(1, values[i] / maxVals[i]);
    const pr = r * pct;
    const x = cx + pr * Math.cos(angle);
    const y = cy + pr * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(78, 145, 54, 0.30)');
  grad.addColorStop(0.5, 'rgba(120, 180, 90, 0.12)');
  grad.addColorStop(1, 'rgba(78, 145, 54, 0.05)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#4E9136';
  ctx.lineWidth = 2;
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    const pct = Math.min(1, values[i] / maxVals[i]);
    const pr = r * pct;
    const x = cx + pr * Math.cos(angle);
    const y = cy + pr * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4E9136';
    ctx.fill();
  }

  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = 'rgba(74, 82, 64, 0.45)';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    const lx = cx + (r + 24) * Math.cos(angle);
    const ly = cy + (r + 24) * Math.sin(angle);
    ctx.fillText(labels[i], lx, ly + 4);
  }
}

// ═══════════════ GLOBE CANVAS ═══════════════
function drawGlobe() {
  const canvas = document.getElementById('globe-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let frame = 0;

  const hexSize = 14;
  const hexes = [];
  for (let q = -10; q <= 10; q++) {
    for (let r = -10; r <= 10; r++) {
      const x = W / 2 + hexSize * 1.732 * (q + r * 0.5);
      const y = H / 2 + hexSize * 1.5 * r;
      const dist = Math.sqrt((x - W / 2) ** 2 + (y - H / 2) ** 2);
      if (dist < 130) {
        hexes.push({ x, y, q, r, phase: Math.random() * Math.PI * 2 });
      }
    }
  }

  function drawHex(ctx, x, y, size, fill, stroke) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const hx = x + size * Math.cos(angle);
      const hy = y + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.5; ctx.stroke(); }
  }

  function animate() {
    frame++;
    ctx.clearRect(0, 0, W, H);

    const radGrad = ctx.createRadialGradient(W * 0.38, H * 0.35, 5, W / 2, H / 2, 135);
    radGrad.addColorStop(0, 'rgba(200, 230, 190, 0.6)');
    radGrad.addColorStop(0.5, 'rgba(240, 246, 235, 0.35)');
    radGrad.addColorStop(1, 'rgba(250, 250, 247, 0.15)');

    hexes.forEach(h => {
      const t = frame * 0.02 + h.phase;
      const glow = 0.3 + 0.25 * Math.sin(t);
      const isLand = (h.q + h.r * 2) % 7 < 3;
      const base = isLand
        ? `rgba(78, 145, 54, ${0.18 + glow * 0.22})`
        : `rgba(180, 215, 165, ${0.08 + glow * 0.1})`;
      const stroke = `rgba(46, 90, 30, ${0.08 + glow * 0.18})`;
      drawHex(ctx, h.x, h.y, hexSize - 1, base, stroke);
    });

    const shimGrad = ctx.createRadialGradient(W * 0.32, H * 0.28, 0, W / 2, H / 2, 140);
    shimGrad.addColorStop(0, `rgba(78, 145, 54, ${0.06 + 0.03 * Math.sin(frame * 0.03)})`);
    shimGrad.addColorStop(0.5, 'rgba(120, 180, 90, 0.03)');
    shimGrad.addColorStop(1, 'rgba(78, 145, 54, 0)');
    ctx.fillStyle = shimGrad;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(animate);
  }

  animate();
}

// ═══════════════ PARTICLE BACKGROUND ═══════════════
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = canvas.width = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  const particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -Math.random() * 0.4 - 0.1,
    life: Math.random(),
    maxLife: 0.6 + Math.random() * 0.4,
  }));

  window.addEventListener('resize', () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });

  function animate() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life += 0.003;
      if (p.life > p.maxLife || p.y < 0 || p.x < 0 || p.x > W) {
        p.x = Math.random() * W;
        p.y = H + 10;
        p.life = 0;
      }
      const fade = Math.sin((p.life / p.maxLife) * Math.PI);
      // Alternate between ember and violet particles
      const isEmber = Math.floor(p.life * 10 + p.r * 3) % 3 !== 2;
      const col = isEmber ? `rgba(78, 145, 54, ${fade * 0.25})` : `rgba(120, 180, 90, ${fade * 0.18})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }
  animate();
}

// ═══════════════ CALCULATOR CONTROLS ═══════════════
function switchTab(tab) {
  document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`panel-${tab}`).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
}

function setToggle(groupId, val) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === val);
  });

  // Update state
  if (groupId === 'owns-car-toggle') {
    state.transport.ownsCar = val === 'yes';
    const carDetails = document.getElementById('car-details');
    const carKmGroup = document.getElementById('car-km-group');
    if (carDetails) carDetails.style.display = val === 'yes' ? '' : 'none';
    if (carKmGroup) carKmGroup.style.display = val === 'yes' ? '' : 'none';
  } else if (groupId === 'renewable-toggle') {
    state.home.renewable = val === 'yes';
  } else if (groupId === 'secondhand-toggle') {
    state.shopping.secondhand = val === 'yes';
  }
  updateResultPanel();
}

function setCardOpt(groupId, val) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.card-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === val);
  });

  const map = {
    'car-type-select': () => { state.transport.carType = val; },
    'transit-select': () => { state.transport.transit = val; },
    'home-type-select': () => { state.home.type = val; },
    'heating-select': () => { state.home.heating = val; },
    'diet-select': () => { state.diet.type = val; },
    'local-food-select': () => { state.diet.localFood = val; },
  };

  if (map[groupId]) map[groupId]();
  updateResultPanel();
}

function updateSlider(sliderId, valId, suffix, prefix = '') {
  const slider = document.getElementById(sliderId);
  const valEl = document.getElementById(valId);
  if (!slider || !valEl) return;
  const val = parseFloat(slider.value);
  valEl.textContent = `${prefix}${val}${suffix}`;

  // Update fill
  const pct = ((val - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.background = `linear-gradient(90deg, #D4854A ${pct}%, rgba(212,133,74,0.12) ${pct}%)`;

  if (sliderId === 'car-km') state.transport.carKm = val;
  else if (sliderId === 'household') state.home.household = val;
  else if (sliderId === 'elec-bill') state.home.elecBill = val;
  else if (sliderId === 'fashion-spend') state.shopping.fashion = val;
  else if (sliderId === 'electronics') state.shopping.electronics = val;
  else if (sliderId === 'packages') state.shopping.packages = val;

  updateResultPanel();
}

function updateFoodWaste(val) {
  const labels = ['None', 'Low', 'Medium', 'High'];
  const valEl = document.getElementById('food-waste-val');
  if (valEl) valEl.textContent = labels[val];
  const slider = document.getElementById('food-waste');
  if (slider) {
    const pct = (val / 3) * 100;
    slider.style.background = `linear-gradient(90deg, #D4854A ${pct}%, rgba(212,133,74,0.12) ${pct}%)`;
  }
  state.diet.waste = parseInt(val);
  updateResultPanel();
}

function adjustCounter(id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = Math.max(0, parseInt(el.textContent) + delta);
  el.textContent = val;
  if (id === 'short-flights') state.transport.shortFlights = val;
  else if (id === 'long-flights') state.transport.longFlights = val;
  updateResultPanel();
}

// ═══════════════ ACTIONS DATA & RENDERING ═══════════════
const actionsData = [
  {
    id: 'a1', icon: '🚲', title: 'Switch to cycling or walking',
    desc: 'Replace short car trips (under 5km) with cycling or walking. Eliminates emissions for those journeys entirely.',
    savings: 0.8, category: 'transport', impact: 'high',
  },
  {
    id: 'a2', icon: '🚌', title: 'Use public transport weekly',
    desc: 'Taking the bus or train for commuting instead of your car dramatically cuts per-person emissions.',
    savings: 0.6, category: 'transport', impact: 'high',
  },
  {
    id: 'a3', icon: '✈️', title: 'Reduce one long-haul flight',
    desc: 'A single long-haul return flight can generate over 1.5T CO₂. Consider train alternatives or video calls.',
    savings: 1.2, category: 'transport', impact: 'high',
  },
  {
    id: 'a4', icon: '🔌', title: 'Switch to a green energy tariff',
    desc: 'Many energy providers offer 100% renewable plans. This can cut your home electricity emissions by up to 90%.',
    savings: 0.9, category: 'home', impact: 'high',
  },
  {
    id: 'a5', icon: '🌡️', title: 'Turn down heating by 1°C',
    desc: 'Each degree you reduce your thermostat saves approximately 10% of your heating energy bill.',
    savings: 0.3, category: 'home', impact: 'medium',
  },
  {
    id: 'a6', icon: '💡', title: 'Switch to LED bulbs everywhere',
    desc: 'LED bulbs use 75% less energy than traditional incandescent bulbs and last 25x longer.',
    savings: 0.15, category: 'home', impact: 'low',
  },
  {
    id: 'a7', icon: '🌱', title: 'Adopt a plant-based diet 3x/week',
    desc: 'Meat production is emissions-intensive. Going plant-based 3 days per week can cut food emissions by 30%.',
    savings: 0.4, category: 'diet', impact: 'high',
  },
  {
    id: 'a8', icon: '🛒', title: 'Buy seasonal, local produce',
    desc: 'Locally-sourced seasonal food avoids long transport chains and refrigeration, reducing food-mile emissions.',
    savings: 0.18, category: 'diet', impact: 'medium',
  },
  {
    id: 'a9', icon: '♻️', title: 'Halve your food waste',
    desc: 'Around 8% of global emissions come from wasted food. Plan meals, compost scraps, and use leftovers.',
    savings: 0.22, category: 'diet', impact: 'medium',
  },
  {
    id: 'a10', icon: '👕', title: 'Buy second-hand clothing',
    desc: 'Fashion accounts for ~10% of global CO₂. Second-hand shopping cuts textile waste and production emissions.',
    savings: 0.35, category: 'shopping', impact: 'medium',
  },
  {
    id: 'a11', icon: '📦', title: 'Consolidate online deliveries',
    desc: 'Group your online orders to reduce delivery trips. Select slower shipping options which are often lower carbon.',
    savings: 0.12, category: 'shopping', impact: 'low',
  },
  {
    id: 'a12', icon: '📱', title: 'Keep electronics 1 year longer',
    desc: 'Manufacturing a new smartphone generates 80kg CO₂. Extending device life by just one year makes a huge difference.',
    savings: 0.3, category: 'shopping', impact: 'medium',
  },
];

function renderActions(filter = 'all') {
  const grid = document.getElementById('actions-grid');
  if (!grid) return;
  grid.innerHTML = '';

  actionsData.forEach(action => {
    const isHidden = filter !== 'all' && filter !== action.category && !(filter === 'high' && action.impact === 'high');
    const isSelected = state.selectedActions.has(action.id);

    const card = document.createElement('div');
    card.className = `action-card fade-in${isSelected ? ' selected' : ''}${isHidden ? ' hidden' : ''}`;
    card.id = `action-${action.id}`;
    card.innerHTML = `
      <div class="ac-top">
        <div class="ac-icon-wrap">${action.icon}</div>
        <div class="ac-impact-badge impact-${action.impact}">
          ${action.impact === 'high' ? '⚡' : action.impact === 'medium' ? '●' : '·'} 
          ${action.impact.charAt(0).toUpperCase() + action.impact.slice(1)} Impact
        </div>
      </div>
      <div class="ac-title">${action.title}</div>
      <div class="ac-desc">${action.desc}</div>
      <div class="ac-bottom">
        <div class="ac-savings">−${action.savings.toFixed(2)}T CO₂/yr</div>
        <div class="ac-check">${isSelected ? '✓' : ''}</div>
      </div>
    `;
    card.addEventListener('click', () => toggleAction(action.id));
    grid.appendChild(card);

    // Animate in
    setTimeout(() => card.classList.add('visible'), 50);
  });
}

function toggleAction(id) {
  if (state.selectedActions.has(id)) {
    state.selectedActions.delete(id);
  } else {
    state.selectedActions.add(id);
  }

  const card = document.getElementById(`action-${id}`);
  if (card) {
    card.classList.toggle('selected', state.selectedActions.has(id));
    const check = card.querySelector('.ac-check');
    if (check) check.textContent = state.selectedActions.has(id) ? '✓' : '';
  }

  updateSavingsBanner(getTotalFootprint().total);
  showToast(state.selectedActions.has(id) ? '✅ Action added to your plan!' : '❌ Action removed');
}

function filterActions(filter) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderActions(filter);
}

function updateSavingsBanner(total) {
  let saved = 0;
  state.selectedActions.forEach(id => {
    const a = actionsData.find(x => x.id === id);
    if (a) saved += a.savings;
  });
  const newTotal = Math.max(0, total - saved);
  const sbSaved = document.getElementById('sb-saved');
  const sbNew = document.getElementById('sb-new');
  if (sbSaved) sbSaved.textContent = saved.toFixed(1);
  if (sbNew) sbNew.textContent = newTotal.toFixed(1);
  updateOffsetTonnes(newTotal);
}

function updateOffsetTonnes(total) {
  setEl('offset-tonnes', total.toFixed(1));
}

// ═══════════════ STREAK CALENDAR ═══════════════
function renderStreak() {
  const cal = document.getElementById('streak-calendar');
  if (!cal) return;
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  cal.innerHTML = '';

  for (let i = 0; i < 28; i++) {
    const day = document.createElement('div');
    day.className = 'streak-day';
    const weekday = days[i % 7];
    day.textContent = weekday;
    if (i < state.streakDays) day.classList.add('done');
    if (i === state.streakDays - 1) day.classList.add('today');
    cal.appendChild(day);
  }

  setEl('streak-num', state.streakDays);
  const motivations = [
    `Keep it up! ${16 - state.streakDays} more days to beat your record.`,
    `Amazing! You've been consistent for ${state.streakDays} days!`,
    `Don't break the chain! Log today's actions.`,
    `You're in the top 15% of consistent users! 🌟`,
  ];
  const motEl = document.getElementById('streak-motivate');
  if (motEl) motEl.textContent = motivations[Math.floor(state.streakDays / 7) % motivations.length];
}

// ═══════════════ LEADERBOARD ═══════════════
const leaderboardData = [
  { name: 'Aiko M.', avatar: '🌿', score: '1.2T', rank: 1 },
  { name: 'Luca P.', avatar: '🌍', score: '1.8T', rank: 2 },
  { name: 'Sofia K.', avatar: '🌱', score: '2.1T', rank: 3 },
  { name: 'James W.', avatar: '♻️', score: '2.4T', rank: 4 },
  { name: 'Priya N.', avatar: '⚡', score: '2.7T', rank: 5 },
];

function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  const youEl = document.getElementById('leaderboard-you');
  if (!list) return;

  const rankColors = ['gold', 'silver', 'bronze', '', ''];
  const medals = ['🥇', '🥈', '🥉', '4.', '5.'];

  list.innerHTML = leaderboardData.map((p, i) => `
    <div class="lb-row">
      <div class="lb-rank ${rankColors[i]}">${medals[i]}</div>
      <div class="lb-avatar">${p.avatar}</div>
      <div class="lb-name">${p.name}</div>
      <div class="lb-score">${p.score}</div>
    </div>
  `).join('');

  const fp = getTotalFootprint();
  if (youEl) {
    youEl.innerHTML = `<div class="lb-rank">⭐</div><div class="lb-avatar">👤</div><div class="lb-name" style="flex:1">You (this month)</div><div class="lb-score">${fp.total.toFixed(1)}T</div>`;
  }
}

// ═══════════════ CHALLENGE ═══════════════
function markChallengeDay() {
  if (state.challengeDays < 7) {
    state.challengeDays++;
    const fill = document.getElementById('challenge-fill');
    const pct = (state.challengeDays / 7) * 100;
    if (fill) fill.style.width = `${pct}%`;
    const label = fill?.parentElement?.nextElementSibling;
    if (label && label.className === 'challenge-progress-label') {
      label.textContent = `${state.challengeDays} of 7 days complete`;
    }
    if (state.challengeDays === 7) {
      showToast('🎖️ Challenge complete! You earned the Urban Rider badge!');
    } else {
      showToast(`✅ Day ${state.challengeDays} logged! ${7 - state.challengeDays} days left.`);
    }
    state.streakDays++;
    renderStreak();
  } else {
    showToast('🏆 Challenge already complete! Great work!');
  }
}

// ═══════════════ OFFSET ═══════════════
function selectOffset(type) {
  document.querySelectorAll('.offset-opt').forEach(o => o.classList.remove('selected'));
  event.target.closest('.offset-opt').classList.add('selected');
  const costs = { trees: 2.5, solar: 5.0, kelp: 8.0 };
  const cost = costs[type] || 2.5;
  const tonnes = parseFloat(document.getElementById('offset-tonnes')?.textContent || '4.8');
  const total = (cost * tonnes).toFixed(2);
  const names = { trees: 'Plant Trees', solar: 'Solar Projects', kelp: 'Ocean Kelp' };
  const el = document.getElementById('offset-total');
  if (el) el.innerHTML = `${names[type]}: <strong style="color:var(--lime-bright)">$${total}</strong> to offset <strong>${tonnes}T</strong> CO₂`;
  showToast(`🌿 ${names[type]} selected — $${total} total`);
}

// ═══════════════ SCROLL ANIMATIONS ═══════════════
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  document.querySelectorAll('.dash-card, .challenge-card, .action-card').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
  });
}

// ═══════════════ COUNTER ANIMATION ═══════════════
function animateHeroCounters() {
  document.querySelectorAll('.hero-stat-num').forEach(el => {
    const target = parseFloat(el.dataset.count);
    const duration = 2000;
    const start = performance.now();
    const isLarge = target > 10;

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      const val = target * ease;
      el.textContent = isLarge ? Math.round(val) : val.toFixed(1);
      if (progress < 1) requestAnimationFrame(step);
    }
    setTimeout(() => requestAnimationFrame(step), 500);
  });
}

// ═══════════════ NAVBAR SCROLL ═══════════════
function initNavbar() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// ═══════════════ MOBILE MENU ═══════════════
function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.classList.remove('open');
}

document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.classList.toggle('open');
});

// ═══════════════ TOAST ═══════════════
let toastTimeout;
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ═══════════════ SCROLL HELPER ═══════════════
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═══════════════ LIVE CO2 COUNTER ═══════════════
function initLiveCO2() {
  const el = document.getElementById('live-co2');
  if (!el) return;
  let base = 423.4;
  setInterval(() => {
    base += (Math.random() - 0.3) * 0.1;
    el.textContent = base.toFixed(1) + ' ppm';
  }, 3000);
}

// ═══════════════ INIT ALL SLIDERS ═══════════════
function initSliders() {
  [
    { id: 'car-km', min: 0, max: 1000, val: 200 },
    { id: 'household', min: 1, max: 8, val: 3 },
    { id: 'elec-bill', min: 20, max: 500, val: 120 },
    { id: 'fashion-spend', min: 0, max: 500, val: 80 },
    { id: 'electronics', min: 0, max: 10, val: 2 },
    { id: 'packages', min: 0, max: 30, val: 5 },
    { id: 'food-waste', min: 0, max: 3, val: 1 },
  ].forEach(({ id, min, max, val }) => {
    const slider = document.getElementById(id);
    if (!slider) return;
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(90deg, #D4854A ${pct}%, rgba(212,133,74,0.12) ${pct}%)`;
  });
}

// ═══════════════ WINDOW RESIZE ═══════════════
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const fp = getTotalFootprint();
    drawTrendChart(fp.total);
    drawRadarChart(fp);
  }, 300);
});

// ═══════════════ BOOT ═══════════════
document.addEventListener('DOMContentLoaded', () => {
  // Core init
  initHeroVideo();
  initNavbar();
  initParticles();
  animateHeroCounters();
  initLiveCO2();
  initSliders();

  // Calculator
  updateResultPanel();

  // Actions
  renderActions();

  // Leaderboard & streak
  renderLeaderboard();
  renderStreak();

  // Scroll animations
  setTimeout(initScrollAnimations, 300);

  // Redraw charts on dashboard visibility
  const dashObs = new IntersectionObserver(
    entries => {
      if (entries[0].isIntersecting) {
        const fp = getTotalFootprint();
        drawTrendChart(fp.total);
        drawRadarChart(fp);
        dashObs.disconnect();
      }
    },
    { threshold: 0.2 }
  );
  const dashEl = document.getElementById('dashboard');
  if (dashEl) dashObs.observe(dashEl);

  // Initial challenge fill animation
  setTimeout(() => {
    const fill = document.getElementById('challenge-fill');
    if (fill) fill.style.width = '43%';
  }, 500);
});
