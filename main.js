const root = document.documentElement;
const navLinks = [...document.querySelectorAll('.navbar-links a[href^="#"]')];
const bar = document.querySelector('.progress span');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelector('.theme-toggle')?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('theme', next);
});

// Scroll progress bar and active nav link.
const targets = navLinks
  .map((link) => [link, document.querySelector(link.getAttribute('href'))])
  .filter(([, el]) => el);
const onScroll = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (bar) bar.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
  let current = targets[0];
  for (const entry of targets) {
    if (entry[1].getBoundingClientRect().top < window.innerHeight * 0.3) current = entry;
  }
  navLinks.forEach((link) => link.classList.toggle('active', current && link === current[0]));
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Typing line under the name.
const typed = document.querySelector('.typed');
if (typed && !reduceMotion) {
  const words = typed.dataset.words.split('|');
  let w = 0, n = words[0].length, deleting = false;
  const step = () => {
    const word = words[w];
    n += deleting ? -1 : 1;
    typed.textContent = word.slice(0, n);
    let delay = deleting ? 45 : 85;
    if (!deleting && n === word.length) { deleting = true; delay = 1600; }
    else if (deleting && n === 0) { deleting = false; w = (w + 1) % words.length; delay = 300; }
    setTimeout(step, delay);
  };
  setTimeout(() => { deleting = true; step(); }, 1800);
}

// Reveal timeline and publication rows when they scroll into view.
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealer.unobserve(entry.target);
    }
  });
}, { rootMargin: '0px 0px -10%' });
document.querySelectorAll('[data-timeline]').forEach((el) => revealer.observe(el));
document.querySelectorAll('.bibliography > li, .project, .cv li').forEach((el) => {
  el.classList.add('reveal');
  revealer.observe(el);
});

// Run a callback only while an element is on screen.
const whenVisible = (el, onShow, onHide) => {
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? onShow() : onHide()), { threshold: 0.25 }).observe(el);
};

// RecreationWorld: original vs. recreation, auto-sweeping and draggable.
document.querySelectorAll('[data-compare]').forEach((box) => {
  const frame = box.closest('.media-frame');
  const ref = box.querySelector('.cmp-ref');
  const rec = box.querySelector('.cmp-rec img');
  const caption = frame.querySelector('[data-compare-caption]');
  const tabs = [...frame.querySelectorAll('[data-compare-tabs] button')];
  let pos = 50, t0 = performance.now(), dragging = false, visible = false, raf = 0, tab = 0, lastSwap = performance.now();
  const set = (p) => { pos = Math.max(0, Math.min(100, p)); box.style.setProperty('--pos', `${pos}%`); };
  const choose = (i) => {
    tab = i;
    const b = tabs[i];
    tabs.forEach((x) => x.classList.toggle('on', x === b));
    ref.src = `assets/media/rw_${b.dataset.key}_reference.webp`;
    rec.src = `assets/media/rw_${b.dataset.key}_recreation.webp`;
    caption.textContent = b.dataset.caption;
    lastSwap = performance.now();
  };
  tabs.forEach((b, i) => b.addEventListener('click', () => { choose(i); t0 = performance.now(); }));
  const loop = (now) => {
    if (!dragging) set(50 + 38 * Math.sin((now - t0) / 1100));
    if (!dragging && now - lastSwap > 7000) choose((tab + 1) % tabs.length);
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  const fromEvent = (e) => { const r = box.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
  box.addEventListener('pointerdown', (e) => { dragging = true; box.setPointerCapture(e.pointerId); fromEvent(e); });
  box.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
  box.addEventListener('pointerup', () => { dragging = false; t0 = performance.now() - Math.asin((pos - 50) / 38 || 0) * 1100; lastSwap = performance.now(); });
  if (reduceMotion) return;
  whenVisible(box, () => { visible = true; if (!raf) raf = requestAnimationFrame(loop); }, () => { visible = false; });
});

// WeaveBench: real agent rollouts, switchable, playing only while visible.
document.querySelectorAll('[data-demo]').forEach((video) => {
  const frame = video.closest('.media-frame');
  const caption = frame.querySelector('[data-demo-caption]');
  const tabs = [...frame.querySelectorAll('[data-demo-tabs] button')];
  let visible = false;
  tabs.forEach((b) => b.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.toggle('on', x === b));
    video.poster = `assets/media/${b.dataset.src}.jpg`;
    video.src = `assets/media/${b.dataset.src}.mp4`;
    caption.textContent = b.dataset.caption;
    if (visible) video.play().catch(() => {});
  }));
  video.addEventListener('ended', () => {
    const i = tabs.findIndex((b) => b.classList.contains('on'));
    tabs[(i + 1) % tabs.length].click();
  });
  video.loop = false;
  if (reduceMotion) { video.controls = true; return; }
  whenVisible(video, () => { visible = true; video.play().catch(() => {}); }, () => { visible = false; video.pause(); });
});

