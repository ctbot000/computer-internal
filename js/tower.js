/* Section 7 — the layer stack, top floor first. */
import { h, $ } from './util.js';

const FLOORS = [
  { t: 'What you actually use', s: 'millions of lines',
    b: 'A browser, a game, a photo editor. None of it exists as a thing — it is an agreement between a great deal of code about what the pixels are supposed to mean.' },
  { t: 'Libraries and frameworks', s: 'somebody else’s code',
    b: 'The parts that are the same in every program, written once. Nobody on the team has read them, and that is the point.' },
  { t: 'Source code', s: 'one line → many instructions',
    b: 'Python, JavaScript, Rust, C. Written for people. The machine has never read a line of it and never will.' },
  { t: 'Compiler or interpreter', s: 'the translator',
    b: 'Turns that text into instructions, either once ahead of time or continuously as it runs. This is where a <code>for</code> loop becomes a compare and a jump.',
    link: ['jumps are how loops work', '#cpu'] },
  { t: 'Operating system', s: 'the referee',
    b: 'Decides which program gets the processor, which gets memory, and who may touch the disk. Also the reason one crashed program does not take the others with it.' },
  { t: 'Machine code', s: '1 byte at a time',
    b: 'Numbers in memory, where each pattern of bits pulls a different set of control wires. This is the layer the processor on this page actually eats.',
    link: ['watch it execute', '#cpu'] },
  { t: 'Microarchitecture', s: 'nanoseconds',
    b: 'Registers, caches, pipelines, branch prediction. The part that pretends to do one instruction at a time while really doing dozens at once, out of order, and hiding every trace of it.',
    link: ['why it bothers', '#speed'] },
  { t: 'Logic gates', s: 'AND · OR · NOT',
    b: 'Arranged into adders that do arithmetic and latches that remember. A few dozen gates make a register; a few million make a core.',
    link: ['play with the gates', '#gates'] },
  { t: 'Transistors', s: '~20 billion per chip',
    b: 'Switches with no moving parts, currently around 20 nanometres across — small enough that a few hundred atoms is a meaningful measurement.',
    link: ['one switch, one bit', '#bits'] },
  { t: 'Physics', s: 'electrons',
    b: 'Charge moving through doped silicon under an electric field. Below this floor nobody is pretending anything, and the abstractions stop.' },
];

export function initTower() {
  const host = $('#tower');
  if (!host) return;

  FLOORS.forEach((f, i) => {
    const btn = h('button', { class: 'floor', type: 'button', 'aria-expanded': 'false' }, [
      h('span', { class: 'floor-n', text: String(FLOORS.length - i).padStart(2, '0') }),
      h('span', { class: 'floor-t', text: f.t }),
      h('span', { class: 'floor-s', text: f.s }),
    ]);

    const body = h('div', { class: 'floor-body is-hidden' });
    body.innerHTML = f.b;
    if (f.link) {
      body.append(' ', h('a', { href: f.link[1], text: f.link[0] + ' →' }));
    }

    btn.addEventListener('click', () => {
      const open = body.classList.toggle('is-hidden') === false;
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });

    host.append(btn, body);
  });
}
