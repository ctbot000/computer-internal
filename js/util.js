/* Shared DOM / SVG helpers and logic-gate drawing primitives. */

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an HTML element. */
export function h(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  apply(n, attrs);
  add(n, kids);
  return n;
}

/** Create an SVG element. */
export function s(tag, attrs = {}, kids = []) {
  const n = document.createElementNS(SVG_NS, tag);
  apply(n, attrs);
  add(n, kids);
  return n;
}

/** Root <svg> with a viewBox. Height is left to the ratio so it never overflows. */
export function svgRoot(w, hgt, attrs = {}) {
  return s('svg', {
    viewBox: `0 0 ${w} ${hgt}`,
    width: w,
    height: hgt,
    style: 'width:100%;height:auto;display:block',
    ...attrs,
  });
}

function apply(n, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') for (const [dk, dv] of Object.entries(v)) n.dataset[dk] = dv;
    else n.setAttribute(k, v);
  }
}

function add(n, kids) {
  for (const k of [].concat(kids)) {
    if (k == null) continue;
    n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const bin = (v, n = 8) => v.toString(2).padStart(n, '0');
export const hex = (v, n = 2) => v.toString(16).toUpperCase().padStart(n, '0');

/* ── gate geometry ───────────────────────────────────────────────────────── */

const BODY = {
  AND:  'M0 0 H22 A18 18 0 0 1 22 36 H0 Z',
  NAND: 'M0 0 H22 A18 18 0 0 1 22 36 H0 Z',
  OR:   'M0 0 Q22 0 42 18 Q22 36 0 36 Q12 18 0 0 Z',
  NOR:  'M0 0 Q22 0 42 18 Q22 36 0 36 Q12 18 0 0 Z',
  XOR:  'M0 0 Q22 0 42 18 Q22 36 0 36 Q12 18 0 0 Z',
  XNOR: 'M0 0 Q22 0 42 18 Q22 36 0 36 Q12 18 0 0 Z',
  NOT:  'M0 0 L36 18 L0 36 Z',
  BUF:  'M0 0 L36 18 L0 36 Z',
};

const HAS_BUBBLE = new Set(['NAND', 'NOR', 'XNOR', 'NOT']);
const NOSE = { AND: 40, NAND: 40, OR: 42, NOR: 42, XOR: 42, XNOR: 42, NOT: 36, BUF: 36 };

/** Where the pins of a gate sit, relative to the gate's own origin. */
export function gatePins(kind) {
  const single = kind === 'NOT' || kind === 'BUF';
  const nose = NOSE[kind] + (HAS_BUBBLE.has(kind) ? 9 : 0);
  return {
    in: single ? [{ x: 0, y: 18 }] : [{ x: 2, y: 8 }, { x: 2, y: 28 }],
    out: { x: nose, y: 18 },
    w: nose,
    h: 36,
  };
}

/**
 * Draw a gate. Returns the <g>; call `g.setOutput(v)` to recolour the body.
 * `x`,`y` place the gate's top-left corner.
 */
export function gate(kind, x, y, label) {
  const g = s('g', { transform: `translate(${x} ${y})`, class: 'gate' });
  const body = s('path', {
    d: BODY[kind],
    fill: 'var(--surface-2)',
    stroke: 'var(--line)',
    'stroke-width': 2,
    'stroke-linejoin': 'round',
  });
  g.appendChild(body);

  if (kind === 'XOR' || kind === 'XNOR') {
    g.appendChild(s('path', {
      d: 'M-7 0 Q3 18 -7 36', fill: 'none', stroke: 'var(--line)', 'stroke-width': 2,
    }));
  }
  if (HAS_BUBBLE.has(kind)) {
    g.appendChild(s('circle', {
      cx: NOSE[kind] + 4.5, cy: 18, r: 4.5,
      fill: 'var(--surface-2)', stroke: 'var(--line)', 'stroke-width': 2,
    }));
  }

  const name = label ?? kind;
  if (name) {
    g.appendChild(s('text', {
      x: kind === 'NOT' || kind === 'BUF' ? 11 : 15, y: 22,
      'font-size': 9.5, 'font-family': 'var(--mono)', fill: 'var(--dimmer)',
      'text-anchor': 'middle', 'pointer-events': 'none', text: name,
    }));
  }

  g.setOutput = (v) => {
    body.setAttribute('stroke', v ? 'var(--on)' : 'var(--line)');
    body.setAttribute('fill', v ? 'color-mix(in srgb, var(--on) 14%, var(--surface-2))' : 'var(--surface-2)');
  };
  return g;
}

/** An orthogonal wire through the given points. `setValue(v)` recolours it. */
export function wire(points, opts = {}) {
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const path = s('path', {
    d, fill: 'none', stroke: 'var(--off)',
    'stroke-width': opts.width ?? 2.2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    class: 'wire',
  });
  path.setValue = (v) => {
    path.setAttribute('stroke', v ? 'var(--on)' : 'var(--off)');
    path.style.filter = v ? 'drop-shadow(0 0 4px var(--on-glow))' : 'none';
  };
  return path;
}

/** A clickable input pad. `onToggle` receives the new value. */
export function pad(x, y, label, value, onToggle) {
  const g = s('g', {
    class: 'pad', transform: `translate(${x} ${y})`, role: 'button', tabindex: '0',
    'aria-label': `Input ${label}`,
  });
  const c = s('circle', { r: 11, fill: 'var(--surface-2)', stroke: 'var(--line)', 'stroke-width': 2 });
  const t = s('text', {
    y: 4, 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'var(--mono)',
    'font-weight': 700, fill: 'var(--off)', 'pointer-events': 'none',
  });
  const lab = label ? s('text', {
    x: -20, y: 4, 'text-anchor': 'middle', 'font-size': 10, 'font-family': 'var(--mono)',
    fill: 'var(--dimmer)', 'pointer-events': 'none', text: label,
  }) : null;
  g.append(c, t);
  if (lab) g.appendChild(lab);

  let v = value ? 1 : 0;
  const paint = () => {
    t.textContent = String(v);
    t.setAttribute('fill', v ? 'var(--on)' : 'var(--off)');
    c.setAttribute('stroke', v ? 'var(--on)' : 'var(--line)');
    c.setAttribute('fill', v ? 'color-mix(in srgb, var(--on) 16%, var(--surface-2))' : 'var(--surface-2)');
  };
  const flip = () => { v ^= 1; paint(); onToggle(v); };
  g.addEventListener('click', flip);
  g.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
  });
  paint();
  g.get = () => v;
  g.set = (nv) => { v = nv ? 1 : 0; paint(); };
  return g;
}

