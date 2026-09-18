/* Section 0 — the von Neumann block diagram. */
import { s, h, svgRoot, $ } from './util.js';

const PARTS = {
  cpu: {
    title: 'Processor (CPU)',
    body: 'Fetches one instruction at a time from memory and carries it out. Everything it can do reduces to moving bytes around, adding them, and deciding what to read next.',
    link: ['Step through a real one', '#cpu'],
  },
  mem: {
    title: 'Main memory (RAM)',
    body: 'One long numbered row of bytes. The pivotal idea of this design: the <em>program</em> lives here too, in the same kind of bytes as the data — so the machine takes a new job without being rewired.',
    link: ['How a circuit remembers', '#memory'],
  },
  bus: {
    title: 'The bus',
    body: 'Shared wires carrying an address, a value, and control signals. Only one component may speak at a time, and the control unit decides who. Every transfer on this page is one turn on the bus.',
    link: ['Watch the bus', '#cpu'],
  },
  in: {
    title: 'Input',
    body: 'Keys, taps, microphones, network packets, the clock on the wall. However it arrives, it becomes numbers written into memory — there is nothing else it could become.',
    link: ['Why numbers are enough', '#bits'],
  },
  out: {
    title: 'Output',
    body: 'Pixels, sound, packets, motors. Numbers read out of memory and handed to a device that knows what to do with them.',
    link: ['Why numbers are enough', '#bits'],
  },
  disk: {
    title: 'Storage',
    body: 'Keeps bytes when the power goes. Enormously larger than RAM and enormously slower — that gap is the reason caches exist at all.',
    link: ['See the gap', '#speed'],
  },
};

const box = (x, y, w, hh, label, sub, key) => {
  const g = s('g', { class: 'vn-block', dataset: { part: key }, role: 'button', tabindex: '0',
    'aria-label': label });
  g.append(
    s('rect', { class: 'vn-body', x, y, width: w, height: hh, rx: 10,
      fill: 'var(--surface-2)', stroke: 'var(--line)', 'stroke-width': 2 }),
    s('text', { x: x + w / 2, y: y + (sub ? hh / 2 - 3 : hh / 2 + 4), 'text-anchor': 'middle',
      'font-size': 13, 'font-weight': 600, fill: 'var(--text)',
      'font-family': 'var(--sans)', text: label }),
  );
  if (sub) {
    g.appendChild(s('text', { x: x + w / 2, y: y + hh / 2 + 14, 'text-anchor': 'middle',
      'font-size': 10, fill: 'var(--dimmer)', 'font-family': 'var(--mono)', text: sub }));
  }
  return g;
};

const stub = (x, y1, y2) => s('path', {
  d: `M${x} ${y1} L${x} ${y2}`, stroke: 'var(--line)', 'stroke-width': 2.5, 'stroke-linecap': 'round',
});

