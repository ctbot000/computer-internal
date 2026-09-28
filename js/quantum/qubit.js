/* Section 1 — one qubit on the Bloch sphere, driven by gates. */
import { h, $ } from '../util.js';
import { State, GATE, ROTATION } from './qsim.js';
import { blochSphere, circleSet, probBar, subLabel, fmtC } from './viz.js';

const WHAT = {
  H: 'Hadamard: a half-turn about the diagonal between x and z. Takes a pole to the equator and back.',
  X: 'NOT: a half-turn about x. Swaps 0 and 1.',
  Y: 'A half-turn about y. Swaps 0 and 1 and changes the phase.',
  Z: 'A half-turn about z. Flips the phase and leaves the odds alone.',
  S: 'A quarter-turn about z.',
  T: 'An eighth of a turn about z.',
};

export function initQubit() {
  const host = $('#qubit-demo');
  if (!host) return;

  const st = new State(1);
  const history = [];

  const sphere = blochSphere({ size: 300 });
  const amp = h('div', { class: 'amp-line' });
  const circles = circleSet(1);
  const bar = probBar();
  const hist = h('div', { class: 'q-history' });
  const btns = h('div', { class: 'gate-btns' });

  for (const g of Object.keys(WHAT)) {
    btns.appendChild(h('button', {
      class: 'gate-btn', type: 'button', text: g, title: WHAT[g], 'aria-label': `${g} gate. ${WHAT[g]}`,
      onclick: () => apply(g),
    }));
  }
  btns.appendChild(h('button', { class: 'gate-btn wide', type: 'button', text: 'Reset to |0⟩', onclick: reset }));

  host.append(
    h('div', { class: 'bloch-holder' }, [sphere.el]),
    h('div', { class: 'q-side' }, [
      subLabel('The state'), amp,
      subLabel('Its two amplitudes as circles — area is probability, the needle is phase'), circles.el,
      subLabel('Odds of reading'), bar.el,
      subLabel('Gates'), btns, hist,
    ]),
  );

  function paint() {
    amp.replaceChildren(
      document.createTextNode(`${fmtC(st.re[0], st.im[0])} `), h('span', { class: 'ket', text: '|0\u27E9' }),
      h('span', { class: 'op', text: '+' }),
      document.createTextNode(`${fmtC(st.re[1], st.im[1])} `), h('span', { class: 'ket', text: '|1\u27E9' }),
    );
    circles.set(st);
    bar.set(st.probOne(0));
    hist.replaceChildren(document.createTextNode('|0⟩'));
    history.slice(-14).forEach((g) => hist.append(' → ', h('b', { text: g })));
    if (history.length > 14) hist.prepend('… ');
  }

  function apply(g) {
    const from = st.bloch(0);
    st.apply(GATE[g], 0);
    history.push(g);
    paint();                                  // readouts first, never waiting on a frame
    const { axis, angle } = ROTATION[g];
    sphere.turn(from, axis, angle, 650);
  }

  function reset() {
    st.reset();
    history.length = 0;
    paint();
    sphere.set([0, 0, 1]);
  }

  paint();
  sphere.set(st.bloch(0));
}
