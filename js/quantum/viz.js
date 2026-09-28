/* Shared pictures for the quantum page: the Bloch sphere, circle notation for
   amplitudes, and the small formatting helpers they all lean on. */
import { h, s, svgRoot, clamp, tween } from '../util.js';
import { rotate, label } from './qsim.js';

const DEG = Math.PI / 180;
let uid = 0;

/* ── formatting ──────────────────────────────────────────────────────────── */

export const pct = (p, d = 0) => `${(p * 100).toFixed(d)}%`;

const num = (v) => {
  const t = Math.abs(v) < 5e-4 ? 0 : v;
  return t.toFixed(3);
};

/** A complex amplitude as text: "0.707", "−0.500i", "(0.500 + 0.500i)". */
export function fmtC(re, im) {
  const r = Math.abs(re) < 5e-4 ? 0 : re;
  const i = Math.abs(im) < 5e-4 ? 0 : im;
  const neg = (v) => (v < 0 ? '−' : '');
  if (i === 0) return `${neg(r)}${num(Math.abs(r))}`;
  if (r === 0) return `${neg(i)}${num(Math.abs(i))}i`;
  return `(${neg(r)}${num(Math.abs(r))} ${i < 0 ? '−' : '+'} ${num(Math.abs(i))}i)`;
}

/** The state as a sum of kets, skipping terms that are (numerically) zero. */
export function ketLine(st, el) {
  const parts = [];
  for (let i = 0; i < st.dim; i++) {
    if (st.prob(i) < 1e-9) continue;
    parts.push([fmtC(st.re[i], st.im[i]), label(i, st.n)]);
  }
  el.replaceChildren();
  parts.forEach(([amp, k], j) => {
    if (j) el.append(h('span', { class: 'op', text: '+' }));
    el.append(document.createTextNode(`${amp} `), h('span', { class: 'ket', text: `|${k}⟩` }));
  });
}

/* ── the Bloch sphere ────────────────────────────────────────────────────── */

/**
 * An orthographic Bloch sphere drawn in SVG. Drag to turn the view.
 * `set(v)` places the arrow; `turn(from, axis, angle, ms)` sweeps it along the
 * rotation a gate really performs; `swing(from, to, ms)` takes the short arc.
 */
