/* A small state-vector quantum simulator: enough for three qubits drawn on a
   page, exact to floating point, and shared by every section of quantum.html.

   Convention: qubit 0 is the top wire and the LEFTMOST character of a basis
   label, so in |10⟩ qubit 0 reads 1 and qubit 1 reads 0. */

const R = Math.SQRT1_2;

/** 2×2 complex matrices as [m00, m01, m10, m11], each entry [re, im]. */
export const GATE = {
  I: [[1, 0], [0, 0], [0, 0], [1, 0]],
  X: [[0, 0], [1, 0], [1, 0], [0, 0]],
  Y: [[0, 0], [0, -1], [0, 1], [0, 0]],
  Z: [[1, 0], [0, 0], [0, 0], [-1, 0]],
  H: [[R, 0], [R, 0], [R, 0], [-R, 0]],
  S: [[1, 0], [0, 0], [0, 0], [0, 1]],
  T: [[1, 0], [0, 0], [0, 0], [R, R]],
};

/** Phase gate: leaves |0⟩ alone and turns the |1⟩ amplitude by φ. */
export const phase = (phi) => [[1, 0], [0, 0], [0, 0], [Math.cos(phi), Math.sin(phi)]];

/** Rotation about the Bloch sphere's y axis — real amplitudes, so it tilts the arrow. */
export const ry = (t) => {
  const c = Math.cos(t / 2), s = Math.sin(t / 2);
  return [[c, 0], [-s, 0], [s, 0], [c, 0]];
};

/**
 * Every single-qubit gate is a rotation of the Bloch sphere. This is the axis and
 * angle for each named one (right-hand rule), used to animate the arrow along
 * the path the gate really takes.
 */
export const ROTATION = {
  X: { axis: [1, 0, 0], angle: Math.PI },
  Y: { axis: [0, 1, 0], angle: Math.PI },
  Z: { axis: [0, 0, 1], angle: Math.PI },
  H: { axis: [R, 0, R], angle: Math.PI },
  S: { axis: [0, 0, 1], angle: Math.PI / 2 },
  T: { axis: [0, 0, 1], angle: Math.PI / 4 },
};

/** Rodrigues' rotation of vector v about unit axis k by angle a. */
export function rotate(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const cx = k[1] * v[2] - k[2] * v[1];
  const cy = k[2] * v[0] - k[0] * v[2];
  const cz = k[0] * v[1] - k[1] * v[0];
  return [
    v[0] * c + cx * s + k[0] * dot * (1 - c),
    v[1] * c + cy * s + k[1] * dot * (1 - c),
    v[2] * c + cz * s + k[2] * dot * (1 - c),
  ];
}

export class State {
  constructor(n) {
    this.n = n;
    this.dim = 1 << n;
    this.re = new Float64Array(this.dim);
    this.im = new Float64Array(this.dim);
    this.re[0] = 1;
  }

  clone() {
    const c = new State(this.n);
    c.re.set(this.re);
    c.im.set(this.im);
    return c;
  }

  /** Overwrite this state with another of the same size, keeping the object. */
  copyFrom(o) {
    this.re.set(o.re);
    this.im.set(o.im);
    return this;
  }

  reset() {
    this.re.fill(0);
    this.im.fill(0);
    this.re[0] = 1;
    return this;
  }

  mask(q) { return 1 << (this.n - 1 - q); }

  /** Apply a 2×2 gate to `target`, only where every qubit in `controls` is 1. */
  apply(m, target, controls = []) {
    const tm = this.mask(target);
    let cm = 0;
    for (const c of controls) cm |= this.mask(c);
    const [a, b, c, d] = m;
    const { re, im } = this;
    for (let i = 0; i < this.dim; i++) {
      if (i & tm || (i & cm) !== cm) continue;
      const j = i | tm;
      const xr = re[i], xi = im[i], yr = re[j], yi = im[j];
      re[i] = a[0] * xr - a[1] * xi + b[0] * yr - b[1] * yi;
      im[i] = a[0] * xi + a[1] * xr + b[0] * yi + b[1] * yr;
      re[j] = c[0] * xr - c[1] * xi + d[0] * yr - d[1] * yi;
      im[j] = c[0] * xi + c[1] * xr + d[0] * yi + d[1] * yr;
    }
    return this;
  }

  prob(i) { return this.re[i] * this.re[i] + this.im[i] * this.im[i]; }

  probs() {
    const p = new Float64Array(this.dim);
    for (let i = 0; i < this.dim; i++) p[i] = this.prob(i);
    return p;
  }

  norm() {
    let s = 0;
    for (let i = 0; i < this.dim; i++) s += this.prob(i);
    return Math.sqrt(s);
  }

  /** Probability that qubit q reads 1. */
  probOne(q) {
    const m = this.mask(q);
    let s = 0;
    for (let i = 0; i < this.dim; i++) if (i & m) s += this.prob(i);
    return s;
  }

