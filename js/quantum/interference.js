/* Section 3 — interference: two coin flips against two Hadamards, with a
   phase between them, drawn as paths, as arrows being added, and as a fringe. */
import { h, s, svgRoot, $, clamp } from '../util.js';
import { pct } from './viz.js';

const TAU = 2 * Math.PI;

/* ── a two-stage branching diagram ───────────────────────────────────────── */
function tree(quantum) {
  const W = 352, H = 200;
  const svg = svgRoot(W, H, { role: 'img',
    'aria-label': quantum ? 'Paths of a qubit through two Hadamard gates' : 'Paths of a coin flipped twice' });

  const N = { S: [44, 100], M0: [165, 52], M1: [165, 148], E0: [282, 52], E1: [282, 148] };
  const r = 17;

  const edge = (a, b, neg) => {
    const [x1, y1] = N[a], [x2, y2] = N[b];
    const d = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / d, uy = (y2 - y1) / d;
    return s('line', { x1: x1 + ux * r, y1: y1 + uy * r, x2: x2 - ux * r, y2: y2 - uy * r,
      stroke: neg ? 'var(--rose)' : 'var(--line)', 'stroke-width': 2.4, 'stroke-linecap': 'round' });
  };
  const text = (x, y, t, fill = 'var(--dim)', size = 11, anchor = 'middle') => s('text', {
    x, y, 'text-anchor': anchor, 'font-size': size, 'font-family': 'var(--mono)', fill, text: t });

  svg.append(
    text(104, 16, quantum ? 'H' : 'flip', 'var(--violet)', 12),
    text(224, 16, quantum ? 'H' : 'flip', 'var(--violet)', 12),
    edge('S', 'M0'), edge('S', 'M1'), edge('M0', 'E0'), edge('M0', 'E1'), edge('M1', 'E0'), edge('M1', 'E1', quantum),
  );

  const w = quantum ? '1/√2' : '½';
  svg.append(
    text(92, 66, w), text(92, 146, w),
    text(224, 44, w), text(224, 170, quantum ? '−1/√2' : w, quantum ? 'var(--rose)' : 'var(--dim)'),
    text(200, 83, w, 'var(--dim)', 10.5), text(200, 125, w, 'var(--dim)', 10.5),
  );

  const node = (k, t) => {
    const [x, y] = N[k];
    const c = s('circle', { cx: x, cy: y, r, fill: 'var(--surface)', stroke: 'var(--line)', 'stroke-width': 2 });
    svg.append(c, text(x, y + 4.5, t, 'var(--text)', 13));
    return c;
  };
  node('S', '0'); node('M0', '0');
  const m1 = node('M1', '1');
  const e0 = node('E0', '0');
  const e1 = node('E1', '1');

  // the phase gate sits on the |1⟩ branch between the two Hadamards
  let dial = null;
  if (quantum) {
    const [x, y] = N.M1;
    dial = s('line', { x1: x, y1: y + 30, x2: x + 11, y2: y + 30, stroke: 'var(--violet)', 'stroke-width': 2, 'stroke-linecap': 'round' });
    svg.append(
      s('circle', { cx: x, cy: y + 30, r: 11, fill: 'var(--surface)', stroke: 'var(--violet)', 'stroke-width': 1.5 }),
      dial,
      text(x + 18, y + 34, 'φ', 'var(--violet)', 12, 'start'),
    );
    m1.setAttribute('stroke', 'var(--violet)');
  }

  const p0t = text(N.E0[0] + 24, N.E0[1] + 4, '', 'var(--text)', 12, 'start');
  const p1t = text(N.E1[0] + 24, N.E1[1] + 4, '', 'var(--text)', 12, 'start');
  svg.append(p0t, p1t);

  const paint = (c, p, col) => {
    c.style.fill = `color-mix(in srgb, ${col} ${Math.round(p * 70)}%, var(--surface))`;
    c.style.stroke = p > 0.005 ? col : 'var(--line)';
  };

  return {
    el: svg,
    set(phi) {
      const p1 = quantum ? Math.sin(phi / 2) ** 2 : 0.5;
      const p0 = 1 - p1;
      paint(e0, p0, 'var(--q0)');
      paint(e1, p1, 'var(--q1)');
      p0t.textContent = pct(p0);
      p1t.textContent = pct(p1);
      if (dial) {
        const [x, y] = N.M1;
        dial.setAttribute('x2', (x + 11 * Math.cos(phi)).toFixed(2));
        dial.setAttribute('y2', (y + 30 - 11 * Math.sin(phi)).toFixed(2));
      }
    },
  };
}

