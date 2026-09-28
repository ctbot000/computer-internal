/* Section 5 — a three-qubit circuit you can edit, step through and run. */
import { h, s, svgRoot, $, clamp } from '../util.js';
import { runCircuit, shots, label } from './qsim.js';
import { circleSet, miniSphere, ketLine, pct } from './viz.js';

const N = 3, COLS = 10;
const X0 = 70, CW = 52;
const Y = (q) => 44 + q * 58;
const XC = (c) => X0 + CW * c + CW / 2;
const W = X0 + CW * COLS + 16, H = Y(N - 1) + 36;

const CHOICES = ['H', 'X', 'Y', 'Z', 'S', 'T', 'C'];
const NAMES = { H: 'Hadamard', X: 'X (NOT)', Y: 'Y', Z: 'Z', S: 'S', T: 'T', C: 'control dot' };

const pad = (cols) => Array.from({ length: COLS }, (_, c) => (cols[c] ?? [null, null, null]).slice());

const EXAMPLES = [
  { name: 'Empty', cols: [], desc: 'Three qubits, all starting at |0⟩. Click any slot to place a gate.' },
  { name: 'Superposition', cols: [['H', null, null]],
    desc: 'One Hadamard: q0 is now an equal mix of 0 and 1, and the register has two amplitudes of the same size.' },
  { name: 'Bell pair', cols: [['H', null, null], ['C', 'X', null]],
    desc: 'H, then a controlled-NOT: q0 and q1 are entangled, and their spheres have lost their arrows.' },
  { name: 'GHZ state', cols: [['H', null, null], ['C', 'X', null], [null, 'C', 'X']],
    desc: 'Entanglement passed down the line: all three read 000 or all three read 111, never anything else.' },
  { name: 'Phase kickback', cols: [[null, 'X', null], ['H', 'H', null], ['C', 'X', null], ['H', null, null]],
    desc: 'The controlled-NOT targets q1, yet it is q0 that changes: its phase is kicked back, and the last H turns that into a certain 1. This is Deutsch’s algorithm answering a question in one query.' },
  { name: 'Grover, 4 items', cols: [['H', 'H', null], ['C', 'Z', null], ['H', 'H', null], ['X', 'X', null], ['C', 'Z', null], ['X', 'X', null], ['H', 'H', null]],
    desc: 'Search four items (q0 and q1) for the one marked 11. Step 2 marks it, steps 3–7 reflect about the average, and 11 comes out with certainty after a single round.' },
  { name: 'Teleportation', cols: [['H', null, null], ['T', null, null], [null, 'H', null], [null, 'C', 'X'], ['C', 'X', null], ['H', null, null], [null, 'C', 'X'], ['C', null, 'Z']],
    desc: 'Steps 1–2 give q0 a state to send. Steps 3–4 share a Bell pair between q1 and q2. After steps 5–8, q2 holds q0’s original state — compare q2’s sphere now with q0’s after step 2.' },
];

