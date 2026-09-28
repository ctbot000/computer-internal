/* Part two: the quantum computer. */
import { initTheme, initScrollUi, boot } from '../shell.js';
import { initQubit } from './qubit.js';
import { initMeasure } from './measure.js';
import { initInterference } from './interference.js';
import { initEntangle, initGrowth } from './entangle.js';
import { initLab } from './lab.js';
import { initGrover } from './grover.js';
import { initBudget, initSurface } from './hardware.js';

boot([
  initTheme,
  initQubit,
  initMeasure,
  initInterference,
  initEntangle,
  initGrowth,
  initLab,
  initGrover,
  initBudget,
  initSurface,
  () => initScrollUi('.section h2, .section .copy, .callout, .wrap > .panel, .cmp, .plats, .uses, .lab, .next-part'),
]);
