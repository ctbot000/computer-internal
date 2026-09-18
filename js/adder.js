/* Section 3 — a full adder, then eight of them in a row. */
import { h, svgRoot, $, gate, wire, pad, lamp, gatePins } from './util.js';

/* ── full adder ───────────────────────────────────────────────────────────── */
function fullAdder(host) {
  const W = 520, H = 244;
  const svg = svgRoot(W, H, { role: 'img', 'aria-label': 'A full adder built from five gates' });
  svg.setAttribute('viewBox', `-18 0 ${W + 18} ${H}`);   // room for the pin labels
  const nose = { x: gatePins('XOR').w, a: gatePins('AND').w, o: gatePins('OR').w };

  const x1 = gate('XOR', 110, 26, 'XOR');
  const a1 = gate('AND', 110, 150, 'AND');
  const x2 = gate('XOR', 250, 20, 'XOR');
  const a2 = gate('AND', 250, 86, 'AND');
  const o1 = gate('OR',  340, 120, 'OR');

  const st = { a: 0, b: 0, c: 0 };

  const wA1 = wire([[37, 34], [112, 34]]);
  const wA2 = wire([[60, 34], [60, 158], [112, 158]]);
  const wB1 = wire([[37, 54], [112, 54]]);
  const wB2 = wire([[80, 54], [80, 178], [112, 178]]);
  const wC1 = wire([[37, 214], [210, 214], [210, 48], [252, 48]]);
  const wC2 = wire([[210, 114], [252, 114]]);
  const wS1 = wire([[110 + nose.x, 44], [180, 44], [180, 28], [252, 28]]);
  const wS2 = wire([[180, 44], [180, 94], [252, 94]]);
  const wSum = wire([[250 + nose.x, 38], [456, 38]]);
  const wA2o = wire([[250 + nose.a, 104], [302, 104], [302, 128], [344, 128]]);
  const wA1o = wire([[110 + nose.a, 168], [320, 168], [320, 148], [344, 148]]);
  const wCo = wire([[340 + nose.o, 138], [456, 138]]);

  const lSum = lamp(W - 46, 38, 'SUM');
  const lCo = lamp(W - 46, 138, 'CARRY OUT');

  const pA = pad(26, 34, 'A', 0, (v) => { st.a = v; upd(); });
  const pB = pad(26, 54, 'B', 0, (v) => { st.b = v; upd(); });
  const pC = pad(26, 214, 'Cin', 0, (v) => { st.c = v; upd(); });

  svg.append(wA1, wA2, wB1, wB2, wC1, wC2, wS1, wS2, wA2o, wA1o, wSum, wCo,
    x1, a1, x2, a2, o1, pA, pB, pC, lSum, lCo);

  const readout = h('div', { class: 'fa-readout' });
  const cSum = h('div', { class: 'chip' }, [h('span', { text: 'sum bit' }), h('b', { text: '0' })]);
  const cCo = h('div', { class: 'chip' }, [h('span', { text: 'carry out' }), h('b', { text: '0' })]);
  const cTot = h('div', { class: 'chip hero-chip' }, [h('span', { text: 'A + B + Cin' }), h('b', { text: '0' })]);
  readout.append(cTot, cSum, cCo);

  function upd() {
    const s1 = st.a ^ st.b;
    const c1 = st.a & st.b;
    const sum = s1 ^ st.c;
    const c2 = s1 & st.c;
    const cout = c1 | c2;

    wA1.setValue(st.a); wA2.setValue(st.a);
    wB1.setValue(st.b); wB2.setValue(st.b);
    wC1.setValue(st.c); wC2.setValue(st.c);
    wS1.setValue(s1); wS2.setValue(s1);
    wA1o.setValue(c1); wA2o.setValue(c2);
    wSum.setValue(sum); wCo.setValue(cout);

    x1.setOutput(s1); a1.setOutput(c1); x2.setOutput(sum); a2.setOutput(c2); o1.setOutput(cout);
    lSum.setValue(sum); lCo.setValue(cout);

    const total = st.a + st.b + st.c;
    cSum.lastChild.textContent = String(sum);
    cCo.lastChild.textContent = String(cout);
    cTot.lastChild.textContent = `${total}  =  ${cout}${sum}₂`;
  }

  host.append(svg, readout);
  upd();
}

