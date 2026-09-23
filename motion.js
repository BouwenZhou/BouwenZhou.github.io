// Motion explainers: small canvas "videos" with scenes, captions and a progress bar.
// Every number shown comes from the corresponding paper or project page.

const W = 960, H = 540;
const C = {
  bg: '#0e1016', panel: '#171a22', panel2: '#1e222c', line: '#2a2f3a',
  text: '#e8eaf0', muted: '#8b91a0', dim: '#565c6a',
  accent: '#d946ef', green: '#34d399', amber: '#fbbf24', cyan: '#22d3ee', red: '#f87171', blue: '#60a5fa',
};
const SANS = 'Roboto, -apple-system, sans-serif';
const MONO = '"JetBrains Mono", "SFMono-Regular", Menlo, monospace';
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeIO = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a));
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillRR(ctx, x, y, w, h, r, color) { rr(ctx, x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); }
function strokeRR(ctx, x, y, w, h, r, color, lw = 1) { rr(ctx, x, y, w, h, r); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); }
function text(ctx, s, x, y, { size = 22, weight = 400, color = C.text, font = SANS, align = 'left', alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  ctx.restore();
}
function windowChrome(ctx, x, y, w, h, title, { alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  fillRR(ctx, x, y, w, h, 12, C.panel);
  strokeRR(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 12, C.line);
  ctx.save(); rr(ctx, x, y, w, 34, 12); ctx.clip(); ctx.fillStyle = C.panel2; ctx.fillRect(x, y, w, 34); ctx.restore();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.beginPath(); ctx.arc(x + 18 + i * 18, y + 17, 5.5, 0, 7); ctx.fillStyle = c; ctx.fill(); });
  text(ctx, title, x + w / 2, y + 17, { size: 15, color: C.muted, align: 'center' });
  ctx.restore();
}
function cursor(ctx, x, y, click = 0) {
  if (click > 0 && click < 1) {
    ctx.beginPath(); ctx.arc(x, y, 8 + click * 26, 0, 7);
    ctx.strokeStyle = `rgba(34,211,238,${1 - click})`; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 22); ctx.lineTo(6, 17); ctx.lineTo(10, 26); ctx.lineTo(14, 24); ctx.lineTo(10, 15); ctx.lineTo(17, 15); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}
function pill(ctx, s, x, y, color, { size = 16, alpha = 1, fg = '#0e1016', pad = 12 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.font = `600 ${size}px ${SANS}`;
  const w = ctx.measureText(s).width + pad * 2, h = size + 14;
  fillRR(ctx, x, y - h / 2, w, h, h / 2, color);
  text(ctx, s, x + pad, y, { size, weight: 600, color: fg });
  ctx.restore();
  return w;
}
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
// Patch-level detail score (pixel variance): used to pick "salient" UI regions.
function patchScores(img, cols, rows) {
  const off = document.createElement('canvas');
  off.width = cols * 8; off.height = rows * 8;
  const o = off.getContext('2d');
  o.drawImage(img, 0, 0, off.width, off.height);
  const px = o.getImageData(0, 0, off.width, off.height).data;
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let s = 0, s2 = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const i = ((r * 8 + y) * off.width + c * 8 + x) * 4;
      const v = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
      s += v; s2 += v * v;
    }
    out.push(s2 / 64 - (s / 64) ** 2);
  }
  const order = out.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const rank = new Array(out.length);
  order.forEach(([, i], k) => { rank[i] = k / order.length; });
  return rank;
}

