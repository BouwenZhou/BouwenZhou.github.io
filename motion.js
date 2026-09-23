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
    this.dur = dur; this.drawFn = draw; this.onLoop = arguments[1].onLoop; this.t = 0; this.visible = false; this.paused = REDUCE; this.running = false;
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
    if (this.t >= this.dur) { this.t %= this.dur; this.loop = (this.loop || 0) + 1; this.onLoop?.(); }
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

// ---------- WeaveBench: evaluation pipeline over a real task desktop ----------
function card(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(x, y, w, h);
  ctx.restore();
  box(ctx, x, y, w, h, { stroke: '#d8d8d8' });
}
async function weavebench() {
  const cases = [
    { dom: 'SPA', img: 'spa', clicks: [[0.34, 0.52], [0.86, 0.36], [0.14, 0.2]] },
    { dom: 'DES', img: 'des', clicks: [[0.9, 0.3], [0.45, 0.45], [0.88, 0.62]] },
    { dom: 'OPS', img: 'ops', clicks: [[0.2, 0.22], [0.5, 0.4], [0.8, 0.3]] },
  ];
  const imgs = await Promise.all(cases.map((c) => loadImage(`assets/media/wbcase_${c.img}.jpg`)));
  const runtimes = ['OpenClaw', 'Codex CLI', 'Claude Code', 'Hermes'];
  const calls = [['GUI', 'screenshot'], ['CLI', 'bash'], ['GUI', 'click'], ['Code', 'python'], ['GUI', 'drag'], ['CLI', 'bash'], ['GUI', 'screenshot'], ['Code', 'edit']];
  const chanColor = { GUI: C.blue, CLI: C.orange, Code: C.purple };
  const clauses = ['deliverable produced and valid', 'rendered state matches the goal', 'process steps visible in logs'];
  const state = { k: 0 };
  return {
    state,
    cases,
    dur: 12,
    onLoop() { state.k = (state.k + 1) % cases.length; state.onChange?.(state.k); },
    draw(ctx, p) {
      const cs = cases[state.k], img = imgs[state.k];
      const S = 1.32, LW = W / S, LH = H / S;
      ctx.save(); ctx.scale(S, S);
      if (img) ctx.drawImage(img, 0, 0, LW, LH);
      const stage = p < 0.18 ? 0 : p < 0.58 ? 1 : 2;

      // Stage indicator.
      ['① Task', '② Harness', '③ Judge'].forEach((t, i) => {
        const x = LW - 12 - (3 - i) * 100, on = i === stage;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 8;
        ctx.fillStyle = on ? '#222' : 'rgba(255,255,255,0.92)'; ctx.fillRect(x, 10, 94, 26); ctx.restore();
        text(ctx, t, x + 47, 23, { size: 13, weight: 600, color: on ? '#fff' : C.muted, align: 'center' });
      });

      // ① task bundle card.
      const ta = stage === 0 ? ease(seg(p, 0, 0.05)) : 1 - ease(seg(p, 0.18, 0.24));
      if (ta > 0) {
        ctx.save(); ctx.globalAlpha *= ta;
        card(ctx, 12, 46, 250, 132);
        text(ctx, `${cs.dom} task bundle`, 24, 64, { size: 14, weight: 700 });
        text(ctx, 'ℰ = (prompt, materials, checks)', 24, 84, { size: 12, color: C.soft });
        [['P1 channel non-substitutable', 0.05], ['P2 long-horizon', 0.09], ['P3 cross-state', 0.13]].forEach(([t, at], i) => {
          text(ctx, `✓ ${t}`, 24, 110 + i * 21, { size: 12, color: C.green, alpha: ease(seg(p, at, at + 0.03)) });
        });
        ctx.restore();
      }

      // ② harness: GUI actions on the desktop, tool-call log.
      if (stage >= 1) {
        const n = Math.floor(seg(p, 0.2, 0.56) * calls.length);
        let gi = 0;
        for (let i = 0; i < n; i++) {
          if (calls[i][0] !== 'GUI') continue;
          const [cx, cy] = cs.clicks[gi++ % cs.clicks.length];
          if (i === n - 1 && stage === 1) {
            const r = ((p * 12) % 0.6) / 0.6;
            ctx.strokeStyle = `rgba(31,119,180,${1 - r})`; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(cx * LW, cy * LH, 6 + 18 * r, 0, 7); ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(cx * LW, cy * LH, 4, 0, 7); ctx.fillStyle = C.blue; ctx.fill();
        }
        const la = stage === 1 ? ease(seg(p, 0.18, 0.24)) : 1 - ease(seg(p, 0.58, 0.64));
        if (la > 0) {
          ctx.save(); ctx.globalAlpha *= la;
          const y0 = LH - 12 - 198;
          card(ctx, 12, y0, 272, 198);
          text(ctx, 'agent loop · one session', 24, y0 + 18, { size: 13, weight: 700 });
          runtimes.forEach((r, i) => {
            const on = Math.floor(p * 40) % 4 === i;
            box(ctx, 24 + i * 63, y0 + 32, 59, 20, { fill: on ? '#222' : '#fff', stroke: on ? '#222' : C.grid });
            text(ctx, r, 53.5 + i * 63, y0 + 42, { size: 10, color: on ? '#fff' : C.muted, align: 'center' });
          });
          calls.slice(Math.max(0, n - 5), n).forEach(([ch, tool], i) => {
            const y = y0 + 72 + i * 25;
            ctx.beginPath(); ctx.arc(30, y, 4.5, 0, 7); ctx.fillStyle = chanColor[ch]; ctx.fill();
            text(ctx, ch, 42, y, { size: 12, weight: 700, color: chanColor[ch] });
            text(ctx, tool, 88, y, { size: 13, font: MONO });
          });
          ctx.restore();
        }
      }

      // ③ judge panel slides in from the right.
      if (stage === 2) {
        const pw = 290, sl = ease(seg(p, 0.58, 0.64)), x = lerp(LW + 10, LW - 12 - pw, sl), y = 46;
        card(ctx, x, y, pw, LH - y - 12);
        text(ctx, 'isolated agentic judge', x + 14, y + 18, { size: 14, weight: 700 });
        ['artifacts', 'screenshots', 'logs'].forEach((e, i) => {
          const on = p > 0.64 + i * 0.03;
          box(ctx, x + 14 + i * 88, y + 32, 82, 22, { fill: on ? '#eef4fa' : '#fff', stroke: on ? C.blue : C.grid });
          text(ctx, e, x + 55 + i * 88, y + 43, { size: 11, color: on ? C.blue : C.muted, align: 'center' });
        });
        clauses.forEach((c, i) => {
          const on = p > 0.72 + i * 0.04;
          text(ctx, `${on ? '☑' : '☐'} ${c}`, x + 14, y + 76 + i * 22, { size: 12, color: on ? C.ink : C.muted });
        });
        const scan = seg(p, 0.84, 0.92);
        text(ctx, '9 shortcut detectors', x + 14, y + 150, { size: 12, color: C.soft });
        box(ctx, x + 14, y + 160, pw - 28, 7, { fill: '#eeeeee', stroke: null });
        box(ctx, x + 14, y + 160, (pw - 28) * scan, 7, { fill: C.green, stroke: null });
        if (scan >= 1) text(ctx, 'no fake renders, hard-coded metrics, leakage', x + 14, y + 180, { size: 11, color: C.green });
        const sa = ease(seg(p, 0.92, 0.97));
        text(ctx, 's = min( process , deliverable )', x + 14, y + 212, { size: 15, font: SERIF, alpha: sa });
        text(ctx, 'zeroed if a shortcut is found', x + 14, y + 232, { size: 11, color: C.muted, alpha: sa });
        ctx.fillStyle = C.grid; ctx.fillRect(x + 14, y + 250, pw - 28, 1);
        text(ctx, '41.2%', x + 14, y + 284, { size: 30, weight: 700, alpha: sa });
        text(ctx, 'best PassRate', x + 110, y + 276, { size: 11, color: C.muted, alpha: sa });
        text(ctx, 'Opus 4.7 · Claude Code', x + 110, y + 292, { size: 11, color: C.soft, alpha: sa });
      }
      ctx.restore();
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
  if (!spec) return;
  const fig = new Figure(host, spec);
  if (!spec.state) return;
  // Clickable case tabs under the WeaveBench figure.
  const frame = host.closest('.media-frame');
  const tabs = [...frame.querySelectorAll('[data-wb-tabs] button')];
  const caption = frame.querySelector('[data-wb-caption]');
  const show = (k) => {
    tabs.forEach((b, i) => b.classList.toggle('on', i === k));
    caption.textContent = tabs[k].dataset.caption;
  };
  spec.state.onChange = show;
  tabs.forEach((b, i) => b.addEventListener('click', () => {
    spec.state.k = i; fig.t = 0; show(i); fig.render();
  }));
});

// Official LoopX footage: play only while visible.
document.querySelectorAll('video[data-autoplay]').forEach((v) => {
  if (REDUCE) { v.controls = true; return; }
  new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.3 }).observe(v);
});
