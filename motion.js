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
    this.t += (now - this.last) / 1000;
    if (this.t >= this.dur) { this.t %= this.dur; this.loop = (this.loop || 0) + 1; }
    this.last = now;
    this.render();
    requestAnimationFrame((n) => this.tick(n));
  }
  render() {
    const p = this.t / this.dur, ctx = this.ctx;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = Math.min(1, p / 0.03, (1 - p) / 0.03);
    this.drawFn(ctx, p, this.loop || 0);
    ctx.restore();
    this.bar.style.width = `${p * 100}%`;
  }
}

// ---------- WeaveBench: evaluation pipeline, one real case per loop ----------
async function weavebench() {
  const cases = [
    { dom: 'SPA', title: 'Audit a 3D mesh for printability in MeshLab', img: 'spa' },
    { dom: 'DES', title: 'Recover a blown-out RAW photo in darktable', img: 'des' },
    { dom: 'OPS', title: 'Manage a RabbitMQ dead-letter-queue topology', img: 'ops' },
  ];
  const imgs = await Promise.all(cases.map((c) => loadImage(`assets/media/wbcase_${c.img}.jpg`)));
  const runtimes = ['OpenClaw', 'Codex CLI', 'Claude Code', 'Hermes'];
  const calls = [['GUI', 'screenshot'], ['CLI', 'bash'], ['GUI', 'click'], ['Code', 'python'], ['GUI', 'drag'], ['CLI', 'bash'], ['GUI', 'screenshot'], ['Code', 'edit']];
  const chanColor = { GUI: C.blue, CLI: C.orange, Code: C.purple };
  const evidence = ['artifacts', 'screenshots', 'logs'];
  const clauses = ['deliverable produced and valid', 'rendered state matches the goal', 'process steps visible in logs'];
  const colX = [40, 330, 660], colW = [260, 300, 260];
  return {
    dur: 12,
    draw(ctx, p, loop) {
      const k = loop % cases.length, cs = cases[k], img = imgs[k];
      const stage = p < 0.2 ? 0 : p < 0.56 ? 1 : 2;
      const heads = ['① Task', '② Hybrid harness', '③ Trajectory-aware judge'];
      heads.forEach((h, i) => {
        text(ctx, h, colX[i], 30, { size: 19, weight: 700, font: SERIF, color: i === stage ? C.ink : C.muted });
        ctx.fillStyle = i === stage ? C.ink : C.grid; ctx.fillRect(colX[i], 44, colW[i], i === stage ? 2 : 1);
      });
      for (let i = 0; i < 2; i++) text(ctx, '→', colX[i] + colW[i] + 15, 30, { size: 15, color: C.muted, align: 'center' });

      // ① task bundle.
      const a0 = ease(seg(p, 0.0, 0.08));
      ctx.save(); ctx.globalAlpha *= a0;
      box(ctx, 40, 62, 260, 150, { fill: '#fff', stroke: stage === 0 ? C.ink : C.grid });
      text(ctx, cs.dom, 56, 84, { size: 14, weight: 700, color: C.blue });
      const words = cs.title.split(' '); let line = '', ly = 110;
      words.forEach((w) => { const t = line ? `${line} ${w}` : w; if (t.length > 26) { text(ctx, line, 56, ly, { size: 15 }); line = w; ly += 22; } else line = t; });
      text(ctx, line, 56, ly, { size: 15 });
      text(ctx, 'bundle ℰ = (prompt, materials, checks)', 56, 192, { size: 12, color: C.soft });
      ctx.restore();
      [['P1 channel non-substitutable', 0.06], ['P2 long-horizon', 0.1], ['P3 cross-state', 0.14]].forEach(([t, at], i) => {
        const a = ease(seg(p, at, at + 0.04));
        text(ctx, `✓ ${t}`, 56, 240 + i * 24, { size: 13, color: C.green, alpha: a });
      });
      text(ctx, '114 tasks · 8 domains · ≥3 pilot agents', 40, 330, { size: 12, color: C.muted });

      // ② harness: real desktop + tool-call stream.
      const hx = 330, hw = 300, hh = hw * 9 / 16;
      if (img) { ctx.save(); ctx.globalAlpha *= 0.35 + 0.65 * ease(seg(p, 0.18, 0.26)); ctx.drawImage(img, hx, 62, hw, hh); ctx.restore(); }
      box(ctx, hx, 62, hw, hh, { stroke: stage === 1 ? C.ink : C.grid });
      text(ctx, 'Ubuntu sandbox · real app', hx + 8, 62 + hh + 14, { size: 12, color: C.muted });
      runtimes.forEach((r, i) => {
        const on = stage >= 1 && Math.floor(p * 40) % 4 === i;
        box(ctx, hx + i * 76, 62 + hh + 30, 70, 22, { fill: on ? '#f0f0f0' : '#fff', stroke: on ? C.ink : C.grid });
        text(ctx, r, hx + i * 76 + 35, 62 + hh + 41, { size: 11, color: on ? C.ink : C.muted, align: 'center' });
      });
      const nCalls = Math.floor(seg(p, 0.22, 0.54) * calls.length);
      for (let i = 0; i < nCalls; i++) {
        const [ch, tool] = calls[i], x = hx + (i % 4) * 76, y = 62 + hh + 70 + Math.floor(i / 4) * 30;
        box(ctx, x, y, 70, 24, { fill: '#fff', stroke: chanColor[ch] });
        text(ctx, tool, x + 35, y + 12, { size: 11, color: chanColor[ch], align: 'center', font: MONO });
      }
      if (p > 0.3) text(ctx, 'GUI plugin (1 screenshot + 9 actions) over CLI / code tools', hx, 62 + hh + 146, { size: 12, color: C.soft });

      // ③ judge: evidence re-fetch, clause checks, shortcut scan.
      const jx = 660;
      evidence.forEach((e, i) => {
        const a = ease(seg(p, 0.56 + i * 0.03, 0.62 + i * 0.03));
        box(ctx, jx + i * 88, 62, 80, 26, { fill: a > 0.5 ? '#f3f7fb' : '#fff', stroke: a > 0.5 ? C.blue : C.grid });
        text(ctx, e, jx + i * 88 + 40, 75, { size: 12, color: a > 0.5 ? C.blue : C.muted, align: 'center' });
        if (a > 0 && a < 1) {
          ctx.strokeStyle = `rgba(31,119,180,${1 - a})`; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(hx + hw, 62 + hh / 2); ctx.lineTo(jx + i * 88 + 40, 90); ctx.stroke(); ctx.setLineDash([]);
        }
      });
      clauses.forEach((c, i) => {
        const a = ease(seg(p, 0.66 + i * 0.05, 0.7 + i * 0.05));
        text(ctx, `${a > 0.9 ? '☑' : '☐'}  ${c}`, jx, 116 + i * 26, { size: 13, color: a > 0.9 ? C.ink : C.muted, alpha: 0.3 + 0.7 * a });
      });
      const scan = seg(p, 0.8, 0.9);
      text(ctx, '9 shortcut detectors', jx, 206, { size: 13, color: C.soft });
      box(ctx, jx, 218, 260, 8, { fill: '#eeeeee', stroke: null });
      box(ctx, jx, 218, 260 * scan, 8, { fill: C.green, stroke: null });
      if (scan >= 1) text(ctx, 'no fake screenshots, hard-coded metrics, leakage …', jx, 240, { size: 12, color: C.green });
      const sa = ease(seg(p, 0.9, 0.96));
      text(ctx, 's = min( process , deliverable )', jx, 282, { size: 16, font: SERIF, alpha: sa });
      text(ctx, 'zeroed if a shortcut is found', jx, 304, { size: 12, color: C.muted, alpha: sa });

      // Footer: headline result.
      ctx.fillStyle = C.grid; ctx.fillRect(40, 440, 880, 1);
      text(ctx, 'Best model × harness: 41.2% PassRate', 40, 474, { size: 20, weight: 600 });
      text(ctx, 'median 76 tool calls and 16 GUI↔CLI switches per task', 40, 502, { size: 14, color: C.soft });
      cases.forEach((c, i) => {
        box(ctx, 680 + i * 82, 462, 74, 26, { fill: i === k ? C.ink : '#fff', stroke: i === k ? C.ink : C.grid });
        text(ctx, c.dom, 717 + i * 82, 475, { size: 13, weight: 600, color: i === k ? '#fff' : C.muted, align: 'center' });
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
