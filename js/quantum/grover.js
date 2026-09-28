/* Section 6 — Grover's search, one oracle and one diffusion at a time. */
import { h, s, svgRoot, $ } from '../util.js';
import { groverProb, groverBest } from './qsim.js';
import { pct } from './viz.js';

const SIZES = [4, 8, 16, 32, 64];

export function initGrover() {
  const host = $('#grover');
  if (!host) return;

  let N = 8;
  let marked = 5;
  let amps = [];
  let k = 0;
  let phase = 'ready';       // 'ready' → oracle next; 'oracled' → diffusion next
  let busy = false;

  const oracleBtn = h('button', { class: 'btn', type: 'button', text: '1 · Oracle' });
  const diffBtn = h('button', { class: 'btn', type: 'button', text: '2 · Diffuse' });
  const roundBtn = h('button', { class: 'btn btn-primary', type: 'button', text: 'One full round' });
  const bestBtn = h('button', { class: 'btn btn-accent', type: 'button', text: 'Run to the best' });
  const resetBtn = h('button', { class: 'btn', type: 'button', text: 'Reset' });
  const roundOut = h('div', { class: 'gv-k' });

  const barsEl = h('div', { class: 'gv-bars' });
  const axis = h('div', { class: 'gv-axis' });
  const meanLabel = h('span', { text: 'average' });
  const mean = h('div', { class: 'gv-mean' }, [meanLabel]);
  const stage = h('div', { class: 'gv-stage' }, [barsEl]);
  const say = h('p', { class: 'gv-say' });

  const stat = (label) => { const b = h('b', {}); return { el: h('div', { class: 'stat' }, [h('span', { text: label }), b]), b }; };
  const sP = stat('Chance of the prize now');
  const sBest = stat('Best possible');
  const sClassic = stat('Classical guesses, on average');
  const sQuantum = stat('Grover rounds needed');

  const W = 380, H = 176, px0 = 34, px1 = W - 12, py0 = 24, py1 = 134;
  const chart = svgRoot(W, H, { role: 'img', 'aria-label': 'Chance of finding the prize after each round' });
  const chartG = s('g', {});
  chart.appendChild(chartG);

  host.append(
    h('div', { class: 'gv-top' }, [h('div', { class: 'gv-btns' }, [oracleBtn, diffBtn, roundBtn, bestBtn, resetBtn]), roundOut]),
    stage,
    say,
    h('div', { class: 'gv-lower' }, [
      h('div', { class: 'gv-stats' }, [sP.el, sBest.el, sClassic.el, sQuantum.el]),
      h('div', { class: 'fig' }, [h('h5', { text: 'Chance of the prize after each round' }), chart]),
    ]),
  );

  const nHost = $('#grover-n');
  const nBtns = SIZES.map((v) => {
    const b = h('button', { class: 'chip-btn', type: 'button', text: `${v} boxes` });
    b.addEventListener('click', () => { if (busy) return; N = v; marked = Math.min(marked, N - 1); build(); });
    return b;
  });
  nHost?.append(...nBtns);

  function build() {
    barsEl.replaceChildren();
    for (let i = 0; i < N; i++) {
      const bar = h('div', { class: 'gv-bar', title: `Box ${i}: click to hide the prize here`,
        role: 'button', tabindex: '0', 'aria-label': `Box ${i}` }, [h('i', {})]);
      const pick = () => { if (busy) return; marked = i; reset(); };
      bar.addEventListener('click', pick);
      bar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
      barsEl.appendChild(bar);
    }
    barsEl.append(axis, mean);
    nBtns.forEach((b, j) => b.classList.toggle('on', SIZES[j] === N));
    reset();
  }

  function reset() {
    amps = new Array(N).fill(1 / Math.sqrt(N));
    k = 0;
    phase = 'ready';
    paint();
  }

  const avg = () => amps.reduce((a, v) => a + v, 0) / N;

  function oracle() { amps[marked] = -amps[marked]; phase = 'oracled'; paint(); }
  function diffuse() {
    const m = avg();
    amps = amps.map((v) => 2 * m - v);
    k++;
    phase = 'ready';
    paint();
  }

  function paint() {
    const best = groverBest(N);
    [...barsEl.querySelectorAll('.gv-bar')].forEach((bar, i) => {
      const a = amps[i];
      const i0 = bar.firstChild;
      i0.style.top = `${a >= 0 ? 50 - 50 * a : 50}%`;
      i0.style.height = `${Math.max(0.4, 50 * Math.abs(a))}%`;
      bar.classList.toggle('neg', a < 0);
      bar.classList.toggle('mark', i === marked);
      bar.setAttribute('aria-label', `Box ${i}${i === marked ? ', the prize' : ''}: amplitude ${a.toFixed(3)}`);
    });
    const m = avg();
    mean.style.top = `${50 - 50 * m}%`;

    const p = amps[marked] ** 2;
    roundOut.innerHTML = `round <b>${k}</b>`;
    sP.b.textContent = pct(p, 1);
    sBest.b.textContent = `${pct(groverProb(N, best), 1)} after ${best} round${best === 1 ? '' : 's'}`;
    sClassic.b.textContent = `${((N + 1) / 2).toLocaleString()}`;
    sQuantum.b.textContent = `${best}  (≈ π/4 · √${N})`;

    if (phase === 'oracled') {
      say.innerHTML = 'The oracle flipped the prize below zero. It is <b>marked but not revealed</b>: every box still has exactly the same chance of being read. The dashed line is the average — now diffuse.';
    } else if (k === 0) {
      say.innerHTML = `All ${N} boxes start equal: amplitude 1/√${N} ≈ ${(1 / Math.sqrt(N)).toFixed(3)}, a ${pct(1 / N, 1)} chance each. Step 1 is the oracle.`;
    } else {
      let tail = '';
      if (k === best) tail = ' <b>That is the best this size allows: measure now.</b>';
      else if (k > best) tail = ' <b>One round too many:</b> the prize has swung past its peak and is shrinking again.';
      say.innerHTML = `Every bar was mirrored about the average, so the prize — far below it — bounced far above. After ${k} round${k === 1 ? '' : 's'}: <b>${pct(p, 1)}</b> chance of reading the prize.${tail}`;
    }

    oracleBtn.disabled = busy || phase !== 'ready';
    diffBtn.disabled = busy || phase !== 'oracled';
    roundBtn.disabled = busy;
    bestBtn.disabled = busy || k >= best;
    resetBtn.disabled = busy;
    drawChart();
  }

  function drawChart() {
    const best = groverBest(N);
    const kmax = Math.max(4, 2 * best + 2);
    const X = (x) => px0 + (x / kmax) * (px1 - px0);
    const Y = (p) => py1 - p * (py1 - py0);
    const theta = Math.asin(1 / Math.sqrt(N));
    let d = '';
    for (let i = 0; i <= 200; i++) {
      const x = (i / 200) * kmax;
      d += `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(Math.sin((2 * x + 1) * theta) ** 2).toFixed(1)}`;
    }
    const text = (x, y, t, anchor = 'middle', fill = 'var(--dimmer)') => s('text', {
      x, y, 'text-anchor': anchor, 'font-size': 10, 'font-family': 'var(--mono)', fill, text: t });
    const kids = [
      s('line', { x1: px0, y1: py1, x2: px1, y2: py1, stroke: 'var(--line)' }),
      s('line', { x1: px0, y1: py0, x2: px0, y2: py1, stroke: 'var(--line)' }),
      s('line', { x1: X(best), y1: py0, x2: X(best), y2: py1, stroke: 'var(--violet)', 'stroke-dasharray': '4 4', opacity: 0.7 }),
      text(X(best), py0 - 10, 'best', 'middle', 'var(--violet)'),
      text(px0 - 5, Y(1) + 4, '100%', 'end'), text(px0 - 5, Y(0) + 4, '0', 'end'),
      text((px0 + px1) / 2, H - 6, 'rounds'),
      s('path', { d, fill: 'none', stroke: 'var(--line)', 'stroke-width': 1.5 }),
    ];
    for (let j = 0; j <= kmax; j++) {
      const on = j === k;
      kids.push(s('circle', { cx: X(j), cy: Y(groverProb(N, j)), r: on ? 6 : 3.5,
        fill: on ? 'var(--amber)' : 'var(--accent)', stroke: on ? 'var(--surface)' : 'none', 'stroke-width': 2 }));
      kids.push(text(X(j), py1 + 14, String(j)));
    }
    chartG.replaceChildren(...kids);
  }

  // Rounds that run on their own pause between moves so the eye can follow them.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function round() {
    if (phase === 'ready') { oracle(); await wait(650); }
    diffuse();
  }
  async function auto(fn) {
    if (busy) return;
    busy = true;
    paint();
    try { await fn(); } finally { busy = false; paint(); }
  }

  oracleBtn.addEventListener('click', () => { if (!busy && phase === 'ready') oracle(); });
  diffBtn.addEventListener('click', () => { if (!busy && phase === 'oracled') diffuse(); });
  roundBtn.addEventListener('click', () => auto(round));
  bestBtn.addEventListener('click', () => auto(async () => {
    const best = groverBest(N);
    while (k < best) { await round(); if (k < best) await wait(700); }
  }));
  resetBtn.addEventListener('click', () => { if (!busy) reset(); });

  build();
}
