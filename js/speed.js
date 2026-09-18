/* Section 6 — latency, rescaled until a human can feel it. */
import { h, $ } from './util.js';

const CYCLE_NS = 0.3;          // one tick of a ~3 GHz core

const ROWS = [
  { name: 'one clock tick', ns: 0.3, human: '1 second', tone: 'var(--accent)',
    note: 'One step of the little machine above, on a 3 GHz core. Light itself only gets about 10 cm in this time.' },
  { name: 'L1 cache', ns: 1, human: '3 seconds', tone: 'var(--accent)',
    note: 'A few tens of kilobytes sitting right beside the adder. The core barely notices the wait.' },
  { name: 'L2 cache', ns: 4, human: '13 seconds', tone: 'var(--accent)',
    note: 'Bigger, one step further away. Still on the same slice of silicon.' },
  { name: 'L3 cache', ns: 12, human: '40 seconds', tone: 'var(--amber)',
    note: 'Tens of megabytes, shared between all the cores. The last stop before leaving the chip.' },
  { name: 'main memory', ns: 80, human: '4 minutes', tone: 'var(--amber)',
    note: 'A trip off the chip and back. The core will happily run a hundred later instructions while it waits — if it can find any that do not need this answer yet.' },
  { name: 'SSD read', ns: 50_000, human: '2 days', tone: 'var(--amber)',
    note: 'Flash memory over a bus. Thousands of times slower than RAM, and still the fastest storage most machines have.' },
  { name: 'hard disk seek', ns: 5_000_000, human: '6 months', tone: 'var(--rose)',
    note: 'A physical arm swinging over a spinning platter — mechanical time inside an electronic machine.' },
  { name: 'London → New York', ns: 150_000_000, human: '16 years', tone: 'var(--rose)',
    note: 'Light in glass, there and back. No amount of engineering will shorten it; the only fix is not to ask.' },
];

const fmtReal = (ns) => (ns < 1000 ? `${ns} ns`
  : ns < 1e6 ? `${(ns / 1000).toFixed(0)} µs`
  : `${(ns / 1e6).toFixed(0)} ms`);

export function initSpeed() {
  const host = $('#latency');
  if (!host) return;

  const lo = Math.log10(CYCLE_NS);
  const hi = Math.log10(ROWS[ROWS.length - 1].ns);
  const fills = [];

  ROWS.forEach((r) => {
    const pct = Math.max(3, ((Math.log10(r.ns) - lo) / (hi - lo)) * 100);
    const fill = h('div', { class: 'lat-fill', style: `background:${r.tone}` });
    fills.push([fill, pct]);

    const row = h('div', {
      class: 'lat-row', role: 'button', tabindex: '0',
      'aria-label': `${r.name}, ${fmtReal(r.ns)}`,
    }, [
      h('span', { class: 'lat-name', text: r.name }),
      h('div', { class: 'lat-track' }, [fill]),
      h('span', { class: 'lat-human', text: r.human }),
    ]);

    const detail = h('div', { class: 'lat-detail' }, [
      h('span', { class: 'lat-real', text: `really ${fmtReal(r.ns)}  ·  ` }),
      h('span', { text: r.note }),
    ]);

    const toggle = () => {
      const open = row.classList.toggle('open');
      detail.classList.toggle('open', open);
    };
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    host.append(row, detail);
  });

  // Grow the bars once, when the panel first comes into view — with a timer as a
  // backstop, so a browser that never fires the observer still shows real data.
  let grown = false;
  const grow = () => {
    if (grown) return;
    grown = true;
    void host.offsetWidth;
    fills.forEach(([f, pct]) => { f.style.width = `${pct}%`; });
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { grow(); io.disconnect(); }
    }, { threshold: .18 });
    io.observe(host);
  }
  setTimeout(grow, 1500);
}
