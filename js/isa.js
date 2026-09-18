/* The instruction set of the little machine in section 5, plus its assembler.
   One byte per instruction: high nibble = opcode, low nibble = address or literal. */

export const OPS = [
  { code: 0x0, m: 'LDA', arg: 'addr', desc: 'A ← memory[addr]' },
  { code: 0x1, m: 'ADD', arg: 'addr', desc: 'A ← A + memory[addr]' },
  { code: 0x2, m: 'SUB', arg: 'addr', desc: 'A ← A − memory[addr]' },
  { code: 0x3, m: 'STA', arg: 'addr', desc: 'memory[addr] ← A' },
  { code: 0x4, m: 'LDI', arg: 'imm',  desc: 'A ← the number itself (0–15)' },
  { code: 0x5, m: 'JMP', arg: 'addr', desc: 'next instruction comes from addr' },
  { code: 0x6, m: 'JC',  arg: 'addr', desc: 'jump, but only if the last add carried' },
  { code: 0x7, m: 'JZ',  arg: 'addr', desc: 'jump, but only if the last result was 0' },
  { code: 0xE, m: 'OUT', arg: null,   desc: 'copy A to the output register' },
  { code: 0xF, m: 'HLT', arg: null,   desc: 'stop the clock' },
];

export const BY_CODE = new Map(OPS.map((o) => [o.code, o]));
export const BY_NAME = new Map(OPS.map((o) => [o.m, o]));

export const RAM_SIZE = 16;

/** Human-readable form of a byte read as an instruction. */
export function disasm(byte) {
  const op = BY_CODE.get((byte >> 4) & 0xf);
  if (!op) return null;
  return op.arg ? `${op.m} ${byte & 0xf}` : op.m;
}

const NUM = /^(0x[0-9a-f]+|0b[01]+|\d+)$/i;

function parseNum(tok) {
  if (!NUM.test(tok)) return null;
  if (/^0x/i.test(tok)) return parseInt(tok.slice(2), 16);
  if (/^0b/i.test(tok)) return parseInt(tok.slice(2), 2);
  return parseInt(tok, 10);
}

/**
 * Two-pass assembler. Returns { ok, bytes, labels, error }.
 * Syntax:  [label:] MNEMONIC [operand]   |   [label:] DB value   |   ; comment
 */
export function assemble(src) {
  const lines = src.split('\n');
  const parsed = [];
  const labels = new Map();
  let addr = 0;

  for (let i = 0; i < lines.length; i++) {
    let text = lines[i].replace(/[;#].*$/, '').trim();
    if (!text) continue;

    const lab = text.match(/^([A-Za-z_][\w]*)\s*:\s*/);
    if (lab) {
      const name = lab[1].toLowerCase();
      if (labels.has(name)) return err(i, `label "${lab[1]}" is defined twice`);
      labels.set(name, addr);
      text = text.slice(lab[0].length).trim();
      if (!text) continue;
    }

    const parts = text.split(/[\s,]+/);
    const mnem = parts[0].toUpperCase();
    const operand = parts[1];
    if (parts.length > 2) return err(i, `unexpected "${parts[2]}"`);

    if (addr >= RAM_SIZE) return err(i, `program runs past the end of memory (${RAM_SIZE} bytes)`);

    if (mnem === 'DB') {
      if (operand === undefined) return err(i, 'DB needs a value');
      parsed.push({ kind: 'db', operand, line: i, addr });
    } else {
      const op = BY_NAME.get(mnem);
      if (!op) return err(i, `unknown instruction "${parts[0]}"`);
      if (op.arg && operand === undefined) return err(i, `${op.m} needs ${op.arg === 'addr' ? 'an address' : 'a number'}`);
      if (!op.arg && operand !== undefined) return err(i, `${op.m} takes no operand`);
      parsed.push({ kind: 'op', op, operand, line: i, addr });
    }
    addr++;
  }

  const bytes = new Array(RAM_SIZE).fill(0);
  const kinds = new Array(RAM_SIZE).fill(null);
  for (const p of parsed) {
    let v;
    if (p.operand === undefined) {
      v = 0;
    } else {
      v = parseNum(p.operand);
      if (v === null) {
        const key = p.operand.toLowerCase();
        if (!labels.has(key)) return err(p.line, `"${p.operand}" is neither a number nor a label`);
        v = labels.get(key);
      }
    }

    if (p.kind === 'db') {
      if (v < 0 || v > 255) return err(p.line, `DB value ${v} does not fit in a byte`);
      bytes[p.addr] = v & 0xff;
      kinds[p.addr] = 'db';
    } else {
      if (v < 0 || v > 15) {
        return err(p.line, p.op.arg === 'addr'
          ? `address ${v} is outside the ${RAM_SIZE}-byte memory`
          : `${v} does not fit in the 4 spare bits (0–15)`);
      }
      bytes[p.addr] = ((p.op.code << 4) | (v & 0xf)) & 0xff;
      kinds[p.addr] = 'op';
    }
  }

  return { ok: true, bytes, kinds, labels, used: parsed.length };
}

const err = (line, message) => ({ ok: false, error: `line ${line + 1}: ${message}` });

export const EXAMPLES = [
  {
    name: 'Add two numbers',
    src: [
      '; four instructions total',
      '      LDA  x',
      '      ADD  y',
      '      OUT',
      '      HLT',
      'x:    DB   14',
      'y:    DB   28',
    ].join('\n'),
  },
  {
    name: 'Count up in 16s',
    src: [
      '; add 16 until it overflows',
      '      LDI  0',
      'loop: OUT',
      '      ADD  step',
      '      JC   done',
      '      JMP  loop',
      'done: HLT',
      'step: DB   16',
    ].join('\n'),
  },
  {
    name: 'Count down to zero',
    src: [
      '      LDA  n',
      'loop: OUT',
      '      SUB  one',
      '      JZ   done',
      '      JMP  loop',
      'done: OUT',
      '      HLT',
      'n:    DB   5',
      'one:  DB   1',
    ].join('\n'),
  },
  {
    name: 'Multiply 3 × 5',
    src: [
      '; no multiply instruction,\n; so add three five times',
      'loop: LDA  res',
      '      ADD  m',
      '      STA  res',
      '      LDA  cnt',
      '      SUB  one',
      '      STA  cnt',
      '      JZ   done',
      '      JMP  loop',
      'done: LDA  res',
      '      OUT',
      '      HLT',
      'res:  DB   0',
      'm:    DB   3',
      'cnt:  DB   5',
      'one:  DB   1',
    ].join('\n'),
  },
  {
    name: 'Fibonacci',
    src: [
      '; 1 1 2 3 5 8 ... to 144',
      'top:  LDA  a',
      '      OUT',
      '      ADD  b',
      '      STA  t',
      '      LDA  b',
      '      STA  a',
      '      LDA  t',
      '      STA  b',
      '      JC   done',
      '      JMP  top',
      'done: HLT',
      'a:    DB   1',
      'b:    DB   1',
      't:    DB   0',
    ].join('\n'),
  },
];
