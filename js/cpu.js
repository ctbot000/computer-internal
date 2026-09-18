/* Section 5 — a complete little processor: model, diagram, memory and assembler UI. */
import { h, s, svgRoot, $, $$, bin, hex, clamp, tween } from './util.js';
import { OPS, BY_CODE, RAM_SIZE, disasm, assemble, EXAMPLES } from './isa.js';

/* ── model ────────────────────────────────────────────────────────────────── */

const st = {
  pc: 0, mar: 0, ir: 0, a: 0, b: 0, out: 0,
  cf: 0, zf: 0, t: 0, halted: false,
  ram: new Array(RAM_SIZE).fill(0),
  // Which cells the assembler emitted as instructions and which as raw data.
  // The bytes are identical either way; this only decides how they are labelled.
  kind: new Array(RAM_SIZE).fill(null),
};

const SIGNALS = [
  ['CO', 'counter out'], ['CE', 'counter enable'], ['J', 'jump: counter in'],
  ['MI', 'address in'], ['RO', 'memory out'], ['RI', 'memory in'],
  ['II', 'instruction in'], ['IO', 'instruction out'],
  ['AI', 'A in'], ['AO', 'A out'], ['BI', 'B in'],
  ['EO', 'ALU out'], ['SU', 'subtract'], ['FI', 'flags in'],
  ['OI', 'output in'], ['HLT', 'stop the clock'],
];

const setFlags = (r, isSub) => {
  st.cf = isSub ? (r >= 0 ? 1 : 0) : (r > 255 ? 1 : 0);
  st.a = r & 0xff;
  st.zf = st.a === 0 ? 1 : 0;
};

const FETCH = [
  {
    sig: ['CO', 'MI'],
    run: () => { st.mar = st.pc; return { src: 'pc', dst: 'mar', value: st.pc }; },
    text: () => `The counter holds <em>${st.mar}</em>. That number goes out on the bus and into the address register — the machine is about to look at memory ${st.mar}.`,
  },
  {
    sig: ['RO', 'II', 'CE'],
    run: () => {
      st.ir = st.ram[st.mar];
      st.pc = (st.pc + 1) % RAM_SIZE;
      return { src: 'ram', dst: 'ir', value: st.ir };
    },
    text: () => {
      const name = disasm(st.ir) ?? 'a byte with no opcode';
      return `Memory hands back <em>${bin(st.ir)}</em>. It lands in the instruction register, which reads it as <em>${name}</em>. The counter ticks up at the same time.`;
    },
  },
];

const addrStep = {
  sig: ['IO', 'MI'],
  run: () => { st.mar = st.ir & 0xf; return { src: 'ir', dst: 'mar', value: st.mar }; },
  text: () => `The bottom four bits of the instruction are an address. They go to the address register: memory ${st.mar}.`,
};