/** A read-only output lamp. */
export function lamp(x, y, label) {
  const g = s('g', { transform: `translate(${x} ${y})` });
  const c = s('circle', { r: 12, fill: 'var(--surface-2)', stroke: 'var(--line)', 'stroke-width': 2 });
  const t = s('text', {
    y: 4.5, 'text-anchor': 'middle', 'font-size': 13, 'font-family': 'var(--mono)',
    'font-weight': 700, fill: 'var(--off)',
  });
  g.append(c, t);
  if (label) {
    g.appendChild(s('text', {
      x: 0, y: -18, 'text-anchor': 'middle', 'font-size': 10,
      'font-family': 'var(--mono)', fill: 'var(--dimmer)', text: label,
    }));
  }
  g.setValue = (v) => {
    t.textContent = String(v);
    t.setAttribute('fill', v ? 'var(--amber)' : 'var(--off)');
    c.setAttribute('stroke', v ? 'var(--amber)' : 'var(--line)');
    c.setAttribute('fill', v ? 'color-mix(in srgb, var(--amber) 18%, var(--surface-2))' : 'var(--surface-2)');
    g.style.filter = v ? 'drop-shadow(0 0 7px color-mix(in srgb, var(--amber) 55%, transparent))' : 'none';
  };
  g.setValue(0);
  return g;
}

/** A wall-clock driven tween. Never counts frames — a throttled tab must not stall it. */
export function tween(ms, onFrame, onDone) {
  const t0 = performance.now();
  let stopped = false;
  const step = (now) => {
    if (stopped) return;
    const k = clamp((now - t0) / ms, 0, 1);
    onFrame(k);
    if (k < 1) requestAnimationFrame(step);
    else onDone?.();
  };
  requestAnimationFrame(step);
  return () => { stopped = true; };
}
