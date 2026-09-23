// Single-shot figure animations in a plain, paper-figure style.
// Numbers come from the papers; token selections are schematic.

const W = 960, H = 540;
const C = {
  bg: '#ffffff', ink: '#222222', soft: '#555555', muted: '#8a8a8a', grid: '#e6e6e6', panel: '#f6f6f4',
  blue: '#1f77b4', orange: '#e0802b', green: '#2ca02c', red: '#d62728', purple: '#9467bd',
};
const SANS = 'Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF = '"Times New Roman", Georgia, serif';
const MONO = '"SFMono-Regular", Menlo, Consolas, monospace';
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a));
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function text(ctx, s, x, y, { size = 16, weight = 400, color = C.ink, font = SANS, align = 'left', alpha = 1, italic = false } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  ctx.restore();
}
function box(ctx, x, y, w, h, { fill = null, stroke = C.grid, lw = 1 } = {}) {
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
}
function panelLabel(ctx, s, x, y) { text(ctx, s, x, y, { size: 17, weight: 700, font: SERIF }); }
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
// Patch detail score (pixel variance rank): flat regions rank low.
function patchRank(img, cols, rows) {
  const o = document.createElement('canvas');
  o.width = cols * 8; o.height = rows * 8;
  const g = o.getContext('2d');
  g.drawImage(img, 0, 0, o.width, o.height);
  const px = g.getImageData(0, 0, o.width, o.height).data;
  const v = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let s = 0, s2 = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const i = ((r * 8 + y) * o.width + c * 8 + x) * 4;
      const l = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
      s += l; s2 += l * l;
    }
    v.push(s2 / 64 - (s / 64) ** 2);
  }
  const rank = new Array(v.length);
  v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]).forEach(([, i], k) => { rank[i] = k / v.length; });
  return rank;
}

// Loops one figure animation; plays only while visible, click to pause.
class Figure {
  constructor(host, { dur, draw }) {
    this.dur = dur; this.drawFn = draw; this.t = 0; this.visible = false; this.paused = REDUCE; this.running = false;
    host.classList.add('fig-player');
    this.canvas = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = W * dpr; this.canvas.height = H * dpr;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    this.bar = document.createElement('i');
    host.append(this.canvas, this.bar);
    host.addEventListener('click', () => { this.paused = !this.paused; this.sync(); });
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.sync(); }, { threshold: 0.3 }).observe(host);
    this.host = host;
    if (REDUCE) this.t = dur * 0.9;
    this.render();
  }
  sync() {
    this.host.classList.toggle('paused', this.paused);
    const run = this.visible && !this.paused;
    if (run && !this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame((n) => this.tick(n)); }
    if (!run) this.running = false;
  }
  tick(now) {
    if (!this.running) return;
    this.t = (this.t + (now - this.last) / 1000) % this.dur;
    this.last = now;
    this.render();
    requestAnimationFrame((n) => this.tick(n));
  }
  render() {
    const p = this.t / this.dur, ctx = this.ctx;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = Math.min(1, p / 0.03, (1 - p) / 0.03);
    this.drawFn(ctx, p);
    ctx.restore();
    this.bar.style.width = `${p * 100}%`;
  }
}