const EXEC = {
  0x0: [addrStep, {
    sig: ['RO', 'AI'],
    run: () => { st.a = st.ram[st.mar]; return { src: 'ram', dst: 'a', value: st.a }; },
    text: () => `Memory ${st.mar} holds <em>${st.a}</em>, and it is copied into register A.`,
  }],
  0x1: [addrStep, {
    sig: ['RO', 'BI'],
    run: () => { st.b = st.ram[st.mar]; return { src: 'ram', dst: 'b', value: st.b }; },
    text: () => `The other number, <em>${st.b}</em>, is fetched into register B. The adder can only see A and B.`,
  }, {
    sig: ['EO', 'AI', 'FI'],
    run: () => { const r = st.a + st.b; setFlags(r, false); return { src: 'alu', dst: 'a', value: st.a }; },
    text: () => `The adder has been holding the answer the whole time — nothing had to be computed, only <em>read</em>. Its output goes back into A.${st.cf ? ' The result did not fit in a byte, so the carry flag is set.' : ''}`,
  }],
  0x2: [addrStep, {
    sig: ['RO', 'BI'],
    run: () => { st.b = st.ram[st.mar]; return { src: 'ram', dst: 'b', value: st.b }; },
    text: () => `The number to subtract, <em>${st.b}</em>, is fetched into register B.`,
  }, {
    sig: ['EO', 'AI', 'SU', 'FI'],
    run: () => { const r = st.a - st.b; setFlags(r, true); return { src: 'alu', dst: 'a', value: st.a }; },
    text: () => `The subtract line flips every bit of B and adds one, so the same adder does the work. Result <em>${st.a}</em> goes into A.`,
  }],
  0x3: [addrStep, {
    sig: ['AO', 'RI'],
    run: () => { st.ram[st.mar] = st.a; return { src: 'a', dst: 'ram', value: st.a }; },
    text: () => `Register A drives the bus and memory ${st.mar} latches it. The byte at that address is now <em>${st.a}</em>.`,
  }],
  0x4: [{
    sig: ['IO', 'AI'],
    run: () => { st.a = st.ir & 0xf; return { src: 'ir', dst: 'a', value: st.a }; },
    text: () => `No memory lookup this time: the number <em>${st.a}</em> was carried inside the instruction itself.`,
  }],
  0x5: [{
    sig: ['IO', 'J'],
    run: () => { st.pc = st.ir & 0xf; return { src: 'ir', dst: 'pc', value: st.pc }; },
    text: () => `The instruction overwrites the program counter with <em>${st.pc}</em>. That is the whole mechanism behind every loop and every branch.`,
  }],
  0x6: [{
    sig: () => (st.cf ? ['IO', 'J'] : []),
    run: () => {
      if (!st.cf) return null;
      st.pc = st.ir & 0xf;
      return { src: 'ir', dst: 'pc', value: st.pc };
    },
    text: () => (st.cf
      ? `The carry flag is set, so the jump is taken: next instruction comes from ${st.pc}.`
      : 'The carry flag is clear, so nothing happens and the counter keeps going straight on.'),
  }],
  0x7: [{
    sig: () => (st.zf ? ['IO', 'J'] : []),
    run: () => {
      if (!st.zf) return null;
      st.pc = st.ir & 0xf;
      return { src: 'ir', dst: 'pc', value: st.pc };
    },
    text: () => (st.zf
      ? `The last result was zero, so the jump is taken: next instruction comes from ${st.pc}.`
      : 'The last result was not zero, so the jump is ignored.'),
  }],
  0xE: [{
    sig: ['AO', 'OI'],
    run: () => { st.out = st.a; return { src: 'a', dst: 'out', value: st.a }; },
    text: () => `Register A is copied to the output register, which is the only part of this machine the outside world can see.`,
  }],
  0xF: [{
    sig: ['HLT'],
    run: () => { st.halted = true; return null; },
    text: () => 'Halt. The control unit stops the clock, and the machine simply stands still.',
  }],
};

function currentSteps() {
  if (st.t < 2) return FETCH;
  return EXEC[(st.ir >> 4) & 0xf] ?? null;
}

/** Run one clock tick. Returns a description of what moved, or null if halted. */
function tick() {
  if (st.halted) return null;

  const phase = st.t < 2 ? 'FETCH' : 'EXECUTE';
  let step;
  if (st.t < 2) {
    step = FETCH[st.t];
  } else {
    const ex = EXEC[(st.ir >> 4) & 0xf];
    if (!ex) {
      const tnum = st.t;
      st.t = 0;
      return { t: tnum, phase, sig: [], tr: null, done: true,
        text: `Nothing in the instruction set starts with <em>${bin((st.ir >> 4) & 0xf, 4)}</em>, so the control unit does nothing at all and moves on.` };
    }
    step = ex[st.t - 2];
  }

  const sig = typeof step.sig === 'function' ? step.sig() : step.sig;
  const tr = step.run();
  const text = step.text();
  const tnum = st.t;

  const ex = EXEC[(st.ir >> 4) & 0xf];
  const last = st.t < 2 ? false : (st.t - 2) === (ex ? ex.length - 1 : 0);
  st.t = last ? 0 : st.t + 1;

  return { t: tnum, phase, sig, tr, text, done: last };
}