  /** Draw one basis index with the Born rule. Does not change the state. */
  sample(rand = Math.random) {
    let r = rand();
    let last = 0;
    for (let i = 0; i < this.dim; i++) {
      const p = this.prob(i);
      if (p > 0) last = i;
      r -= p;
      if (r < 0) return i;
    }
    return last; // rounding left a sliver of probability unassigned
  }

  /** Measure one qubit: returns 0 or 1 and collapses the state to match. */
  measure(q, rand = Math.random) {
    const p1 = this.probOne(q);
    const bit = rand() < p1 ? 1 : 0;
    const m = this.mask(q);
    const keep = bit ? p1 : 1 - p1;
    const k = keep > 0 ? 1 / Math.sqrt(keep) : 0;
    for (let i = 0; i < this.dim; i++) {
      if (((i & m) ? 1 : 0) === bit) { this.re[i] *= k; this.im[i] *= k; }
      else { this.re[i] = 0; this.im[i] = 0; }
    }
    return bit;
  }

  /**
   * Bloch vector of qubit q on its own. For an entangled qubit the other
   * qubits are traced out, and the arrow comes back shorter than 1 — all the
   * way down to 0 when the qubit has no state of its own at all.
   */
  bloch(q) {
    const m = this.mask(q);
    let p0 = 0, p1 = 0, cr = 0, ci = 0; // ρ01 = Σ a_i0 · conj(a_i1)
    for (let i = 0; i < this.dim; i++) {
      if (i & m) continue;
      const j = i | m;
      p0 += this.prob(i);
      p1 += this.prob(j);
      cr += this.re[i] * this.re[j] + this.im[i] * this.im[j];
      ci += this.im[i] * this.re[j] - this.re[i] * this.im[j];
    }
    return [2 * cr, -2 * ci, p0 - p1];
  }

  /** Two-qubit states only: 0 for a product state, 1 for a Bell pair. */
  concurrence() {
    if (this.n !== 2) throw new Error('concurrence is defined here for two qubits');
    const { re, im } = this;
    // a00·a11 − a01·a10
    const r = (re[0] * re[3] - im[0] * im[3]) - (re[1] * re[2] - im[1] * im[2]);
    const i = (re[0] * im[3] + im[0] * re[3]) - (re[1] * im[2] + im[1] * re[2]);
    return 2 * Math.hypot(r, i);
  }
}

export const label = (i, n) => i.toString(2).padStart(n, '0');

/* ── circuits ────────────────────────────────────────────────────────────── */

/**
 * A circuit is a list of columns; a column holds one entry per qubit:
 * null, a gate name from GATE, or 'C' for a control dot. Every gate in a column
 * is applied conditioned on every control in that column.
 */
const PAULI = [GATE.X, GATE.Y, GATE.Z];

export function applyColumn(state, col, noise = 0, rand = Math.random) {
  const controls = [];
  col.forEach((g, q) => { if (g === 'C') controls.push(q); });
  col.forEach((g, q) => { if (g && g !== 'C') state.apply(GATE[g], q, controls); });
  if (noise > 0) {
    // Depolarising noise: each qubit the column touched suffers a random
    // X, Y or Z with probability `noise`.
    col.forEach((g, q) => {
      if (g && rand() < noise) state.apply(PAULI[Math.floor(rand() * 3)], q);
    });
  }
  return state;
}

export function runCircuit(n, cols, upto = cols.length, noise = 0, rand = Math.random) {
  const st = new State(n);
  for (let c = 0; c < upto; c++) applyColumn(st, cols[c], noise, rand);
  return st;
}

/** Histogram of `count` measurements of the whole register. */
export function shots(n, cols, count, noise = 0, rand = Math.random) {
  const hist = new Array(1 << n).fill(0);
  if (noise <= 0) {
    const st = runCircuit(n, cols);
    for (let k = 0; k < count; k++) hist[st.sample(rand)]++;
  } else {
    // Each shot is its own run, because the errors differ from run to run.
    for (let k = 0; k < count; k++) hist[runCircuit(n, cols, cols.length, noise, rand).sample(rand)]++;
  }
  return hist;
}

/** Small deterministic PRNG for tests and reproducible demos. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Grover, in closed form ──────────────────────────────────────────────── */

/** Chance of reading the marked item after k Grover iterations over N items. */
export function groverProb(N, k) {
  const theta = Math.asin(1 / Math.sqrt(N));
  return Math.sin((2 * k + 1) * theta) ** 2;
}

/** The iteration count that maximises that chance. */
export function groverBest(N) {
  const theta = Math.asin(1 / Math.sqrt(N));
  return Math.max(0, Math.round(Math.PI / (4 * theta) - 0.5));
}
