(() => {
  const canvas = document.getElementById("rainCanvas");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  let width = 0;
  let height = 0;
  let dpr = 1;
  let lastTs = performance.now();

  const pointer = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    vx: 0,
    vy: 0,
    lastX: 0,
    lastY: 0,
    lastMoveTs: performance.now(),
    lastSplashTs: 0,
    active: false,
  };

  let wind = 0;
  let windTarget = 0;
  let flash = 0;
  let flashTimer = 0;

  const layers = [];
  const beads = [];
  const splashes = [];
  const ripples = [];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function resetLayerDrop(drop, layer, toTop = false) {
    drop.x = rand(-20, width + 20);
    drop.y = toTop ? rand(-height * 0.4, 0) : rand(-height, height);
    drop.len = rand(layer.lenMin, layer.lenMax);
    drop.speed = rand(layer.speedMin, layer.speedMax);
    drop.alpha = rand(layer.alphaMin, layer.alphaMax);
    drop.windFactor = rand(layer.windMin, layer.windMax);
  }

  function resetBead(bead, toTop = false) {
    bead.x = rand(-20, width + 20);
    bead.y = toTop ? rand(-150, -8) : rand(-20, height + 30);
    bead.r = rand(0.9, 2.8);
    bead.vx = rand(-0.16, 0.16);
    bead.vy = rand(0.12, 0.6);
    bead.gravity = rand(0.02, 0.07);
    bead.phase = rand(0, Math.PI * 2);
    bead.wobble = rand(0.7, 2.1);
    bead.alpha = rand(0.1, 0.3);
  }

  function resetForegroundBead(bead, toTop = false) {
    bead.x = rand(-20, width + 20);
    bead.y = toTop ? rand(-220, -12) : rand(-20, height + 40);
    bead.r = rand(2.2, 6.2);
    bead.vx = rand(-0.22, 0.22);
    bead.vy = rand(0.2, 0.95);
    bead.gravity = rand(0.03, 0.085);
    bead.phase = rand(0, Math.PI * 2);
    bead.wobble = rand(0.7, 1.6);
    bead.alpha = rand(0.17, 0.36);
    bead.foreground = true;
  }

  function buildLayer(config) {
    const drops = [];
    for (let i = 0; i < config.count; i += 1) {
      const d = {};
      resetLayerDrop(d, config, false);
      drops.push(d);
    }
    layers.push({ ...config, drops });
  }

  function setSize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const mobile = width < 760;
    const density = clamp((width * height) / (1920 * 1080), 0.55, 1.65);

    layers.length = 0;
    beads.length = 0;

    buildLayer({
      count: Math.floor((mobile ? 95 : 130) * density),
      speedMin: 4,
      speedMax: 7,
      lenMin: 10,
      lenMax: 20,
      alphaMin: 0.06,
      alphaMax: 0.13,
      windMin: 0.24,
      windMax: 0.46,
      lineWidth: 0.8,
      parallax: 0.32,
      color: [184, 224, 240],
    });

    buildLayer({
      count: Math.floor((mobile ? 125 : 190) * density),
      speedMin: 7,
      speedMax: 11,
      lenMin: 14,
      lenMax: 28,
      alphaMin: 0.08,
      alphaMax: 0.2,
      windMin: 0.38,
      windMax: 0.7,
      lineWidth: 1,
      parallax: 0.55,
      color: [194, 235, 248],
    });

    buildLayer({
      count: Math.floor((mobile ? 150 : 250) * density),
      speedMin: 11,
      speedMax: 16,
      lenMin: 18,
      lenMax: 34,
      alphaMin: 0.11,
      alphaMax: 0.28,
      windMin: 0.52,
      windMax: 0.95,
      lineWidth: 1.2,
      parallax: 0.75,
      color: [212, 243, 255],
    });

    const beadCount = Math.floor((mobile ? 100 : 160) * density);
    const fgBeadCount = Math.floor((mobile ? 28 : 46) * density);

    for (let i = 0; i < beadCount; i += 1) {
      const bead = {};
      resetBead(bead, false);
      beads.push(bead);
    }

    for (let i = 0; i < fgBeadCount; i += 1) {
      const bead = {};
      resetForegroundBead(bead, false);
      beads.push(bead);
    }

    pointer.x = width * 0.5;
    pointer.y = height * 0.5;
    pointer.targetX = pointer.x;
    pointer.targetY = pointer.y;
    pointer.lastX = pointer.x;
    pointer.lastY = pointer.y;
  }

  function spawnSplash(x, y, power = 1) {
    const count = Math.floor(14 + power * 10);
    for (let i = 0; i < count; i += 1) {
      const a = rand(0, Math.PI * 2);
      const v = rand(0.8, 3.2) * power;
      splashes.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - rand(0.8, 1.7),
        life: 0,
        maxLife: rand(0.25, 0.7),
        size: rand(0.8, 2.2),
        alpha: rand(0.18, 0.46),
      });
    }

    ripples.push({
      x,
      y,
      radius: 6,
      speed: 120 + power * 90,
      alpha: 0.32,
      width: 1 + power * 0.35,
    });
  }

  function drawBead(x, y, radius, alpha, large = false) {
    const spread = large ? 3.1 : 2.35;
    const grad = ctx.createRadialGradient(
      x - radius * 0.45,
      y - radius * 0.48,
      0,
      x,
      y,
      radius * spread
    );

    grad.addColorStop(0, `rgba(228, 248, 255, ${alpha})`);
    grad.addColorStop(0.38, `rgba(190, 230, 244, ${alpha * 0.62})`);
    grad.addColorStop(1, "rgba(125, 185, 210, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius * (large ? 2.4 : 2.05), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * (large ? 0.34 : 0.24)})`;
    ctx.beginPath();
    ctx.arc(x - radius * 0.42, y - radius * 0.35, radius * (large ? 0.55 : 0.43), 0, Math.PI * 2);
    ctx.fill();
  }

  function animate(ts) {
    requestAnimationFrame(animate);

    const dt = Math.min(0.034, (ts - lastTs) / 1000);
    lastTs = ts;

    pointer.x += (pointer.targetX - pointer.x) * 0.13;
    pointer.y += (pointer.targetY - pointer.y) * 0.13;

    const speed = Math.hypot(pointer.vx, pointer.vy);
    const parallaxX = (pointer.x - width * 0.5) * 0.03;
    const parallaxY = (pointer.y - height * 0.5) * 0.022;

    windTarget = ((pointer.x / width) - 0.5) * 150 + pointer.vx * 0.07;
    wind += (windTarget - wind) * 0.045;

    const gust = Math.sin(ts * 0.00028) * 14;
    const currentWind = wind + gust;

    flashTimer -= dt;
    if (flashTimer <= 0 && Math.random() < 0.00085) {
      flash = rand(0.08, 0.19);
      flashTimer = rand(4.8, 10.5);
    }
    flash *= 0.92;

    ctx.clearRect(0, 0, width, height);

    ctx.lineCap = "round";

    for (const layer of layers) {
      const [cr, cg, cb] = layer.color;
      ctx.lineWidth = layer.lineWidth;

      for (const drop of layer.drops) {
        drop.y += drop.speed * dt * 60;
        drop.x += (currentWind * drop.windFactor) * dt;

        if (drop.y > height + drop.len + 20) {
          resetLayerDrop(drop, layer, true);
          continue;
        }
        if (drop.x < -40) drop.x = width + 20;
        if (drop.x > width + 40) drop.x = -20;

        const x = drop.x + parallaxX * layer.parallax;
        const y = drop.y + parallaxY * layer.parallax;
        const tilt = currentWind * 0.028 * layer.windFactor;

        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${drop.alpha})`;
        ctx.beginPath();
        ctx.moveTo(x - tilt * 0.8, y - drop.len);
        ctx.lineTo(x + tilt, y);
        ctx.stroke();
      }
    }

    for (const bead of beads) {
      bead.phase += bead.wobble * dt;
      bead.vy += bead.gravity * dt * 60;
      bead.vx += currentWind * 0.001 * dt * 60;

      if (pointer.active) {
        const dx = bead.x - pointer.x;
        const dy = bead.y - pointer.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 150) {
          const force = (150 - dist) / 150;
          bead.vx += (dx / dist) * force * 0.08 * (1 + speed * 0.02);
          bead.vy += (dy / dist) * force * 0.05;
        }
      }

      bead.x += bead.vx * dt * 60 + Math.sin(bead.phase) * 0.03;
      bead.y += bead.vy * dt * 60;

      bead.vx *= 0.987;
      bead.vy *= 0.993;

      if (bead.y > height + 42 || bead.x < -42 || bead.x > width + 42) {
        if (bead.foreground) {
          resetForegroundBead(bead, true);
        } else {
          resetBead(bead, true);
        }
      }

      const bx = bead.x + parallaxX * (bead.foreground ? 0.88 : 0.5);
      const by = bead.y + parallaxY * (bead.foreground ? 0.82 : 0.46);
      const trailLen = bead.r * (bead.foreground ? 6.2 : 4.2);
      const trailAlpha = bead.alpha * (bead.foreground ? 0.38 : 0.22);

      ctx.strokeStyle = `rgba(190, 232, 248, ${trailAlpha})`;
      ctx.lineWidth = bead.r * (bead.foreground ? 0.35 : 0.23);
      ctx.beginPath();
      ctx.moveTo(bx - currentWind * 0.015, by - trailLen);
      ctx.lineTo(bx, by);
      ctx.stroke();

      drawBead(bx, by, bead.r, bead.alpha, Boolean(bead.foreground));
    }

    for (let i = splashes.length - 1; i >= 0; i -= 1) {
      const p = splashes[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        splashes.splice(i, 1);
        continue;
      }

      p.vy += 0.06 * dt * 60;
      p.vx += currentWind * 0.0009 * dt * 60;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;

      const fade = 1 - p.life / p.maxLife;
      ctx.fillStyle = `rgba(220, 246, 255, ${p.alpha * fade})`;
      ctx.beginPath();
      ctx.arc(p.x + parallaxX * 0.35, p.y + parallaxY * 0.3, p.size * fade, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const r = ripples[i];
      r.radius += r.speed * dt;
      r.alpha -= dt * 0.45;
      if (r.alpha <= 0) {
        ripples.splice(i, 1);
        continue;
      }

      ctx.strokeStyle = `rgba(200, 240, 255, ${r.alpha})`;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.arc(r.x + parallaxX * 0.2, r.y + parallaxY * 0.2, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (flash > 0.01) {
      ctx.fillStyle = `rgba(225, 246, 255, ${flash})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function onPointerMove(clientX, clientY) {
    const now = performance.now();
    const dtMs = Math.max(1, now - pointer.lastMoveTs);
    pointer.vx = ((clientX - pointer.lastX) / dtMs) * 16;
    pointer.vy = ((clientY - pointer.lastY) / dtMs) * 16;

    pointer.targetX = clientX;
    pointer.targetY = clientY;
    pointer.lastX = clientX;
    pointer.lastY = clientY;
    pointer.lastMoveTs = now;
    pointer.active = true;

    const speed = Math.hypot(pointer.vx, pointer.vy);
    if (speed > 24 && now - pointer.lastSplashTs > 90) {
      pointer.lastSplashTs = now;
      spawnSplash(clientX, clientY, clamp(speed / 34, 0.5, 1.4));
    }
  }

  window.addEventListener(
    "mousemove",
    (event) => {
      onPointerMove(event.clientX, event.clientY);
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      if (!event.touches.length) return;
      const touch = event.touches[0];
      onPointerMove(touch.clientX, touch.clientY);
    },
    { passive: true }
  );

  window.addEventListener("click", (event) => {
    spawnSplash(event.clientX, event.clientY, 1.5);
  });

  window.addEventListener("touchstart", (event) => {
    if (!event.touches.length) return;
    const touch = event.touches[0];
    spawnSplash(touch.clientX, touch.clientY, 1.35);
  });

  window.addEventListener("mouseleave", () => {
    pointer.active = false;
    pointer.targetX = width * 0.5;
    pointer.targetY = height * 0.5;
  });

  window.addEventListener("resize", setSize);

  setSize();
  requestAnimationFrame(animate);
})();