function reset(keepRam = true) {
  st.pc = 0; st.mar = 0; st.ir = 0; st.a = 0; st.b = 0; st.out = 0;
  st.cf = 0; st.zf = 0; st.t = 0; st.halted = false;
  if (!keepRam) { st.ram.fill(0); st.kind.fill(null); }
}

/* ── diagram ──────────────────────────────────────────────────────────────── */

const VW = 900, VH = 560;
const BUS_X = 418, BUS_W = 64, BUS_C = BUS_X + BUS_W / 2;
const LEFT_X = 40, RIGHT_X = 610, BOX_W = 250;
const LEFT_EDGE = LEFT_X + BOX_W, RIGHT_EDGE = RIGHT_X;

const LAYOUT = {
  pc:    { side: 'L', y: 40,  h: 52, label: 'PROGRAM COUNTER', bits: 4 },
  mar:   { side: 'L', y: 118, h: 52, label: 'ADDRESS REGISTER', bits: 4 },
  ram:   { side: 'L', y: 196, h: 52, label: 'MEMORY', bits: 8 },
  ir:    { side: 'L', y: 274, h: 52, label: 'INSTRUCTION REGISTER', bits: 8 },
  ctrl:  { side: 'L', y: 356, h: 74, label: 'CONTROL UNIT', bits: 0 },
  a:     { side: 'R', y: 40,  h: 52, label: 'REGISTER A', bits: 8 },
  alu:   { side: 'R', y: 118, h: 52, label: 'ADDER / ALU', bits: 8 },
  b:     { side: 'R', y: 196, h: 52, label: 'REGISTER B', bits: 8 },
  out:   { side: 'R', y: 274, h: 52, label: 'OUTPUT REGISTER', bits: 8 },
  flags: { side: 'R', y: 356, h: 52, label: 'FLAGS', bits: 0 },
};

const boxes = {};
let busRail, packet, packetText, packetBox, svg;

const cy = (k) => LAYOUT[k].y + LAYOUT[k].h / 2;
const edgeX = (k) => (LAYOUT[k].side === 'L' ? LEFT_EDGE : RIGHT_EDGE);

function makeBox(key) {
  const L = LAYOUT[key];
  const x = L.side === 'L' ? LEFT_X : RIGHT_X;
  const g = s('g', { class: 'reg-box', dataset: { reg: key } });
  const body = s('rect', {
    class: 'reg-body', x, y: L.y, width: BOX_W, height: L.h, rx: 9,
    fill: 'var(--surface-2)', stroke: 'var(--line)', 'stroke-width': 2,
  });
  const name = s('text', {
    x: x + 12, y: L.y + 17, 'font-size': 9.5, 'font-family': 'var(--mono)',
    fill: 'var(--dimmer)', 'letter-spacing': '.1em', text: L.label,
  });
  const val = s('text', {
    x: x + BOX_W - 12, y: L.y + 38, 'text-anchor': 'end', 'font-size': 17,
    'font-family': 'var(--mono)', 'font-weight': 700, fill: 'var(--text)', 'letter-spacing': '1.5',
  });
  const sub = s('text', {
    x: x + 12, y: L.y + 38, 'font-size': 11, 'font-family': 'var(--mono)', fill: 'var(--dim)',
  });
  g.append(body, name, val, sub);

  // stub to the bus
  if (L.bits) {
    const from = L.side === 'L' ? LEFT_EDGE : BUS_X + BUS_W;
    const to = L.side === 'L' ? BUS_X : RIGHT_X;
    g.appendChild(s('path', {
      d: `M${from} ${cy(key)} L${to} ${cy(key)}`,
      stroke: 'var(--line)', 'stroke-width': 2.5, 'stroke-linecap': 'round',
    }));
  }
  boxes[key] = { g, body, val, sub };
  return g;
}

