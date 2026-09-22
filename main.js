const navLinks = [...document.querySelectorAll('.topnav a[href^="#"]')];
const sections = [...document.querySelectorAll('main section[id]')];

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