// ---------- Player ----------
class Player {
  constructor(host, scenes) {
    this.scenes = scenes;
    this.total = scenes.reduce((s, x) => s + x.dur, 0);
    this.t = 0; this.playing = false; this.visible = false; this.paused = false; this.last = 0;
    host.classList.add('player');
    this.canvas = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = W * dpr; this.canvas.height = H * dpr;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    this.cap = document.createElement('div'); this.cap.className = 'player-cap';
    this.bar = document.createElement('div'); this.bar.className = 'player-bar';
    this.segs = scenes.map((s) => {
      const el = document.createElement('span');
      el.style.flex = s.dur;
      el.appendChild(document.createElement('i'));
      this.bar.appendChild(el);
      return el;
    });
    this.btn = document.createElement('button');
    this.btn.type = 'button'; this.btn.className = 'player-btn'; this.btn.setAttribute('aria-label', 'Pause');
    host.append(this.canvas, this.cap, this.bar, this.btn);
    host.addEventListener('click', () => this.toggle());
    this.segs.forEach((el, i) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.t = scenes.slice(0, i).reduce((s, x) => s + x.dur, 0);
      this.draw();
    }));
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.sync(); }, { threshold: 0.3 }).observe(host);
    this.host = host;
    if (REDUCE) { this.paused = true; this.t = this.total * 0.97; }
    this.draw();
  }
  toggle() { this.paused = !this.paused; this.sync(); }
  sync() {
    const run = this.visible && !this.paused;
    this.host.classList.toggle('paused', this.paused);
    this.btn.setAttribute('aria-label', this.paused ? 'Play' : 'Pause');
    if (run && !this.playing) { this.playing = true; this.last = performance.now(); requestAnimationFrame((n) => this.tick(n)); }
    if (!run) this.playing = false;
  }
  tick(now) {
    if (!this.playing) return;
    this.t = (this.t + (now - this.last) / 1000) % this.total;
    this.last = now;
    this.draw();
    requestAnimationFrame((n) => this.tick(n));
  }
  draw() {
    let acc = 0, idx = 0;
    while (idx < this.scenes.length - 1 && this.t >= acc + this.scenes[idx].dur) { acc += this.scenes[idx].dur; idx++; }
    const sc = this.scenes[idx], p = clamp((this.t - acc) / sc.dur);
    const ctx = this.ctx;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    // Scene cross-fade in/out.
    ctx.globalAlpha = Math.min(1, p / 0.06, (1 - p) / 0.05 + 0.15);
    sc.draw(ctx, p, this.t - acc);
    ctx.restore();
    if (this.cap.dataset.idx !== String(idx)) { this.cap.dataset.idx = idx; this.cap.textContent = sc.cap; this.cap.classList.remove('show'); void this.cap.offsetWidth; this.cap.classList.add('show'); }
    this.segs.forEach((el, i) => { el.firstChild.style.width = `${i < idx ? 100 : i > idx ? 0 : p * 100}%`; });
  }
}

