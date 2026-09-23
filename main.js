const root = document.documentElement;
const navLinks = [...document.querySelectorAll('.navbar-links a[href^="#"]')];
const bar = document.querySelector('.progress span');

document.querySelector('.theme-toggle')?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('theme', next);
});

// Toggle each publication's abstract, like al-folio's "ABS" button.
document.querySelectorAll('.btn.abs').forEach((button) => {
  const abstract = button.closest('.col-entry')?.querySelector('.abstract');
  if (!abstract) return;
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => {
    const open = abstract.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
  });
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