// ---------- WeaveBench: one OPS case, GUI and CLI interleaved ----------
function weavebench() {
  const steps = [
    { lane: 0, at: 0.06, label: 'observe dashboard' },
    { lane: 0, at: 0.18, label: 'inspect 503 spike' },
    { lane: 1, at: 0.31, label: 'grep nginx.conf' },
    { lane: 2, at: 0.43, label: 'edit timeout' },
    { lane: 1, at: 0.55, label: 'reload nginx' },
    { lane: 0, at: 0.68, label: 're-check dashboard' },
    { lane: 1, at: 0.80, label: 'verify logs' },
  ];
  const laneName = ['GUI', 'CLI', 'Code'];
  const laneColor = [C.blue, C.orange, C.purple];
  const term = [
    ['$ grep -n timeout /etc/nginx/nginx.conf', 0.31],
    ['  42:  proxy_read_timeout 5s;', 0.36],
    ['$ sed -i "42s/5s/60s/" /etc/nginx/nginx.conf', 0.43],
    ['  42:  proxy_read_timeout 60s;', 0.48],
    ['$ sudo nginx -s reload', 0.55],
    ['$ tail -n 2 /var/log/nginx/error.log', 0.80],
    ['  (no new errors)', 0.85],
  ];
  return {
    dur: 11,
    draw(ctx, p) {
      const active = steps.filter((s) => p >= s.at).pop();
      const lane = active ? active.lane : 0;

      // (a) GUI: dashboard.
      panelLabel(ctx, '(a) GUI · Web Ops dashboard', 40, 28);
      const gx = 40, gy = 48, gw = 420, gh = 230;
      box(ctx, gx, gy, gw, gh, { fill: '#fff', stroke: lane === 0 ? C.blue : C.grid, lw: lane === 0 ? 2 : 1 });
      const cx = gx + 44, cy = gy + 28, cw = gw - 66, ch = gh - 70;
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(cx, cy + (ch * i) / 4); ctx.lineTo(cx + cw, cy + (ch * i) / 4); ctx.stroke(); }
      ctx.strokeStyle = C.soft; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + ch); ctx.lineTo(cx + cw, cy + ch); ctx.stroke();
      text(ctx, '5xx / min', cx - 36, cy - 12, { size: 12, color: C.muted });
      text(ctx, 'time →', cx + cw, cy + ch + 16, { size: 12, color: C.muted, align: 'right' });
      const fixed = ease(seg(p, 0.6, 0.7));
      const pts = 70;
      const shown = Math.floor(pts * (0.62 + 0.38 * seg(p, 0.6, 0.72)));
      ctx.beginPath();
      for (let i = 0; i <= shown; i++) {
        const x = cx + (cw * i) / pts;
        const spike = i > 30 && i < 44 ? Math.exp(-((i - 37) ** 2) / 10) * 0.78 : 0;
        const after = i > 44 ? 0 : 1;
        const v = 0.1 + 0.03 * Math.sin(i * 1.3) + spike * after;
        const y = cy + ch - v * ch;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.stroke();
      if (p > 0.18) {
        const sx = cx + (cw * 37) / pts, sy = cy + ch - 0.88 * ch;
        ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.strokeRect(sx - 26, sy - 8, 52, ch * 0.8); ctx.setLineDash([]);
        text(ctx, '503 spike', sx + 32, sy + 4, { size: 13, color: C.red });
      }
      if (fixed > 0) text(ctx, 'recovered ✓', cx + cw - 4, cy + 14, { size: 13, color: C.green, align: 'right', alpha: fixed });

      // (b) CLI / code: terminal.
      panelLabel(ctx, '(b) CLI / Code · shell', 500, 28);
      const tx = 500, ty = 48, tw = 420, th = 230;
      box(ctx, tx, ty, tw, th, { fill: C.panel, stroke: lane > 0 ? C.orange : C.grid, lw: lane > 0 ? 2 : 1 });
      term.forEach(([s, at], i) => {
        const a = seg(p, at, at + 0.04);
        if (a <= 0) return;
        const col = s.startsWith('$') ? C.ink : s.includes('60s') ? C.purple : C.muted;
        text(ctx, s.slice(0, Math.ceil(s.length * a)), tx + 14, ty + 24 + i * 29, { size: 13, color: col, font: MONO });
      });

      // (c) Trajectory swimlanes.
      panelLabel(ctx, '(c) Trajectory: channel used at each step', 40, 316);
      const lx = 120, lw = 800, ly = 346, lh = 44;
      laneName.forEach((n, i) => {
        text(ctx, n, lx - 16, ly + i * lh + lh / 2, { size: 14, weight: 600, color: laneColor[i], align: 'right' });
        ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(lx, ly + i * lh + lh / 2); ctx.lineTo(lx + lw, ly + i * lh + lh / 2); ctx.stroke();
      });
      const X = (k) => lx + 40 + (k * (lw - 80)) / (steps.length - 1);
      const Y = (l) => ly + l * lh + lh / 2;
      ctx.strokeStyle = C.soft; ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      steps.forEach((s, k) => {
        if (p < s.at) return;
        started ? ctx.lineTo(X(k), Y(s.lane)) : ctx.moveTo(X(k), Y(s.lane));
        started = true;
      });
      ctx.stroke();
      steps.forEach((s, k) => {
        const a = ease(seg(p, s.at, s.at + 0.04));
        if (a <= 0) return;
        ctx.beginPath(); ctx.arc(X(k), Y(s.lane), 6.5 * a, 0, 7);
        ctx.fillStyle = laneColor[s.lane]; ctx.fill();
        text(ctx, `${k + 1}`, X(k), ly - 10, { size: 12, color: C.muted, align: 'center', alpha: a });
        text(ctx, s.label, X(k), ly + 3 * lh + 14, { size: 12, color: C.soft, align: 'center', alpha: a });
      });
    },
  };
}

