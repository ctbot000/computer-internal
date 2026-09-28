/* Section 4 — entanglement: build a Bell pair gate by gate, measure it, and see
   what it costs a classical computer to keep track of many qubits. */
import { h, s, svgRoot, $, clamp } from '../util.js';
import { State, GATE } from './qsim.js';
import { circleSet, miniSphere, subLabel, pct } from './viz.js';

const NAMES = [
  [[0, 0, 1], '|0⟩'], [[0, 0, -1], '|1⟩'], [[1, 0, 0], '|+⟩'],
  [[-1, 0, 0], '|−⟩'], [[0, 1, 0], '|+i⟩'], [[0, -1, 0], '|−i⟩'],
];
const nameOf = (v) => {
  const hit = NAMES.find(([w]) => Math.hypot(v[0] - w[0], v[1] - w[1], v[2] - w[2]) < 1e-6);
  return hit ? hit[1] : 'a superposition';
};

/* ── the two-gate circuit with switchable gates ──────────────────────────── */
function bellCircuit(onChange) {
  const W = 340, H = 132, y0 = 42, y1 = 98, xh = 132, xc = 226;
  const svg = svgRoot(W, H, { role: 'group', 'aria-label': 'Two-qubit circuit' });
  const text = (x, y, t, fill = 'var(--dim)', size = 12, anchor = 'start') => s('text', {
    x, y, 'text-anchor': anchor, 'font-size': size, 'font-family': 'var(--mono)', fill, text: t });

  svg.append(
    text(8, y0 + 4, 'q0'), text(34, y0 + 4, '|0⟩', 'var(--violet)'),
    text(8, y1 + 4, 'q1'), text(34, y1 + 4, '|0⟩', 'var(--violet)'),
    s('line', { x1: 66, y1: y0, x2: W - 14, y2: y0, stroke: 'var(--line)', 'stroke-width': 2 }),
    s('line', { x1: 66, y1: y1, x2: W - 14, y2: y1, stroke: 'var(--line)', 'stroke-width': 2 }),
  );

  const on = { h: true, cx: true };

  const toggle = (key, g, label) => {
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', label);
    g.style.cursor = 'pointer';
    const flip = () => { on[key] = !on[key]; paint(); onChange(on); };
    g.addEventListener('click', flip);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
  };

  // H on q0
  const hG = s('g', {});
  const hBox = s('rect', { x: xh - 18, y: y0 - 18, width: 36, height: 36, rx: 7, 'stroke-width': 2 });
  const hTxt = text(xh, y0 + 5, 'H', 'var(--text)', 15, 'middle');
  hTxt.setAttribute('font-weight', '700');
  hG.append(s('rect', { x: xh - 26, y: y0 - 26, width: 52, height: 52, fill: 'transparent' }), hBox, hTxt);
  toggle('h', hG, 'Hadamard gate on q0: click to switch on or off');

  // CNOT from q0 to q1
  const cG = s('g', {});
  const cLine = s('line', { x1: xc, y1: y0, x2: xc, y2: y1 + 14, 'stroke-width': 2 });
  const cDot = s('circle', { cx: xc, cy: y0, r: 6.5 });
  const cT = s('circle', { cx: xc, cy: y1, r: 14, fill: 'var(--surface)', 'stroke-width': 2 });
  const cPlus = s('path', { d: `M${xc - 14} ${y1} H${xc + 14} M${xc} ${y1 - 14} V${y1 + 14}`, 'stroke-width': 2 });
  cG.append(s('rect', { x: xc - 24, y: y0 - 20, width: 48, height: y1 - y0 + 40, fill: 'transparent' }), cLine, cDot, cT, cPlus);
  toggle('cx', cG, 'Controlled-NOT from q0 to q1: click to switch on or off');

  const hint = text(W / 2, H - 6, 'click a gate to switch it off and on', 'var(--dimmer)', 10, 'middle');
  svg.append(hG, cG, hint);

  function paint() {
    const onC = 'var(--violet)', offC = 'var(--dimmer)';
    hBox.style.fill = on.h ? 'color-mix(in srgb, var(--violet) 16%, var(--surface))' : 'var(--surface)';
    hBox.style.stroke = on.h ? onC : offC;
    hBox.style.strokeDasharray = on.h ? '' : '4 4';
    hTxt.style.fill = on.h ? 'var(--text)' : offC;
    hG.setAttribute('aria-pressed', String(on.h));
    [cLine, cPlus, cT].forEach((n) => { n.style.stroke = on.cx ? onC : offC; });
    cDot.style.fill = on.cx ? onC : offC;
    cLine.style.strokeDasharray = on.cx ? '' : '4 4';
    cG.setAttribute('aria-pressed', String(on.cx));
  }
  paint();
  return { el: svg, on };
}

