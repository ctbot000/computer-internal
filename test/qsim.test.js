import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  State, GATE, ROTATION, phase, ry, rotate, applyColumn, runCircuit, shots,
  mulberry32, groverProb, groverBest, label,
} from '../js/quantum/qsim.js';

// Amplitudes and Bloch components are bounded by 1, so an absolute tolerance is
// the honest scale — and it never trips over -0 the way strict equality does.
const EPS = 1e-12;
const near = (got, want, what = '', eps = EPS) =>
  assert.ok(Math.abs(got - want) <= eps, `${what}: expected ${want}, got ${got}`);
const nearVec = (got, want, what = '', eps = EPS) =>
  got.forEach((g, i) => near(g, want[i], `${what}[${i}]`, eps));
const amps = (st) => Array.from(st.re, (r, i) => [r, st.im[i]]);

function randomState(n, rand) {
  const st = new State(n);
  for (let i = 0; i < st.dim; i++) { st.re[i] = rand() - 0.5; st.im[i] = rand() - 0.5; }
  const k = 1 / st.norm();
  for (let i = 0; i < st.dim; i++) { st.re[i] *= k; st.im[i] *= k; }
  return st;
}

test('H sends |0⟩ to an equal superposition and back again', () => {
  const st = new State(1).apply(GATE.H, 0);
  near(st.re[0], Math.SQRT1_2, 'a0'); near(st.re[1], Math.SQRT1_2, 'a1');
  st.apply(GATE.H, 0);
  near(st.re[0], 1, 'a0 after HH'); near(st.prob(1), 0, 'p1 after HH');
});

test('Pauli and phase gates match their definitions', () => {
  const y = new State(1).apply(GATE.Y, 0);          // Y|0⟩ = i|1⟩
  near(y.re[1], 0, 'Re'); near(y.im[1], 1, 'Im');
  const rand = mulberry32(7);
  for (let k = 0; k < 20; k++) {
    const a = randomState(1, rand);
    const ss = a.clone().apply(GATE.S, 0).apply(GATE.S, 0);
    const z = a.clone().apply(GATE.Z, 0);
    amps(ss).forEach(([r, i], j) => { near(r, z.re[j], 'SS=Z re'); near(i, z.im[j], 'SS=Z im'); });
    const tt = a.clone().apply(GATE.T, 0).apply(GATE.T, 0);
    const s = a.clone().apply(GATE.S, 0);
    amps(tt).forEach(([r, i], j) => { near(r, s.re[j], 'TT=S re'); near(i, s.im[j], 'TT=S im'); });
    const hzh = a.clone().apply(GATE.H, 0).apply(GATE.Z, 0).apply(GATE.H, 0);
    const x = a.clone().apply(GATE.X, 0);
    amps(hzh).forEach(([r, i], j) => { near(r, x.re[j], 'HZH=X re'); near(i, x.im[j], 'HZH=X im'); });
  }
});

test('gates preserve the norm', () => {
  const rand = mulberry32(11);
  const names = Object.keys(GATE);
  for (let k = 0; k < 200; k++) {
    const st = randomState(3, rand);
    const g = names[Math.floor(rand() * names.length)];
    const t = Math.floor(rand() * 3);
    const ctrl = rand() < 0.5 ? [(t + 1) % 3] : [];
    st.apply(GATE[g], t, ctrl);
    near(st.norm(), 1, `norm after ${g}`, 1e-12);
  }
});

test('Bloch vectors of the six cardinal states', () => {
  nearVec(new State(1).bloch(0), [0, 0, 1], '|0⟩');
  nearVec(new State(1).apply(GATE.X, 0).bloch(0), [0, 0, -1], '|1⟩');
  nearVec(new State(1).apply(GATE.H, 0).bloch(0), [1, 0, 0], '|+⟩');
  nearVec(new State(1).apply(GATE.X, 0).apply(GATE.H, 0).bloch(0), [-1, 0, 0], '|−⟩');
  nearVec(new State(1).apply(GATE.H, 0).apply(GATE.S, 0).bloch(0), [0, 1, 0], '|+i⟩');
  nearVec(new State(1).apply(GATE.H, 0).apply(GATE.S, 0).apply(GATE.Z, 0).bloch(0), [0, -1, 0], '|−i⟩');
});

test('each named gate moves the Bloch arrow exactly as its rotation says', () => {
  const rand = mulberry32(3);
  for (const [name, { axis, angle }] of Object.entries(ROTATION)) {
    for (let k = 0; k < 25; k++) {
      const st = randomState(1, rand);
      const before = st.bloch(0);
      st.apply(GATE[name], 0);
      nearVec(st.bloch(0), rotate(before, axis, angle), `${name}`, 1e-12);
    }
  }
  const st = new State(1).apply(ry(1.1), 0).apply(phase(0.7), 0);
  const b = st.bloch(0);
  near(Math.acos(b[2]), 1.1, 'polar angle of ry', 1e-12);
  near(Math.atan2(b[1], b[0]), 0.7, 'azimuth after phase', 1e-12);
});