// ---------- ST-Lite: which KV entries survive along a long trajectory ----------
function stlite() {
  const steps = 12, groups = 14, rand = rng(5);
  // Schematic importance per (step, token group): UI-salient groups score higher.
  const sal = [...Array(steps)].map(() => [...Array(groups)].map(() => rand()));
  const budget = 0.2;
  return {
    dur: 10,
    draw(ctx, p) {
      const cur = Math.min(steps, Math.floor(seg(p, 0.02, 0.78) * steps) + 1);
      // Keep the most recent 2 steps in full, then the most salient older entries up to the budget.
      const cap = Math.round(budget * steps * groups);
      const recent = [];
      const older = [];
      for (let s = 0; s < cur; s++) for (let g = 0; g < groups; g++) {
        (s >= cur - 1 ? recent : older).push([s, g, sal[s][g] * (0.6 + 0.4 * s / steps)]);
      }
      older.sort((a, b) => b[2] - a[2]);
      const kept = new Set([...recent, ...older.slice(0, Math.max(0, cap - recent.length))].map(([s, g]) => `${s}:${g}`));

      // (a) heatmap of retained KV entries.
      panelLabel(ctx, '(a) Retained KV entries (token group × step)', 40, 28);
      const hx = 80, hy = 56, cw = 34, ch = 24;
      for (let s = 0; s < steps; s++) {
        text(ctx, `${s + 1}`, hx + s * cw + cw / 2, hy + groups * ch + 14, { size: 12, color: s === cur - 1 ? C.ink : C.muted, align: 'center' });
        for (let g = 0; g < groups; g++) {
          const x = hx + s * cw, y = hy + g * ch;
          if (s >= cur) { box(ctx, x, y, cw, ch, { fill: '#fafafa', stroke: '#f0f0f0' }); continue; }
          const k = kept.has(`${s}:${g}`);
          const isRecent = s >= cur - 1;
          const shade = isRecent ? 'rgba(44,160,44,0.75)' : k ? `rgba(31,119,180,${0.35 + 0.6 * sal[s][g]})` : '#ededed';
          box(ctx, x, y, cw, ch, { fill: shade, stroke: '#ffffff', lw: 1.5 });
        }
      }
      text(ctx, 'step', hx + steps * cw / 2, hy + groups * ch + 34, { size: 13, color: C.soft, align: 'center' });
      ctx.save(); ctx.translate(hx - 22, hy + groups * ch / 2); ctx.rotate(-Math.PI / 2);
      text(ctx, 'token group', 0, 0, { size: 13, color: C.soft, align: 'center' }); ctx.restore();
      const lg = hy + groups * ch + 58;
      [['rgba(44,160,44,0.75)', 'current step (full)', 0], [C.blue, 'kept: salient, still attended', 150], ['#ededed', 'evicted', 350]].forEach(([c, s, dx]) => {
        box(ctx, hx + dx, lg - 7, 14, 14, { fill: c, stroke: null });
        text(ctx, s, hx + dx + 20, lg, { size: 12, color: C.soft });
      });

      // (b) cache size vs. step.
      panelLabel(ctx, '(b) KV cache size', 560, 28);
      const px = 600, py = 70, pw = 320, ph = 300;
      ctx.strokeStyle = C.soft; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + ph); ctx.lineTo(px + pw, py + ph); ctx.stroke();
      for (let i = 1; i <= 4; i++) { ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(px, py + ph - (ph * i) / 4); ctx.lineTo(px + pw, py + ph - (ph * i) / 4); ctx.stroke(); }
      text(ctx, 'step', px + pw, py + ph + 18, { size: 12, color: C.muted, align: 'right' });
      text(ctx, 'entries', px - 8, py - 12, { size: 12, color: C.muted });
      const X = (s) => px + (pw * s) / steps, Y = (v) => py + ph - ph * v;
      const line = (f, color, dash) => {
        ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash(dash);
        ctx.beginPath();
        for (let s = 0; s <= cur; s++) { const v = f(s); s ? ctx.lineTo(X(s), Y(v)) : ctx.moveTo(X(s), Y(v)); }
        ctx.stroke(); ctx.setLineDash([]);
      };
      line((s) => s / steps, '#7f7f7f', [6, 4]);
      line((s) => Math.min(s / steps, budget), C.blue, []);
      text(ctx, 'Full Cache', X(cur) - 6, Y(cur / steps) - 14, { size: 13, color: '#7f7f7f', align: 'right' });
      text(ctx, 'ST-Lite (20% budget)', px + pw, Y(budget) - 14, { size: 13, color: C.blue, align: 'right' });
      const a = ease(seg(p, 0.8, 0.9));
      text(ctx, 'up to 2.35× faster decoding,', px, py + ph + 56, { size: 15, color: C.ink, alpha: a });
      text(ctx, 'matching or exceeding Full Cache accuracy', px, py + ph + 78, { size: 15, color: C.ink, alpha: a });
    },
  };
}