export function initEntangle() {
  const host = $('#ent');
  if (!host) return;

  const st = new State(2);
  const circles = circleSet(2);
  const m0 = miniSphere('q0');
  const m1 = miniSphere('q1');
  const verdict = h('div', { class: 'ent-verdict' });
  const meterFill = h('span', {});
  const meterTxt = h('span', { class: 'sub-label' });
  const circuit = bellCircuit(update);

  const cells = [];
  const corr = h('div', { class: 'corr' });
  corr.append(h('span', { class: 'h' }), h('span', { class: 'h', text: 'q1 = 0' }), h('span', { class: 'h', text: 'q1 = 1' }));
  for (const a of [0, 1]) {
    corr.append(h('span', { class: 'h', text: `q0 = ${a}` }));
    for (const b of [0, 1]) {
      const c = h('span', { text: '—' });
      cells[a * 2 + b] = c;
      corr.append(c);
    }
  }
  const last = h('p', { class: 'm-est', text: 'Nothing measured yet.' });

  const once = h('button', { class: 'btn btn-primary', type: 'button', text: 'Measure both' });
  const many = h('button', { class: 'btn', type: 'button', text: 'Measure 1,000 fresh pairs' });

  host.append(
    h('div', { class: 'ent-left' }, [
      circuit.el,
      subLabel('Each qubit on its own'),
      h('div', { class: 'minis' }, [m0.el, m1.el]),
      verdict,
      h('div', {}, [meterTxt, h('div', { class: 'meter' }, [meterFill])]),
    ]),
    h('div', { class: 'ent-right' }, [
      subLabel('All four amplitudes'), circles.el,
      subLabel('Measure them'),
      h('div', { class: 'm-btns' }, [once, many]),
      last,
      corr,
    ]),
  );

  function build() {
    st.reset();
    if (circuit.on.h) st.apply(GATE.H, 0);
    if (circuit.on.cx) st.apply(GATE.X, 1, [0]);
  }

  function update() {
    build();
    circles.set(st);
    const b0 = st.bloch(0), b1 = st.bloch(1);
    m0.set(b0);
    m1.set(b1);
    const c = st.concurrence();
    meterFill.style.width = `${c * 100}%`;
    meterTxt.textContent = `Entanglement: ${pct(c)}`;
    const tangled = c > 0.99;
    verdict.classList.toggle('tangled', tangled);
    verdict.innerHTML = tangled
      ? '<b>Entangled.</b> The state is (|00⟩ + |11⟩)/√2: both 0 or both 1, never one of each. Neither qubit has a state of its own — both arrows have shrunk to nothing.'
      : `<b>Not entangled.</b> This is simply q0 = ${nameOf(b0)} next to q1 = ${nameOf(b1)}. Each can be described on its own.`;
    cells.forEach((cl) => { cl.textContent = '—'; cl.classList.remove('hot'); });
    last.textContent = 'Nothing measured yet.';
  }

  once.addEventListener('click', () => {
    build();
    const i = st.sample();
    const a = i >> 1, b = i & 1;
    last.textContent = `This pair read q0 = ${a}, q1 = ${b}.${a === b && circuit.on.h && circuit.on.cx ? ' Try again: they will always match.' : ''}`;
  });

  many.addEventListener('click', () => {
    build();
    const counts = [0, 0, 0, 0];
    for (let k = 0; k < 1000; k++) counts[st.sample()]++;
    counts.forEach((n, i) => {
      cells[i].replaceChildren(document.createTextNode(n.toLocaleString()), h('small', { text: pct(n / 1000) }));
      cells[i].classList.toggle('hot', n > 50);
    });
    const agree = counts[0] + counts[3];
    last.textContent = `${agree.toLocaleString()} of 1,000 pairs agreed.`
      + (circuit.on.h && circuit.on.cx ? ' Each qubit alone is a fair coin; together they never disagree.' : '');
  });

  update();
}