// ---------- Canvas illustrations (ST-Lite, GUIPruner) ----------
const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const THEME = '#d946ef';
const GREEN = '#34d399';
const FONT = '500 13px Roboto, sans-serif';

function setupCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = 480, H = 360;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, W, H };
}

function runCanvas(canvas, draw, period) {
  let visible = false, raf = 0, start = performance.now();
  const frame = (now) => {
    draw(((now - start) % period) / 1000);
    raf = visible ? requestAnimationFrame(frame) : 0;
  };
  if (reduceMotion) { draw(period / 1000 * 0.6); return; }
  whenVisible(canvas, () => { visible = true; if (!raf) raf = requestAnimationFrame(frame); }, () => { visible = false; });
}

// GUIPruner: temporal-adaptive resolution + structure-aware token pruning.
async function pruner(canvas) {
  const { ctx, W, H } = setupCanvas(canvas);
  const img = await loadImage('assets/media/rw_foodtruck_reference.webp');
  if (!img) return;
  const cols = 32, rows = 18;
  const sx = 16, sy = 34, sw = W - 32, sh = sw * 9 / 16;
  const pw = sw / cols, ph = sh / rows;
  // Per-patch detail score from pixel variance: flat background is pruned first.
  const off = document.createElement('canvas');
  off.width = cols * 8; off.height = rows * 8;
  const octx = off.getContext('2d');
  octx.drawImage(img, 0, 0, off.width, off.height);
  const px = octx.getImageData(0, 0, off.width, off.height).data;
  const score = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let s = 0, s2 = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const i = ((r * 8 + y) * off.width + c * 8 + x) * 4;
      const v = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
      s += v; s2 += v * v;
    }
    score.push({ i: r * cols + c, v: s2 / 64 - (s / 64) ** 2 });
  }
  const order = [...score].sort((a, b) => a.v - b.v).map((o) => o.i);
  const rank = new Array(cols * rows);
  order.forEach((idx, k) => { rank[idx] = k / order.length; });
  const keep = 1 / 3.4;

  runCanvas(canvas, (t) => {
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, W, H);
    ctx.font = FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('high-resolution GUI screenshot → visual tokens', 16, 22);
    ctx.drawImage(img, sx, sy, sw, sh);

    const grid = ease(t / 0.8);
    const prune = ease((t - 1.6) / 2.4) * (1 - keep);
    const hold = t > 4.2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const x = sx + c * pw, y = sy + r * ph;
      const pruned = rank[idx] < prune;
      if (pruned) {
        ctx.fillStyle = 'rgba(15,17,21,0.82)';
        ctx.fillRect(x, y, pw + 0.5, ph + 0.5);
      } else if (grid > 0) {
        ctx.strokeStyle = hold ? `rgba(217,70,239,${0.75 * grid})` : `rgba(255,255,255,${0.28 * grid})`;
        ctx.lineWidth = hold ? 1 : 0.5;
        ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
      }
    }

    // Temporal strip: history frames at lower resolution, current frame at full.
    const ty = sy + sh + 14;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('history', 16, ty + 12);
    const sizes = [30, 38, 48];
    let x = 66;
    sizes.forEach((w, k) => {
      const h = w * 9 / 16;
      ctx.globalAlpha = 0.35 + 0.2 * k;
      ctx.drawImage(img, x, ty + 40 - h, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.strokeRect(x, ty + 40 - h, w, h);
      x += w + 8;
    });
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText("↓ lower res", 66, ty + 58);

    // Token budget bar and headline numbers.
    const bx = 212, bw = W - bx - 16, by = ty + 4;
    const ratio = 1 - prune;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = THEME;
    ctx.fillRect(bx, by, bw * ratio, 10);
    ctx.fillStyle = '#fff';
    ctx.fillText(`tokens kept ${Math.round(ratio * 100)}%`, bx, by + 30);
    ctx.globalAlpha = ease((t - 4.2) / 0.6);
    ctx.fillStyle = GREEN;
    ctx.font = '700 15px Roboto, sans-serif';
    ctx.fillText('3.4× fewer FLOPs', bx, by + 54);
    ctx.font = FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(">94% perf. kept", bx + 134, by + 54);
    ctx.globalAlpha = 1;
  }, 8000);
}