function buildDiagram(host) {
  svg = svgRoot(VW, VH, { role: 'img', 'aria-label': 'Block diagram of the processor' });

  busRail = s('rect', {
    class: 'bus-rail', x: BUS_X, y: 24, width: BUS_W, height: VH - 48, rx: 14,
    fill: 'color-mix(in srgb, var(--accent) 9%, transparent)',
    stroke: 'color-mix(in srgb, var(--accent) 34%, transparent)', 'stroke-width': 2,
  });
  svg.appendChild(busRail);
  svg.appendChild(s('text', {
    x: BUS_C, y: 500, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'var(--mono)',
    fill: 'color-mix(in srgb, var(--accent) 80%, transparent)', 'letter-spacing': '.28em',
    transform: `rotate(-90 ${BUS_C} 500)`, text: '8-BIT BUS',
  }));

  Object.keys(LAYOUT).forEach((k) => svg.appendChild(makeBox(k)));

  // ALU reads A and B directly
  svg.appendChild(s('path', {
    d: `M${RIGHT_X + BOX_W} ${cy('a')} L878 ${cy('a')} L878 ${cy('alu')} L${RIGHT_X + BOX_W} ${cy('alu')}`
      + ` M${RIGHT_X + BOX_W} ${cy('b')} L878 ${cy('b')} L878 ${cy('alu')}`,
    fill: 'none', stroke: 'var(--line)', 'stroke-width': 2.5, 'stroke-linejoin': 'round',
  }));
  svg.appendChild(s('text', {
    x: 886, y: cy('alu') - 6, 'font-size': 9, 'font-family': 'var(--mono)', fill: 'var(--dimmer)',
    'text-anchor': 'middle', transform: `rotate(-90 886 ${cy('alu') - 6})`, text: 'A and B',
  }));

  // control unit reaches everything
  svg.appendChild(s('path', {
    d: `M${LEFT_X + BOX_W} ${cy('ctrl')} L${BUS_X - 14} ${cy('ctrl')}`,
    stroke: 'var(--line-soft)', 'stroke-width': 2, 'stroke-dasharray': '4 5',
  }));

  packet = s('g', { style: 'opacity:0', 'pointer-events': 'none' });
  packetBox = s('rect', {
    x: -48, y: -13, width: 96, height: 26, rx: 7,
    fill: 'var(--amber)', stroke: 'var(--amber)', 'stroke-width': 2,
    style: 'filter:drop-shadow(0 0 12px color-mix(in srgb, var(--amber) 60%, transparent))',
  });
  packetText = s('text', {
    y: 5, 'text-anchor': 'middle', 'font-size': 13, 'font-family': 'var(--mono)',
    'font-weight': 700, fill: '#10161f', 'letter-spacing': '1',
  });
  packet.append(packetBox, packetText);
  svg.appendChild(packet);

  host.appendChild(svg);
}

/* ── painting ─────────────────────────────────────────────────────────────── */

const outEl = () => $('#cpu-out');
let ramCells = [];

function paintDiagram() {
  const put = (k, v, sub) => {
    boxes[k].val.textContent = v;
    boxes[k].sub.textContent = sub ?? '';
  };
  put('pc', bin(st.pc, 4), `→ ${st.pc}`);
  put('mar', bin(st.mar, 4), `→ ${st.mar}`);
  put('ram', bin(st.ram[st.mar]), `@${st.mar} → ${st.ram[st.mar]}`);
  put('ir', bin(st.ir), disasm(st.ir) ?? 'no opcode');
  put('a', bin(st.a), `→ ${st.a}`);
  put('b', bin(st.b), `→ ${st.b}`);
  const isSub = ((st.ir >> 4) & 0xf) === 0x2;
  const alu = isSub ? (st.a - st.b) & 0xff : (st.a + st.b) & 0xff;
  put('alu', bin(alu), isSub ? `A − B → ${alu}` : `A + B → ${alu}`);
  put('out', bin(st.out), `→ ${st.out}`);

  const op = BY_CODE.get((st.ir >> 4) & 0xf);
  boxes.ctrl.val.textContent = '';
  boxes.ctrl.sub.textContent = st.halted ? 'halted' : `T${st.t}  ·  ${op ? op.m : '—'}`;
  boxes.flags.val.textContent = `C${st.cf} Z${st.zf}`;
  boxes.flags.sub.textContent = 'carry / zero';
  boxes.flags.val.setAttribute('fill', st.cf || st.zf ? 'var(--amber)' : 'var(--text)');

  outEl().textContent = String(st.out);
}

