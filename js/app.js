/* Page shell: theme, navigation, progress, reveal — then each section's module. */
import { $, $$ } from './util.js';
import { initIntro } from './intro.js';
import { initBits } from './bits.js';
import { initGates } from './gates.js';
import { initAdder } from './adder.js';
import { initMemory } from './memory.js';
import { initCpu } from './cpu.js';
import { initSpeed } from './speed.js';
import { initTower } from './tower.js';

/* ── theme ────────────────────────────────────────────────────────────────── */
function initTheme() {
  const root = document.documentElement;
  const btn = $('#theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('hcw-theme', next); } catch { /* private mode: fine */ }
  });
}

/* ── nav highlight + reading progress ─────────────────────────────────────── */
function initNav() {
  const links = new Map($$('.nav a').map((a) => [a.dataset.nav, a]));
  const sections = $$('main section[id]');
  const bar = $('#progress-bar');

  if ('IntersectionObserver' in window) {
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
      const first = sections.find((sec) => seen.has(sec.id));
      links.forEach((a, id) => a.classList.toggle('active', !!first && id === first.id));
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((sec) => io.observe(sec));
  }

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
}

/* ── gentle reveal on scroll ──────────────────────────────────────────────── */
function initReveal() {
  const targets = $$('.section h2, .section .copy, .callout, .panel, .gate-grid, .tower, .vn, .cpu');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('shown'));
    return;
  }
  targets.forEach((t) => t.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('shown');
      io.unobserve(e.target);
    });
  }, { threshold: .06, rootMargin: '0px 0px -40px 0px' });
  targets.forEach((t) => io.observe(t));
  // Anything still unrevealed after a moment gets shown anyway.
  setTimeout(() => targets.forEach((t) => {
    if (t.getBoundingClientRect().top < window.innerHeight) t.classList.add('shown');
  }), 900);
}

/* ── boot ─────────────────────────────────────────────────────────────────── */
function boot() {
  initTheme();
  initNav();
  initIntro();
  initBits();
  initGates();
  initAdder();
  initMemory();
  initCpu();
  initSpeed();
  initTower();
  initReveal();
}

// Modules are deferred, so the document is normally parsed by now — but never
// build from inside an animation frame: a hidden tab would never deliver one.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
