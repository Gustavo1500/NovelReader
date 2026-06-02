const CanvasAurora = (() => {
    const canvas = document.getElementById('aurora-canvas');
    if (!canvas) return { start(){}, sync(){} };
    const ctx = canvas.getContext('2d', { alpha: false });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeIncrement = prefersReducedMotion ? 0.05 : 0.35;

    let width  = canvas.width  = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let time   = 0;
    let resizeTimer;

    let cachedBgColor = '#14110e';
    const refreshBgColor = () => { cachedBgColor = getComputedStyle(document.body).backgroundColor || '#14110e'; };

    let isReadingMode = false;
    let particleTargetOpacity = 1.0;

    let mouseX = width / 2, mouseY = height / 2;
    document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });

    let colors = {
        glowA: { r: 190, g: 120, b: 40 }, glowB: { r: 110, g: 60, b: 10 }, accent: { r: 200, g: 146, b: 74 },
        targetGlowA: { r: 190, g: 120, b: 40 }, targetGlowB: { r: 110, g: 60, b: 10 }, targetAccent: { r: 200, g: 146, b: 74 }
    };

    const bokehCanvas = document.createElement('canvas');
    bokehCanvas.width = 64; bokehCanvas.height = 64;
    const bokehCtx = bokehCanvas.getContext('2d');

    const parseHex = hex => {
        let c = hex.trim().replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const n = parseInt(c, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };

    const syncThemeColors = () => {
        refreshBgColor();
        const style  = getComputedStyle(document.documentElement);
        const hexA   = style.getPropertyValue('--glow-a').trim();
        const hexB   = style.getPropertyValue('--glow-b').trim();
        const hexAcc = style.getPropertyValue('--accent').trim();
        if (hexA && hexA.startsWith('#')) colors.targetGlowA = parseHex(hexA);
        if (hexB && hexB.startsWith('#')) colors.targetGlowB = parseHex(hexB);
        if (hexAcc && hexAcc.startsWith('#')) colors.targetAccent = parseHex(hexAcc);
    };

    const updateInterpolation = () => {
        const ease = 0.04;
        for (const key of ['glowA', 'glowB', 'accent']) {
            const tgt = 'target' + key[0].toUpperCase() + key.slice(1);
            colors[key].r += (colors[tgt].r - colors[key].r) * ease;
            colors[key].g += (colors[tgt].g - colors[key].g) * ease;
            colors[key].b += (colors[tgt].b - colors[key].b) * ease;
        }
    };

    const curtains = [
        { yPercent: 0.40, thickness: 500, baseAlpha: 0.20, sliceWidth: 8,
          pathWaves: [{ f: 0.0003, a: 220, s: 0.0015, phase: 0 }, { f: 0.0008, a: 100, s: -0.002, phase: 0 }],
          foldWaves: [{ f: 0.002, s: 0.005, phase: 0 }], cacheCanvas: document.createElement('canvas') },
        { yPercent: 0.45, thickness: 350, baseAlpha: 0.35, sliceWidth: 6,
          pathWaves: [{ f: 0.0005, a: 180, s: -0.0025, phase: 0 }, { f: 0.0012, a: 80, s: 0.003, phase: 0 }],
          foldWaves: [{ f: 0.004, s: 0.008, phase: 0 }, { f: 0.007, s: -0.004, phase: 0 }], cacheCanvas: document.createElement('canvas') },
        { yPercent: 0.50, thickness: 200, baseAlpha: 0.45, sliceWidth: 5,
          pathWaves: [{ f: 0.0009, a: 140, s: 0.0035, phase: 0 }, { f: 0.0015, a: 60, s: -0.004, phase: 0 }],
          foldWaves: [{ f: 0.006, s: 0.01, phase: 0 }, { f: 0.010, s: 0.006, phase: 0 }], cacheCanvas: document.createElement('canvas') }
    ];
    curtains.forEach(c => { c.cacheCanvas.width = 1; c.cacheCanvas.height = 256; c.cacheCtx = c.cacheCanvas.getContext('2d'); });

    const calculateY = (x, c) => { let y = height * c.yPercent; for (const w of c.pathWaves) y += Math.sin(x * w.f + w.phase) * w.a; return y; };
    const calculateFold = (x, c) => { let fold = 0; for (const w of c.foldWaves) fold += (Math.sin(x * w.f + w.phase) + 1) * 0.5; return fold / c.foldWaves.length; };

    class BokehParticle {
        constructor(initialise) {
            if (initialise) {
                this.x = Math.random() * width; this.y = height * 0.3 + Math.random() * height * 0.5;
            } else {
                const side = Math.random();
                if (side < 0.4) { this.x = -60; this.y = height * 0.25 + Math.random() * height * 0.55; }
                else if (side < 0.8) { this.x = width + 60; this.y = height * 0.25 + Math.random() * height * 0.55; }
                else { this.x = Math.random() * width; this.y = height + 60; }
            }
            this.size = Math.random() * 26 + 12;
            this.speedX = (Math.random() * 0.35 + 0.08) * (this.x < width / 2 ? 1 : -1);
            this.speedY = -(Math.random() * 0.18 + 0.04);
            this.phase = Math.random() * Math.PI * 2;
            this.phaseSpeed = 0.007 + Math.random() * 0.006;
            this.naturalAlpha = Math.random() * 0.10 + 0.03;
            this.alpha = initialise ? this.naturalAlpha * Math.random() : 0;
        }
        update() {
            this.phase += this.phaseSpeed; this.x += this.speedX; this.y += this.speedY + Math.sin(this.phase) * 0.25;
            if (!isReadingMode) {
                const dx = mouseX - this.x, dy = mouseY - this.y, distSq = dx * dx + dy * dy;
                if (distSq < 70000) { const dist = Math.sqrt(distSq); this.x += (dx / dist) * 0.10; this.y += (dy / dist) * 0.07; }
            }
            const xFade = Math.min(this.x / (width * 0.12), 1, (width - this.x) / (width * 0.12));
            const yFade = Math.min(1, (height * 0.05 - Math.max(0, this.y - height * 0.95)) / (height * 0.05 + 1), this.y > 0 ? 1 : 0);
            const edgeFade = Math.max(0, Math.min(1, xFade)) * Math.max(0, Math.min(1, yFade));
            const modeMultiplier = isReadingMode ? 0.0 : 1.0;
            const target = this.naturalAlpha * edgeFade * modeMultiplier;
            const lerpRate = target > this.alpha ? 0.018 : 0.025;
            this.alpha += (target - this.alpha) * lerpRate;
            if ((this.x < -80 || this.x > width + 80 || this.y < -80 || this.y > height + 80) && this.alpha < 0.002) Object.assign(this, new BokehParticle(false));
        }
        draw() { if (this.alpha < 0.004) return; ctx.globalAlpha = this.alpha; ctx.drawImage(bokehCanvas, this.x - this.size, this.y - this.size, this.size * 2, this.size * 2); }
    }

    const bokehParticles = Array.from({ length: 28 }, () => new BokehParticle(true));

    const render = () => {
        requestAnimationFrame(render);
        if (document.hidden) return;
        time += timeIncrement; updateInterpolation();

        const rB = colors.glowB.r | 0, gB = colors.glowB.g | 0, bB = colors.glowB.b | 0;
        const rA = colors.glowA.r | 0, gA = colors.glowA.g | 0, bA = colors.glowA.b | 0;
        const rAcc = colors.accent.r | 0, gAcc = colors.accent.g | 0, bAcc = colors.accent.b | 0;

        bokehCtx.clearRect(0, 0, 64, 64);
        const bGrad = bokehCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        bGrad.addColorStop(0, `rgba(${rAcc},${gAcc},${bAcc},1)`);
        bGrad.addColorStop(0.20, `rgba(${rAcc},${gAcc},${bAcc},0.8)`);
        bGrad.addColorStop(0.55, `rgba(${rA},${gA},${bA},0.4)`);
        bGrad.addColorStop(1, `rgba(${rA},${gA},${bA},0)`);
        bokehCtx.fillStyle = bGrad; bokehCtx.fillRect(0, 0, 64, 64);

        for (let i = 0; i < curtains.length; i++) {
            const c = curtains[i]; c.cacheCtx.clearRect(0, 0, 1, 256);
            const cGrad = c.cacheCtx.createLinearGradient(0, 0, 0, 256);
            if (i === 0) { cGrad.addColorStop(0, `rgba(${rB},${gB},${bB},0)`); cGrad.addColorStop(0.4, `rgba(${rB},${gB},${bB},0.6)`); cGrad.addColorStop(0.8, `rgba(${rA},${gA},${bA},0.7)`); cGrad.addColorStop(1, `rgba(${rA},${gA},${bA},0)`); }
            else if (i === 1) { cGrad.addColorStop(0, `rgba(${rB},${gB},${bB},0)`); cGrad.addColorStop(0.3, `rgba(${rB},${gB},${bB},0.5)`); cGrad.addColorStop(0.6, `rgba(${rA},${gA},${bA},0.8)`); cGrad.addColorStop(0.9, `rgba(${rAcc},${gAcc},${bAcc},0.9)`); cGrad.addColorStop(1, `rgba(${rAcc},${gAcc},${bAcc},0)`); }
            else { cGrad.addColorStop(0, `rgba(${rB},${gB},${bB},0)`); cGrad.addColorStop(0.2, `rgba(${rB},${gB},${bB},0.3)`); cGrad.addColorStop(0.55, `rgba(${rA},${gA},${bA},0.7)`); cGrad.addColorStop(0.85, `rgba(${rAcc},${gAcc},${bAcc},1)`); cGrad.addColorStop(0.95, `rgba(${rAcc},${gAcc},${bAcc},1)`); cGrad.addColorStop(1, `rgba(${rAcc},${gAcc},${bAcc},0)`); }
            c.cacheCtx.fillStyle = cGrad; c.cacheCtx.fillRect(0, 0, 1, 256);
            for (const w of c.pathWaves) w.phase = time * w.s;
            for (const w of c.foldWaves) w.phase = time * w.s;
        }

        ctx.fillStyle = cachedBgColor; ctx.fillRect(0, 0, width, height);
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        for (const curtain of curtains) {
            for (let x = -50; x < width + 50; x += curtain.sliceWidth) {
                const y = calculateY(x, curtain), fold = calculateFold(x, curtain), alpha = curtain.baseAlpha * (0.4 + 0.6 * fold), thick = curtain.thickness * (0.8 + 0.4 * fold);
                ctx.globalAlpha = alpha * 1.2; ctx.drawImage(curtain.cacheCanvas, x, y - thick, curtain.sliceWidth + 1, thick * 1.6);
            }
        }
        for (const p of bokehParticles) { p.update(); p.draw(); }
        ctx.restore();
    };

    const handleResize = () => {
        width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight;
        for (const p of bokehParticles) if (p.x > width + 80 || p.x < -80 || p.y > height + 80) Object.assign(p, new BokehParticle(false));
    };

    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(handleResize, 150); });

    return {
        start() { syncThemeColors(); render(); },
        sync: syncThemeColors,
        setReadingMode(active) { isReadingMode = active; if (!active) refreshBgColor(); }
    };
})();