// ---------- WeaveBench ----------
function weavebench() {
  const domains = [
    ['DSK', 'Desktop Productivity'], ['DOC', 'Document Processing'], ['GAM', 'Games & Interactive'], ['WEB', 'Web Development'],
    ['DAV', 'Data Analysis & Viz'], ['OPS', 'DevOps & Sysadmin'], ['SPA', 'Spatial / 3D / CAD'], ['DES', 'Design & Creative'],
  ];
  const board = [
    ['Claude Opus 4.7 · Claude Code', 41.2], ['GPT-5.5 · Codex CLI', 35.1], ['Claude Opus 4.7 · OpenClaw', 35.1],
    ['GPT-5.5 · OpenClaw', 33.3], ['GPT-5.5 · Hermes Agent', 31.6],
  ];
  // Weave ribbon: which channel each step of the example trajectory uses.
  const steps = [
    ['GUI', 'observe dashboard', 0.08], ['GUI', 'inspect 503 spike', 0.24], ['CLI', 'open nginx.conf', 0.38],
    ['CODE', 'raise timeout', 0.5], ['CLI', 'reload nginx', 0.6], ['GUI', 're-check dashboard', 0.78],
  ];
  const chan = { GUI: C.cyan, CLI: C.amber, CODE: C.accent };
  return [
    {
      dur: 3.4, cap: '114 real-world tasks across 8 work domains, run in a real Ubuntu sandbox',
      draw(ctx, p) {
        text(ctx, 'WeaveBench', W / 2, 120, { size: 64, weight: 700, align: 'center', alpha: ease(p / 0.25) });
        text(ctx, 'GUI  ×  CLI  ×  Code', W / 2, 180, { size: 26, color: C.muted, align: 'center', alpha: ease((p - 0.1) / 0.25) });
        domains.forEach(([k, name], i) => {
          const a = ease((p - 0.2 - i * 0.05) / 0.2);
          const col = i % 4, row = Math.floor(i / 4);
          const x = 90 + col * 200, y = 260 + row * 110 + (1 - a) * 20;
          ctx.save(); ctx.globalAlpha *= a;
          fillRR(ctx, x, y, 185, 88, 14, C.panel);
          strokeRR(ctx, x + 0.5, y + 0.5, 184, 87, 14, C.line);
          text(ctx, k, x + 20, y + 32, { size: 26, weight: 700, color: [C.cyan, C.amber, C.accent, C.green][i % 4], font: MONO });
          text(ctx, name, x + 20, y + 64, { size: 15, color: C.muted });
          ctx.restore();
        });
      },
    },
    {
      dur: 7.6, cap: 'Each task weaves GUI observation with CLI / code changes: spot a 503 spike, patch nginx.conf, re-check',
      draw(ctx, p) {
        // GUI pane: web-ops dashboard.
        windowChrome(ctx, 30, 30, 520, 330, 'Web Ops dashboard');
        const cx = 60, cy = 90, cw = 460, ch = 200;
        ctx.strokeStyle = C.line; ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(cx, cy + (ch * i) / 4); ctx.lineTo(cx + cw, cy + (ch * i) / 4); ctx.stroke(); }
        text(ctx, 'HTTP 5xx / min', cx, cy - 18, { size: 15, color: C.muted });
        const spike = ease(seg(p, 0.05, 0.2)), fixed = ease(seg(p, 0.66, 0.8));
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const x = cx + (cw * i) / 60;
          let v = 0.12 + 0.05 * Math.sin(i * 0.9);
          const bump = Math.exp(-((i - 38) ** 2) / 18) * 0.72 * spike * (1 - fixed);
          if (i > 46) v += 0.0;
          const y = cy + ch - (v + bump) * ch;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = fixed > 0.5 ? C.green : spike > 0.3 ? C.red : C.blue; ctx.lineWidth = 3; ctx.stroke();
        if (spike > 0.3 && fixed < 0.5) pill(ctx, '503 spike', cx + cw * 0.63 - 10, cy + 30, C.red, { size: 15, alpha: spike });
        if (fixed > 0.2) pill(ctx, 'healthy ✓', cx + cw * 0.63 - 10, cy + 30, C.green, { size: 15, alpha: fixed });
        // Cursor path: move to spike, click; later re-check.
        const m1 = easeIO(seg(p, 0.12, 0.24)), m2 = easeIO(seg(p, 0.7, 0.8));
        const px = lerp(lerp(420, cx + cw * 0.63, m1), cx + cw * 0.63 + 40, m2);
        const py = lerp(lerp(330, cy + 60, m1), cy + 120, m2);
        cursor(ctx, px, py, p > 0.24 && p < 0.32 ? seg(p, 0.24, 0.32) : p > 0.8 && p < 0.88 ? seg(p, 0.8, 0.88) : 0);

        // CLI pane: terminal editing nginx.conf.
        windowChrome(ctx, 570, 30, 360, 330, 'terminal');
        const lines = [
          ['$ grep timeout /etc/nginx/nginx.conf', C.text, 0.34],
          ['  proxy_read_timeout 5s;', C.muted, 0.4],
          ['$ sed -i "s/5s/60s/" nginx.conf', C.text, 0.46],
          ['  proxy_read_timeout 60s;', C.accent, 0.54],
          ['$ nginx -s reload', C.text, 0.58],
          ['  signal process started ✓', C.green, 0.64],
        ];
        lines.forEach(([s, color, at], i) => {
          const a = seg(p, at, at + 0.05);
          if (a <= 0) return;
          const shown = s.slice(0, Math.ceil(s.length * a));
          text(ctx, shown, 590, 92 + i * 34, { size: 16, color, font: MONO });
        });
        const active = p < 0.32 || p > 0.68 ? 'GUI' : 'CLI';
        strokeRR(ctx, active === 'GUI' ? 30 : 570, 30, active === 'GUI' ? 520 : 360, 330, 12, active === 'GUI' ? C.cyan : C.amber, 2.5);

        // Weave ribbon along the bottom.
        text(ctx, 'trajectory', 30, 404, { size: 16, color: C.muted });
        ctx.strokeStyle = C.line; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(130, 404); ctx.lineTo(930, 404); ctx.stroke();
        steps.forEach(([ch, label, at], i) => {
          const a = ease(seg(p, at, at + 0.06));
          if (a <= 0) return;
          const x = 150 + i * 132;
          if (i > 0) {
            ctx.strokeStyle = chan[ch]; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(x - 132 + 12, 404); ctx.bezierCurveTo(x - 90, i % 2 ? 380 : 428, x - 42, i % 2 ? 428 : 380, x - 12, 404); ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(x, 404, 10 * a, 0, 7); ctx.fillStyle = chan[ch]; ctx.fill();
          text(ctx, ch, x, 436, { size: 14, weight: 700, color: chan[ch], align: 'center', font: MONO, alpha: a });
          text(ctx, label, x, 458, { size: 13, color: C.muted, align: 'center', alpha: a });
        });
      },
    },
    {
      dur: 3.6, cap: 'A trajectory-aware agentic judge audits screenshots, files and logs, and zeroes out shortcuts',
      draw(ctx, p) {
        text(ctx, 'Trajectory-aware judge', 90, 90, { size: 34, weight: 700 });
        const items = [
          ['screenshot', 'Dashboard shows the 503 spike resolved', true],
          ['file', 'nginx.conf timeout actually changed', true],
          ['log', 'nginx reloaded without errors', true],
          ['audit', 'No reward hack / shortcut detected', true],
        ];
        items.forEach(([kind, label], i) => {
          const a = ease(seg(p, 0.12 + i * 0.14, 0.24 + i * 0.14));
          const y = 160 + i * 78;
          ctx.save(); ctx.globalAlpha *= a;
          fillRR(ctx, 90, y, 780, 60, 12, C.panel);
          pill(ctx, kind, 108, y + 30, C.panel2, { size: 14, fg: C.muted });
          text(ctx, label, 230, y + 30, { size: 21 });
          const tick = ease(seg(p, 0.2 + i * 0.14, 0.3 + i * 0.14));
          ctx.beginPath(); ctx.arc(830, y + 30, 16 * tick, 0, 7); ctx.fillStyle = C.green; ctx.fill();
          if (tick > 0.6) text(ctx, '✓', 830, y + 31, { size: 20, weight: 700, color: C.bg, align: 'center' });
          ctx.restore();
        });
      },
    },
    {
      dur: 4.2, cap: 'Even the strongest model × harness pairing reaches only 41.2% PassRate',
      draw(ctx, p) {
        text(ctx, 'PassRate on 114 tasks', 90, 80, { size: 30, weight: 700 });
        board.forEach(([name, v], i) => {
          const a = ease(seg(p, 0.08 + i * 0.07, 0.45 + i * 0.07));
          const y = 140 + i * 70;
          text(ctx, name, 90, y + 20, { size: 19, color: i ? C.muted : C.text });
          fillRR(ctx, 420, y + 6, 440, 28, 8, C.panel);
          fillRR(ctx, 420, y + 6, Math.max(16, 440 * (v / 100) * a), 28, 8, i ? '#6b7280' : C.accent);
          text(ctx, `${(v * a).toFixed(1)}%`, 430 + 440 * (v / 100) * a + 8, y + 20, { size: 19, weight: 700, color: i ? C.muted : C.text });
        });
        const k = ease(seg(p, 0.7, 0.85));
        text(ctx, 'Hybrid GUI + CLI work is still far from solved.', 90, 500, { size: 22, color: C.amber, alpha: k });
      },
    },
  ];
}