export function blochSphere({ size = 280, mini = false } = {}) {
  const id = `bl${++uid}`;
  const c = size / 2;
  const R = size * (mini ? 0.4 : 0.34);
  let az = 30 * DEG, el = 17 * DEG;
  let vec = [0, 0, 1];
  let trail = null;

  const svg = svgRoot(size, size, {
    class: 'bloch', role: 'img',
    'aria-label': mini ? 'Bloch sphere' : 'Bloch sphere: drag to turn the view',
    // a mini sphere is sized by its stylesheet, which an inline width would beat
    ...(mini ? { style: 'display:block' } : {}),
  });

  const defs = s('defs');
  const grad = s('radialGradient', { id: `${id}g`, cx: '38%', cy: '32%', r: '75%' });
  grad.append(
    s('stop', { offset: '0%', 'stop-color': 'var(--violet)', 'stop-opacity': mini ? 0.16 : 0.2 }),
    s('stop', { offset: '100%', 'stop-color': 'var(--violet)', 'stop-opacity': 0.02 }),
  );
  defs.appendChild(grad);
  svg.appendChild(defs);

  const ball = s('circle', { cx: c, cy: c, r: R, fill: `url(#${id}g)`,
    stroke: 'var(--line)', 'stroke-width': mini ? 1.2 : 1.6 });
  const back = s('g', { fill: 'none', 'stroke-linecap': 'round' });
  const front = s('g', { fill: 'none', 'stroke-linecap': 'round' });
  const labels = s('g', { 'font-family': 'var(--mono)', 'text-anchor': 'middle', 'pointer-events': 'none' });
  const trailPath = s('path', { fill: 'none', stroke: 'var(--violet)', 'stroke-width': mini ? 1.2 : 2,
    'stroke-dasharray': '3 4', opacity: 0.7, 'stroke-linecap': 'round' });
  const shadow = s('path', { fill: 'none', stroke: 'var(--amber)', 'stroke-width': mini ? 1 : 1.4,
    'stroke-dasharray': '2 3', opacity: 0.55 });
  const shaft = s('line', { stroke: 'var(--amber)', 'stroke-width': mini ? 2.2 : 3.2, 'stroke-linecap': 'round' });
  const tip = s('circle', { r: mini ? 3.4 : 5.5, fill: 'var(--amber)' });
  const hub = s('circle', { cx: c, cy: c, r: mini ? 1.8 : 2.6, fill: 'var(--dim)' });
  svg.append(ball, back, front, trailPath, shadow, shaft, tip, hub, labels);

  function project(v) {
    const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    const x1 = v[0] * ca + v[1] * sa;
    const y1 = -v[0] * sa + v[1] * ca;
    return [c + R * y1, c - R * (-x1 * se + v[2] * ce), x1 * ce + v[2] * se];
  }

  const pathOf = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');

  /** Split a closed 3D curve into the runs in front of and behind the sphere's centre. */
  function greatCircle(fn) {
    const runs = { f: [], b: [] };
    let cur = null, side = null;
    for (let i = 0; i <= 96; i++) {
      const p = project(fn((i / 96) * 2 * Math.PI));
      const sd = p[2] >= 0 ? 'f' : 'b';
      if (sd !== side) { if (cur) cur.push(p); cur = [p]; runs[sd].push(cur); side = sd; }
      else cur.push(p);
    }
    return runs;
  }

  function drawFrame() {
    back.replaceChildren();
    front.replaceChildren();
    labels.replaceChildren();
    const circles = [
      (t) => [Math.cos(t), Math.sin(t), 0],
      (t) => [Math.sin(t), 0, Math.cos(t)],
      (t) => [0, Math.sin(t), Math.cos(t)],
    ];
    circles.forEach((fn, i) => {
      const runs = greatCircle(fn);
      const w = i === 0 ? (mini ? 1.1 : 1.5) : (mini ? 0.7 : 1);
      runs.b.forEach((r) => back.appendChild(s('path', { d: pathOf(r), stroke: 'var(--line)',
        'stroke-width': w, 'stroke-dasharray': '3 4', opacity: 0.8 })));
      runs.f.forEach((r) => front.appendChild(s('path', { d: pathOf(r), stroke: 'var(--line)',
        'stroke-width': w, opacity: i === 0 ? 1 : 0.75 })));
    });

    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const o = [c, c];
    axes.forEach((a) => {
      [1, -1].forEach((sg) => {
        const e = project(a.map((x) => x * sg));
        const g = e[2] >= 0 ? front : back;
        g.appendChild(s('line', { x1: o[0], y1: o[1], x2: e[0], y2: e[1], stroke: 'var(--dimmer)',
          'stroke-width': mini ? 0.7 : 1, opacity: e[2] >= 0 ? 0.7 : 0.4,
          'stroke-dasharray': e[2] >= 0 ? null : '2 3' }));
      });
    });

    const L = mini
      ? [[[0, 0, 1], '0'], [[0, 0, -1], '1']]
      : [[[0, 0, 1], '|0⟩'], [[0, 0, -1], '|1⟩'], [[1, 0, 0], '|+⟩'], [[-1, 0, 0], '|−⟩'],
         [[0, 1, 0], '|+i⟩'], [[0, -1, 0], '|−i⟩']];
    L.forEach(([v, t], i) => {
      const p = project(v.map((x) => x * (mini ? 1.2 : 1.2)));
      const pole = i < 2;
      labels.appendChild(s('text', {
        x: p[0], y: p[1] + (mini ? 3.5 : 4.5),
        'font-size': mini ? 10 : pole ? 13 : 11,
        fill: pole ? 'var(--text)' : 'var(--dim)', opacity: p[2] < -0.2 ? 0.55 : 1,
        'font-weight': pole ? 700 : 400, text: t,
      }));
    });
  }

  function drawArrow() {
    const len = Math.hypot(vec[0], vec[1], vec[2]);
    const t = project(vec);
    const foot = project([vec[0], vec[1], 0]);
    shaft.setAttribute('x1', c); shaft.setAttribute('y1', c);
    shaft.setAttribute('x2', t[0]); shaft.setAttribute('y2', t[1]);
    tip.setAttribute('cx', t[0]); tip.setAttribute('cy', t[1]);
    shadow.setAttribute('d', len > 1e-3 ? `M${c} ${c} L${foot[0]} ${foot[1]} L${t[0]} ${t[1]}` : '');
    const behind = t[2] < -0.02;
    shaft.style.opacity = behind ? 0.55 : 1;
    tip.style.opacity = len < 1e-3 ? 0 : behind ? 0.6 : 1;
    tip.style.display = len < 1e-3 ? 'none' : '';
    trailPath.setAttribute('d', trail ? pathOf(trail.map(project)) : '');
  }

  function redraw() { drawFrame(); drawArrow(); }

  /* dragging turns the view; state is only touched after capture is attempted */
  let press = null;
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    try { svg.setPointerCapture(e.pointerId); } catch { /* not capturable: window listeners still track */ }
    press = { x: e.clientX, y: e.clientY, az, el };
    svg.classList.add('dragging');
  });
  window.addEventListener('pointermove', (e) => {
    if (!press) return;
    const k = 0.6 * DEG * (280 / size);
    az = press.az - (e.clientX - press.x) * k;
    el = clamp(press.el + (e.clientY - press.y) * k, -80 * DEG, 80 * DEG);
    redraw();
  });
  const release = () => { if (!press) return; press = null; svg.classList.remove('dragging'); };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  /* animation: wall-clock tweens with a timer backstop, so a tab that delivers no
     frames still ends up showing the right arrow */
  let stop = null, backstop = null;
  const cancel = () => {
    if (stop) { stop(); stop = null; }
    if (backstop) { clearTimeout(backstop); backstop = null; }
  };
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

  function run(ms, at, final, done) {
    cancel();
    if (ms <= 0) { vec = final; drawArrow(); done?.(); return; }
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      cancel();
      vec = final;
      drawArrow();
      done?.();
    };
    stop = tween(ms, (k) => { vec = at(ease(k)); drawArrow(); }, end);
    backstop = setTimeout(end, ms + 150);
  }

  redraw();

  return {
    el: svg,
    get vec() { return vec; },
    set(v, keepTrail = false) {
      cancel();
      vec = v.slice();
      if (!keepTrail) trail = null;
      drawArrow();
    },
    /** Sweep along a gate's rotation, leaving a dotted trail of the path. */
    turn(from, axis, angle, ms, done) {
      trail = [];
      for (let i = 0; i <= 40; i++) trail.push(rotate(from, axis, (i / 40) * angle));
      run(ms, (k) => rotate(from, axis, k * angle), rotate(from, axis, angle), done);
    },
    /** Take the short way from one direction to another (used for collapse). */
    swing(from, to, ms, done) {
      trail = null;
      const cr = [from[1] * to[2] - from[2] * to[1], from[2] * to[0] - from[0] * to[2], from[0] * to[1] - from[1] * to[0]];
      const n = Math.hypot(...cr);
      const dot = clamp(from[0] * to[0] + from[1] * to[1] + from[2] * to[2], -1, 1);
      if (n < 1e-9) { run(0, null, to.slice(), done); return; }
      const axis = cr.map((x) => x / n);
      const angle = Math.acos(dot);
      run(ms, (k) => rotate(from, axis, k * angle), to.slice(), done);
    },
  };
}