export function initLab() {
  const root = $('#lab-root');
  if (!root) return;

  let cols = pad([]);
  let k = COLS;                          // show the state after this many steps

  /* ── circuit panel ── */
  const select = h('select', { 'aria-label': 'Example circuit' }, [
    ...EXAMPLES.map((ex, i) => h('option', { value: String(i), text: ex.name })),
    h('option', { value: '', disabled: 'disabled', text: 'Your own circuit' }),
  ]);
  const clearBtn = h('button', { class: 'btn', type: 'button', text: 'Clear' });
  const desc = h('p', { class: 'fig-note', style: 'padding:.6rem 1rem 0;margin:0' });

  const svg = svgRoot(W, H, { role: 'group', 'aria-label': 'Circuit: three wires and ten time steps', style: 'display:block' });
  const band = s('rect', { x: X0, y: 22, height: H - 34, rx: 8,
    fill: 'color-mix(in srgb, var(--violet) 7%, transparent)' });
  const wires = s('g', {});
  const links = s('g', {});
  const cellsG = s('g', {});
  const cursor = s('line', { y1: 20, y2: H - 10, stroke: 'var(--violet)', 'stroke-width': 2, 'stroke-dasharray': '5 4' });
  const cursorTag = s('text', { y: 16, 'text-anchor': 'middle', 'font-size': 10, 'font-family': 'var(--mono)', fill: 'var(--violet)', text: 'state ▾' });
  svg.append(band, wires, links, cellsG, cursor, cursorTag);

  for (let q = 0; q < N; q++) {
    wires.append(
      s('text', { x: 10, y: Y(q) + 4, 'font-size': 12, 'font-family': 'var(--mono)', fill: 'var(--dim)', text: `q${q}` }),
      s('text', { x: 36, y: Y(q) + 4, 'font-size': 12, 'font-family': 'var(--mono)', fill: 'var(--violet)', text: '|0⟩' }),
      s('line', { x1: X0 - 4, y1: Y(q), x2: W - 10, y2: Y(q), stroke: 'var(--line)', 'stroke-width': 2 }),
    );
  }
  for (let c = 0; c < COLS; c++) {
    wires.appendChild(s('text', { x: XC(c), y: H - 4, 'text-anchor': 'middle', 'font-size': 9.5,
      'font-family': 'var(--mono)', fill: 'var(--dimmer)', text: String(c + 1) }));
  }

  const cells = [];
  for (let c = 0; c < COLS; c++) {
    cells[c] = [];
    for (let q = 0; q < N; q++) {
      const g = s('g', { class: 'cell-hit', role: 'button', tabindex: '0' });
      const bg = s('rect', { class: 'cell-bg', x: X0 + CW * c + 3, y: Y(q) - 26, width: CW - 6, height: 52, rx: 8,
        fill: 'transparent' });
      const glyph = s('g', { 'pointer-events': 'none' });
      g.append(bg, glyph);
      g.addEventListener('click', () => openPicker(c, q));
      g.addEventListener('keydown', (e) => {
        // preventDefault also stops the keypress that would otherwise land on the
        // picker's first button once focus has moved there
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(c, q); }
      });
      cellsG.appendChild(g);
      cells[c][q] = { g, bg, glyph };
    }
  }

  const range = h('input', { type: 'range', min: 0, max: COLS, step: 1, value: COLS, 'aria-label': 'Show the state after this many steps' });
  const stepOut = h('output', {});
  const prev = h('button', { class: 'btn', type: 'button', text: '‹', 'aria-label': 'One step back' });
  const next = h('button', { class: 'btn', type: 'button', text: '›', 'aria-label': 'One step forward' });

  const circuitPanel = h('div', { class: 'panel lab-circuit' }, [
    h('div', { class: 'lab-bar' }, [
      h('span', { class: 'sub-label', text: 'Example' }), select, clearBtn, h('span', { class: 'grow' }),
      h('span', { class: 'sub-label', text: 'click any slot to change it' }),
    ]),
    desc,
    h('div', { class: 'lab-scroll' }, [svg]),
    h('div', { class: 'lab-step' }, [prev, range, next, stepOut]),
  ]);

  /* ── state panel ── */
  const stateTitle = h('h3', {});
  const kets = h('div', { class: 'amp-line' });
  const circles = circleSet(N, { small: true });
  const minis = [0, 1, 2].map((q) => miniSphere(`q${q}`));
  const statePanel = h('div', { class: 'panel lab-state' }, [
    h('div', { class: 'panel-head' }, [stateTitle]),
    h('div', { class: 'panel-body' }, [
      kets, circles.el,
      h('p', { class: 'sub-label', text: 'Each qubit on its own' }),
      h('div', { class: 'minis' }, minis.map((m) => m.el)),
    ]),
  ]);

  /* ── shots panel ── */
  const runBtn = h('button', { class: 'btn btn-primary', type: 'button', text: 'Run 1,000 shots' });
  const noise = h('input', { type: 'range', min: 0, max: 10, step: 0.5, value: 0, id: 'lab-noise', 'aria-label': 'Error chance per gate, percent' });
  const noiseOut = h('output', { for: 'lab-noise' });
  const bars = [], ghosts = [], counts = [];
  const hist = h('div', { class: 'hist8' });
  const labels = h('div', { class: 'hist8-labels' });
  for (let i = 0; i < 1 << N; i++) {
    const ghost = h('div', { class: 'hb-ghost' });
    const fill = h('div', { class: 'hb-fill' });
    hist.appendChild(h('div', { class: 'hb' }, [ghost, fill]));
    const cnt = h('small', { text: ' ' });
    labels.appendChild(h('span', {}, [document.createTextNode(label(i, N)), cnt]));
    bars.push(fill); ghosts.push(ghost); counts.push(cnt);
  }
  const shotNote = h('p', { class: 'shots-note' });
  const shotsPanel = h('div', { class: 'panel lab-shots' }, [
    h('div', { class: 'panel-head' }, [h('h3', { text: 'Measure all three at the end' })]),
    h('div', { class: 'panel-body' }, [
      h('div', { class: 'shots-ctl' }, [runBtn, h('label', { for: 'lab-noise', text: 'noise per gate' }), noise, noiseOut]),
      hist, labels, shotNote,
    ]),
  ]);

  /* ── the gate picker ── */
  const picker = h('div', { class: 'picker is-hidden', role: 'dialog', 'aria-label': 'Choose a gate' });
  const pickerTitle = h('span', { class: 'picker-title' });
  const pickBtns = CHOICES.map((v) => h('button', {
    class: `gate-btn${v === 'C' ? ' ctrl-btn' : ''}`, type: 'button', text: v === 'C' ? '●' : v,
    title: NAMES[v], 'aria-label': NAMES[v], dataset: { v },
  }));
  const emptyBtn = h('button', { class: 'gate-btn clear', type: 'button', text: 'Empty', dataset: { v: '' } });
  picker.append(pickerTitle, ...pickBtns, emptyBtn);
  let picking = null;

  function openPicker(c, q) {
    picking = { c, q };
    pickerTitle.textContent = `q${q} · step ${c + 1}`;
    [...pickBtns, emptyBtn].forEach((b) => b.classList.toggle('cur', (cols[c][q] ?? '') === b.dataset.v));
    picker.classList.remove('is-hidden');
    const r = cells[c][q].bg.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    const pw = picker.offsetWidth;
    const left = clamp(r.left - box.left + r.width / 2 - pw / 2, 0, Math.max(0, box.width - pw));
    picker.style.left = `${left}px`;
    picker.style.top = `${r.bottom - box.top + 6}px`;
    (pickBtns.find((b) => b.classList.contains('cur')) ?? pickBtns[0]).focus();
  }

  function closePicker(refocus = true) {
    if (!picking) return;
    const { c, q } = picking;
    picking = null;
    picker.classList.add('is-hidden');
    if (refocus) cells[c][q].g.focus();
  }

  picker.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !picking) return;
    const { c, q } = picking;
    cols[c][q] = b.dataset.v || null;
    select.value = '';
    desc.textContent = 'Your own circuit. Step through it below, or run it.';
    k = COLS;
    closePicker();
    render();
    staleShots();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePicker(); });
  document.addEventListener('pointerdown', (e) => {
    if (picking && !picker.contains(e.target) && !e.target.closest?.('.cell-hit')) closePicker(false);
  });

  root.append(circuitPanel, statePanel, shotsPanel, picker);

  /* ── drawing ── */
  function glyphFor(v, c, q, controlled) {
    const x = XC(c), y = Y(q);
    if (v === 'C') return [s('circle', { cx: x, cy: y, r: 6.5, fill: 'var(--violet)' })];
    if (v === 'X' && controlled) {
      return [
        s('circle', { cx: x, cy: y, r: 14, fill: 'var(--surface)', stroke: 'var(--violet)', 'stroke-width': 2 }),
        s('path', { d: `M${x - 14} ${y} H${x + 14} M${x} ${y - 14} V${y + 14}`, stroke: 'var(--violet)', 'stroke-width': 2 }),
      ];
    }
    return [
      s('rect', { x: x - 17, y: y - 17, width: 34, height: 34, rx: 7, 'stroke-width': 2,
        fill: 'color-mix(in srgb, var(--violet) 16%, var(--surface))', stroke: 'var(--violet)' }),
      s('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700,
        'font-family': 'var(--mono)', fill: 'var(--text)', text: v }),
    ];
  }

  function drawCircuit() {
    links.replaceChildren();
    for (let c = 0; c < COLS; c++) {
      const col = cols[c];
      const used = col.map((v, q) => (v ? q : -1)).filter((q) => q >= 0);
      const controlled = col.includes('C');
      if (controlled && used.length > 1) {
        links.appendChild(s('line', { x1: XC(c), y1: Y(Math.min(...used)), x2: XC(c), y2: Y(Math.max(...used)),
          stroke: 'var(--violet)', 'stroke-width': 2 }));
      }
      for (let q = 0; q < N; q++) {
        const v = col[q];
        const cell = cells[c][q];
        cell.glyph.replaceChildren(...(v ? glyphFor(v, c, q, controlled) : []));
        cell.g.setAttribute('aria-label', `q${q}, step ${c + 1}: ${v ? NAMES[v] : 'empty'}. Press to change.`);
      }
    }
    const x = X0 + CW * k;
    band.setAttribute('width', Math.max(0, CW * k));
    cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);
    cursorTag.setAttribute('x', clamp(x, X0 + 16, W - 30));
  }

  function drawState() {
    const st = runCircuit(N, cols, k);
    ketLine(st, kets);
    circles.set(st);
    minis.forEach((m, q) => m.set(st.bloch(q)));
    stateTitle.textContent = k === 0 ? 'State before any gates' : `State after step ${k}`;
    stepOut.textContent = k === 0 ? 'start' : k === COLS ? 'end' : `step ${k}`;
    range.value = String(k);
    prev.disabled = k === 0;
    next.disabled = k === COLS;
  }

  function render() { drawCircuit(); drawState(); }

  function staleShots() {
    const ideal = runCircuit(N, cols).probs();
    ideal.forEach((p, i) => {
      ghosts[i].style.height = `${p * 100}%`;
      bars[i].style.height = '0%';
      bars[i].classList.remove('odd');
      counts[i].textContent = pct(p);
    });
    shotNote.textContent = 'Dashed outlines are the exact odds. Run the circuit to see what 1,000 real measurements look like.';
  }

  function run() {
    const p = Number(noise.value) / 100;
    const ideal = runCircuit(N, cols).probs();
    const hst = shots(N, cols, 1000, p);
    let bad = 0;
    hst.forEach((n, i) => {
      bars[i].style.height = `${(n / 1000) * 100}%`;
      const impossible = ideal[i] < 1e-9;
      bars[i].classList.toggle('odd', impossible && n > 0);
      if (impossible) bad += n;
      counts[i].textContent = n.toLocaleString();
    });
    shotNote.textContent = p === 0
      ? 'No noise: the counts scatter around the dashed odds, and outcomes the circuit forbids never appear.'
      : `With a ${pct(p, 1)} chance of error per gate, ${bad.toLocaleString()} of 1,000 runs landed on outcomes the ideal circuit can never produce (red).`;
  }

  /* ── wiring ── */
  function load(i) {
    const ex = EXAMPLES[i];
    cols = pad(ex.cols);
    k = COLS;
    desc.textContent = ex.desc;
    render();
    staleShots();
  }

  select.addEventListener('change', () => { if (select.value !== '') load(Number(select.value)); });
  clearBtn.addEventListener('click', () => { select.value = '0'; load(0); });
  range.addEventListener('input', () => { k = clamp(Number(range.value), 0, COLS); render(); });
  prev.addEventListener('click', () => { k = Math.max(0, k - 1); render(); });
  next.addEventListener('click', () => { k = Math.min(COLS, k + 1); render(); });
  runBtn.addEventListener('click', run);
  const showNoise = () => { noiseOut.textContent = `${Number(noise.value).toFixed(1)}%`; };
  noise.addEventListener('input', showNoise);
  showNoise();

  select.value = '3';
  load(3);
}