test('H then CNOT makes a Bell pair with no direction of its own', () => {
  const st = runCircuit(2, [['H', null], ['C', 'X']]);
  near(st.re[0], Math.SQRT1_2, '|00⟩'); near(st.re[3], Math.SQRT1_2, '|11⟩');
  near(st.prob(1), 0, '|01⟩'); near(st.prob(2), 0, '|10⟩');
  nearVec(st.bloch(0), [0, 0, 0], 'qubit 0');
  nearVec(st.bloch(1), [0, 0, 0], 'qubit 1');
  near(st.concurrence(), 1, 'concurrence');
  near(runCircuit(2, [['H', 'H']]).concurrence(), 0, 'product state');
});

test('labels put qubit 0 on the left', () => {
  const st = new State(3).apply(GATE.X, 0);
  assert.equal(label(st.sample(() => 0.5), 3), '100');
});

test('measuring collapses, and a second measurement agrees with the first', () => {
  const rand = mulberry32(5);
  for (let k = 0; k < 50; k++) {
    const st = runCircuit(2, [['H', null], ['C', 'X']]);
    const a = st.measure(0, rand);
    near(st.norm(), 1, 'renormalised');
    assert.equal(st.measure(1, rand), a, 'Bell partners agree');
    assert.equal(st.measure(0, rand), a, 'repeat measurement agrees');
  }
});

test('shots follow the Born rule', () => {
  const rand = mulberry32(42);
  const n = 20000;
  const st = new State(1).apply(ry(2 * Math.asin(Math.sqrt(0.3))), 0);   // P(1) = 0.3
  near(st.probOne(0), 0.3, 'prepared', 1e-12);
  let ones = 0;
  for (let k = 0; k < n; k++) ones += st.sample(rand);
  const sd = Math.sqrt(0.3 * 0.7 / n);
  assert.ok(Math.abs(ones / n - 0.3) < 4 * sd, `frequency ${ones / n}`);

  const hist = shots(3, [['H', null, null], ['C', 'X', null], [null, 'C', 'X']], 4000, 0, rand);
  assert.equal(hist.reduce((s, v) => s + v, 0), 4000);
  assert.equal(hist[0] + hist[7], 4000, 'GHZ only ever reads 000 or 111');
});

test('noise breaks the GHZ correlation, roughly in proportion', () => {
  const cols = [['H', null, null], ['C', 'X', null], [null, 'C', 'X']];
  const clean = shots(3, cols, 3000, 0, mulberry32(1));
  const noisy = shots(3, cols, 3000, 0.1, mulberry32(1));
  const bad = (h) => h.reduce((s, v, i) => s + (i === 0 || i === 7 ? 0 : v), 0);
  assert.equal(bad(clean), 0);
  assert.ok(bad(noisy) > 300 && bad(noisy) < 1500, `noisy off-pattern count ${bad(noisy)}`);
});

test('phase kickback: Deutsch’s algorithm answers in one query', () => {
  // f(x) = x is balanced, so qubit 0 must read 1 with certainty.
  const st = runCircuit(2, [[null, 'X'], ['H', 'H'], ['C', 'X'], ['H', null]]);
  near(st.probOne(0), 1, 'P(q0 = 1)');
});

test('two-qubit Grover finds |11⟩ in one iteration', () => {
  const st = runCircuit(2, [
    ['H', 'H'], ['C', 'Z'],                          // oracle marks |11⟩
    ['H', 'H'], ['X', 'X'], ['C', 'Z'], ['X', 'X'], ['H', 'H'],   // diffusion
  ]);
  near(st.prob(3), 1, 'P(|11⟩)');
});

test('Grover closed form', () => {
  near(groverProb(4, 1), 1, 'N=4');
  near(groverProb(8, 2), 0.9453125, 'N=8', 1e-9);
  assert.equal(groverBest(4), 1);
  assert.equal(groverBest(8), 2);
  assert.equal(groverBest(16), 3);
  assert.equal(groverBest(64), 6);
  assert.ok(groverProb(8, 3) < groverProb(8, 2), 'iterating past the best makes it worse');

  // The closed form agrees with literally doing it: flip the mark, invert about the mean.
  for (const N of [4, 8, 16, 32, 64]) {
    const a = new Array(N).fill(1 / Math.sqrt(N));
    const marked = N - 3;
    for (let k = 1; k <= groverBest(N) + 1; k++) {
      a[marked] = -a[marked];
      const mean = a.reduce((s, v) => s + v, 0) / N;
      for (let i = 0; i < N; i++) a[i] = 2 * mean - a[i];
      near(a[marked] ** 2, groverProb(N, k), `N=${N} k=${k}`, 1e-9);
    }
  }
});

test('teleportation moves qubit 0’s state onto qubit 2', () => {
  const teleport = [
    [null, 'H', null], [null, 'C', 'X'],   // share a Bell pair between 1 and 2
    ['C', 'X', null], ['H', null, null],   // Alice's half of the protocol
    [null, 'C', 'X'], ['C', null, 'Z'],    // Bob's corrections, measurement deferred
  ];
  const rand = mulberry32(9);
  for (let k = 0; k < 30; k++) {
    const st = new State(3).apply(ry(Math.PI * rand()), 0).apply(phase(2 * Math.PI * rand()), 0);
    const sent = st.bloch(0);
    teleport.forEach((col) => applyColumn(st, col));
    nearVec(st.bloch(2), sent, 'received', 1e-12);
  }
});