export function initIntro() {
  const host = $('#vn-diagram');
  const detail = $('#vn-detail');
  if (!host || !detail) return;

  const svg = svgRoot(620, 400, { role: 'img', 'aria-label': 'Block diagram of a stored-program computer' });

  // bus band
  svg.appendChild(s('rect', { x: 30, y: 226, width: 560, height: 34, rx: 8,
    fill: 'color-mix(in srgb, var(--accent) 10%, transparent)',
    stroke: 'color-mix(in srgb, var(--accent) 40%, transparent)', 'stroke-width': 2 }));
  svg.appendChild(s('text', { x: 310, y: 248, 'text-anchor': 'middle', 'font-size': 11,
    'font-family': 'var(--mono)', fill: 'var(--accent)', 'letter-spacing': '.08em',
    text: 'BUS  ·  address  ·  data  ·  control' }));

  // stubs into the bus
  [[155, 200, 226], [465, 200, 226], [125, 260, 300], [310, 260, 300], [495, 260, 300]]
    .forEach(([x, a, b]) => svg.appendChild(stub(x, a, b)));

  // CPU
  const cpu = box(30, 40, 250, 160, 'Processor', null, 'cpu');
  cpu.append(
    s('rect', { x: 48, y: 78, width: 214, height: 44, rx: 7, fill: 'var(--surface)',
      stroke: 'var(--line-soft)', 'stroke-width': 1.5 }),
    s('text', { x: 155, y: 105, 'text-anchor': 'middle', 'font-size': 11,
      'font-family': 'var(--mono)', fill: 'var(--dim)', text: 'control unit' }),
    s('rect', { x: 48, y: 130, width: 214, height: 44, rx: 7, fill: 'var(--surface)',
      stroke: 'var(--line-soft)', 'stroke-width': 1.5 }),
    s('text', { x: 155, y: 157, 'text-anchor': 'middle', 'font-size': 11,
      'font-family': 'var(--mono)', fill: 'var(--dim)', text: 'registers + ALU' }),
  );
  cpu.querySelector('text').setAttribute('y', 66);
  svg.appendChild(cpu);

  // Memory
  const mem = box(340, 40, 250, 160, 'Memory', null, 'mem');
  mem.querySelector('text').setAttribute('y', 66);
  for (let i = 0; i < 6; i++) {
    const y = 80 + i * 19;
    const isProg = i < 3;
    mem.append(
      s('rect', { x: 358, y, width: 214, height: 15, rx: 3,
        fill: isProg ? 'color-mix(in srgb, var(--violet) 22%, var(--surface))'
                     : 'color-mix(in srgb, var(--amber) 16%, var(--surface))',
        stroke: 'var(--line-soft)', 'stroke-width': 1 }),
      s('text', { x: 366, y: y + 11.5, 'font-size': 9, 'font-family': 'var(--mono)',
        fill: 'var(--dimmer)', text: isProg ? 'instruction' : 'data' }),
    );
  }
  svg.appendChild(mem);

  svg.appendChild(box(30, 300, 190, 62, 'Input', 'keys · sensors · net', 'in'));
  svg.appendChild(box(232, 300, 156, 62, 'Storage', 'disk · flash', 'disk'));
  svg.appendChild(box(400, 300, 190, 62, 'Output', 'screen · sound · net', 'out'));

  // a bus-wide clickable target, drawn last so it sits above nothing important
  const busHit = s('rect', { x: 30, y: 226, width: 560, height: 34, rx: 8, fill: 'transparent',
    class: 'vn-block', dataset: { part: 'bus' }, role: 'button', tabindex: '0',
    'aria-label': 'The bus', style: 'cursor:pointer' });
  svg.appendChild(busHit);

  // decorative traffic — CSS-driven, purely cosmetic if frames stop
  const traffic = s('circle', { r: 4.5, cx: 0, cy: 243, fill: 'var(--amber)',
    style: 'animation: vnrun 3.4s linear infinite' });
  svg.appendChild(traffic);
  const style = s('style', {});
  style.textContent = '@keyframes vnrun{0%{transform:translateX(60px);opacity:0}'
    + '10%{opacity:1}90%{opacity:1}100%{transform:translateX(560px);opacity:0}}'
    + '@media (prefers-reduced-motion: reduce){circle[style*="vnrun"]{display:none}}';
  svg.appendChild(style);

  host.appendChild(svg);

  const show = (key) => {
    const p = PARTS[key];
    if (!p) return;
    detail.replaceChildren(
      h('h4', { text: p.title }),
      h('p', { html: p.body }),
      h('a', { href: p.link[1], text: p.link[0] + ' →' }),
    );
    svg.querySelectorAll('.vn-block').forEach((b) => {
      const on = b.dataset.part === key;
      const body = b.classList.contains('vn-block') && b.tagName === 'rect' ? b : b.querySelector('.vn-body');
      if (body) {
        body.setAttribute('stroke', on ? 'var(--accent)' : 'var(--line)');
        if (b.tagName !== 'rect') {
          body.setAttribute('fill', on
            ? 'color-mix(in srgb, var(--accent) 12%, var(--surface-2))' : 'var(--surface-2)');
        }
      }
    });
  };

  svg.querySelectorAll('.vn-block').forEach((b) => {
    b.style.cursor = 'pointer';
    b.addEventListener('click', () => show(b.dataset.part));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(b.dataset.part); }
    });
  });

  show('cpu');
}
