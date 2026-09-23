const root = document.documentElement;
const topbar = document.querySelector('.topbar');
const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
const sections = [...document.querySelectorAll('main section[id]')];

// Theme toggle: explicit choice persists; otherwise follow the OS.
document.querySelector('.theme-toggle')?.addEventListener('click', () => {
  const current = root.dataset.theme
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('theme', next);
});

const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 240);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const observer = new IntersectionObserver(
  (entries) => {
    const active = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!active) return;

    navLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === `#${active.target.id}`);
    });
  },
  { rootMargin: '-18% 0px -68%', threshold: [0, 0.2, 0.5] },
);

sections.forEach((section) => observer.observe(section));

// Fade sections in as they enter the viewport.
const revealer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealer.unobserve(entry.target);
      }
    });
  },
  { rootMargin: '0px 0px -8%' },
);
document.querySelectorAll('.block').forEach((el) => {
  el.classList.add('reveal');
  revealer.observe(el);
});

const loopxStats = document.querySelector('[data-loopx-stat="stars"]');
if (loopxStats) {
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
}