function paintRam(flashAddr = -1) {
  ramCells.forEach((c, i) => {
    c.root.classList.toggle('is-pc', i === st.pc && !st.halted);
    c.root.classList.toggle('is-mar', i === st.mar);
    c.bits.innerHTML = `<span class="nib">${bin(st.ram[i]).slice(0, 4)}</span> ${bin(st.ram[i]).slice(4)}`;
    const asOp = st.kind[i] === 'op';
    c.dis.textContent = asOp ? (disasm(st.ram[i]) ?? String(st.ram[i])) : `= ${st.ram[i]}`;
    c.dis.classList.toggle('data', !asOp);
    if (i === flashAddr) {
      c.root.classList.remove('flash');
      void c.root.offsetWidth;
      c.root.classList.add('flash');
    }
  });
}

let sigEls = {};
function paintSignals(active = []) {
  const set = new Set(active);
  for (const [k, el] of Object.entries(sigEls)) el.classList.toggle('on', set.has(k));
}

function narrate(res) {
  const n = $('#cpu-narrate');
  if (!res) {
    n.innerHTML = '<span class="t-badge">HALT</span><span>The clock is stopped. Press Reset, or load another program.</span>';
    return;
  }
  const badge = res.t < 2 ? `FETCH T${res.t}` : `EXEC T${res.t}`;
  n.innerHTML = `<span class="t-badge">${badge}</span><span>${res.text}</span>`;
}

/* ── transfer animation ───────────────────────────────────────────────────── */

let finishAnim = null;   // snaps an in-flight transfer to its end

function animate(tr, ms, done) {
  if (finishAnim) finishAnim();

  const movable = tr && LAYOUT[tr.src] && LAYOUT[tr.dst];
  if (!movable || ms <= 0) {
    packet.style.opacity = '0';
    busRail.classList.remove('hot');
    done();
    return;
  }

  const pts = [[edgeX(tr.src), cy(tr.src)], [BUS_C, cy(tr.src)],
               [BUS_C, cy(tr.dst)], [edgeX(tr.dst), cy(tr.dst)]];
  const probe = s('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ') });
  svg.appendChild(probe);
  const len = probe.getTotalLength();

  const narrow = LAYOUT[tr.src].bits === 4 && LAYOUT[tr.dst].bits === 4;
  packetText.textContent = bin(tr.value, narrow ? 4 : 8);
  const w = packetText.textContent.length * 9 + 24;
  packetBox.setAttribute('width', w);
  packetBox.setAttribute('x', -w / 2);

  boxes[tr.src].g.classList.add('src');
  boxes[tr.dst].g.classList.add('active');
  busRail.classList.add('hot');
  packet.style.opacity = '1';
  packet.setAttribute('transform', `translate(${pts[0][0]} ${pts[0][1]})`);

  const cleanup = () => {
    probe.remove();
    packet.style.opacity = '0';
    busRail.classList.remove('hot');
    boxes[tr.src].g.classList.remove('src');
    boxes[tr.dst].g.classList.remove('active');
    done();
  };

  const stop = tween(ms, (k) => {
    const e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const p = probe.getPointAtLength(e * len);
    packet.setAttribute('transform', `translate(${p.x} ${p.y})`);
  }, () => { finishAnim = null; cleanup(); });

  finishAnim = () => { stop(); finishAnim = null; cleanup(); };
}

/* ── driving ──────────────────────────────────────────────────────────────── */

