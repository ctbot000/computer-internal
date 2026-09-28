/* Section 7 — why errors are the whole problem: an error budget, and a surface
   code patch that detects errors without looking at the data. */
import { h, s, svgRoot, $, clamp } from '../util.js';

/* ── how far a circuit gets before its own errors swamp it ───────────────── */
const fmtP = (p) => `${Number((p * 100).toPrecision(2))}%`;

function words(x) {
  if (x < 1e3) return Math.round(x).toLocaleString('en-US');
  if (x < 1e6) return `${Math.round(x / 1e3).toLocaleString('en-US')} thousand`;
  if (x < 1e9) return `${Number((x / 1e6).toPrecision(2))} million`;
  if (x < 1e12) return `${Number((x / 1e9).toPrecision(2))} billion`;
  return `${Number((x / 1e12).toPrecision(2))} trillion`;
}

export function initBudget() {
  const host = $('#budget');
  if (!host) return;

  const W = 660, H = 272, x0 = 62, x1 = W - 18, y0 = 18, y1 = 212, XMAX = 10;
  const X = (lg) => x0 + (lg / XMAX) * (x1 - x0);
  const Y = (p) => y1 - p * (y1 - y0);
  const svg = svgRoot(W, H, { role: 'img', 'aria-label': 'Chance a circuit succeeds against its number of gates, for several error rates' });

  const text = (x, y, t, anchor = 'middle', fill = 'var(--dimmer)', size = 10.5) => s('text', {
    x, y, 'text-anchor': anchor, 'font-size': size, 'font-family': 'var(--mono)', fill, text: t });

  const curve = (p) => {
    const ln = Math.log1p(-p);
    let d = '';
    for (let i = 0; i <= 240; i++) {
      const lg = (i / 240) * XMAX;
      d += `${i ? 'L' : 'M'}${X(lg).toFixed(1)} ${Y(Math.exp(ln * 10 ** lg)).toFixed(1)}`;
    }
    return d;
  };

  const ticks = ['1', '10', '100', '1k', '10k', '100k', '1M', '10M', '100M', '1B', '10B'];
  svg.append(
    s('rect', { x: X(9), y: y0, width: X(10) - X(9), height: y1 - y0, fill: 'color-mix(in srgb, var(--violet) 14%, transparent)' }),
    text(X(9.5), y0 + 14, 'useful', 'middle', 'var(--violet)'),
    text(X(9.5), y0 + 27, 'algorithms', 'middle', 'var(--violet)'),
    s('line', { x1: x0, y1, x2: x1, y2: y1, stroke: 'var(--line)' }),
    s('line', { x1: x0, y1: y0, x2: x0, y2: y1, stroke: 'var(--line)' }),
    s('line', { x1: x0, y1: Y(0.5), x2: x1, y2: Y(0.5), stroke: 'var(--dimmer)', 'stroke-dasharray': '4 4' }),
    text(x0 - 6, Y(1) + 4, '100%', 'end'), text(x0 - 6, Y(0.5) + 4, '50%', 'end'), text(x0 - 6, Y(0) + 4, '0', 'end'),
    ...ticks.map((t, i) => text(X(i), y1 + 16, t)),
    text((x0 + x1) / 2, H - 6, 'number of gates in the circuit (log scale)'),
  );

  [[1e-2, '1%'], [1e-3, '0.1%'], [1e-4, '0.01%']].forEach(([p, t]) => {
    const lg = Math.log10(Math.LN2 / p);
    svg.append(
      s('path', { d: curve(p), fill: 'none', stroke: 'var(--dimmer)', 'stroke-width': 1.3, opacity: 0.7 }),
      text(X(lg) + 4, Y(0.5) - 6, t, 'start'),
    );
  });

  const live = s('path', { fill: 'none', stroke: 'var(--rose)', 'stroke-width': 3 });
  const dot = s('circle', { r: 5.5, fill: 'var(--rose)', stroke: 'var(--surface)', 'stroke-width': 2 });
  svg.append(live, dot);

  const slider = h('input', { type: 'range', min: -6, max: -1, step: 0.1, value: -3, id: 'budget-p',
    'aria-label': 'Error rate per gate, as a power of ten' });
  const out = h('output', { for: 'budget-p' });
  const say = h('p', { class: 'budget-say' });

  host.append(
    h('div', { class: 'budget-ctl' }, [h('label', { for: 'budget-p', text: 'Error per gate' }), slider, out]),
    svg,
    say,
  );

  function update() {
    const p = 10 ** clamp(Number(slider.value), -6, -1);
    live.setAttribute('d', curve(p));
    const n50 = Math.log(0.5) / Math.log1p(-p);
    dot.setAttribute('cx', X(Math.log10(n50)));
    dot.setAttribute('cy', Y(0.5));
    out.textContent = fmtP(p);
    const needed = Math.LN2 / 1e9;
    say.innerHTML = `At <b>${fmtP(p)}</b> per gate, a circuit fails more often than it succeeds after about <b>${words(n50)}</b> gates. `
      + `A billion operations would need gates roughly <b>${words(p / needed)} times</b> more reliable than that — which is why nobody expects to get there by better hardware alone.`;
  }
  slider.addEventListener('input', update);
  update();
}