/* ── how fast the bookkeeping grows ──────────────────────────────────────── */
const UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

function sci(log10) {
  const e = Math.floor(log10);
  const m = 10 ** (log10 - e);
  return `${m.toFixed(2)} × 10${String(e).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('')}`;
}

function amplitudes(n) {
  if (n <= 64) return (2n ** BigInt(n)).toLocaleString('en-US');
  return `≈ ${sci(n * Math.LOG10E * Math.LN2)}`;
}

function memory(n) {
  const p = n + 4;                              // 16 bytes = two 64-bit floats per amplitude
  if (p >= 90) return `≈ ${sci(p * Math.LOG10E * Math.LN2)} bytes`;
  const u = Math.min(8, Math.floor(p / 10));
  return `${(2 ** (p - 10 * u)).toLocaleString('en-US')} ${UNITS[u]}`;
}

function fits(n) {
  if (n <= 26) return ['a phone', 'A phone does this without noticing.'];
  if (n <= 32) return ['a good laptop', 'A well-equipped laptop can still hold every amplitude.'];
  if (n <= 36) return ['one big server', 'Past what a laptop holds; one large server copes.'];
  if (n <= 49) return ['a top supercomputer', 'Only the largest supercomputers on Earth have that much memory — and only just.'];
  if (n <= 58) return ['nothing ever built', 'More memory than any computer ever built.'];
  if (n < 266) return ['nothing, ever', 'More bytes than there are grains of sand on every beach on Earth.'];
  return ['nothing, ever', 'More numbers than there are atoms in the observable universe.'];
}

export function initGrowth() {
  const host = $('#growth');
  if (!host) return;

  const slider = h('input', { type: 'range', min: 1, max: 100, step: 1, value: 10, id: 'growth-n',
    'aria-label': 'Number of qubits' });
  const nOut = h('output', { class: 'growth-n', for: 'growth-n' });
  const stat = (label) => { const b = h('b', {}); return { el: h('div', { class: 'stat' }, [h('span', { text: label }), b]), b }; };
  const sA = stat('Amplitudes to track');
  const sM = stat('Memory to store them');
  const sF = stat('Fits in');
  const say = h('p', { class: 'growth-say' });
  const ticks = h('div', { class: 'growth-ticks' });

  let n = 10;
  const set = (v) => {
    n = v;
    if (v <= 100) slider.value = String(v);
    render();
  };
  for (const v of [10, 30, 50, 100, 300]) {
    ticks.appendChild(h('button', { class: 'chip-btn', type: 'button', text: `${v} qubits`, onclick: () => set(v) }));
  }

  host.append(
    h('div', { class: 'growth-ctl' }, [h('label', { for: 'growth-n', text: 'Qubits' }), slider, nOut]),
    ticks,
    h('div', { class: 'growth-out' }, [sA.el, sM.el, sF.el]),
    say,
  );

  function render() {
    nOut.textContent = String(n);
    sA.b.textContent = amplitudes(n);
    sM.b.textContent = memory(n);
    const [where, sentence] = fits(n);
    sF.b.textContent = where;
    say.innerHTML = `<strong>${n} qubit${n === 1 ? '' : 's'}</strong> means 2<sup>${n}</sup> amplitudes, each two 8-byte numbers. ${sentence}`;
    [...ticks.children].forEach((b) => b.classList.toggle('on', b.textContent === `${n} qubits`));
  }

  slider.addEventListener('input', () => set(clamp(Number(slider.value), 1, 100)));
  render();
}
