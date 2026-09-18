/* Section 2 — logic gates, and NAND doing everyone else's job. */
import { h, s, svgRoot, $, gate, wire, pad, lamp, gatePins } from './util.js';

export const LOGIC = {
  NOT:  (a) => a ^ 1,
  AND:  (a, b) => a & b,
  OR:   (a, b) => a | b,
  XOR:  (a, b) => a ^ b,
  NAND: (a, b) => (a & b) ^ 1,
  NOR:  (a, b) => (a | b) ^ 1,
};

const CARDS = [
  { kind: 'NOT', blurb: 'Says the opposite. The only gate that changes a single bit’s mind, and the cheapest thing on this page.' },
  { kind: 'AND', blurb: '1 only when both inputs are 1. Reads as “both of these are true” — the machine’s way of checking a condition.' },
  { kind: 'OR',  blurb: '1 when either input is 1. Reads as “at least one of these is true”.' },
  { kind: 'XOR', blurb: '1 when the inputs disagree. This is the gate that adds — keep it in mind for the next section.' },
  { kind: 'NAND', blurb: 'AND with the answer flipped. Unremarkable, except that every other gate on this page can be built out of nothing but these.' },
];

/** One gate with live inputs, an output lamp and a highlighted truth table. */
function gateCard({ kind, blurb }) {
  const single = kind === 'NOT';
  const W = 232, H = single ? 92 : 104;
  const svg = svgRoot(W, H, { role: 'img', 'aria-label': `${kind} gate` });

  const gy = (H - 36) / 2;
  const g = gate(kind, 92, gy);
  const pins = gatePins(kind);
  const outX = 92 + pins.w;
  const outY = gy + 18;

  const lampNode = lamp(W - 34, outY, 'out');
  const outWire = wire([[outX, outY], [W - 50, outY]]);

  const state = single ? [0] : [0, 0];
  const inWires = [];
  const pads = [];

  const compute = () => (single ? LOGIC.NOT(state[0]) : LOGIC[kind](state[0], state[1]));

  const refresh = () => {
    const out = compute();
    inWires.forEach((w, i) => w.setValue(state[i]));
    outWire.setValue(out);
    lampNode.setValue(out);
    g.setOutput(out);
    highlight(out);
  };

  if (single) {
    inWires.push(wire([[34, outY], [92, outY]]));
    pads.push(pad(22, outY, 'A', 0, (v) => { state[0] = v; refresh(); }));
  } else {
    const ys = [gy + 8, gy + 28];
    [0, 1].forEach((i) => {
      const py = i === 0 ? 30 : H - 30;
      inWires.push(wire([[34, py], [62, py], [62, ys[i]], [94, ys[i]]]));
      pads.push(pad(22, py, i ? 'B' : 'A', 0, (v) => { state[i] = v; refresh(); }));
    });
  }

  svg.append(...inWires, outWire, g, ...pads, lampNode);

  // truth table
  const rows = [];
  const table = h('table', { class: 'tt' });
  const head = h('tr', {}, single
    ? [h('th', { text: 'A' }), h('th', { text: 'out' })]
    : [h('th', { text: 'A' }), h('th', { text: 'B' }), h('th', { text: 'out' })]);
  table.appendChild(head);

  const combos = single ? [[0], [1]] : [[0, 0], [0, 1], [1, 0], [1, 1]];
  for (const c of combos) {
    const out = single ? LOGIC.NOT(c[0]) : LOGIC[kind](c[0], c[1]);
    const tr = h('tr', {}, [...c.map((v) => h('td', { text: String(v) })), h('td', { text: String(out) })]);
    tr.dataset.key = c.join('');
    rows.push(tr);
    table.appendChild(tr);
  }

  const highlight = () => {
    const key = state.join('');
    rows.forEach((r) => r.classList.toggle('hot', r.dataset.key === key));
  };

  const card = h('div', { class: 'gate-card' }, [
    h('h3', { text: kind }),
    h('div', { class: 'gate-svg-holder' }, [svg]),
    h('p', { class: 'gate-desc', text: blurb }),
    table,
  ]);

  refresh();
  return card;
}

/* ── NAND building the others ─────────────────────────────────────────────── */