// ST-Lite: spatio-trajectory guided KV cache compression over a long rollout.
async function stlite(canvas) {
  const { ctx, W, H } = setupCanvas(canvas);
  const frames = (await Promise.all([...Array(10).keys()].map((i) => loadImage(`assets/media/traj/g${i}.jpg`)))).filter(Boolean);
  if (!frames.length) return;
  const steps = frames.length, cells = 14, budget = 0.2;
  const rand = rng(7);
  // Per step, rank tokens by a pseudo saliency; UI-relevant tokens survive longer.
  const sal = [...Array(steps)].map(() => [...Array(cells)].map(() => rand()));

  runCanvas(canvas, (t) => {
    const cur = Math.min(steps, Math.floor(t / 0.55) + 1);
    const grow = Math.min(1, (t % 0.55) / 0.35);
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, W, H);
    ctx.font = FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`long-horizon GUI trajectory · step ${cur}/${steps}`, 16, 22);

    // Trajectory thumbnails.
    const tw = (W - 32 - (steps - 1) * 4) / steps, th = tw * 9 / 16;
    for (let s = 0; s < cur; s++) {
      const x = 16 + s * (tw + 4), a = s === cur - 1 ? grow : 1;
      ctx.globalAlpha = a * (s >= cur - 2 ? 1 : 0.55);
      ctx.drawImage(frames[s], x, 34, tw, th);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = s === cur - 1 ? THEME : 'rgba(255,255,255,0.2)';
      ctx.strokeRect(x + 0.5, 34.5, tw - 1, th - 1);
    }

    // KV cache grid: every step appends tokens; ST-Lite keeps a 20% budget.
    const gy = 34 + th + 26, ch = 9, cw = tw;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('KV cache', 16, gy - 8);
    const keepTotal = Math.max(1, Math.round(cur * cells * budget));
    // Recent steps get a larger share (trajectory), the rest by saliency (spatial).
    const scored = [];
    for (let s = 0; s < cur; s++) for (let k = 0; k < cells; k++) {
      scored.push({ s, k, v: sal[s][k] + (s >= cur - 2 ? 0.35 : 0) + (s / cur) * 0.15 });
    }
    scored.sort((a, b) => b.v - a.v);
    const kept = new Set(scored.slice(0, keepTotal).map((o) => `${o.s}:${o.k}`));
    for (let s = 0; s < cur; s++) for (let k = 0; k < cells; k++) {
      const x = 16 + s * (tw + 4), y = gy + k * (ch + 2);
      const on = kept.has(`${s}:${k}`);
      ctx.globalAlpha = s === cur - 1 ? grow : 1;
      ctx.fillStyle = on ? (s >= cur - 2 ? GREEN : THEME) : 'rgba(255,255,255,0.07)';
      ctx.fillRect(x, y, cw, ch);
      ctx.globalAlpha = 1;
    }

    // Memory bars: full cache vs. ST-Lite.
    const by = gy + cells * (ch + 2) + 14, bw = W - 150;
    const full = cur / steps;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Full cache', 16, by + 9);
    ctx.fillText('ST-Lite', 16, by + 31);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(100, by, bw, 10);
    ctx.fillRect(100, by + 22, bw, 10);
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(100, by, bw * full, 10);
    ctx.fillStyle = THEME;
    ctx.fillRect(100, by + 22, bw * full * budget, 10);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.round(full * 100)}%`, 106 + bw * full, by + 9);
    ctx.fillText('20%', 106 + bw * full * budget, by + 31);

    ctx.globalAlpha = cur === steps ? ease((t - steps * 0.55) / 0.5) : 0;
    ctx.font = '700 15px Roboto, sans-serif';
    ctx.fillStyle = GREEN;
    ctx.fillText('up to 2.35× faster decoding', 16, H - 12);
    ctx.font = FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('≥ Full-Cache accuracy', 236, H - 12);
    ctx.globalAlpha = 1;
  }, 9000);
}

const anims = { pruner, stlite };
document.querySelectorAll('canvas[data-anim]').forEach((c) => anims[c.dataset.anim]?.(c));

fetch('https://api.github.com/repos/loopx-project/loopx')
  .then((response) => response.ok ? response.json() : Promise.reject(response))
  .then((repo) => {
    for (const [stat, count] of Object.entries({ stars: repo.stargazers_count, forks: repo.forks_count })) {
      const element = document.querySelector(`[data-loopx-stat="${stat}"]`);
      if (element && Number.isInteger(count) && count >= 0) {
        element.textContent = count.toLocaleString('en-US');
      }
    }
  })
  .catch(() => {});
