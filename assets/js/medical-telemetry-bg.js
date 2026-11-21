/**
 * DiaMon — Fondo de Telemetría Biomédica & Radar GPS de Cartagena
 * Combina:
 * 1. Radar de telemetría GPS con barrido angular 360° y ondas concéntricas de geocerca
 * 2. Células biomoleculares flotantes con profundidad 3D y respuesta al cursor
 * 3. Nodos satelitales con coordenadas reales de Cartagena de Indias
 * 4. Micro-vectores de enlace que se iluminan al ser detectados por el radar
 */

(function () {
  'use strict';

  const canvas = document.getElementById('medicalCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const mouse = { x: width / 2, y: height / 2, active: false };

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initNodes();
    initCells();
  });

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });

  window.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

  // 1. Radar Biomédico (Ubicado dinámicamente)
  const radar = {
    x: width * 0.78,
    y: height * 0.38,
    radius: Math.min(width, height) * 0.38,
    angle: 0,
    speed: 0.012,
    waves: [0, 0.33, 0.66]
  };

  // 2. Nodos GPS de Cartagena
  let nodes = [];
  function initNodes() {
    radar.x = width * 0.78;
    radar.y = height * 0.38;
    radar.radius = Math.min(width, height) * 0.38;

    nodes = [
      { label: 'Hospital Naval · 10.4052°N', x: radar.x - 90, y: radar.y - 120, detected: false },
      { label: 'San Fernando (Casa) · 10.3887°N', x: radar.x + 80, y: radar.y + 70, detected: false },
      { label: 'UDC Zarzagocilla · 10.3951°N', x: radar.x - 140, y: radar.y + 40, detected: false },
      { label: 'Clínica Blas de Lezo · 10.3920°N', x: radar.x + 50, y: radar.y - 100, detected: false },
      { label: 'Bocagrande · 10.4011°N', x: radar.x - 170, y: radar.y - 40, detected: false },
      { label: 'Centro Histórico · 10.4235°N', x: radar.x - 40, y: radar.y - 170, detected: false },
      { label: 'Satélite GPS Geo-01', x: width * 0.18, y: height * 0.22, detected: true },
      { label: 'Satélite GPS Geo-02', x: width * 0.22, y: height * 0.78, detected: true }
    ];
  }

  // 3. Células Biomédicas en Suspensión (Glucosa / Bio-moléculas)
  let cells = [];
  function initCells() {
    cells = [];
    const count = Math.floor((width * height) / 22000) + 25;
    for (let i = 0; i < count; i++) {
      cells.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 4.5 + 1.5,
        depth: Math.random() * 0.8 + 0.2, // Profundidad (0.2 lejana, 1.0 cercana)
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }
  }

  initNodes();
  initCells();

  let tick = 0;

  function render() {
    tick += 0.02;

    // Fondo clínico nocturno profundo con ligero gradiente
    const bgGrad = ctx.createRadialGradient(width * 0.75, height * 0.4, 50, width * 0.5, height * 0.5, Math.max(width, height));
    bgGrad.addColorStop(0, '#0a1a32');
    bgGrad.addColorStop(0.5, '#061020');
    bgGrad.addColorStop(1, '#030812');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Grid hexagonal / métrico sutil
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.035)';
    ctx.lineWidth = 1;
    const step = 45;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // ==========================================
    // A. RADAR DE TELEMETRÍA GPS & GEOCERCAS
    // ==========================================
    radar.angle = (radar.angle + radar.speed) % (Math.PI * 2);

    // Anillos concéntricos del radar
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const ringRadius = (radar.radius / 4) * i;
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.12)';
      ctx.beginPath();
      ctx.arc(radar.x, radar.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ejes ortogonales del radar
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.08)';
    ctx.beginPath();
    ctx.moveTo(radar.x - radar.radius, radar.y);
    ctx.lineTo(radar.x + radar.radius, radar.y);
    ctx.moveTo(radar.x, radar.y - radar.radius);
    ctx.lineTo(radar.x, radar.y + radar.radius);
    ctx.stroke();

    // Ondas expansivas de geocerca (pulso de sonar)
    for (let i = 0; i < radar.waves.length; i++) {
      radar.waves[i] += 0.0035;
      if (radar.waves[i] > 1) radar.waves[i] = 0;

      const waveRadius = radar.radius * radar.waves[i];
      const waveAlpha = (1 - radar.waves[i]) * 0.25;

      ctx.strokeStyle = `rgba(56, 189, 248, ${waveAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(radar.x, radar.y, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Barrido cónico del radar (Sweep beam)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(radar.x, radar.y);
    ctx.arc(radar.x, radar.y, radar.radius, radar.angle - 0.45, radar.angle);
    ctx.closePath();

    const beamGrad = ctx.createRadialGradient(radar.x, radar.y, 10, radar.x, radar.y, radar.radius);
    beamGrad.addColorStop(0, 'rgba(37, 99, 235, 0.28)');
    beamGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.15)');
    beamGrad.addColorStop(1, 'rgba(37, 99, 235, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fill();
    ctx.restore();

    // Línea principal de barrido
    ctx.beginPath();
    ctx.moveTo(radar.x, radar.y);
    ctx.lineTo(
      radar.x + Math.cos(radar.angle) * radar.radius,
      radar.y + Math.sin(radar.angle) * radar.radius
    );
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ==========================================
    // B. NODOS GPS DE CARTAGENA
    // ==========================================
    nodes.forEach(node => {
      // Calcular si el haz del radar está barriendo este nodo
      const dx = node.x - radar.x;
      const dy = node.y - radar.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let angleToNode = Math.atan2(dy, dx);
      if (angleToNode < 0) angleToNode += Math.PI * 2;

      const angleDiff = Math.abs(radar.angle - angleToNode);
      if (angleDiff < 0.25 && dist <= radar.radius) {
        node.detected = true;
      }

      // Dibujar nodo
      const pulseSize = Math.sin(tick * 3 + dist) * 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 3.5 + pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = node.detected ? '#38bdf8' : 'rgba(96, 165, 250, 0.4)';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = node.detected ? 12 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Anillo de satélite
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = node.detected ? 'rgba(56, 189, 248, 0.5)' : 'rgba(37, 99, 235, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Etiqueta de telemetría
      ctx.font = '10px monospace';
      ctx.fillStyle = node.detected ? 'rgba(241, 245, 249, 0.85)' : 'rgba(148, 163, 184, 0.4)';
      ctx.fillText(node.label, node.x + 12, node.y + 4);

      // Línea de enlace hacia el centro del radar
      if (node.detected && dist <= radar.radius) {
        ctx.beginPath();
        ctx.moveTo(radar.x, radar.y);
        ctx.lineTo(node.x, node.y);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.stroke();
      }
    });

    // ==========================================
    // C. CÉLULAS BIOMÉDICAS FLOTANTES (GLUCOSA)
    // ==========================================
    cells.forEach(c => {
      c.x += c.vx * c.depth;
      c.y += c.vy * c.depth;

      // Rebote suave en bordes
      if (c.x < 0) c.x = width;
      if (c.x > width) c.x = 0;
      if (c.y < 0) c.y = height;
      if (c.y > height) c.y = 0;

      // Interacción con mouse
      if (mouse.active) {
        const mdx = c.x - mouse.x;
        const mdy = c.y - mouse.y;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mDist < 120) {
          c.x += (mdx / mDist) * 1.5;
          c.y += (mdy / mDist) * 1.5;
        }
      }

      // Respiración biológica
      const pulse = Math.sin(tick * 2 + c.pulseOffset) * 0.6;
      const curRadius = Math.max(1, c.r * c.depth + pulse);

      const cellGrad = ctx.createRadialGradient(
        c.x - curRadius * 0.3,
        c.y - curRadius * 0.3,
        curRadius * 0.1,
        c.x,
        c.y,
        curRadius
      );
      cellGrad.addColorStop(0, `rgba(96, 165, 250, ${0.45 * c.depth})`);
      cellGrad.addColorStop(0.7, `rgba(37, 99, 235, ${0.25 * c.depth})`);
      cellGrad.addColorStop(1, 'rgba(37, 99, 235, 0)');

      ctx.fillStyle = cellGrad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, curRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(render);
  }

  render();
})();