const SPEEDS = [1, 4, 10, 30, 100, 500];
let speedIdx = 1;
let running = false;
let runTimer = null;

const hz = () => SPEEDS[speedIdx];
const animMs = () => (hz() > 30 ? 0 : Math.min(420, 620 / hz()));

function logOut(v) {
  const log = $('#cpu-outlog');
  log.appendChild(h('span', { text: String(v) }));
  while (log.children.length > 60) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}

function doTick(onDone) {
  if (st.halted) { narrate(null); paintSignals([]); onDone?.(false); return; }

  const res = tick();
  if (!res) { narrate(null); onDone?.(false); return; }

  // The state is already committed, so the DOM is updated right here rather than
  // from the animation loop — a hidden tab delivers no frames, and the readouts
  // still have to be right.
  paintSignals(res.sig);
  narrate(res);
  paintDiagram();
  paintRam(res.tr && res.tr.dst === 'ram' ? st.mar : -1);
  if (res.sig.includes('OI')) logOut(st.out);

  animate(res.tr, animMs(), () => onDone?.(res.done));
}

function stepInstruction() {
  if (st.halted) return;
  const go = () => doTick((done) => { if (!done && !st.halted) setTimeout(go, animMs() ? 40 : 0); });
  go();
}

function setRunning(on) {
  running = on;
  const b = $('#cpu-run');
  b.textContent = on ? 'Pause' : 'Run';
  b.classList.toggle('btn-accent', !on);
  b.classList.toggle('btn-primary', on);
  if (runTimer) { clearTimeout(runTimer); runTimer = null; }
  if (on) loop();
}

function loop() {
  if (!running) return;
  if (st.halted) { setRunning(false); narrate(null); return; }

  const period = 1000 / hz();
  if (animMs() > 0) {
    doTick(() => { runTimer = setTimeout(loop, Math.max(0, period - animMs())); });
  } else {
    // fast mode: several ticks per timer wake-up, since timers clamp around 4 ms
    const batch = Math.max(1, Math.round(hz() / 60));
    for (let i = 0; i < batch && !st.halted; i++) {
      const res = tick();
      if (!res) break;
      paintSignals(res.sig);
      narrate(res);
      if (res.sig.includes('OI')) logOut(st.out);
    }
    paintDiagram();
    paintRam();
    runTimer = setTimeout(loop, Math.max(4, (1000 / hz()) * batch));
  }
}

/* ── memory grid ──────────────────────────────────────────────────────────── */

function buildRam(host) {
  ramCells = [];
  for (let i = 0; i < RAM_SIZE; i++) {
    const bits = h('span', { class: 'cell-bits', role: 'button', tabindex: '0',
      'aria-label': `memory ${i}, click to edit` });
    const dis = h('span', { class: 'cell-dis' });
    const root = h('div', { class: 'cell' }, [
      h('div', { class: 'cell-top' }, [h('span', { class: 'cell-addr', text: hex(i, 1) }), dis]),
      bits,
    ]);

    const edit = () => {
      if (root.querySelector('input')) return;
      const inp = h('input', { value: String(st.ram[i]), spellcheck: 'false',
        'aria-label': `value at memory ${i}` });
      bits.replaceWith(inp);
      inp.focus();
      inp.select();
      const commit = (save) => {
        if (save) {
          const raw = inp.value.trim();
          let v = /^0x/i.test(raw) ? parseInt(raw.slice(2), 16)
            : /^0b/i.test(raw) ? parseInt(raw.slice(2), 2)
            : parseInt(raw, 10);
          if (Number.isFinite(v)) {
            st.ram[i] = clamp(v, 0, 255) & 0xff;
            // A hand-edited blank cell is most likely meant as code; a cell the
            // program declared with DB stays data.
            if (st.kind[i] === null) st.kind[i] = 'op';
          }
        }
        inp.replaceWith(bits);
        paintRam();
        paintDiagram();
      };
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(true); }
        else if (e.key === 'Escape') { e.preventDefault(); commit(false); }
      });
      inp.addEventListener('blur', () => commit(true));
    };

    bits.addEventListener('click', edit);
    bits.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(); }
    });

    ramCells.push({ root, bits, dis });
    host.appendChild(root);
  }
}

