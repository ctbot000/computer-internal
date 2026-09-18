/* Section 4 — a circuit that holds still, and one that picks a row. */
import { h, s, svgRoot, $, gate, wire, pad, lamp, gatePins, bin } from './util.js';

/* ── SR latch ─────────────────────────────────────────────────────────────── */
function srLatch(host) {
  const W = 470, H = 200;
  const svg = svgRoot(W, H, { role: 'img', 'aria-label': 'An SR latch built from two NOR gates' });
  const nose = gatePins('NOR').w;

  const n1 = gate('NOR', 150, 30, 'NOR');
  const n2 = gate('NOR', 150, 118, 'NOR');
  const o1x = 150 + nose, o1y = 48;
  const o2x = 150 + nose, o2y = 136;

  const wR = wire([[40, 22], [136, 22], [136, 38], [152, 38]]);
  const wS = wire([[40, 176], [136, 176], [136, 146], [152, 146]]);
  const fbQ = wire([[o1x, o1y], [o1x + 30, o1y], [o1x + 30, 100], [124, 100], [124, 126], [152, 126]]);
  const fbQb = wire([[o2x, o2y], [o2x + 16, o2y], [o2x + 16, 84], [112, 84], [112, 58], [152, 58]]);
  const wQ = wire([[o1x, o1y], [W - 66, o1y]]);
  const wQb = wire([[o2x, o2y], [W - 66, o2y]]);

  const lQ = lamp(W - 44, o1y, 'Q');
  const lQb = lamp(W - 44, o2y, 'NOT Q');

  svg.append(fbQ, fbQb, wR, wS, wQ, wQb, n1, n2, lQ, lQb);
  svg.append(
    s('text', { x: 24, y: 26, 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--dimmer)', text: 'R' }),
    s('text', { x: 24, y: 180, 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--dimmer)', text: 'S' }),
  );

  let q = 0, qb = 1, S = 0, R = 0;
  const note = h('p', { class: 'latch-note' });

  function settle() {
    for (let i = 0; i < 12; i++) {
      const nq = (R | qb) ^ 1;
      const nqb = (S | q) ^ 1;
      if (nq === q && nqb === qb) break;
      q = nq; qb = nqb;
    }
    wR.setValue(R); wS.setValue(S);
    wQ.setValue(q); wQb.setValue(qb);
    fbQ.setValue(q); fbQb.setValue(qb);
    n1.setOutput(q); n2.setOutput(qb);
    lQ.setValue(q); lQb.setValue(qb);

    note.textContent = S && R
      ? 'Both at once: the one input combination the latch is not allowed. Q and NOT Q are both 0 — it is no longer storing anything.'
      : S ? 'Set is pressed. Q goes to 1.'
      : R ? 'Reset is pressed. Q goes to 0.'
      : `Nothing is pressed, and the latch is still holding ${q}. The output is feeding its own input — that loop is the memory.`;
  }

  const holdBtn = (label, set) => {
    const b = h('button', { class: 'btn-hold', type: 'button', text: label });
    const down = (e) => { e.preventDefault(); b.classList.add('pressed'); set(1); settle(); };
    const up = () => { if (!b.classList.contains('pressed')) return; b.classList.remove('pressed'); set(0); settle(); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
    // Both handlers are idempotent, so mouse events are a harmless fallback
    // anywhere pointer events do not arrive.
    b.addEventListener('mousedown', down);
    b.addEventListener('mouseup', up);
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); down(e); }
    });
    b.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); up(); }
    });
    b.addEventListener('blur', up);
    return b;
  };

  const btns = h('div', { class: 'latch-btns' }, [
    holdBtn('Set', (v) => { S = v; }),
    holdBtn('Reset', (v) => { R = v; }),
  ]);

  host.append(svg, btns, note);
  settle();
}