/** A captioned mini sphere for one qubit of a register. */
export function miniSphere(name) {
  const sphere = blochSphere({ size: 120, mini: true });
  const cap = h('div', { class: 'mini-cap' });
  const el = h('div', { class: 'mini' }, [sphere.el, cap]);
  return {
    el,
    set(v) {
      sphere.set(v);
      const len = Math.hypot(v[0], v[1], v[2]);
      cap.replaceChildren(document.createTextNode(name));
      if (len < 0.02) cap.append(h('br'), h('em', { text: 'no direction' }));
      else if (len < 0.98) cap.append(h('br'), h('em', { text: 'partly entangled' }));
    },
  };
}

/* ── circle notation ─────────────────────────────────────────────────────── */

/**
 * One circle per basis state: the filled disc's area is the probability, and
 * the needle is the phase (pointing right = positive, left = negative).
 */
export function circleSet(n, { small = false } = {}) {
  const el = h('div', { class: `circles${small ? ' small' : ''}` });
  const items = [];
  for (let i = 0; i < 1 << n; i++) {
    const svg = svgRoot(60, 60, { 'aria-hidden': 'true', style: 'display:block' });
    const ring = s('circle', { cx: 30, cy: 30, r: 26, fill: 'var(--surface)', stroke: 'var(--line)', 'stroke-width': 1.5 });
    const disc = s('circle', { cx: 30, cy: 30, r: 0, fill: 'color-mix(in srgb, var(--accent) 55%, transparent)' });
    const needle = s('line', { x1: 30, y1: 30, x2: 56, y2: 30, stroke: 'var(--text)', 'stroke-width': 2, 'stroke-linecap': 'round' });
    svg.append(ring, disc, needle);
    const k = h('span', { class: 'circ-k', text: `|${label(i, n)}⟩` });
    const p = h('span', { class: 'circ-p' });
    el.appendChild(h('div', { class: 'circ' }, [svg, k, p]));
    items.push({ disc, needle, p });
  }
  return {
    el,
    set(st) {
      items.forEach((it, i) => {
        const mag = Math.sqrt(st.prob(i));
        const ph = Math.atan2(st.im[i], st.re[i]);
        it.disc.setAttribute('r', (26 * mag).toFixed(2));
        const show = mag > 1e-6;
        it.needle.style.display = show ? '' : 'none';
        it.needle.setAttribute('x2', (30 + 26 * Math.cos(ph)).toFixed(2));
        it.needle.setAttribute('y2', (30 - 26 * Math.sin(ph)).toFixed(2));
        it.p.textContent = pct(mag * mag);
      });
    },
  };
}

/** Horizontal bar split into P(0) and P(1). */
export function probBar() {
  const p0 = h('span', { class: 'p0' });
  const p1 = h('span', { class: 'p1' });
  const el = h('div', { class: 'probbar' }, [p0, p1]);
  return {
    el,
    set(prob1) {
      const a = 1 - prob1;
      p0.style.flexBasis = `${a * 100}%`;
      p1.style.flexBasis = `${prob1 * 100}%`;
      // the text sits in an inner span, so a 0% segment has no padding to keep it visible
      p0.replaceChildren(h('em', { text: a > 0.12 ? `0 · ${pct(a)}` : '' }));
      p1.replaceChildren(h('em', { text: prob1 > 0.12 ? `1 · ${pct(prob1)}` : '' }));
      el.title = `P(0) = ${pct(a, 1)}, P(1) = ${pct(prob1, 1)}`;
    },
  };
}

export const subLabel = (t) => h('p', { class: 'sub-label', text: t });

export { DEG };