// ---------- GUIPruner: prune a real screenshot, lower-res history ----------
async function guipruner() {
  const img = await loadImage('assets/media/rw_foodtruck_reference.webp');
  if (!img) return null;
  const cols = 32, rows = 18, rank = patchRank(img, cols, rows), keep = 1 / 3.4;
  const shot = (ctx, x, y, w, grid, prune, glowKept) => {
    const h = (w * 9) / 16;
    ctx.drawImage(img, x, y, w, h);
    const gc = Math.round(cols * grid), gr = Math.round(rows * grid);
    const pw = w / gc, ph = h / gr;
    for (let r = 0; r < gr; r++) for (let c = 0; c < gc; c++) {
      const k = rank[Math.floor((r / gr) * rows) * cols + Math.floor((c / gc) * cols)];
      const bx = x + c * pw, by = y + r * ph;
      if (k < prune) { ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.fillRect(bx, by, pw + 0.4, ph + 0.4); }
      ctx.strokeStyle = glowKept && k >= prune ? 'rgba(214,39,40,0.8)' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = glowKept && k >= prune ? 1 : 0.5;
      ctx.strokeRect(bx + 0.5, by + 0.5, pw - 1, ph - 1);
    }
    box(ctx, x, y, w, h, { stroke: '#cfcfcf' });
  };
  return {
    dur: 9,
    draw(ctx, p) {
      const prune = (1 - keep) * ease(seg(p, 0.12, 0.62));
      // (a) history at lower resolution.
      panelLabel(ctx, '(a) History, lower res.', 40, 28);
      [[0.25, 't−3'], [0.375, 't−2'], [0.5, 't−1']].forEach(([g, lbl], i) => {
        const w = 200, y = 60 + i * 140;
        shot(ctx, 40, y, w, g, prune * 0.6, false);
        text(ctx, `${lbl} · ${Math.round(cols * g)}×${Math.round(rows * g)} patches`, 40 + w / 2, y + (w * 9) / 16 + 14, { size: 12, color: C.soft, align: 'center' });
      });
      // (b) current frame, structure-aware pruning.
      panelLabel(ctx, '(b) Current frame: structure-aware pruning', 290, 28);
      shot(ctx, 290, 60, 630, 1, prune, p > 0.62);
      const kept = Math.round((1 - prune) * 100);
      text(ctx, `visual tokens kept: ${kept}%`, 290, 440, { size: 16, color: C.ink });
      box(ctx, 290, 456, 300, 10, { fill: '#eeeeee', stroke: null });
      box(ctx, 290, 456, 300 * (1 - prune), 10, { fill: C.red, stroke: null });
      const a = ease(seg(p, 0.66, 0.78));
      text(ctx, '3.4× fewer FLOPs · 3.3× faster vision encoding · >94% performance retained', 290, 496, { size: 15, color: C.ink, alpha: a });
    },
  };
}

// ---------- Mount ----------
const figures = { weavebench, stlite, guipruner };
document.querySelectorAll('[data-motion]').forEach(async (host) => {
  const spec = await figures[host.dataset.motion]?.();
  if (spec) new Figure(host, spec);
});

// Official LoopX footage: play only while visible.
document.querySelectorAll('video[data-autoplay]').forEach((v) => {
  if (REDUCE) { v.controls = true; return; }
  new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.3 }).observe(v);
});