/* ── adding the arrows for one outcome ───────────────────────────────────── */
function arrow(color, width) {
  const g = s('g', {});
  const line = s('line', { stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' });
  const head = s('path', { fill: color });
  g.append(line, head);
  return {
    g,
    set(x1, y1, x2, y2) {
      const d = Math.hypot(x2 - x1, y2 - y1);
      g.style.display = d < 0.5 ? 'none' : '';
      if (d < 0.5) return;
      const ux = (x2 - x1) / d, uy = (y2 - y1) / d;
      const hl = Math.min(9, d * 0.45), hw = hl * 0.55;
      const bx = x2 - ux * hl, by = y2 - uy * hl;
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', bx); line.setAttribute('y2', by);
      head.setAttribute('d', `M${x2} ${y2} L${bx - uy * hw} ${by + ux * hw} L${bx + uy * hw} ${by - ux * hw} Z`);
    },
  };
}

function phasor(outcome) {
  const W = 210, H = 170, O = [58, 85], U = 110;       // U px per unit of amplitude
  const svg = svgRoot(W, H, { role: 'img', 'aria-label': `Amplitudes adding up for outcome ${outcome}` });
  svg.append(
    s('line', { x1: 8, y1: O[1], x2: W - 8, y2: O[1], stroke: 'var(--line)', 'stroke-width': 1 }),
    s('line', { x1: O[0], y1: 10, x2: O[0], y2: H - 10, stroke: 'var(--line)', 'stroke-width': 1 }),
  );
  // The total is a wide translucent band underneath, so it stays visible when the
  // two arrows it is made of lie along it.
  const t = arrow('color-mix(in srgb, var(--amber) 55%, transparent)', 11);
  const a = arrow('var(--q0)', 5);
  const b = arrow('var(--violet)', 2.6);
  svg.append(t.g, a.g, b.g);
  const out = s('text', { x: W - 8, y: H - 10, 'text-anchor': 'end', 'font-size': 12, 'font-family': 'var(--mono)', fill: 'var(--amber)' });
  svg.appendChild(out);

  return {
    el: svg,
    set(phi) {
      const psi = outcome ? phi + Math.PI : phi;       // the −1 in H's corner adds half a turn
      const ax = O[0] + 0.5 * U, ay = O[1];
      const bx = ax + 0.5 * U * Math.cos(psi), by = ay - 0.5 * U * Math.sin(psi);
      a.set(O[0], O[1], ax, ay);
      b.set(ax, ay, bx, by);
      t.set(O[0], O[1], bx, by);
      const mag = Math.hypot(bx - O[0], by - O[1]) / U;
      out.textContent = `|total|² = ${pct(mag * mag)}`;
    },
  };
}

/* ── the fringe: both probabilities as the phase turns ───────────────────── */
function fringe() {
  const W = 330, H = 170, x0 = 40, x1 = W - 12, y0 = 14, y1 = 132;
  const X = (phi) => x0 + (phi / TAU) * (x1 - x0);
  const Y = (p) => y1 - p * (y1 - y0);
  const svg = svgRoot(W, H, { role: 'img', 'aria-label': 'Chance of each outcome as the phase turns' });

  const curve = (f) => {
    let d = '';
    for (let i = 0; i <= 120; i++) {
      const phi = (i / 120) * TAU;
      d += `${i ? 'L' : 'M'}${X(phi).toFixed(1)} ${Y(f(phi)).toFixed(1)}`;
    }
    return d;
  };
  const text = (x, y, t, anchor = 'middle', fill = 'var(--dimmer)') => s('text', {
    x, y, 'text-anchor': anchor, 'font-size': 10, 'font-family': 'var(--mono)', fill, text: t });

  svg.append(
    s('line', { x1: x0, y1, x2: x1, y2: y1, stroke: 'var(--line)' }),
    s('line', { x1: x0, y1: y0, x2: x0, y2: y1, stroke: 'var(--line)' }),
    s('line', { x1: x0, y1: Y(0.5), x2: x1, y2: Y(0.5), stroke: 'var(--dimmer)', 'stroke-dasharray': '4 4', opacity: 0.8 }),
    text(x0 + 6, Y(0.5) - 6, 'coin: always 50%', 'start'),
    text(x0 - 6, Y(1) + 4, '100%', 'end'), text(x0 - 6, Y(0) + 4, '0', 'end'),
    ...[0, 90, 180, 270, 360].map((dg) => text(X((dg / 360) * TAU), y1 + 15, `${dg}°`)),
    text((x0 + x1) / 2, H - 4, 'phase φ between the two H gates'),
    s('path', { d: curve((p) => Math.cos(p / 2) ** 2), fill: 'none', stroke: 'var(--q0)', 'stroke-width': 2.2 }),
    s('path', { d: curve((p) => Math.sin(p / 2) ** 2), fill: 'none', stroke: 'var(--q1)', 'stroke-width': 2.2 }),
  );
  const cursor = s('line', { y1: y0, y2: y1, stroke: 'var(--violet)', 'stroke-width': 1.5 });
  const d0 = s('circle', { r: 5, fill: 'var(--q0)' });
  const d1 = s('circle', { r: 5, fill: 'var(--q1)' });
  svg.append(cursor, d0, d1);

  return {
    el: svg,
    set(phi) {
      const x = X(phi);
      cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);
      d0.setAttribute('cx', x); d0.setAttribute('cy', Y(Math.cos(phi / 2) ** 2));
      d1.setAttribute('cx', x); d1.setAttribute('cy', Y(Math.sin(phi / 2) ** 2));
    },
  };
}

export function initInterference() {
  const host = $('#interf');
  if (!host) return;

  const coin = tree(false);
  const qubit = tree(true);
  const ph0 = phasor(0);
  const ph1 = phasor(1);
  const fr = fringe();

  const slider = h('input', { type: 'range', min: 0, max: 360, step: 1, value: 0,
    id: 'interf-phi', 'aria-label': 'Phase between the two Hadamard gates, in degrees' });
  const out = h('output', { for: 'interf-phi' });
  const say = h('p', { class: 'fig-note' });

  const fig = (title, node, note) => h('div', { class: 'fig' },
    [h('h5', { text: title }), node, note ? h('p', { class: 'fig-note', text: note }) : null]);

  host.append(
    h('div', { class: 'interf-ctl' }, [h('label', { for: 'interf-phi', text: 'Phase φ' }), slider, out]),
    h('div', { class: 'interf-trees' }, [
      fig('A fair coin, flipped twice', coin.el, 'Every branch has probability ½. Two routes lead to each outcome, and their chances add: ¼ + ¼ = ½, whatever you do.'),
      h('div', { class: 'fig' }, [h('h5', { text: 'A qubit: H, then a phase φ on the 1 branch, then H' }), qubit.el, say]),
    ]),
    h('div', { class: 'interf-lower' }, [
      fig('Arrows arriving at 0', ph0.el, 'One arrow per route: via 0 (teal) and via 1 (violet). Tip to tail, they make the total.'),
      fig('Arrows arriving at 1', ph1.el, 'The route through 1 picks up H’s minus sign: half a turn.'),
      h('div', { class: 'fig fringe-box' }, [h('h5', { text: 'The chance of each outcome, all the way round' }), fr.el]),
    ]),
  );

  const presets = [['nothing', 0], ['S', 90], ['Z', 180]];
  const chips = presets.map(([name, deg]) => {
    const b = h('button', { class: 'chip-btn', type: 'button', text: `${name} (${deg}°)`,
      title: deg ? `Put a ${name} gate between the two H gates` : 'No gate between the two H gates' });
    b.addEventListener('click', () => { slider.value = String(deg); update(); });
    return [b, deg];
  });
  $('#interf-presets')?.append(...chips.map(([b]) => b));

  function update() {
    const deg = clamp(Number(slider.value), 0, 360);
    const phi = (deg / 360) * TAU;
    out.textContent = `${deg}°`;
    coin.set(phi); qubit.set(phi); ph0.set(phi); ph1.set(phi); fr.set(phi);
    chips.forEach(([b, d]) => b.classList.toggle('on', d === deg));
    const p1 = Math.sin(phi / 2) ** 2;
    say.textContent = p1 < 0.005
      ? 'The two routes into 1 cancel exactly; the two into 0 reinforce. Result: 0, with certainty.'
      : p1 > 0.995
        ? 'Now it is the routes into 0 that cancel. Result: 1, with certainty — the same gates, one phase apart.'
        : `Partly cancelling: ${pct(1 - p1)} for 0 and ${pct(p1)} for 1.`;
  }
  slider.addEventListener('input', update);
  update();
}