/* ── a rotated surface code patch ────────────────────────────────────────── */
export function initSurface() {
  const host = $('#sc');
  if (!host) return;

  let d = 3;
  let mode = 1;                // 1 = X error, 2 = Z error
  let err = new Uint8Array(9);

  const figHost = h('div', { class: 'sc-fig' });
  const facts = h('p', { class: 'sc-say' });
  const say = h('p', { class: 'sc-say' });
  const legend = h('div', { class: 'sc-legend' }, [
    h('span', {}, [h('i', { class: 'sw', style: 'background:color-mix(in srgb, var(--violet) 35%, transparent)' }), 'X check: catches Z errors']),
    h('span', {}, [h('i', { class: 'sw', style: 'background:color-mix(in srgb, var(--accent) 35%, transparent)' }), 'Z check: catches X errors']),
    h('span', {}, [h('i', { class: 'sw', style: 'background:var(--amber)' }), 'check that disagrees']),
    h('span', {}, [h('i', { class: 'sw', style: 'background:var(--rose);border-radius:50%' }), 'data qubit with an error']),
  ]);
  host.append(figHost, h('div', { class: 'sc-side' }, [facts, say, legend]));

  const ctl = $('#sc-controls');
  const dBtns = [3, 5, 7].map((v) => h('button', { class: 'chip-btn', type: 'button', text: `d = ${v}`,
    onclick: () => { d = v; err = new Uint8Array(d * d); build(); } }));
  const mBtns = [[1, 'X errors'], [2, 'Z errors']].map(([v, t]) => h('button', { class: 'chip-btn', type: 'button', text: t,
    onclick: () => { mode = v; paintControls(); } }));
  const clearBtn = h('button', { class: 'chip-btn', type: 'button', text: 'Clear', onclick: () => { err.fill(0); paint(); } });
  ctl?.append(...dBtns, ...mBtns, clearBtn);

  let stabs = [];
  let qubits = [];

  function build() {
    const sp = 60, m = 44;
    const size = (d - 1) * sp + 2 * m;
    const svg = svgRoot(size, size, { role: 'group', 'aria-label': `Surface code patch of distance ${d}`,
      style: 'display:block;max-width:100%;height:auto' });
    const P = (r, c) => [m + c * sp, m + r * sp];
    const plaqG = s('g', {});
    const ancG = s('g', {});
    const dataG = s('g', {});
    svg.append(plaqG, ancG, dataG);

    stabs = [];
    const add = (type, pr, pc, shape, anc) => {
      const qs = [[pr - 1, pc - 1], [pr - 1, pc], [pr, pc - 1], [pr, pc]]
        .filter(([r, c]) => r >= 0 && c >= 0 && r < d && c < d);
      const col = type === 'X' ? 'var(--violet)' : 'var(--accent)';
      shape.setAttribute('fill', `color-mix(in srgb, ${col} 20%, transparent)`);
      shape.setAttribute('stroke', 'var(--surface)');
      shape.setAttribute('stroke-width', 1.5);
      plaqG.appendChild(shape);
      const a = s('rect', { x: anc[0] - 5.5, y: anc[1] - 5.5, width: 11, height: 11, rx: 2.5, 'stroke-width': 1.5 });
      a.style.stroke = col;
      ancG.appendChild(a);
      stabs.push({ type, qs, anc: a, col });
    };

    for (let pr = 0; pr <= d; pr++) {
      for (let pc = 0; pc <= d; pc++) {
        const type = (pr + pc) % 2 === 0 ? 'X' : 'Z';
        const bulk = pr >= 1 && pr <= d - 1 && pc >= 1 && pc <= d - 1;
        const [ax, ay] = P(pr - 1, pc - 1);
        if (bulk) {
          add(type, pr, pc, s('rect', { x: ax, y: ay, width: sp, height: sp }), [ax + sp / 2, ay + sp / 2]);
          continue;
        }
        const rim = sp / 2;
        if ((pr === 0 || pr === d) && pc >= 1 && pc <= d - 1 && type === 'X') {
          const y = pr === 0 ? m : m + (d - 1) * sp;
          const xa = m + (pc - 1) * sp, xb = m + pc * sp;
          const up = pr === 0;
          add(type, pr, pc, s('path', { d: `M${xa} ${y} A${rim} ${rim} 0 0 ${up ? 1 : 0} ${xb} ${y} Z` }),
            [(xa + xb) / 2, y + (up ? -rim / 2 : rim / 2)]);
        } else if ((pc === 0 || pc === d) && pr >= 1 && pr <= d - 1 && type === 'Z') {
          const x = pc === 0 ? m : m + (d - 1) * sp;
          const ya = m + (pr - 1) * sp, yb = m + pr * sp;
          const left = pc === 0;
          add(type, pr, pc, s('path', { d: `M${x} ${ya} A${rim} ${rim} 0 0 ${left ? 0 : 1} ${x} ${yb} Z` }),
            [x + (left ? -rim / 2 : rim / 2), (ya + yb) / 2]);
        }
      }
    }

    qubits = [];
    for (let r = 0; r < d; r++) {
      for (let c = 0; c < d; c++) {
        const [x, y] = P(r, c);
        const g = s('g', { class: 'data-q', role: 'button', tabindex: '0' });
        const dq = s('circle', { class: 'dq', cx: x, cy: y, r: 9.5, 'stroke-width': 2 });
        const t = s('text', { x, y: y + 3.8, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 700,
          'font-family': 'var(--mono)', 'pointer-events': 'none' });
        g.append(s('circle', { cx: x, cy: y, r: 17, fill: 'transparent' }), dq, t);
        const i = r * d + c;
        const flip = () => { err[i] ^= mode; paint(); };
        g.addEventListener('click', flip);
        g.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
        });
        dataG.appendChild(g);
        qubits.push({ g, dq, t, r, c });
      }
    }

    figHost.replaceChildren(svg);
    const data = d * d, meas = d * d - 1;
    facts.innerHTML = `<b>d = ${d}</b>: ${data} data qubits + ${meas} measurement qubits = <b>${data + meas} physical qubits</b> `
      + `for one logical qubit. It can fix any ${(d - 1) / 2} error${d === 3 ? '' : 's'}.`;
    paintControls();
    paint();
  }

  function paintControls() {
    dBtns.forEach((b, i) => b.classList.toggle('on', [3, 5, 7][i] === d));
    mBtns.forEach((b, i) => b.classList.toggle('on', i + 1 === mode));
  }

  function paint() {
    let lit = 0;
    for (const st of stabs) {
      const bit = st.type === 'Z' ? 1 : 2;      // Z checks see X errors; X checks see Z errors
      const on = st.qs.reduce((a, [r, c]) => a ^ ((err[r * d + c] & bit) ? 1 : 0), 0);
      st.anc.style.fill = on ? 'var(--amber)' : 'var(--surface)';
      st.anc.style.stroke = on ? 'var(--amber)' : st.col;
      st.anc.style.filter = on ? 'drop-shadow(0 0 6px color-mix(in srgb, var(--amber) 70%, transparent))' : 'none';
      lit += on;
    }
    let count = 0;
    for (const q of qubits) {
      const e = err[q.r * d + q.c];
      if (e) count++;
      q.dq.style.fill = e ? 'var(--rose)' : 'var(--surface)';
      q.dq.style.stroke = e ? 'var(--rose)' : 'var(--dim)';
      q.t.textContent = e === 1 ? 'X' : e === 2 ? 'Z' : e === 3 ? 'Y' : '';
      q.t.style.fill = '#fff';
      q.g.setAttribute('aria-label', `Data qubit row ${q.r + 1}, column ${q.c + 1}: ${q.t.textContent ? `${q.t.textContent} error` : 'no error'}`);
    }

    const t = (d - 1) / 2;
    if (!count) {
      say.innerHTML = 'No errors, so every check agrees. Click a data qubit (the round ones) to flip it.';
    } else if (lit) {
      say.innerHTML = `<b>${lit} check${lit === 1 ? '' : 's'} disagree.</b> A decoder — ordinary classical software — reads this pattern and infers the likeliest errors, without ever measuring a data qubit.`
        + (count > t ? ` That is more errors than a distance-${d} patch is guaranteed to fix (${t}).` : '');
    } else {
      // No check fires: either the errors amount to nothing, or they form a chain
      // from edge to edge that flips the logical qubit itself.
      let xl = 0, zl = 0;
      for (let c = 0; c < d; c++) xl ^= err[c] & 1;
      for (let r = 0; r < d; r++) zl ^= (err[r * d] & 2) ? 1 : 0;
      say.innerHTML = xl || zl
        ? `<b>Every check agrees — and the data is wrong.</b> A chain of errors running from edge to edge slips past every check: a logical error. It takes ${d} errors in a line, which is why a bigger patch is safer.`
        : '<b>Every check agrees, and no harm is done:</b> these errors add up to the same thing as one of the checks, which leaves the logical qubit untouched.';
    }
  }

  build();
}