/* ── 3-to-8 address decoder ───────────────────────────────────────────────── */
function decoder(host) {
  const W = 540, H = 272;
  const svg = svgRoot(W, H, { role: 'img', 'aria-label': 'A 3 to 8 address decoder selecting one memory row' });

  const SAMPLE = [0b00001111, 0b10110010, 0b01000001, 0b11111110,
                  0b00100100, 0b10011001, 0b01010101, 0b11000011];

  let addr = 5;
  const bitsState = [1, 0, 1]; // A2 A1 A0

  // decoder body
  svg.appendChild(s('path', {
    d: 'M92 22 L166 52 L166 240 L92 270 Z',
    fill: 'var(--surface-2)', stroke: 'var(--line)', 'stroke-width': 2, 'stroke-linejoin': 'round',
  }));
  svg.appendChild(s('text', {
    x: 128, y: 150, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'var(--mono)',
    fill: 'var(--dimmer)', transform: 'rotate(-90 128 150)', text: '3 → 8 decoder',
  }));

  const inWires = [], pads = [];
  const inY = [86, 146, 206];
  ['A2', 'A1', 'A0'].forEach((lab, i) => {
    const w = wire([[44, inY[i]], [94, inY[i]]]);
    inWires.push(w);
    svg.appendChild(w);
    pads.push(pad(32, inY[i], lab, bitsState[i], (v) => { bitsState[i] = v; upd(); }));
  });

  const rowY = [], outWires = [], rowRects = [], rowTexts = [], rowAddr = [];
  for (let i = 0; i < 8; i++) {
    const y = 34 + i * 29;
    rowY.push(y);
    const w = wire([[166, y], [206, y]], { width: 2 });
    outWires.push(w);
    svg.appendChild(w);

    const r = s('rect', { x: 206, y: y - 12, width: 312, height: 24, rx: 5,
      fill: 'var(--surface-2)', stroke: 'var(--line-soft)', 'stroke-width': 1.5 });
    rowRects.push(r);
    svg.appendChild(r);

    const a = s('text', { x: 218, y: y + 4, 'font-size': 10, 'font-family': 'var(--mono)',
      fill: 'var(--dimmer)', text: i.toString(2).padStart(3, '0') });
    rowAddr.push(a);
    svg.appendChild(a);

    const t = s('text', { x: 268, y: y + 4.5, 'font-size': 12, 'font-family': 'var(--mono)',
      'letter-spacing': '3', fill: 'var(--dim)', text: bin(SAMPLE[i]) });
    rowTexts.push(t);
    svg.appendChild(t);
  }

  svg.appendChild(s('text', { x: 360, y: 16, 'text-anchor': 'middle', 'font-size': 10,
    'font-family': 'var(--mono)', fill: 'var(--dimmer)', 'letter-spacing': '.1em',
    text: 'eight rows of eight latches' }));

  svg.append(...pads);

  const caption = h('p', { class: 'latch-note' });
  const ctl = h('div', { class: 'dec-addr' });
  const mk = (t) => h('button', { class: 'btn', type: 'button', text: t });
  const prev = mk('‹ prev'), next = mk('next ›');
  const addrChip = h('div', { class: 'chip hero-chip' }, [h('span', { text: 'address' }), h('b', {})]);
  ctl.append(prev, addrChip, next);

  const setAddr = (v) => {
    addr = (v + 8) % 8;
    bitsState[0] = (addr >> 2) & 1;
    bitsState[1] = (addr >> 1) & 1;
    bitsState[2] = addr & 1;
    pads.forEach((p, i) => p.set(bitsState[i]));
    upd();
  };
  prev.addEventListener('click', () => setAddr(addr - 1));
  next.addEventListener('click', () => setAddr(addr + 1));

  function upd() {
    addr = (bitsState[0] << 2) | (bitsState[1] << 1) | bitsState[2];
    inWires.forEach((w, i) => w.setValue(bitsState[i]));
    for (let i = 0; i < 8; i++) {
      const on = i === addr;
      outWires[i].setValue(on ? 1 : 0);
      rowRects[i].setAttribute('stroke', on ? 'var(--amber)' : 'var(--line-soft)');
      rowRects[i].setAttribute('fill', on
        ? 'color-mix(in srgb, var(--amber) 14%, var(--surface-2))' : 'var(--surface-2)');
      rowTexts[i].setAttribute('fill', on ? 'var(--amber)' : 'var(--dim)');
      rowAddr[i].setAttribute('fill', on ? 'var(--amber)' : 'var(--dimmer)');
    }
    addrChip.lastChild.textContent = `${addr}`;
    caption.innerHTML = `Three wires carry <code>${addr.toString(2).padStart(3, '0')}</code>, `
      + `so exactly one of eight rows is switched on. Twenty wires would reach a million rows — `
      + `an address is short because each extra wire doubles what it can reach.`;
  }

  host.append(svg, ctl, caption);
  upd();
}

export function initMemory() {
  const l = $('#latch');
  const d = $('#decoder');
  if (l) srLatch(l);
  if (d) decoder(d);
}
