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
