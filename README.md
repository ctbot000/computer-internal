# How a Computer Works

An interactive, visual walk up the whole ladder — from one transistor acting as a
switch to a running program — with a working 8-bit CPU you can step through one
clock tick at a time. Part two does the same for quantum computers, on top of an
exact state-vector simulator.

- **Part one — classical:** [ctbot000.github.io/computer-internal](https://ctbot000.github.io/computer-internal/)
- **Part two — quantum:** [ctbot000.github.io/computer-internal/quantum.html](https://ctbot000.github.io/computer-internal/quantum.html)

No build step, no dependencies, no tracking. Plain HTML, CSS and ES modules.

## Part one: how a computer works

| # | Section | What you can do |
|---|---------|-----------------|
| 1 | **Bits** | Flip a switch in a circuit; flip eight of them and watch the same byte be a number, a letter, a shade of grey and a CPU instruction at once |
| 2 | **Gates** | Live NOT, AND, OR, XOR and NAND with truth tables that highlight the row you are on, plus three NAND gates impersonating the other three |
| 3 | **Math** | A five-gate full adder wired up gate by gate, then eight of them chained so you can watch a carry ripple from right to left |
| 4 | **Memory** | An SR latch that holds its bit after you let go of Set, and a 3-to-8 address decoder picking one row out of eight |
| 5 | **CPU** | A complete little processor: 16 bytes of memory, a shared bus, an assembler, five example programs, and a clock from 1 Hz to 500 Hz |
| 6 | **Speed** | Every level of the memory hierarchy rescaled so one clock tick is one second — the Atlantic comes out at sixteen years |
| 7 | **Tower** | The ten layers between physics and the app you actually use |

## Part two: how a quantum computer works

| # | Section | What you can do |
|---|---------|-----------------|
| 1 | **Qubit** | Rotate a qubit around the Bloch sphere with H, X, Y, Z, S and T, and watch each gate sweep the arrow along the rotation it really performs |
| 2 | **Measure** | Tilt a qubit, measure it and watch it collapse; measure thousands of fresh copies to estimate the odds, sampling error included |
| 3 | **Interfere** | Two coin flips against two Hadamards: turn the phase between them and watch the arrows for each outcome add up or cancel |
| 4 | **Entangle** | Switch H and CNOT on and off to make a Bell pair, measure 1,000 pairs, and see what simulating n qubits would cost a classical machine |
| 5 | **Circuits** | A three-qubit circuit editor with step-through, circle notation, per-qubit Bloch spheres, 1,000-shot runs with adjustable noise, and examples including GHZ, Deutsch, Grover and teleportation |
| 6 | **Search** | Grover's algorithm on 4 to 64 boxes, one oracle and one reflection at a time — including what happens when you go one round too far |
| 7 | **Hardware** | The four main ways to build a qubit, an error-budget chart, and a surface-code patch where you inject errors and watch the checks light up — or not, for a logical error |
| 8 | **Uses** | What a quantum computer is and is not good for |

The simulator (`js/quantum/qsim.js`) tracks every amplitude exactly, so every
picture on the page is what an ideal machine would do — except the circuit lab
with its noise turned up, which runs each shot with random Pauli errors.

## The processor in part one

A SAP-1-style machine — the teaching architecture from Malvino & Brown's
*Digital Computer Electronics*, and the one Ben Eater builds on breadboards.
Everything is faithful to that design: a single 8-bit bus that only one component
may drive at a time, micro-steps (T-states) inside every instruction, and a
control unit that does nothing but pull the right wires on each tick.

One byte per instruction: the top four bits are the opcode, the bottom four an
address or a small literal.

| Opcode | Mnemonic | Meaning |
|--------|----------|---------|
| `0000` | `LDA n` | A ← memory[n] |
| `0001` | `ADD n` | A ← A + memory[n] |
| `0010` | `SUB n` | A ← A − memory[n] |
| `0011` | `STA n` | memory[n] ← A |
| `0100` | `LDI k` | A ← k (0–15) |
| `0101` | `JMP n` | jump to n |
| `0110` | `JC n`  | jump if the last add carried |
| `0111` | `JZ n`  | jump if the last result was zero |
| `1110` | `OUT`   | copy A to the output register |
| `1111` | `HLT`   | stop the clock |

`DB v` is not an instruction — it just puts a byte in memory.

The assembler takes optional labels, decimal, `0x` and `0b` literals, and `;`
comments:

```
loop: LDA  res
      ADD  m
      STA  res
      LDA  cnt
      SUB  one
      STA  cnt
      JZ   done
      JMP  loop
done: LDA  res
      OUT
      HLT
res:  DB   0
m:    DB   3
cnt:  DB   5
one:  DB   1
```

You can also click any byte in the memory grid and type over it — including the
bytes the program is currently executing.

## Running it locally

The pages use ES modules, so they need to be served over HTTP rather than opened
from the file system:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

The quantum simulator has unit tests — gate identities, Bloch rotations, Bell and
GHZ states, measurement statistics, Grover's closed form and teleportation:

```bash
node --test
```

## Layout

```
index.html            part one: markup and prose
quantum.html          part two
css/style.css         shared stylesheet, dark and light
css/quantum.css       part two's additions
js/shell.js           theme, navigation, progress and reveal, for both pages
js/util.js            SVG helpers and the logic-gate shapes
js/app.js             part one's sections: intro, bits, gates, adder,
                      memory, cpu (with isa.js), speed, tower
js/quantum/qsim.js    the state-vector simulator
js/quantum/viz.js     Bloch sphere and circle notation
js/quantum/*.js       part two's sections
test/qsim.test.js     simulator tests
```

## Licence

MIT.