function nandNot() {
  const W = 216, H = 88, svg = svgRoot(W, H, { role: 'img', 'aria-label': 'NOT built from one NAND' });
  const gy = 26;
  const g = gate('NAND', 92, gy, 'NAND');
  const w1 = wire([[34, 44], [64, 44], [64, gy + 8], [94, gy + 8]]);
  const w2 = wire([[64, 44], [64, gy + 28], [94, gy + 28]]);
  const ow = wire([[92 + gatePins('NAND').w, 44], [W - 50, 44]]);
  const l = lamp(W - 34, 44);
  let a = 0;
  const p = pad(22, 44, 'A', 0, (v) => { a = v; upd(); });
  const upd = () => {
    const o = LOGIC.NAND(a, a);
    [w1, w2].forEach((w) => w.setValue(a));
    ow.setValue(o); l.setValue(o); g.setOutput(o);
  };
  svg.append(w1, w2, ow, g, p, l);
  upd();
  return svg;
}

function nandAnd() {
  const W = 300, H = 104, svg = svgRoot(W, H, { role: 'img', 'aria-label': 'AND built from two NANDs' });
  const gy = 34, nose = gatePins('NAND').w;
  const g1 = gate('NAND', 76, gy, 'NAND');
  const g2 = gate('NAND', 176, gy, 'NAND');
  const state = [0, 0];
  const wa = wire([[34, 26], [58, 26], [58, gy + 8], [78, gy + 8]]);
  const wb = wire([[34, 78], [58, 78], [58, gy + 28], [78, gy + 28]]);
  const mid1 = wire([[76 + nose, 52], [152, 52], [152, gy + 8], [178, gy + 8]]);
  const mid2 = wire([[152, 52], [152, gy + 28], [178, gy + 28]]);
  const ow = wire([[176 + nose, 52], [W - 50, 52]]);
  const l = lamp(W - 34, 52);
  const pa = pad(22, 26, 'A', 0, (v) => { state[0] = v; upd(); });
  const pb = pad(22, 78, 'B', 0, (v) => { state[1] = v; upd(); });
  const upd = () => {
    const m = LOGIC.NAND(state[0], state[1]);
    const o = LOGIC.NAND(m, m);
    wa.setValue(state[0]); wb.setValue(state[1]);
    mid1.setValue(m); mid2.setValue(m);
    ow.setValue(o); l.setValue(o);
    g1.setOutput(m); g2.setOutput(o);
  };
  svg.append(wa, wb, mid1, mid2, ow, g1, g2, pa, pb, l);
  upd();
  return svg;
}

function nandOr() {
  const W = 316, H = 122, svg = svgRoot(W, H, { role: 'img', 'aria-label': 'OR built from three NANDs' });
  const nose = gatePins('NAND').w;
  const ga = gate('NAND', 70, 8, 'NAND');
  const gb = gate('NAND', 70, 76, 'NAND');
  const gc = gate('NAND', 180, 43, 'NAND');
  const state = [0, 0];

  const wa1 = wire([[34, 26], [56, 26], [56, 16], [72, 16]]);
  const wa2 = wire([[56, 26], [56, 36], [72, 36]]);
  const wb1 = wire([[34, 94], [56, 94], [56, 84], [72, 84]]);
  const wb2 = wire([[56, 94], [56, 104], [72, 104]]);
  const mA = wire([[70 + nose, 26], [150, 26], [150, 51], [182, 51]]);
  const mB = wire([[70 + nose, 94], [150, 94], [150, 71], [182, 71]]);
  const ow = wire([[180 + nose, 61], [W - 50, 61]]);
  const l = lamp(W - 34, 61);
  const pa = pad(22, 26, 'A', 0, (v) => { state[0] = v; upd(); });
  const pb = pad(22, 94, 'B', 0, (v) => { state[1] = v; upd(); });

  const upd = () => {
    const na = LOGIC.NAND(state[0], state[0]);
    const nb = LOGIC.NAND(state[1], state[1]);
    const o = LOGIC.NAND(na, nb);
    wa1.setValue(state[0]); wa2.setValue(state[0]);
    wb1.setValue(state[1]); wb2.setValue(state[1]);
    mA.setValue(na); mB.setValue(nb);
    ow.setValue(o); l.setValue(o);
    ga.setOutput(na); gb.setOutput(nb); gc.setOutput(o);
  };
  svg.append(wa1, wa2, wb1, wb2, mA, mB, ow, ga, gb, gc, pa, pb, l);
  upd();
  return svg;
}

export function initGates() {
  const grid = $('#gate-grid');
  if (grid) CARDS.forEach((c) => grid.appendChild(gateCard(c)));

  const nd = $('#nand-demo');
  if (nd) {
    const mk = (title, node) => h('div', { class: 'nand-card' },
      [h('h5', { text: title }), node]);
    nd.append(
      mk('NOT — one NAND, inputs tied together', nandNot()),
      mk('AND — a NAND, then a NAND used as NOT', nandAnd()),
      mk('OR — flip both inputs, then NAND them', nandOr()),
    );
  }
}
