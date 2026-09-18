/* Section 1 — one switch, then eight of them. */
import { h, s, svgRoot, $, $$, bin, hex } from './util.js';
import { disasm } from './isa.js';

/* ── a single switch in a circuit ─────────────────────────────────────────── */
function switchDemo(host) {
  let on = false;

  const svg = svgRoot(420, 176, { role: 'img', 'aria-label': 'A switch in a circuit' });

  const loop = s('path', {
    d: 'M70 132 L70 44 L170 44 M250 44 L350 44 L350 132 L70 132',
    fill: 'none', stroke: 'var(--off)', 'stroke-width': 3,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  });
  svg.appendChild(loop);

  // battery
  svg.append(
    s('path', { d: 'M56 78 L84 78 M62 92 L78 92 M56 106 L84 106 M62 120 L78 120',
      stroke: 'var(--dim)', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    s('rect', { x: 46, y: 70, width: 48, height: 58, rx: 8, fill: 'none',
      stroke: 'transparent' }),
    s('text', { x: 24, y: 103, 'font-size': 10, 'font-family': 'var(--mono)',
      fill: 'var(--dimmer)', text: '3.3 V' }),
  );

  // switch
  const hinge = s('circle', { cx: 170, cy: 44, r: 4.5, fill: 'var(--dim)' });
  const post = s('circle', { cx: 250, cy: 44, r: 4.5, fill: 'var(--dim)' });
  const lever = s('path', { d: 'M170 44 L246 20', stroke: 'var(--dim)', 'stroke-width': 4,
    'stroke-linecap': 'round', style: 'transition:d .18s' });
  svg.append(lever, hinge, post);
  svg.appendChild(s('text', { x: 210, y: 76, 'text-anchor': 'middle', 'font-size': 10,
    'font-family': 'var(--mono)', fill: 'var(--dimmer)', text: 'transistor' }));

  // lamp
  const bulbGlow = s('circle', { cx: 350, cy: 88, r: 26, fill: 'transparent' });
  const bulb = s('circle', { cx: 350, cy: 88, r: 17, fill: 'var(--surface-2)',
    stroke: 'var(--off)', 'stroke-width': 3 });
  const filament = s('path', { d: 'M342 88 q4 -8 8 0 q4 8 8 0', fill: 'none',
    stroke: 'var(--off)', 'stroke-width': 2.5, 'stroke-linecap': 'round' });
  svg.append(bulbGlow, bulb, filament);
  svg.appendChild(s('text', { x: 330, y: 158, 'text-anchor': 'middle', 'font-size': 9.5,
    'font-family': 'var(--mono)', fill: 'var(--dimmer)', text: 'the rest of the machine' }));

  const state = h('div', { class: 'sw-readout' });
  const flowEl = h('span', {});
  const bitEl = h('span', {});
  state.append(flowEl, bitEl);

  const paint = () => {
    lever.setAttribute('d', on ? 'M170 44 L250 44' : 'M170 44 L246 20');
    const col = on ? 'var(--on)' : 'var(--off)';
    loop.setAttribute('stroke', col);
    loop.style.filter = on ? 'drop-shadow(0 0 5px var(--on-glow))' : 'none';
    bulb.setAttribute('stroke', on ? 'var(--amber)' : 'var(--off)');
    bulb.setAttribute('fill', on ? 'color-mix(in srgb, var(--amber) 22%, var(--surface-2))' : 'var(--surface-2)');
    filament.setAttribute('stroke', on ? 'var(--amber)' : 'var(--off)');
    bulbGlow.setAttribute('fill', on ? 'color-mix(in srgb, var(--amber) 16%, transparent)' : 'transparent');
    flowEl.innerHTML = on ? 'current <b>flows</b>' : 'current <b style="color:var(--dimmer)">stops</b>';
    bitEl.innerHTML = `the bit is <b>${on ? 1 : 0}</b>`;
  };

  const toggle = () => { on = !on; paint(); };
  svg.style.cursor = 'pointer';
  svg.addEventListener('click', toggle);

  const btn = h('button', { class: 'btn', type: 'button', text: 'Flip the switch', onclick: toggle });

  host.append(svg, state, btn);
  paint();
}

/* ── eight switches ───────────────────────────────────────────────────────── */
const ASCII_NAMES = {
  0: 'NUL', 7: 'BEL', 8: 'BS', 9: 'TAB', 10: 'LF', 13: 'CR', 27: 'ESC', 32: 'space', 127: 'DEL',
};

function byteDemo(host) {
  let value = 0b01001010; // 74, 'J'

  const row = h('div', { class: 'bits-row' });
  const cells = [];
  for (let i = 7; i >= 0; i--) {
    const cell = h('div', {
      class: 'bit', role: 'button', tabindex: '0',
      'aria-label': `bit worth ${1 << i}`,
    }, [
      h('span', { class: 'bit-val', text: '0' }),
      h('span', { class: 'bit-place', text: String(1 << i) }),
    ]);
    const flip = () => { value ^= (1 << i); paint(); };
    cell.addEventListener('click', flip);
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
    cells[i] = cell;
    row.appendChild(cell);
  }

  const chip = (label, cls) => {
    const b = h('b', {});
    const c = h('div', { class: `chip${cls ? ' ' + cls : ''}` }, [h('span', { text: label }), b]);
    return { node: c, b };
  };

  const dec = chip('as a number', 'hero-chip');
  const hx = chip('in hex');
  const ch = chip('as text');
  const gr = chip('as a grey');
  const ins = chip('as an instruction');

  const swatch = h('span', {
    style: 'width:15px;height:15px;border-radius:4px;display:inline-block;border:1px solid var(--line)',
  });
  gr.node.insertBefore(swatch, gr.b);

  const readout = h('div', { class: 'byte-readout' },
    [dec.node, hx.node, ch.node, gr.node, ins.node]);

  const binLine = h('p', {
    class: 'latch-note',
    style: 'font-family:var(--mono);letter-spacing:.18em;margin-top:1rem',
  });

  function paint() {
    for (let i = 0; i < 8; i++) {
      const on = (value >> i) & 1;
      cells[i].classList.toggle('on', !!on);
      cells[i].firstChild.textContent = on ? '1' : '0';
    }
    dec.b.textContent = String(value);
    hx.b.textContent = '0x' + hex(value);
    const name = ASCII_NAMES[value];
    ch.b.textContent = name ? name : (value > 32 && value < 127 ? String.fromCharCode(value) : '—');
    const g = value.toString(16).padStart(2, '0');
    swatch.style.background = `#${g}${g}${g}`;
    gr.b.textContent = `${Math.round((value / 255) * 100)}%`;
    ins.b.textContent = disasm(value) ?? '—';
    binLine.textContent = bin(value);
  }

  const act = {
    inc: () => { value = (value + 1) & 0xff; },
    dbl: () => { value = (value << 1) & 0xff; },
    rnd: () => { value = Math.floor(Math.random() * 256); },
    clr: () => { value = 0; },
  };
  $$('[data-byte-act]').forEach((b) => {
    b.addEventListener('click', () => { act[b.dataset.byteAct](); paint(); });
  });

  host.append(row, readout, binLine);
  paint();
}

export function initBits() {
  const sw = $('#switch-demo');
  const by = $('#byte-demo');
  if (sw) switchDemo(sw);
  if (by) byteDemo(by);
}