/* ── assembler UI ─────────────────────────────────────────────────────────── */

function loadProgram(src, quiet) {
  const status = $('#cpu-asm-status');
  const r = assemble(src);
  if (!r.ok) {
    status.textContent = r.error;
    status.className = 'asm-status err';
    return false;
  }
  setRunning(false);
  reset(false);
  r.bytes.forEach((b, i) => { st.ram[i] = b; st.kind[i] = r.kinds[i]; });
  $('#cpu-outlog').replaceChildren();
  paintDiagram();
  paintRam();
  paintSignals([]);
  $('#cpu-narrate').innerHTML =
    '<span class="t-badge">READY</span><span>Program loaded at address 0. Press <em>Tick</em> for one clock pulse, or <em>Run</em> to let it go.</span>';
  status.textContent = quiet ? '' : `loaded — ${r.used} bytes used`;
  status.className = 'asm-status ok';
  return true;
}

/* ── wiring ───────────────────────────────────────────────────────────────── */

export function initCpu() {
  const diagram = $('#cpu-diagram');
  if (!diagram) return;

  buildDiagram(diagram);
  buildRam($('#cpu-ram'));

  const sigHost = $('#cpu-signals');
  sigEls = {};
  for (const [k, title] of SIGNALS) {
    const el = h('span', { class: 'sig', text: k, title });
    sigEls[k] = el;
    sigHost.appendChild(el);
  }

  const isa = $('#isa-table');
  for (const op of OPS) {
    isa.appendChild(h('tr', {}, [
      h('td', { text: `${op.m}${op.arg ? (op.arg === 'addr' ? ' n' : ' k') : ''}` }),
      h('td', { text: bin(op.code, 4) + (op.arg ? ' nnnn' : ' ----') }),
      h('td', { text: op.desc }),
    ]));
  }
  isa.appendChild(h('tr', {}, [
    h('td', { text: 'DB v' }), h('td', { text: 'vvvv vvvv' }),
    h('td', { text: 'not an instruction — just a byte of data' }),
  ]));

  const sel = $('#cpu-example');
  EXAMPLES.forEach((ex, i) => sel.appendChild(h('option', { value: String(i), text: ex.name })));
  sel.addEventListener('change', () => {
    const ex = EXAMPLES[Number(sel.value)];
    $('#cpu-source').value = ex.src;
    loadProgram(ex.src, true);
  });

  $('#cpu-source').value = EXAMPLES[0].src;
  $('#cpu-assemble').addEventListener('click', () => loadProgram($('#cpu-source').value));

  $('#cpu-step').addEventListener('click', () => { setRunning(false); doTick(); });
  $('#cpu-instr').addEventListener('click', () => { setRunning(false); stepInstruction(); });
  $('#cpu-run').addEventListener('click', () => setRunning(!running));
  $('#cpu-reset').addEventListener('click', () => {
    setRunning(false);
    reset(true);
    $('#cpu-outlog').replaceChildren();
    paintDiagram(); paintRam(); paintSignals([]);
    $('#cpu-narrate').innerHTML =
      '<span class="t-badge">RESET</span><span>Counter back to 0, registers cleared. Memory is untouched.</span>';
  });

  const speed = $('#cpu-speed');
  const speedVal = $('#cpu-speed-val');
  const showSpeed = () => { speedVal.textContent = `${hz()} Hz`; };
  speed.addEventListener('input', () => {
    speedIdx = clamp(Number(speed.value), 0, SPEEDS.length - 1);
    showSpeed();
    if (running) { setRunning(false); setRunning(true); }
  });
  speedIdx = Number(speed.value);
  showSpeed();

  loadProgram(EXAMPLES[0].src, true);
}