/* ── 8-bit ripple-carry adder ─────────────────────────────────────────────── */
function ripple(host) {
  let A = 0b01101011, B = 0b00101101;
  let cancel = null;

  const grid = h('div', { class: 'ripple-grid' });
  const mk = (cls, txt) => h('div', { class: `rp-cell ${cls}`, text: txt });

  const carryCells = [], aCells = [], bCells = [], sumCells = [];

  const label = (t) => h('div', { class: 'rp-label', text: t });

  grid.appendChild(label('carry in'));
  for (let i = 7; i >= 0; i--) { const c = mk('carry', '0'); carryCells[i] = c; grid.appendChild(c); }

  grid.appendChild(label('A'));
  for (let i = 7; i >= 0; i--) {
    const c = mk('click', '0');
    c.addEventListener('click', () => { A ^= (1 << i); stop(); paint(true); });
    aCells[i] = c; grid.appendChild(c);
  }

  grid.appendChild(label('B'));
  for (let i = 7; i >= 0; i--) {
    const c = mk('click', '0');
    c.addEventListener('click', () => { B ^= (1 << i); stop(); paint(true); });
    bCells[i] = c; grid.appendChild(c);
  }

  grid.appendChild(label('sum'));
  for (let i = 7; i >= 0; i--) { const c = mk('rp-sum', '0'); sumCells[i] = c; grid.appendChild(c); }

  const foot = h('div', { class: 'ripple-foot' });
  const chipA = h('div', { class: 'chip' }, [h('span', { text: 'A' }), h('b', {})]);
  const chipB = h('div', { class: 'chip' }, [h('span', { text: 'B' }), h('b', {})]);
  const chipS = h('div', { class: 'chip hero-chip' }, [h('span', { text: 'sum' }), h('b', {})]);
  const chipC = h('div', { class: 'chip' }, [h('span', { text: 'carry out' }), h('b', {})]);
  foot.append(chipA, chipB, chipS, chipC);

  const setCell = (cell, v, settled) => {
    cell.textContent = String(v);
    cell.classList.toggle('on', !!v);
    cell.classList.toggle('pending', !settled);
    cell.classList.remove('lit');
  };

  function paint(settled = true) {
    let carry = 0;
    for (let i = 0; i < 8; i++) {
      const a = (A >> i) & 1, b = (B >> i) & 1;
      setCell(aCells[i], a, true);
      setCell(bCells[i], b, true);
      setCell(carryCells[i], carry, settled);
      const sum = a ^ b ^ carry;
      carry = (a & b) | (b & carry) | (a & carry);
      setCell(sumCells[i], sum, settled);
    }
    const total = A + B;
    chipA.lastChild.textContent = `${A}`;
    chipB.lastChild.textContent = `${B}`;
    chipS.lastChild.textContent = `${total & 0xff}`;
    chipC.lastChild.textContent = total > 255 ? '1  (result overflowed)' : '0';
    chipC.style.color = total > 255 ? 'var(--amber)' : '';
  }

  function stop() { if (cancel) { cancel(); cancel = null; } }

  function run() {
    stop();
    for (let i = 0; i < 8; i++) {
      setCell(carryCells[i], 0, false);
      setCell(sumCells[i], 0, false);
    }
    let i = 0, carry = 0, timer = null;
    const step = () => {
      if (i > 7) { paint(true); cancel = null; return; }
      sumCells.forEach((c) => c.classList.remove('lit'));
      carryCells.forEach((c) => c.classList.remove('lit'));
      const a = (A >> i) & 1, b = (B >> i) & 1;
      setCell(carryCells[i], carry, true);
      const sum = a ^ b ^ carry;
      carry = (a & b) | (b & carry) | (a & carry);
      setCell(sumCells[i], sum, true);
      sumCells[i].classList.add('lit');
      carryCells[i].classList.add('lit');
      i++;
      timer = setTimeout(step, 260);
    };
    step();
    cancel = () => {
      clearTimeout(timer);
      sumCells.forEach((c) => c.classList.remove('lit'));
      carryCells.forEach((c) => c.classList.remove('lit'));
    };
  }

  host.append(grid, foot);
  paint(true);

  $('#ripple-run')?.addEventListener('click', run);
  $('#ripple-rnd')?.addEventListener('click', () => {
    stop();
    A = Math.floor(Math.random() * 256);
    B = Math.floor(Math.random() * 256);
    paint(true);
  });
}

export function initAdder() {
  const fa = $('#fa-demo');
  const rp = $('#ripple');
  if (fa) fullAdder(fa);
  if (rp) ripple(rp);
}
