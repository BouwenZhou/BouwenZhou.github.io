// Typed agent trace in the hero terminal.
const lines = [
  ['p', '$ uda run "reproduce the chart and email it to the team"'],
  ['d', '  observe   screenshot 2560×1440 · 142 UI elements'],
  ['d', '  plan      open data.csv → plot → export → compose mail'],
  ['o', '  gui       click  ▸ Files / data.csv'],
  ['o', '  cli       python plot.py --out chart.png'],
  ['o', '  code      fix: ax.set_ylim(0, None)'],
  ['o', '  gui       attach chart.png ▸ Send'],
  ['s', '  ✓ task complete · 23 steps · verified'],
];
const term = document.getElementById('term');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (term) {
  const render = (upto, partial) => {
    term.innerHTML = lines.slice(0, upto).map(([k, t]) => `<span class="t-${k}">${t}</span>`).join('\n')
      + (partial ? `${upto ? '\n' : ''}<span class="t-${lines[upto][0]}">${partial}</span>` : '')
      + '<span class="caret"></span>';
  };
  if (reduce) render(lines.length);
  else {
    let i = 0, j = 0;
    const tick = () => {
      if (i >= lines.length) { setTimeout(() => { i = 0; j = 0; tick(); }, 4200); return; }
      const text = lines[i][1];
      const step = lines[i][0] === 'p' ? 1 : 4;
      j = Math.min(text.length, j + step);
      render(i, text.slice(0, j));
      if (j >= text.length) { i += 1; j = 0; render(i); setTimeout(tick, lines[i - 1][0] === 'p' ? 500 : 260); }
      else setTimeout(tick, lines[i][0] === 'p' ? 38 : 12);
    };
    tick();
  }
}

// Reveal on scroll.
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -6%' });
document.querySelectorAll('.sec, .paper, .stat').forEach((el) => { el.classList.add('rise'); io.observe(el); });

// Pointer glow on cards.
document.querySelectorAll('.paper, .loopx, .glass').forEach((el) => {
  el.addEventListener('pointermove', (ev) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${ev.clientX - r.left}px`);
    el.style.setProperty('--my', `${ev.clientY - r.top}px`);
  });
});

fetch('https://api.github.com/repos/loopx-project/loopx')
  .then((r) => r.ok ? r.json() : Promise.reject(r))
  .then((repo) => {
    const set = (k, v) => document.querySelectorAll(`[data-loopx-stat="${k}"]`).forEach((el) => { el.textContent = v; });
    if (Number.isInteger(repo.stargazers_count)) {
      set('stars', repo.stargazers_count.toLocaleString('en-US'));
      set('stars-short', (repo.stargazers_count / 1000).toFixed(1) + 'k');
    }
    if (Number.isInteger(repo.forks_count)) set('forks', repo.forks_count.toLocaleString('en-US'));
  })
  .catch(() => {});
