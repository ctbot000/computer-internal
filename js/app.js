/* Main page: the classical computer, bottom to top. */
import { initTheme, initScrollUi, boot } from './shell.js';
import { initIntro } from './intro.js';
import { initBits } from './bits.js';
import { initGates } from './gates.js';
import { initAdder } from './adder.js';
import { initMemory } from './memory.js';
import { initCpu } from './cpu.js';
import { initSpeed } from './speed.js';
import { initTower } from './tower.js';

boot([
  initTheme,
  initIntro,
  initBits,
  initGates,
  initAdder,
  initMemory,
  initCpu,
  initSpeed,
  initTower,
  () => initScrollUi('.section h2, .section .copy, .callout, .panel, .gate-grid, .tower, .vn, .cpu, .next-part'),
]);
