/* The page shell shared by both pages: theme toggle, section highlighting in the
   nav, the reading-progress bar and the gentle reveal on scroll. */
import { $, $$ } from './util.js';

export function initTheme() {
  const root = document.documentElement;
  const btn = $('#theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('hcw-theme', next); } catch { /* private mode: fine */ }
  });
}

/**
 * Nav highlight, progress bar and reveal all derive from the scroll position,
 * recomputed on scroll, on resize and when the page becomes visible. Observers
 * alone are not enough: a hidden page delivers neither scroll events nor
 * intersection entries, so anything that only an observer can reveal would stay
 * invisible in a background tab.
 */
export function initScrollUi(revealSelector) {
  const links = new Map($$('.nav a[data-nav]').map((a) => [a.dataset.nav, a]));
  const sections = $$('main section[id]');
  const bar = $('#progress-bar');

  const targets = revealSelector ? $$(revealSelector) : [];
  const pending = new Set(targets);
  targets.forEach((t) => t.classList.add('reveal'));

  const show = (t) => { t.classList.add('shown'); pending.delete(t); };

  const sync = () => {
    const vh = window.innerHeight;

    // Anything at or above the bottom of the viewport is shown, including what a
    // fast jump skipped over, so scrolling back up never finds a blank.
    for (const t of pending) if (t.getBoundingClientRect().top < vh - 30) show(t);

    let current = null;
    for (const sec of sections) {
      if (sec.getBoundingClientRect().top <= vh * 0.45) current = sec.id;
    }
    links.forEach((a, id) => a.classList.toggle('active', id === current));

    const max = document.documentElement.scrollHeight - vh;
    if (bar) bar.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
  };

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    // A timer rather than a frame, so the update still lands if frames are scarce.
    setTimeout(() => { queued = false; sync(); }, 60);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  document.addEventListener('visibilitychange', sync);

  if ('IntersectionObserver' in window && pending.size) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.06 });
    targets.forEach((t) => io.observe(t));
  } else {
    targets.forEach(show);
  }

  sync();
}

/** Build every section immediately — never from inside an animation frame. */
export function boot(steps) {
  const run = () => steps.forEach((fn) => fn());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
}
