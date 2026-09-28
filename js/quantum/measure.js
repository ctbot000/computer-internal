/* Section 2 — measurement: one qubit collapses; many copies make a histogram. */
import { h, $, clamp } from '../util.js';
import { State, ry } from './qsim.js';
import { blochSphere, probBar, subLabel, pct } from './viz.js';

export function initMeasure() {
  const host = $('#measure-demo');
  if (!host) return;

  let theta = 60;                 // degrees of tilt away from |0⟩
  let st = null;                  // the one qubit on the bench
  let reads = [];                 // results of looking at *this* qubit

  const sphere = blochSphere({ size: 250 });

  const slider = h('input', { type: 'range', min: 0, max: 180, step: 1, value: theta,
    'aria-label': 'Tilt of the prepared qubit, in degrees' });
  const sliderOut = h('output', { class: 'slider-val' });
  const odds = probBar();

  const digit = h('span', { class: 'm-digit', text: '?' });
  const note = h('div', { class: 'm-note' });

  const measureBtn = h('button', { class: 'btn btn-primary', type: 'button', text: 'Measure it' });
  const freshBtn = h('button', { class: 'btn', type: 'button', text: 'Prepare a fresh one' });

  const rows = [0, 1].map((b) => {
    const fill = h('div', { class: 'hist2-fill', style: `background:${b ? 'var(--q1)' : 'var(--q0)'}` });
    const exp = h('div', { class: 'hist2-exp' });
    const txt = h('span', { text: '—' });
    const el = h('div', { class: 'hist2-row' }, [h('b', { text: String(b) }),
      h('div', { class: 'hist2-track' }, [fill, exp]), txt]);
    return { el, fill, exp, txt };
  });
  const est = h('p', { class: 'm-est', text: 'Measure some fresh copies to estimate the odds.' });
  const manyBtns = h('div', { class: 'm-btns' }, [10, 100, 1000].map((n) =>
    h('button', { class: 'btn', type: 'button', text: `Measure ${n.toLocaleString()} fresh copies`,
      onclick: () => many(n) })));

  host.append(
    h('div', { class: 'bloch-holder' }, [sphere.el]),
    h('div', { class: 'm-side' }, [
      h('label', { class: 'slider-row' }, [
        h('span', { class: 'slider-label' }, [h('span', { text: 'Tilt' }), sliderOut]),
        slider,
      ]),
      odds.el,
      subLabel('Look at this one qubit'),
      h('div', { class: 'm-result' }, [digit, note]),
      h('div', { class: 'm-btns' }, [measureBtn, freshBtn]),
      subLabel('Or prepare many identical ones and count'),
      manyBtns,
      h('div', { class: 'hist2' }, rows.map((r) => r.el)),
      est,
    ]),
  );

  const p1 = () => Math.sin((theta * Math.PI) / 360) ** 2;
  const prepared = () => new State(1).apply(ry((theta * Math.PI) / 180), 0);

  function prepare() {
    st = prepared();
    reads = [];
    sliderOut.textContent = `${theta}°`;
    odds.set(p1());
    digit.textContent = '?';
    digit.className = 'm-digit';
    note.textContent = `A fresh qubit: ${pct(1 - p1())} chance of reading 0, ${pct(p1())} of reading 1. Nobody can see the arrow — only these odds.`;
    measureBtn.textContent = 'Measure it';
    sphere.set(st.bloch(0));
    rows.forEach((r, b) => { r.exp.style.left = `calc(${(b ? p1() : 1 - p1()) * 100}% - 1px)`; });
  }

  function measure() {
    const from = st.bloch(0);
    const bit = st.measure(0);
    reads.push(bit);
    digit.textContent = String(bit);
    digit.className = `m-digit is${bit}`;
    if (reads.length === 1) {
      note.textContent = `It read ${bit}. The qubit is now exactly |${bit}⟩ — the rest of the state is gone. Measure it again.`;
    } else {
      note.textContent = `${reads.join(', ')} — the same answer every time. Once collapsed, there is nothing left to be random about.`;
    }
    measureBtn.textContent = 'Measure it again';
    sphere.swing(from, [0, 0, bit ? -1 : 1], 380);
  }

  function many(n) {
    const src = prepared();
    let ones = 0;
    for (let i = 0; i < n; i++) ones += src.sample();
    const counts = [n - ones, ones];
    rows.forEach((r, b) => {
      r.fill.style.width = `${(counts[b] / n) * 100}%`;
      r.txt.textContent = counts[b].toLocaleString();
    });
    const phat = ones / n;
    const se = Math.sqrt(Math.max(phat * (1 - phat), 1e-12) / n);
    est.innerHTML = `Estimated chance of 1: <b>${phat.toFixed(3)} ± ${se.toFixed(3)}</b> from ${n.toLocaleString()} copies. `
      + `The true value is <b>${p1().toFixed(3)}</b>.`;
  }

  slider.addEventListener('input', () => {
    theta = clamp(Number(slider.value), 0, 180);
    prepare();
  });
  measureBtn.addEventListener('click', measure);
  freshBtn.addEventListener('click', prepare);

  prepare();
}