// ---------- ST-Lite ----------
async function stlite() {
  const frames = (await Promise.all([...Array(10).keys()].map((i) => loadImage(`assets/media/traj/g${i}.jpg`)))).filter(Boolean);
  const cols = 24, rows = 13;
  // Use the frame with the most UI detail for the spatial-guidance close-up.
  const detail = (img) => {
    const o = document.createElement('canvas'); o.width = 96; o.height = 54;
    const g = o.getContext('2d'); g.drawImage(img, 0, 0, 96, 54);
    const d = g.getImageData(0, 0, 96, 54).data; let e = 0;
    for (let i = 4; i < d.length; i += 4) e += Math.abs(d[i] - d[i - 4]);
    return e;
  };
  const hero = frames.reduce((best, f) => (!best || detail(f) > detail(best) ? f : best), null);
  const rank = hero ? patchScores(hero, cols, rows) : [];
  const rand = rng(11);
  const cellSal = [...Array(10)].map(() => [...Array(12)].map(() => rand()));
  return [
    {
      dur: 3.8, cap: 'Long-horizon GUI agents keep every past screenshot in context, so the KV cache keeps growing',
      draw(ctx, p) {
        const n = Math.min(10, Math.floor(p * 12) + 1);
        const fw = 84, fh = 47;
        for (let i = 0; i < n; i++) {
          const a = i === n - 1 ? ease((p * 12) % 1) : 1;
          const x = 40 + i * (fw + 5), y = 110 + (1 - a) * 16;
          ctx.save(); ctx.globalAlpha *= a;
          if (frames[i]) ctx.drawImage(frames[i], x, y, fw, fh);
          strokeRR(ctx, x, y, fw, fh, 4, C.line);
          ctx.restore();
          text(ctx, `t${i + 1}`, x + fw / 2, 174, { size: 13, color: C.dim, align: 'center', font: MONO, alpha: a });
        }
        text(ctx, 'KV cache', 40, 240, { size: 20, color: C.muted });
        const full = n / 10;
        fillRR(ctx, 40, 260, 880, 34, 10, C.panel);
        const g = ctx.createLinearGradient(40, 0, 920, 0);
        g.addColorStop(0, C.amber); g.addColorStop(1, C.red);
        fillRR(ctx, 40, 260, 880 * full, 34, 10, g);
        const lbl = `${n} step${n > 1 ? 's' : ''} of screenshots`, bw = 880 * full;
        if (bw > 240) text(ctx, lbl, 40 + bw - 12, 277, { size: 17, weight: 700, color: C.bg, align: 'right' });
        else text(ctx, lbl, 52 + bw, 277, { size: 17, weight: 700, color: C.amber });
        text(ctx, 'decode speed', 40, 350, { size: 20, color: C.muted });
        const speed = 1 / (0.5 + full * 1.2);
        fillRR(ctx, 40, 370, 880, 34, 10, C.panel);
        fillRR(ctx, 40, 370, 880 * speed * 0.6, 34, 10, C.blue);
        text(ctx, 'slower and slower …', 40, 450, { size: 24, color: C.red, alpha: ease(seg(p, 0.6, 0.8)) });
      },
    },
    {
      dur: 4.2, cap: 'Spatial guidance: keep the visual tokens on UI regions that matter, drop flat background',
      draw(ctx, p) {
        const iw = 620, ih = iw * 9 / 16, ix = 40, iy = 40;
        if (hero) ctx.drawImage(hero, ix, iy, iw, ih);
        const pw = iw / cols, ph = ih / rows;
        const cut = 0.8 * ease(seg(p, 0.15, 0.7));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const k = rank[r * cols + c], x = ix + c * pw, y = iy + r * ph;
          if (k < cut) { ctx.fillStyle = 'rgba(14,16,22,0.8)'; ctx.fillRect(x, y, pw + 0.5, ph + 0.5); }
          else if (p > 0.1) { ctx.strokeStyle = 'rgba(217,70,239,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1); }
        }
        strokeRR(ctx, ix, iy, iw, ih, 6, C.line);
        const kept = Math.round((1 - cut) * 100);
        text(ctx, 'tokens kept', 700, 120, { size: 20, color: C.muted });
        text(ctx, `${kept}%`, 700, 175, { size: 64, weight: 700, color: C.accent });
        text(ctx, 'per screenshot', 700, 225, { size: 18, color: C.muted });
        text(ctx, 'buttons, text,', 700, 300, { size: 20, alpha: ease(seg(p, 0.6, 0.8)) });
        text(ctx, 'the cursor target', 700, 330, { size: 20, alpha: ease(seg(p, 0.6, 0.8)) });
      },
    },
    {
      dur: 4.2, cap: 'Trajectory guidance: the current step keeps what past steps still contribute, the rest is evicted',
      draw(ctx, p) {
        const n = 10, cw = 70, gap = 18, x0 = 60, y0 = 70, cells = 12, chh = 22;
        const thin = ease(seg(p, 0.2, 0.7));
        text(ctx, 'steps', x0, 40, { size: 18, color: C.muted });
        const kept = [];
        for (let s = 0; s < n; s++) {
          const x = x0 + s * (cw + gap);
          const recent = s >= n - 2;
          text(ctx, `t${s + 1}`, x + cw / 2, y0 - 12, { size: 14, color: s === n - 1 ? C.accent : C.dim, align: 'center', font: MONO });
          for (let k = 0; k < cells; k++) {
            const y = y0 + k * (chh + 4);
            const keepIt = recent || cellSal[s][k] > 0.62 + (1 - s / n) * 0.25;
            const on = keepIt || thin < 1 - 0.0001 && cellSal[s][k] > thin;
            const col = recent ? C.green : keepIt ? C.accent : '#3b4252';
            ctx.globalAlpha = on ? 1 : 0.12;
            fillRR(ctx, x, y, cw, chh, 5, col);
            ctx.globalAlpha = 1;
            if (keepIt && !recent) kept.push([x + cw / 2, y + chh / 2]);
          }
        }
        // Attention arcs from the current step to what it still needs.
        const cx = x0 + (n - 1) * (cw + gap) + cw / 2, a = ease(seg(p, 0.5, 0.85));
        kept.forEach(([x, y], i) => {
          if (i % 2) return;
          ctx.strokeStyle = `rgba(217,70,239,${0.35 * a})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(cx, y0 + cells * (chh + 4) + 10);
          ctx.quadraticCurveTo((cx + x) / 2, y0 + cells * (chh + 4) + 90, x, y + 10); ctx.stroke();
        });
        pill(ctx, 'recent steps', 60, 470, C.green, { size: 15 });
        pill(ctx, 'still-needed past tokens', 210, 470, C.accent, { size: 15 });
        pill(ctx, 'evicted', 450, 470, '#3b4252', { size: 15, fg: C.muted });
      },
    },
    {
      dur: 4.6, cap: 'With a 20% KV budget ST-Lite matches or beats Full Cache, with up to 2.35× faster decoding',
      draw(ctx, p) {
        // Budget ring.
        const a = ease(seg(p, 0.05, 0.4));
        ctx.lineWidth = 22;
        ctx.strokeStyle = C.panel; ctx.beginPath(); ctx.arc(180, 250, 110, 0, 7); ctx.stroke();
        ctx.strokeStyle = C.accent; ctx.beginPath(); ctx.arc(180, 250, 110, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.2 * a); ctx.stroke();
        text(ctx, `${Math.round(20 * a)}%`, 180, 240, { size: 56, weight: 700, align: 'center' });
        text(ctx, 'KV budget', 180, 290, { size: 20, color: C.muted, align: 'center' });
        // Decoding race: ST-Lite finishes 2.35x sooner.
        const race = seg(p, 0.25, 0.9);
        const lanes = [['Full Cache', 1, '#6b7280'], ['ST-Lite', 2.35, C.accent]];
        lanes.forEach(([name, speed, color], i) => {
          const y = 170 + i * 110, prog = clamp(race * speed);
          text(ctx, name, 370, y, { size: 22, weight: 600, color: i ? C.text : C.muted });
          fillRR(ctx, 370, y + 22, 540, 30, 10, C.panel);
          fillRR(ctx, 370, y + 22, Math.max(14, 540 * prog), 30, 10, color);
          const dots = Math.floor(prog * 24);
          for (let d = 0; d < dots; d++) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(378 + d * 22, y + 34, 10, 6); }
          if (prog >= 1) text(ctx, 'done ✓', 900, y, { size: 18, weight: 700, color: i ? C.green : C.muted, align: 'right' });
        });
        text(ctx, 'up to 2.35× faster decoding', 370, 420, { size: 30, weight: 700, color: C.green, alpha: ease(seg(p, 0.55, 0.7)) });
        text(ctx, 'accuracy ≥ Full Cache', 370, 462, { size: 22, color: C.text, alpha: ease(seg(p, 0.62, 0.78)) });
      },
    },
  ];
}

// ---------- GUIPruner ----------
async function guipruner() {
  const img = await loadImage('assets/media/rw_foodtruck_reference.webp');
  const cols = 32, rows = 18;
  const rank = img ? patchScores(img, cols, rows) : [];
  const keep = 1 / 3.4;
  const shot = (ctx, x, y, w, alpha = 1) => {
    ctx.save(); ctx.globalAlpha *= alpha;
    if (img) ctx.drawImage(img, x, y, w, w * 9 / 16);
    strokeRR(ctx, x, y, w, w * 9 / 16, 6, C.line);
    ctx.restore();
  };
  const grid = (ctx, x, y, w, alpha, prune = 0, glow = false) => {
    const h = w * 9 / 16, pw = w / cols, ph = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = rank[r * cols + c], px = x + c * pw, py = y + r * ph;
      if (k < prune) { ctx.fillStyle = 'rgba(14,16,22,0.85)'; ctx.fillRect(px, py, pw + 0.5, ph + 0.5); }
      else {
        ctx.strokeStyle = glow ? `rgba(217,70,239,${0.85 * alpha})` : `rgba(255,255,255,${0.3 * alpha})`;
        ctx.lineWidth = glow ? 1.2 : 0.6;
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      }
    }
  };
  return [
    {
      dur: 3.4, cap: 'A high-resolution GUI screenshot turns into a huge grid of visual tokens',
      draw(ctx, p) {
        shot(ctx, 40, 40, 620);
        grid(ctx, 40, 40, 620, ease(seg(p, 0.15, 0.5)));
        text(ctx, 'visual tokens', 700, 130, { size: 20, color: C.muted });
        text(ctx, `${Math.round(100 * ease(seg(p, 0.15, 0.6)))}%`, 700, 185, { size: 64, weight: 700 });
        text(ctx, 'every patch, every frame', 700, 235, { size: 18, color: C.muted });
      },
    },
    {
      dur: 3.8, cap: 'Temporal-adaptive resolution: history frames are kept at progressively lower resolution',
      draw(ctx, p) {
        const a = ease(seg(p, 0.05, 0.6));
        const frames = [[0.28, 't-3'], [0.38, 't-2'], [0.52, 't-1'], [1, 't (now)']];
        let x = 40;
        frames.forEach(([s, label], i) => {
          const w = lerp(300, 300 * s + (i === 3 ? 160 : 0), a), y = 280 - (w * 9 / 16) / 2;
          shot(ctx, x, y, w, i === 3 ? 1 : 0.8);
          text(ctx, label, x + w / 2, 280 + (w * 9 / 16) / 2 + 22, { size: 16, color: i === 3 ? C.accent : C.muted, align: 'center', font: MONO });
          x += w + 22;
        });
        text(ctx, 'older → lower resolution → fewer tokens', 40, 480, { size: 22, color: C.cyan, alpha: ease(seg(p, 0.55, 0.75)) });
      },
    },
    {
      dur: 4.2, cap: 'Structure-aware pruning drops flat background and keeps the tokens that carry UI structure',
      draw(ctx, p) {
        const prune = (1 - keep) * ease(seg(p, 0.1, 0.7));
        shot(ctx, 40, 40, 620);
        grid(ctx, 40, 40, 620, 1, prune, p > 0.7);
        text(ctx, 'tokens kept', 700, 130, { size: 20, color: C.muted });
        text(ctx, `${Math.round((1 - prune) * 100)}%`, 700, 185, { size: 64, weight: 700, color: C.accent });
        fillRR(ctx, 700, 225, 220, 14, 7, C.panel);
        fillRR(ctx, 700, 225, 220 * (1 - prune), 14, 7, C.accent);
      },
    },
    {
      dur: 3.6, cap: 'Training-free, with >94% of the original performance retained',
      draw(ctx, p) {
        const stats = [['3.4×', 'fewer FLOPs', C.accent], ['3.3×', 'faster vision encoding', C.cyan], ['>94%', 'performance retained', C.green]];
        stats.forEach(([v, label, color], i) => {
          const a = ease(seg(p, 0.08 + i * 0.15, 0.35 + i * 0.15));
          const x = 60 + i * 300, y = 170 + (1 - a) * 30;
          ctx.save(); ctx.globalAlpha *= a;
          fillRR(ctx, x, y, 270, 200, 18, C.panel);
          text(ctx, v, x + 135, y + 85, { size: 72, weight: 700, color, align: 'center' });
          text(ctx, label, x + 135, y + 155, { size: 20, color: C.muted, align: 'center' });
          ctx.restore();
        });
      },
    },
  ];
}

// ---------- LoopX ----------
function loopx() {
  const agents = [['Codex', C.cyan], ['Claude Code', C.amber], ['Other agents', C.blue]];
  const ledger = ['goal & plan', 'steps done: 14', 'open TODOs: 3', 'artifacts & logs'];
  const node = (ctx, x, y, label, color, on) => {
    fillRR(ctx, x - 90, y - 34, 180, 68, 16, on ? color : C.panel);
    strokeRR(ctx, x - 90, y - 34, 180, 68, 16, on ? color : C.line, 2);
    text(ctx, label, x, y, { size: 21, weight: 700, color: on ? C.bg : C.muted, align: 'center' });
  };
  const hub = (ctx, p, fill) => {
    ctx.save(); ctx.translate(480, 270); ctx.rotate(p * Math.PI * 2 * 0.25);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 4; ctx.setLineDash([18, 12]);
    ctx.beginPath(); ctx.arc(0, 0, 92, 0, 7); ctx.stroke();
    ctx.restore(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(480, 270, 78, 0, 7); ctx.fillStyle = C.panel; ctx.fill();
    text(ctx, 'LoopX', 480, 252, { size: 30, weight: 700, align: 'center', color: C.accent });
    text(ctx, 'task state', 480, 286, { size: 17, color: C.muted, align: 'center' });
    ledger.forEach((s, i) => {
      const a = clamp(fill * ledger.length - i);
      text(ctx, `• ${s}`, 700, 150 + i * 32, { size: 17, color: C.text, alpha: a, font: MONO });
    });
  };
  const pos = { Codex: [170, 150], 'Claude Code': [170, 390], 'Other agents': [790, 390], Human: [790, 70] };
  const session = (ctx, name, prog, color) => {
    const [x, y] = pos[name];
    fillRR(ctx, x - 90, y + 42, 180, 10, 5, C.panel);
    fillRR(ctx, x - 90, y + 42, 180 * prog, 10, 5, color);
  };
  const card = (ctx, from, to, t) => {
    const [x1, y1] = from, [x2, y2] = to, e = easeIO(t);
    const x = lerp(x1, x2, e), y = lerp(y1, y2, e) - Math.sin(e * Math.PI) * 40;
    fillRR(ctx, x - 44, y - 28, 88, 56, 10, C.accent);
    text(ctx, 'state', x, y, { size: 17, weight: 700, color: C.bg, align: 'center' });
  };
  const base = (ctx, p, active, fill) => {
    agents.forEach(([name, color]) => node(ctx, pos[name][0], pos[name][1], name, color, active === name));
    node(ctx, pos.Human[0], pos.Human[1], 'Human', C.green, active === 'Human');
    hub(ctx, p, fill);
  };
  return [
    {
      dur: 3.4, cap: 'Long-running work outlives any single agent session',
      draw(ctx, p) {
        base(ctx, p, 'Codex', 0);
        session(ctx, 'Codex', ease(seg(p, 0, 0.8)), C.cyan);
        if (p > 0.8) pill(ctx, 'session ends', 90, 240, C.red, { size: 15, alpha: ease(seg(p, 0.8, 0.9)) });
      },
    },
    {
      dur: 3.2, cap: 'LoopX checkpoints the task state outside the agent: plan, progress, TODOs, artifacts',
      draw(ctx, p) {
        base(ctx, p, null, ease(seg(p, 0.35, 0.95)));
        session(ctx, 'Codex', 1, C.cyan);
        if (p < 0.5) card(ctx, pos.Codex, [480, 270], seg(p, 0, 0.45));
      },
    },
    {
      dur: 3.6, cap: 'Another agent resumes from the saved state: a clean handoff instead of starting over',
      draw(ctx, p) {
        base(ctx, p, p > 0.4 ? 'Claude Code' : null, 1);
        session(ctx, 'Codex', 1, C.cyan);
        if (p < 0.45) card(ctx, [480, 270], pos['Claude Code'], seg(p, 0, 0.4));
        session(ctx, 'Claude Code', ease(seg(p, 0.45, 1)) * 0.8, C.amber);
        if (p > 0.5) pill(ctx, 'resumed at step 15', 90, 480, C.amber, { size: 15, alpha: ease(seg(p, 0.5, 0.6)) });
      },
    },
    {
      dur: 3.6, cap: 'Humans stay in the loop for review and approval, then the loop keeps moving',
      draw(ctx, p) {
        const ok = p > 0.5;
        base(ctx, p, ok ? 'Human' : null, 1);
        session(ctx, 'Codex', 1, C.cyan);
        session(ctx, 'Claude Code', 0.8, C.amber);
        if (p < 0.5) card(ctx, [480, 270], pos.Human, seg(p, 0.05, 0.45));
        if (ok) pill(ctx, 'approved ✓', 720, 130, C.green, { size: 16, alpha: ease(seg(p, 0.5, 0.6)) });
        text(ctx, 'Keep the loop moving.', 480, 505, { size: 24, weight: 600, align: 'center', color: C.accent, alpha: ease(seg(p, 0.65, 0.8)) });
      },
    },
  ];
}

// ---------- Mount ----------
const builders = { weavebench, stlite, guipruner, loopx };
document.querySelectorAll('[data-motion]').forEach(async (host) => {
  const scenes = await builders[host.dataset.motion]?.();
  if (scenes) new Player(host, scenes);
});
