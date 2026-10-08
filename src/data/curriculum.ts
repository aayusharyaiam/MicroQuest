import type { Challenge, Exercise, Lesson, Module, Processor, Question } from '../types';

const q = (prompt: string, options: string[], answer: number, explanation: string): Question => ({ prompt, options, answer, explanation });
const ex = (prompt: string, code: string, answers: string[], explanation: string): Exercise => ({ prompt, code, answers, explanation });
const challenge = (title: string, prompt: string, starter: string, solution: string, rest: Partial<Challenge>): Challenge => ({ title, prompt, starter, solution, hints: [], ...rest });

export const modules: Module[] = (['8085', '8086'] as Processor[]).flatMap(processor => [
  { id: `${processor}-foundations`, processor, title: 'Start from zero', description: 'Meet the CPU, learn number systems, and find your way around registers.', tag: 'FOUNDATIONS' },
  { id: `${processor}-instructions`, processor, title: 'Speak the language', description: 'Learn every instruction family through examples, quizzes, and small code puzzles.', tag: 'INSTRUCTION SETS' },
  { id: `${processor}-programs`, processor, title: 'Think like a programmer', description: 'Turn a problem into an algorithm, trace it, then write and test your own program.', tag: 'PROGRAMMING' },
]);

function foundations(processor: Processor): Lesson[] {
  const is85 = processor === '8085';
  return [
    {
      id: `${processor}-hello`, processor, module: `${processor}-foundations`, title: 'Your first conversation with a CPU', subtitle: 'No coding experience required. Start right here.', minutes: 7,
      body: `## What is a microprocessor?
A microprocessor is a chip that follows very small instructions. It does not understand “sort these numbers.” You break that job into steps: read a number, compare it, move it, and repeat.

Think of **memory as numbered lockers**, **registers as a few things on your desk**, and an **instruction as one action**. An instruction set is the list of actions your CPU understands.

## Assembly, machine code, and an assembler
The CPU executes numeric machine code. Assembly is a readable spelling of those instructions. An **assembler** translates it. A **label** names a place in your program. A **comment**, introduced by a semicolon, is a note for you.

\`\`\`asm
${is85 ? 'MVI A, 05H  ; put the number 5 in A\nADI 03H     ; add 3 to A\nHLT         ; stop: A now contains 08H' : 'MOV AX, 0005H ; put 5 in AX\nADD AX, 0003H ; add 3 to AX\nHLT           ; stop: AX now contains 0008H'}
\`\`\`

## The fetch–decode–execute cycle
1. **Fetch:** the program counter finds the next instruction.
2. **Decode:** the CPU identifies what it means.
3. **Execute:** it performs the operation.
4. Advance to the next instruction, unless a jump changes the path.

Here you can single-step assembly in a teaching simulator. On a real trainer, machine-code entry and operating keys depend on the trainer model. You will learn those separately in lab orientation.

**Your learning loop:** read → predict → answer → fill a gap → run → explain the result. Getting something wrong is useful feedback, not a penalty.`,
      questions: [q('What does an assembler do?', ['Powers the CPU', 'Translates assembly into machine code', 'Stores only pictures'], 1, 'Assembly mnemonics are translated into the numeric instructions the CPU executes.'), q('What is a register?', ['A small, fast storage location inside the CPU', 'An entire hard drive', 'A comment in a program'], 0, 'Registers hold working values inside the processor.'), q('Why write HLT in these examples?', ['To clear memory', 'To multiply', 'To stop execution'], 2, 'HLT halts the processor; real interrupts can resume a halted CPU.')],
      exercise: is85 ? ex('Load 5 into A and stop.', '___ A, 05H\n___', ['MVI', 'HLT'], 'MVI loads an immediate byte. HLT ends this teaching program.') : ex('Load 5 into AX and stop.', '___ AX, 0005H\n___', ['MOV', 'HLT'], 'MOV copies the immediate value into AX. HLT stops execution.'),
    },
    {
      id: `${processor}-numbers`, processor, module: `${processor}-foundations`, title: 'Bits, bytes & hexadecimal', subtitle: 'Make 2400H and FFH feel as natural as 24 and 255.', minutes: 10,
      body: `## Start with the units
A **bit** is 0 or 1. A **nibble** is 4 bits. A **byte** is 8 bits. A **word** on the 8086 is 16 bits (2 bytes). An unsigned byte represents 0–255; an unsigned 16-bit value represents 0–65535.

## Three ways to write the same value
Decimal uses ten digits. Binary uses 0 and 1. Hexadecimal uses **0–9 and A–F**. One hex digit corresponds to exactly four bits.

- Decimal 10 = binary 1010 = hex 0AH.
- Decimal 16 = binary 00010000 = hex 10H.
- Decimal 255 = binary 11111111 = hex FFH.
- Hex 2FH = 2 × 16 + 15 = decimal 47.

In this editor, ordinary numbers are decimal. A suffix **H** means hexadecimal. Write **0FFH**, not FFH, when ambiguity with a label is possible; both are accepted here. Real assemblers often require the leading zero.

## Address versus data
**2400H is a location**, not the number stored there. If memory[2400H] = 3AH, the address is 2400H and the data is 3AH. Consecutive byte addresses are 2400H, 2401H, 2402H, and so on.

## Unsigned and signed interpretation
The bits 11111111 mean 255 unsigned or −1 in 8-bit **two's complement**. The signed byte range is −128 through +127. To form −5, invert 00000101 and add 1: 11111011 = FBH.

## Little-endian words
The low byte is stored first: the word 1234H at address 2400H occupies 34H at 2400H and 12H at 2401H. Do not confuse byte order with the way a hex number is written.`,
      questions: [q('What is 10H in decimal?', ['10', '16', '100'], 1, 'The H suffix means hexadecimal: 1 × 16 + 0 = 16.'), q('How many bits are in a byte?', ['4', '8', '16'], 1, 'One byte contains eight bits, or two hex digits.'), q('A little-endian word 1234H starts at 2400H. What is at 2400H?', ['12H', '34H', '1234H'], 1, 'The low byte, 34H, occupies the lower address.')],
      exercise: is85 ? ex('Load decimal 16, then add decimal 1.', 'MVI A, ___\nADI ___\nHLT', ['10H', '01H'], '10H is sixteen, so the result is 11H (seventeen).') : ex('Load decimal 16, then add decimal 1.', 'MOV AX, ___\nADD AX, ___\nHLT', ['10H', '01H'], 'Hexadecimal 10H equals decimal 16.'),
    },
    {
      id: `${processor}-architecture`, processor, module: `${processor}-foundations`, title: is85 ? 'Meet the 8085 registers & flags' : 'Meet the 8086 registers & segments', subtitle: 'Understand the machine before you tell it what to do.', minutes: 12,
      body: is85 ? `## The 8085 at a glance
The 8085 has an **8-bit data bus** and a **16-bit address bus**, so it can address 64 KiB of memory (0000H–FFFFH). Its accumulator **A** is the main working register for arithmetic and logic.

General-purpose registers are **B, C, D, E, H, L**. Register pairs **BC, DE, HL** hold 16-bit values. In Intel syntax, pair operands are written B, D, H (for example LXI H, 2400H). **M is not a register**: it means the memory byte addressed by HL.

The **PC** holds the address of the next instruction. The **SP** points to the stack, a memory area that grows toward lower addresses.

## Five status flags
- **S (sign):** bit 7 of the result.
- **Z (zero):** 1 when the result is zero.
- **AC (auxiliary carry):** a carry/borrow across the low nibble boundary; important for BCD.
- **P (parity):** 1 when the result has an even number of set bits.
- **CY (carry):** carry out in addition or borrow in subtraction.

For subtraction, 8085 AC follows the complemented internal half-borrow convention, unlike 8086 AF. Use CY for unsigned borrow tests; do not infer the full subtraction result from AC.

For FFH + 01H, A becomes 00H and CY and Z are set. For 7FH + 01H, A becomes 80H and CY is clear. **The 8085 has no overflow flag**; carry and signed overflow are different concepts.

\`\`\`asm
LXI H, 2400H ; HL points at memory
MVI M, 2AH   ; memory[2400H] = 2AH
MOV A, M     ; A = 2AH
HLT
\`\`\`

MOV, MVI, LXI, INX, and DCX do not change status flags. Always check which instruction last changed the flag you want to test.` : `## The 8086 at a glance
The 8086 has 16-bit general registers and a 20-bit physical address space (1 MiB). **AX, BX, CX, DX** each split into two bytes: AX = AH:AL. Changing AL preserves AH.

**SP, BP, SI, DI** are 16-bit pointer/index registers. **CS, DS, SS, ES** are segment registers. **IP** is the instruction pointer. CS:IP locates code; DS commonly selects data; SS:SP locates the stack.

## Segmented addresses
Physical address = **segment × 16 + offset**. DS = 1000H and offset = 0020H refers to 10020H. Different segment:offset pairs can refer to the same physical byte.

For normal data accesses, [BX], [SI], [DI] use DS. Addresses involving BP default to SS. String sources use DS:SI and destinations use ES:DI. An explicit prefix such as ES:[BX] overrides the default.

## Status versus control flags
Status flags: **CF** carry/borrow, **PF** low-byte even parity, **AF** auxiliary carry, **ZF** zero, **SF** sign, **OF** signed overflow. Control flags: **TF** single-step trap, **IF** maskable interrupts, **DF** string direction.

7FFFH + 1 → 8000H: OF = 1, CF = 0. FFFFH + 1 → 0000H: CF = 1, OF = 0. Choose signed jumps (JG/JL) or unsigned jumps (JA/JB) to match your data.

\`\`\`asm
MOV AX, 1234H
MOV AL, 56H ; AX becomes 1256H
MOV BX, 2400H
MOV [BX], AX ; memory: 56H then 12H
HLT
\`\`\`

The simulator initializes segment registers to zero. Real hardware requires you to initialize the segments and stack according to your execution environment.`,
      questions: is85 ? [q('What does M refer to?', ['The memory byte addressed by HL', 'Register M', 'The carry flag'], 0, 'M is an indirect memory operand, not a physical register.'), q('What is CY after FFH + 01H?', ['0', '1', 'Unchanged'], 1, 'The ninth bit is a carry out of the 8-bit result.'), q('Which pair points to M?', ['BC', 'DE', 'HL'], 2, 'M means memory[HL].')] : [q('AX is 1234H. MOV AL, 56H makes AX…', ['0056H', '1256H', '5634H'], 1, 'Writing AL changes only the low byte.'), q('1000H:0020H corresponds to…', ['10020H', '10002H', '1020H'], 0, '1000H × 10H + 0020H = 10020H.'), q('Which flag detects signed overflow?', ['CF', 'DF', 'OF'], 2, 'OF indicates a result outside the signed range.')],
      exercise: is85 ? ex('Point HL at 2400H and store a byte there.', '___ H, 2400H\nMVI ___, 2AH\nHLT', ['LXI', 'M'], 'HL provides the address; M dereferences it.') : ex('Change only the low byte of AX.', 'MOV AX, 1234H\nMOV ___, 56H\nHLT', ['AL'], 'AX becomes 1256H; AH stays 12H.'),
    },
  ];
}

const lessons85: Lesson[] = [
  {
    id: '8085-transfer', processor: '8085', module: '8085-instructions', title: 'Data transfer: move your first byte', subtitle: 'MOV, MVI, LXI and the different ways to reach memory.', minutes: 12,
    body: `## Copying is not removing
**MOV destination, source** copies an 8-bit value. The source remains unchanged. MOV A, B copies B into A. MOV M, A stores A at memory[HL]. MOV M, M is invalid: there is no general memory-to-memory MOV.

**MVI register, byte** loads immediate data (MVI A, 2AH). **LXI pair, word** loads a 16-bit constant (LXI H, 2400H).

## Three ways to access memory
- **Direct:** LDA 2400H loads A from that address; STA 3000H stores A there.
- **HL indirect:** MOV A, M reads memory[HL]. INX H advances HL to the next byte without changing flags.
- **BC/DE indirect:** LDAX B / LDAX D loads A through BC/DE. STAX B / STAX D stores A through BC/DE.

**LHLD address** loads L from address and H from address+1. SHLD stores the pair in that same low-byte-first order. **XCHG** swaps HL and DE.

\`\`\`asm
LXI H, 2400H
MOV A, M
INX H
MOV M, A ; copy the first byte into the next location
HLT
\`\`\`

## Addressing modes
Immediate embeds data in the instruction. Register addressing uses a register. Direct embeds a memory address. Register-indirect uses a pointer pair. Implied addressing has no written operand (for example CMA acts on A).

These data-transfer instructions leave status flags unchanged. Copying a zero does **not** automatically set Z.`,
    questions: [q('Does MOV A, B erase B?', ['Yes', 'No', 'Only when B is zero'], 1, 'MOV copies; it does not consume its source.'), q('Which reads from a fixed address into A?', ['STA', 'LDA', 'LXI'], 1, 'LDA loads A directly from memory.'), q('Which is invalid?', ['MOV A, M', 'MOV M, A', 'MOV M, M'], 2, 'The 8085 cannot encode a memory-to-memory MOV.')],
    exercise: ex('Copy the byte at 2400H into 3000H.', '___ 2400H\n___ 3000H\nHLT', ['LDA', 'STA'], 'LDA reads into A; STA writes A to the destination.'),
    challenge: challenge('The byte courier', 'Copy the byte at 2400H to 3000H. Keep the original unchanged.', '; Read 2400H, write 3000H, then halt\n', 'LDA 2400H\nSTA 3000H\nHLT', { memory: [{ address: 0x2400, values: [0x3a] }], expectedMemory: [{ address: 0x2400, values: [0x3a] }, { address: 0x3000, values: [0x3a] }], hints: ['LDA loads the source into A.', 'STA writes A into a fixed memory address.'] }),
  },
  {
    id: '8085-arithmetic', processor: '8085', module: '8085-instructions', title: 'Arithmetic & carrying the extra bit', subtitle: 'Add, subtract, increment, and handle values bigger than one byte.', minutes: 14,
    body: `## Accumulator arithmetic
ADD r adds a register or M to A. ADI byte adds immediate data. ADC / ACI also add the existing carry. SUB / SUI subtract; SBB / SBI subtract the operand **and the existing borrow (CY)**. The result returns to A.

\`\`\`asm
MVI A, 0FFH
ADI 01H ; A = 00H, CY = 1, Z = 1
MVI A, 00H ; flags unchanged
ACI 00H ; A = 01H, using the previous carry
HLT
\`\`\`

## Counters and pointers
INR/DCR update an 8-bit register or M and affect S, Z, AC, P, **but preserve CY**. INX/DCX update a 16-bit pair and affect no flags. DAD pair adds that pair to HL and changes **only CY**.

## Multi-byte addition
Add the low bytes with ADD. Add the high bytes with ADC to include the carry. Do not put an instruction that changes CY between them.

## Decimal adjustment
DAA adjusts A after a BCD addition. Two decimal digits packed into one byte use 00H–99H; digits A–F are not valid BCD digits. DAA uses the low nibble/AC and high value/CY to add 06H and/or 60H. Preserve the carry for the next packed BCD byte.

The 8085 has no native multiplication or division instruction. Implement those with loops or another algorithm.`,
    questions: [q('Which instruction includes the old carry?', ['ADD', 'ADC', 'INR'], 1, 'ADC computes A + operand + CY.'), q('Does DCR change CY?', ['Yes', 'No', 'Only for zero'], 1, 'DCR changes other arithmetic flags but preserves carry.'), q('What does DAD D update?', ['DE and Z', 'HL and CY', 'A and every flag'], 1, 'DAD D adds DE to HL and affects only CY.')],
    exercise: ex('Add 5 and 3, then store the result.', 'MVI A, 05H\n___ 03H\nSTA 3000H\nHLT', ['ADI'], 'ADI adds immediate data to A.'),
    challenge: challenge('Add two memory bytes', 'Add the bytes at 2400H and 2401H. Store the low 8-bit result at 3000H.', '; Your input bytes are 12H and 23H\n', 'LXI H, 2400H\nMOV A, M\nINX H\nADD M\nSTA 3000H\nHLT', { memory: [{ address: 0x2400, values: [0x12, 0x23] }], expectedMemory: [{ address: 0x3000, values: [0x35] }], hints: ['Use HL to point at the first input.', 'MOV A, M loads one byte. INX H reaches the next.', 'ADD M adds the next byte to A.'] }),
  },
  {
    id: '8085-logic', processor: '8085', module: '8085-instructions', title: 'Logic, masks & rotations', subtitle: 'The tools behind even/odd counting and nibble extraction.', minutes: 14,
    body: `## Bitwise operations
ANA/ANI perform AND: a result bit is 1 only if both input bits are 1. ORA/ORI perform OR: either input bit can set it. XRA/XRI perform XOR: different input bits produce 1.

Use **ANI 01H** to isolate bit 0. An even byte has bit 0 = 0, so Z becomes 1; an odd byte produces 01H. ANI 0FH extracts the low nibble. ANI 0F0H keeps the high nibble.

ANA/ANI clear CY and set AC. OR/XOR clear both CY and AC. All update S, Z, P. **CMA** complements A without changing flags.

## Compare without replacing A
CMP r and CPI byte perform subtraction only to set flags. A remains unchanged. After comparing unsigned A with B: CY = 1 means A < B; Z = 1 means equal.

## Four accumulator rotations
- RLC: bit 7 wraps into bit 0 and also into CY.
- RRC: bit 0 wraps into bit 7 and also into CY.
- RAL: rotate left through CY (old CY enters bit 0).
- RAR: rotate right through CY (old CY enters bit 7).

Rotations change only CY. Four RRC instructions exchange the high and low nibble positions. Mask the wanted nibble afterward.

\`\`\`asm
MVI A, 0ABH
RRC
RRC
RRC
RRC
ANI 0FH ; A = 0AH, the original high nibble
HLT
\`\`\`

STC sets CY. CMC complements CY. Neither changes the other flags.`,
    questions: [q('Which mask detects odd/even?', ['F0H', '01H', '80H'], 1, 'Parity of the numeric value is determined by its least significant bit.'), q('Does CMP replace A with the subtraction result?', ['Yes', 'No', 'Only when equal'], 1, 'CMP sets flags while preserving A.'), q('Which rotation includes the old carry as an input?', ['RLC', 'RRC', 'RAL'], 2, 'RAL rotates through carry; RLC wraps bit 7 directly.')],
    exercise: ex('Extract the low nibble of ABH.', 'MVI A, 0ABH\n___ 0FH\nHLT', ['ANI'], 'ABH AND 0FH = 0BH.'),
    challenge: challenge('Nibble detective', 'Extract the high nibble of ABH and store it as 0AH at 3000H.', 'LDA 2400H\n; Rotate and mask here\n', 'LDA 2400H\nRRC\nRRC\nRRC\nRRC\nANI 0FH\nSTA 3000H\nHLT', { memory: [{ address: 0x2400, values: [0xab] }], expectedMemory: [{ address: 0x3000, values: [0x0a] }], hints: ['Four circular right rotations swap nibble positions.', 'ANI 0FH removes the unwanted high nibble.'] }),
  },
  {
    id: '8085-branch', processor: '8085', module: '8085-instructions', title: 'Decisions & loops', subtitle: 'Labels, conditional jumps, and your first repeated task.', minutes: 13,
    body: `## Labels name destinations
A label followed by a colon names the next instruction. JMP label always branches. A conditional jump branches only when its condition is true.

Pairs: JZ/JNZ test zero; JC/JNC test carry; JM/JP test sign (minus/plus); JPE/JPO test even/odd parity. **JP includes zero**, because it tests S = 0.

## A counted loop
\`\`\`asm
LXI H, 2400H
MVI B, 04H
MVI A, 2AH
LOOP: MOV M, A
INX H
DCR B
JNZ LOOP
HLT
\`\`\`

This writes 2AH into four consecutive bytes. DCR B creates the Z flag that JNZ reads. INX H does not alter Z.

## Trace before running
Use a table with columns: iteration, HL, B, memory write. After four iterations, B = 0 and HL = 2404H. A counter initialized to 00H and decremented at the bottom will wrap to FFH: it performs 256 iterations, not zero.

## Building an if/else
CPI compares A with an immediate number. A conditional jump selects a path. Often an unconditional JMP skips the other path after finishing the first one.

Write the algorithm in plain language first. “Repeat for 16 bytes” means initialize a pointer, initialize a count, do the work, advance the pointer, decrement the count, and branch while nonzero.`,
    questions: [q('JNZ branches when…', ['Z is 1', 'Z is 0', 'CY is 1'], 1, 'JNZ means jump if not zero.'), q('Which instruction in the sample controls Z?', ['INX H', 'MOV M, A', 'DCR B'], 2, 'DCR updates the zero flag using the decremented counter.'), q('What happens when an 8-bit zero counter is decremented?', ['It stays 0', 'It becomes FFH', 'It halts'], 1, '8-bit subtraction wraps modulo 256.')],
    exercise: ex('Run the loop exactly four times.', 'MVI B, 04H\nAGAIN: DCR B\n___ AGAIN\nHLT', ['JNZ'], 'DCR sets Z when B reaches zero; JNZ repeats only before that.'),
    challenge: challenge('Paint four memory lockers', 'Fill 2400H through 2403H with 2AH.', '; Initialize pointer, value, and counter\n', 'LXI H, 2400H\nMVI B, 04H\nMVI A, 2AH\nLOOP: MOV M, A\nINX H\nDCR B\nJNZ LOOP\nHLT', { expectedMemory: [{ address: 0x2400, values: [42, 42, 42, 42] }], hints: ['HL is your pointer and B can be your counter.', 'MOV M, A writes one location. INX H advances it.', 'Place JNZ immediately after DCR B.'] }),
  },
  {
    id: '8085-stack', processor: '8085', module: '8085-instructions', title: 'The stack & reusable subroutines', subtitle: 'Save values, call a routine, and return safely.', minutes: 12,
    body: `## The stack is last-in, first-out
Initialize SP to a safe RAM region (for example LXI SP, 4000H in this simulator). PUSH B saves BC, PUSH D saves DE, PUSH H saves HL, and PUSH PSW saves A with the flags. Each push decrements SP by two. POP restores the most recently saved pair and increments SP by two.

## CALL and RET
CALL label pushes the return address, then jumps. RET pops that address into PC. A subroutine must balance every PUSH with a POP before RET. Otherwise it may return to a data value!

\`\`\`asm
LXI SP, 4000H
MVI A, 05H
CALL DOUBLE
HLT
DOUBLE: ADD A
RET
\`\`\`

Conditional calls are CZ, CNZ, CC, CNC, CM, CP, CPE, CPO. Conditional returns are RZ, RNZ, RC, RNC, RM, RP, RPE, RPO. Their conditions match the corresponding jumps.

## Special instructions
XTHL exchanges HL with the two bytes at the stack top (without changing SP). SPHL copies HL into SP. PCHL copies HL into PC. RST n is a one-byte call to vector 8 × n, with n from 0 to 7.

The teaching simulator models a logical return stack for CALL/RET and exposes byte-addressed memory. Its displayed PC is an instruction index, not a machine-code address. It does not replace a real assembler when calculating opcodes or branch addresses.`,
    questions: [q('After PUSH H, SP changes by…', ['+2', '−2', '0'], 1, 'The 8085 stack grows downward by two bytes per pair.'), q('What does CALL save?', ['The return address', 'Only A', 'All registers'], 0, 'CALL automatically saves a return address; save working registers yourself.'), q('Which pair does PUSH B save?', ['Only B', 'BC', 'DE'], 1, 'Pair syntax B means the BC register pair.')],
    exercise: ex('Call a subroutine and return.', 'LXI SP, 4000H\n___ WORK\nHLT\nWORK: INR A\n___', ['CALL', 'RET'], 'CALL saves the return point, and RET resumes after CALL.'),
  },
  {
    id: '8085-control', processor: '8085', module: '8085-instructions', title: 'I/O, interrupts & machine control', subtitle: 'Understand what happens outside your arithmetic program.', minutes: 10,
    body: `## Port I/O
IN port reads an 8-bit input port into A. OUT port sends A to an output port. Port numbers range from 00H to FFH. These are separate from memory addresses. The simulator lets you inspect output ports; unconfigured input ports read zero.

NOP does nothing. HLT halts until an appropriate interrupt/reset on real hardware; here it ends a run.

## Interrupts
An interrupt asks the CPU to execute a service routine. **TRAP** is non-maskable. RST 7.5, 6.5, and 5.5 are maskable vectored interrupts. INTR is a non-vectored maskable request. Priority is TRAP > 7.5 > 6.5 > 5.5 > INTR.

EI enables maskable interrupts (on real 8085 hardware, effective after the following instruction); DI disables them. **RIM** reads interrupt masks/status and serial input into A. **SIM** uses A to set masks, reset the RST 7.5 latch, and control serial output.

## RIM and SIM bit layouts
RIM: bit 7 SID, bits 6–4 pending 7.5/6.5/5.5, bit 3 interrupt enable, bits 2–0 masks 7.5/6.5/5.5.
SIM: bit 7 SOD, bit 6 serial-output enable, bit 4 reset 7.5, bit 3 mask-set enable, bits 2–0 mask values. Bit 5 is unused.

These hardware control mnemonics are in the reference. **External interrupt timing, serial pins, and trainer peripherals are not emulated.** Use the teaching workspace for data/algorithm practice and the real trainer for hardware experiments.`,
    questions: [q('Which interrupt is non-maskable?', ['INTR', 'RST 5.5', 'TRAP'], 2, 'TRAP is the 8085 non-maskable interrupt.'), q('OUT sends data from…', ['HL', 'A', 'SP'], 1, 'OUT transfers the accumulator to a port.'), q('Which reads interrupt status?', ['SIM', 'RIM', 'DI'], 1, 'RIM reads masks, pending requests, interrupt enable, and serial input.')],
    exercise: ex('Send 55H to output port 02H.', 'MVI A, 55H\n___ 02H\nHLT', ['OUT'], 'OUT uses A as its implicit data source.'),
  },
  {
    id: '8085-bcd', processor: '8085', module: '8085-programs', title: 'BCD & ASCII without the confusion', subtitle: 'Know the representation before you write the algorithm.', minutes: 15,
    body: `## Binary, packed BCD, and unpacked BCD
Decimal 45 is binary 2DH. Packed BCD stores two decimal digits per byte: 45H. Unpacked BCD stores one digit per byte: 04H, 05H (order depends on the problem). They are different encodings of the same number.

For **20 decimal digits**, packed BCD occupies 10 bytes; unpacked BCD occupies 20 bytes. Your lab list does not specify which format or digit order. The lab guide explicitly chooses unpacked, least-significant-digit first, so the assumptions are testable.

DAA is useful after packed BCD addition. For unpacked digits, add two digits plus carry: if the sum is at least ten, subtract ten and set the next carry to one.

## A hexadecimal digit to ASCII
ASCII codes for '0'–'9' are 30H–39H. Codes for 'A'–'F' are 41H–46H. A nibble 0–9 needs +30H; A–F needs +37H.

\`\`\`asm
; A holds a nibble 0..15
CPI 0AH
JC DIGIT
ADI 07H
DIGIT: ADI 30H
HLT
\`\`\`

For ABH, extract A and B separately, convert them, and store ASCII 41H and 42H. Never add 30H directly to an unmasked byte and assume you converted both digits.

## Test boundary cases
Test 0, 9, A, and F. For decimal addition, test 0+0, 9+1, and a carry propagating across many digits. The representation is part of the program's contract.`,
    questions: [q('How many bytes hold 20 packed BCD digits?', ['10', '20', '40'], 0, 'Two decimal digits fit in each packed BCD byte.'), q('What do you add to nibble 0AH to get ASCII A?', ['30H', '37H', '41H'], 1, '0AH + 37H = 41H.'), q('Is 2DH the packed BCD representation of decimal 45?', ['Yes', 'No', 'Only in A'], 1, '2DH is binary 45; packed BCD is 45H.')],
    exercise: ex('Convert a decimal nibble to ASCII.', 'MVI A, 09H\nADI ___\nHLT', ['30H'], '09H + 30H = 39H, the ASCII code for 9.'),
  },
  {
    id: '8085-algorithms', processor: '8085', module: '8085-programs', title: 'From a problem to a working program', subtitle: 'Plan, trace, test—and get ready for your seven labs.', minutes: 15,
    body: `## Use a five-step recipe
1. **Contract:** define input addresses, length, representation, and output addresses.
2. **Algorithm:** describe the steps without assembly.
3. **Register plan:** choose pointers, counters, and temporary storage.
4. **Trace:** dry-run two or three values by hand.
5. **Test:** run normal, boundary, and carry cases.

## Example: sum four bytes
Use HL as a pointer, B as a counter, and A as the sum. Start A at zero. Add memory[HL], increment HL, decrement B, repeat. This gives the low byte of the sum; a full-width sum requires explicit carry handling.

## Sorting descending
Bubble sort compares adjacent unsigned bytes. If the left byte is smaller, swap. Repeat passes until no inversions remain. CMP sets CY when A is smaller than the operand. **Do not use sign alone for unsigned order**.

## Debug deliberately
When a result is wrong, single-step from the first unexpected state. Check addresses before checking data. Check the loop count before rewriting the loop. Check the instruction that most recently affected the flags before blaming a jump.

## Your lab path
1. Trainer orientation.
2. Swap two halves of a 16-byte block.
3. Count even and odd bytes.
4. Generate ascending/descending bit patterns.
5. Add 20 decimal digits.
6. Sort descending.
7. Convert both nibbles to ASCII.

Each lab includes an explicit memory contract, a worked algorithm, runnable solution, hints, and an output check. After passing, explain **why** each register and branch was chosen.`,
    questions: [q('What should you decide first?', ['Instruction spelling', 'Input/output contract', 'The website theme'], 1, 'A correct program depends on a clear problem specification.'), q('For unsigned comparison, which means A < operand?', ['CY = 1 after CMP', 'S = 1 always', 'Z = 1'], 0, 'CMP sets carry when unsigned subtraction requires a borrow.'), q('The most useful first debugging step is…', ['Rewrite everything', 'Find the first unexpected state', 'Ignore flags'], 1, 'Single-step and compare the machine state with your intended trace.')],
    exercise: ex('Advance a block pointer and repeat while bytes remain.', 'INX H\n___ B\nJNZ AGAIN', ['DCR'], 'DCR updates the loop counter and the Z flag.'),
    challenge: challenge('Your first block algorithm', 'Sum four bytes at 2400H–2403H and store the low byte at 3000H.', '; Inputs: 01H, 02H, 03H, 04H\n', 'LXI H, 2400H\nMVI B, 04H\nMVI A, 00H\nLOOP: ADD M\nINX H\nDCR B\nJNZ LOOP\nSTA 3000H\nHLT', { memory: [{ address: 0x2400, values: [1, 2, 3, 4] }], expectedMemory: [{ address: 0x3000, values: [10] }], hints: ['Start A at zero before entering the loop.', 'Use ADD M once per iteration.', 'Store A after the loop, not inside it.'] }),
  },
];

const lessons86: Lesson[] = [
  {
    id: '8086-transfer', processor: '8086', module: '8086-instructions', title: 'Data transfer & effective addresses', subtitle: 'MOV, memory operands, sizes, and little-endian data.', minutes: 14,
    body: `## Intel operand order
MOV destination, source copies a value. MOV AX, BX copies BX to AX. MOV AL, [BX] reads a byte through DS:BX. MOV [BX], AX writes a word. Ordinary MOV cannot have both operands in memory.

## Operand sizes
AX is a word; AL is a byte. MOV AX, AL is invalid. When the size is not implied by a register, write BYTE PTR or WORD PTR: MOV BYTE PTR [2400H], 2AH. Immediate-to-segment MOV is invalid; load AX first, then MOV DS, AX. MOV cannot write CS.

## Original 8086 effective addresses
Valid address registers are BX, BP, SI, DI. Valid two-register combinations are BX+SI, BX+DI, BP+SI, BP+DI, with optional displacement. [AX] and [SP] are not encodable on the 8086. BP-based operands default to SS; others default to DS.

## More transfer tools
XCHG swaps equal-size operands (not two memory operands). LEA computes an effective offset without reading memory. LDS and LES load a register plus a segment from a four-byte far pointer. XLAT reads the table byte at DS:[BX+AL] into AL.

LAHF copies status flags into AH; SAHF restores selected flags from AH. PUSHF/POPF save/restore the flags word.

\`\`\`asm
MOV BX, 2400H
MOV AL, [BX]
MOV BYTE PTR [3000H], AL
HLT
\`\`\`

This workspace supports a clearly marked teaching subset. Far pointer instructions and hardware-specific operations are documented in the reference, with unsupported execution reported explicitly.`,
    questions: [q('Which effective address is valid on the original 8086?', ['[AX]', '[BX+SI]', '[SP]'], 1, 'BX+SI is one of the original legal base/index combinations.'), q('MOV AX, AL is…', ['Valid widening', 'Invalid: unequal operand sizes', 'A segment operation'], 1, 'MOV requires matching operand sizes.'), q('Does LEA read the memory contents?', ['Yes', 'No', 'Only for BP'], 1, 'LEA computes the effective offset.')],
    exercise: ex('Read a byte via BX and store it directly.', 'MOV BX, 2400H\nMOV ___, [BX]\nMOV BYTE PTR [3000H], AL\nHLT', ['AL'], 'AL is an 8-bit register, so the read is one byte.'),
    challenge: challenge('8086 byte courier', 'Copy the byte at DS:2400H to DS:3000H. Segments start at zero.', '; Your source byte is 3AH\n', 'MOV BX, 2400H\nMOV AL, [BX]\nMOV [3000H], AL\nHLT', { memory: [{ address: 0x2400, values: [0x3a] }], expectedMemory: [{ address: 0x2400, values: [0x3a] }, { address: 0x3000, values: [0x3a] }], hints: ['MOV AL, [2400H] reads the byte.', 'Use AL again as the source of the store.'] }),
  },
  {
    id: '8086-arithmetic', processor: '8086', module: '8086-instructions', title: 'Arithmetic, carry & signed overflow', subtitle: 'ADD, ADC, SUB, SBB, multiplication, and division.', minutes: 15,
    body: `## Explicit destinations
ADD AX, BX writes AX + BX into AX. ADC includes CF. SUB subtracts; SBB subtracts the source and CF. INC/DEC add/subtract one and preserve CF. NEG forms two's complement; CMP sets subtraction flags without storing a result.

## Signed versus unsigned
CF describes unsigned carry/borrow. OF describes signed overflow. After 7FFFH + 1, OF is set but CF is clear. After FFFFH + 1, CF is set but OF is clear. Signed and unsigned are **interpretations of the same bits**.

## Implicit multiply/divide operands
MUL byte computes AL × operand → AX. MUL word computes AX × operand → DX:AX. IMUL is signed; on the original 8086 it uses the same one-operand form.

DIV byte divides AX by the operand → quotient AL, remainder AH. DIV word divides DX:AX → quotient AX, remainder DX. IDIV is signed. A zero divisor or an oversized quotient causes a divide error. Clear DX before unsigned word division when the dividend is only in AX. Use CWD to sign-extend AX into DX:AX for signed division. CBW sign-extends AL into AX.

## Decimal adjust family
DAA/DAS adjust AL after packed-BCD add/subtract. AAA/AAS adjust unpacked digits after add/subtract; AAM splits a multiplication result into base-ten digits; AAD combines two unpacked digits before division.

The reference covers all these instructions. The workspace supports the arithmetic forms marked runnable; division and decimal adjustment are reference-only here.`,
    questions: [q('Which instruction preserves CF?', ['ADD', 'INC', 'SUB'], 1, 'INC updates arithmetic flags except carry.'), q('MUL BX places its word product in…', ['BX:CX', 'DX:AX', 'AX only'], 1, 'Word MUL uses AX implicitly and returns the 32-bit result in DX:AX.'), q('For a small unsigned AX dividend before DIV BX, DX should be…', ['Zero', 'FFFFH', 'Equal to BX'], 0, 'The full dividend is DX:AX, so clear the high word.')],
    exercise: ex('Add two word registers with carry.', 'MOV AX, 0FFFFH\nADD AX, 1\nMOV BX, 0\n___ BX, 0\nHLT', ['ADC'], 'BX becomes 1 because ADD produced a carry.'),
    challenge: challenge('Add two words', 'Add words 1234H and 0102H stored at 2400H and 2402H. Store the result at 3000H.', '; Words are stored low byte first\n', 'MOV AX, [2400H]\nADD AX, [2402H]\nMOV [3000H], AX\nHLT', { memory: [{ address: 0x2400, values: [0x34, 0x12, 0x02, 0x01] }], expectedMemory: [{ address: 0x3000, values: [0x36, 0x13] }], hints: ['Reading into AX selects a 16-bit word.', 'The result 1336H is stored as 36H, 13H.'] }),
  },
  {
    id: '8086-logic', processor: '8086', module: '8086-instructions', title: 'Masks, tests, shifts & rotations', subtitle: 'Manipulate bits while keeping flag behavior straight.', minutes: 12,
    body: `## Boolean operations
AND clears unwanted bits. OR sets selected bits. XOR toggles bits; XOR AX, AX clears AX. NOT inverts bits and changes no flags. TEST performs AND for flags only, preserving both operands. AND/OR/XOR/TEST clear CF and OF; AF is undefined.

## Shifts
SHL (also called SAL) shifts left, inserting zeros. SHR shifts right, inserting zeros. SAR shifts right while copying the sign bit. The bit shifted out goes into CF. OF is defined only for a one-bit shift. Other undefined flags should never be relied on.

**Original 8086 counts are 1 or CL**, not an arbitrary immediate count. To shift four places, load CL with 4, then SHR AL, CL.

## Rotations
ROL/ROR wrap bits around. RCL/RCR rotate through carry. Rotations affect CF and, for a count of one, OF; they do not recompute ZF, SF, or PF.

\`\`\`asm
MOV AL, 0ABH
MOV CL, 4
SHR AL, CL
AND AL, 0FH ; AL = 0AH
HLT
\`\`\`

To branch on odd/even without altering data, TEST AL, 1 followed by JZ/JNZ works. Numeric evenness and the PF flag are different: PF counts the number of set bits in the low byte.`,
    questions: [q('Which leaves operands unchanged?', ['AND', 'TEST', 'XOR'], 1, 'TEST sets flags from an AND without storing its result.'), q('Which original 8086 shift count is legal?', ['Immediate 4', 'CL', 'AX'], 1, 'Original 8086 supports a count of one or the CL register.'), q('SAR fills from the left with…', ['Zero always', 'The original sign bit', 'CF'], 1, 'SAR is an arithmetic right shift and preserves the sign.')],
    exercise: ex('Keep only AL’s low nibble.', 'MOV AL, 0ABH\n___ AL, 0FH\nHLT', ['AND'], 'AND with 0FH removes the top four bits.'),
    challenge: challenge('Find the high nibble', 'Extract the high nibble of ABH into AL (expected 0AH).', 'MOV AL, 0ABH\n; Use CL for a shift count\n', 'MOV AL, 0ABH\nMOV CL, 4\nSHR AL, CL\nHLT', { expectedRegisters: { AL: 0x0a }, hints: ['Load CL with 4.', 'SHR AL, CL removes the low nibble.'] }),
  },
  {
    id: '8086-branch', processor: '8086', module: '8086-instructions', title: 'Unsigned jumps, signed jumps & LOOP', subtitle: 'Choose a condition that matches your data.', minutes: 13,
    body: `## Comparison is subtraction for flags
CMP AX, BX sets flags from AX − BX, leaving AX unchanged. JE/JZ tests equality; JNE/JNZ tests inequality. JMP branches unconditionally.

## Unsigned order
JB/JC/JNAE: below (CF = 1). JAE/JNB/JNC: above or equal (CF = 0). JA/JNBE: above (CF = 0 and ZF = 0). JBE/JNA: below or equal (CF = 1 or ZF = 1).

## Signed order
JL/JNGE: less (SF ≠ OF). JGE/JNL: greater/equal (SF = OF). JG/JNLE: greater (ZF = 0 and SF = OF). JLE/JNG: less/equal (ZF = 1 or SF ≠ OF).

Also: JO/JNO overflow, JS/JNS sign, JP/JPE and JNP/JPO parity. The original 8086 conditional branch displacement is an 8-bit signed offset; assemblers may need an inverted short condition plus a longer JMP for distant targets.

## Counted loops
LOOP decrements CX and jumps if CX ≠ 0; flags are unchanged. LOOPE/LOOPZ also require ZF = 1; LOOPNE/LOOPNZ also require ZF = 0. JCXZ jumps if CX = 0 without decrementing.

\`\`\`asm
MOV CX, 4
MOV AX, 0
AGAIN: ADD AX, 2
LOOP AGAIN
HLT ; AX = 8
\`\`\`

A loop starting with CX = 0 wraps to FFFFH. Use JCXZ to skip it when zero-length input is possible.`,
    questions: [q('Which is unsigned “below”?', ['JL', 'JB', 'JO'], 1, 'JB tests CF; JL is a signed comparison.'), q('LOOP uses which counter?', ['AX', 'BX', 'CX'], 2, 'LOOP decrements CX without modifying flags.'), q('Which skips when CX is already zero?', ['JCXZ', 'JZ', 'LOOP'], 0, 'JCXZ tests CX directly, not ZF.')],
    exercise: ex('Repeat an addition four times.', 'MOV CX, 4\nMOV AX, 0\nAGAIN: ADD AX, 2\n___ AGAIN\nHLT', ['LOOP'], 'LOOP decrements CX and repeats until it becomes zero.'),
    challenge: challenge('Count to eight', 'Use a loop to add 2 four times. Finish with AX = 8 and CX = 0.', '; Initialize AX and CX, then make a loop\n', 'MOV AX, 0\nMOV CX, 4\nAGAIN: ADD AX, 2\nLOOP AGAIN\nHLT', { expectedRegisters: { AX: 8, CX: 0 }, hints: ['CX starts at four.', 'LOOP handles the decrement and the branch.'] }),
  },
  {
    id: '8086-stack', processor: '8086', module: '8086-instructions', title: 'Stack discipline & near procedures', subtitle: 'SS:SP, PUSH/POP, CALL/RET, and safe register preservation.', minutes: 12,
    body: `## Word-sized stack operations
The 8086 stack uses SS:SP and grows downward. PUSH AX decrements SP by 2 then stores a word. POP AX reads the word then increments SP by 2. The original 8086 does not support PUSH immediate; load a register first.

## Procedures
A near CALL saves IP on the current stack; RET restores IP. A far CALL saves CS and IP; RETF restores both. RET n additionally discards n bytes of arguments. The browser workspace supports label-based near calls, not far transfers.

\`\`\`asm
MOV SP, 4000H
MOV AX, 5
CALL DOUBLE
HLT
DOUBLE: ADD AX, AX
RET
\`\`\`

## Preserve what you promise
If your routine uses BX but the caller needs its old value, PUSH BX at entry and POP BX before RET. Pop in reverse push order. Do not lose track of the return address below saved registers.

PUSHF/POPF transfer FLAGS. LAHF/SAHF transfer selected status flags through AH. INT invokes an interrupt handler; IRET restores IP, CS, and FLAGS. Real interrupt vectors and hardware timing are outside this teaching emulator.

The displayed workspace IP is a parsed instruction index, not a machine-code byte offset. Use a real assembler and trainer for machine-code lengths and opcode entry.`,
    questions: [q('PUSH AX changes SP by…', ['−2', '+2', '−1'], 0, 'A word push reserves two bytes below the current stack top.'), q('Which instruction returns from an interrupt?', ['RET', 'IRET', 'POP'], 1, 'IRET restores IP, CS, and FLAGS.'), q('PUSH 1234H is valid on the original 8086?', ['Yes', 'No', 'Only in DS'], 1, 'Immediate PUSH was added after the original 8086.')],
    exercise: ex('Preserve BX inside a procedure.', 'WORK: ___ BX\nMOV BX, 1234H\n___ BX\nRET', ['PUSH', 'POP'], 'Save the old value, use BX, then restore it before returning.'),
  },
  {
    id: '8086-strings', processor: '8086', module: '8086-instructions', title: 'String instructions & REP', subtitle: 'Copy and compare blocks with SI, DI, CX, and DF.', minutes: 14,
    body: `## A string is a sequence of bytes or words
MOVSB/MOVSW copies DS:SI to ES:DI. LODSB/LODSW loads DS:SI into AL/AX. STOSB/STOSW stores AL/AX at ES:DI. CMPSB/CMPSW compares DS:SI against ES:DI. SCASB/SCASW compares AL/AX against ES:DI.

Byte versions advance one byte; word versions advance two. **DF = 0 increments**, **DF = 1 decrements**. CLD clears direction; STD sets direction. Explicitly choose direction instead of trusting a previous routine.

## Repetition prefixes
REP repeats MOVS, STOS, or LODS while CX is nonzero, decrementing CX each time. REPE/REPZ repeats CMPS/SCAS while equality remains; REPNE/REPNZ repeats while inequality remains. CX = 0 means no operation.

\`\`\`asm
CLD
MOV SI, 2400H
MOV DI, 3000H
MOV CX, 4
REP MOVSB
HLT
\`\`\`

With DS = ES = 0, this copies four bytes from 2400H to 3000H. The workspace supports CLD, STD, MOVSB/MOVSW, LODSB/LODSW, STOSB/STOSW and REP for those operations; compare/scan string operations are reference-only.

## Overlapping memory
If the destination begins inside the source at a higher address, a forward copy can overwrite data you have not read. Copy backward from the last byte using STD, and restore CLD before returning to a caller that expects forward direction.`,
    questions: [q('MOVSB destination uses…', ['DS:SI', 'ES:DI', 'SS:SP'], 1, 'String destinations are addressed through ES:DI.'), q('CLD means pointers will…', ['Increase', 'Decrease', 'Stay fixed'], 0, 'Clearing DF selects forward traversal.'), q('REP with CX = 0 does…', ['65536 copies', 'No copies', 'One copy'], 1, 'REP checks the count before executing a string instruction.')],
    exercise: ex('Copy a four-byte block forward.', '___\nMOV SI, 2400H\nMOV DI, 3000H\nMOV CX, 4\n___ MOVSB\nHLT', ['CLD', 'REP'], 'CLD selects forward traversal; REP uses CX as the count.'),
    challenge: challenge('A four-byte delivery', 'Copy bytes 01H, 02H, 03H, 04H from 2400H to 3000H with REP MOVSB.', '; DS and ES begin at zero\n', 'CLD\nMOV SI, 2400H\nMOV DI, 3000H\nMOV CX, 4\nREP MOVSB\nHLT', { memory: [{ address: 0x2400, values: [1, 2, 3, 4] }], expectedMemory: [{ address: 0x3000, values: [1, 2, 3, 4] }], hints: ['SI is the source, DI is the destination.', 'Set CX to four and clear DF before REP MOVSB.'] }),
  },
  {
    id: '8086-control', processor: '8086', module: '8086-instructions', title: 'I/O, flags & processor control', subtitle: 'Recognize the system-level instructions and their limits.', minutes: 10,
    body: `## Isolated I/O
IN AL, port / IN AX, port reads a byte/word. OUT port, AL / OUT port, AX writes it. A port can be an 8-bit immediate or the 16-bit DX register. I/O ports are separate from memory.

## Flag controls
CLC clears CF, STC sets CF, CMC toggles CF. CLD/STD choose string direction. CLI clears IF; STI sets IF. Interrupt and device behavior depends on the real system.

## Control and synchronization
NOP does nothing. HLT halts the processor until an appropriate interrupt/reset. WAIT synchronizes with the coprocessor's TEST input. LOCK is a prefix that holds the bus during certain memory operations; it is not a general mutual-exclusion solution in this teaching workspace.

INT n invokes an interrupt vector; INT 3 is a breakpoint; INTO invokes interrupt 4 when OF is set. IRET returns from an interrupt. DOS services such as INT 21H require DOS: they are **not part of a bare 8086 CPU** and are not provided here.

## Know the generation
This course targets the **original 8086**, not modern x86. Instructions such as PUSHA, ENTER, MOVZX, 32-bit registers, and immediate shift counts beyond 1 belong to later processors. Our instruction reference stays within the original instruction families.`,
    questions: [q('INT 21H file services are supplied by…', ['The CPU alone', 'DOS', 'The carry flag'], 1, 'Operating-system services require the corresponding environment.'), q('Which clears the carry flag?', ['CLD', 'CLC', 'CLI'], 1, 'CLC clears CF; CLD clears DF; CLI clears IF.'), q('Which belongs to a later generation, not the original 8086?', ['MOV', 'PUSHA', 'ADD'], 1, 'PUSHA was introduced after the 8086.')],
    exercise: ex('Clear carry before starting a carry chain.', '___\nMOV AX, 0\nADC AX, 1\nHLT', ['CLC'], 'CLC establishes a known initial carry value.'),
  },
  {
    id: '8086-algorithms', processor: '8086', module: '8086-programs', title: 'Design, trace & test an 8086 program', subtitle: 'Bring data sizes, pointers, loops, and flags together.', minutes: 15,
    body: `## A reliable workflow
Specify input/output addresses and sizes. Choose signed or unsigned interpretation. Write pseudocode. Allocate registers. Dry-run a small example. Finally, implement and test.

## Summing bytes into a word
If a byte is loaded into BL, clear BH before adding BX to a word sum. Otherwise the old BH becomes unintended extra data. The original 8086 has no MOVZX.

## Register plan
- SI: current input offset.
- CX: number of remaining bytes.
- AX: 16-bit sum.
- BX: zero-extended current byte.

Read a byte, add it, advance SI, repeat. Guard zero-length input with JCXZ. For a four-byte test [1,2,3,4], AX must be 10.

## Meaningful tests
Try zeros, maximum bytes, and values that produce an 8-bit carry but still fit a word. For sorting, try already sorted, reversed, repeated, and boundary values (00H/FFH). For copying, test overlap and direction.

## Next step
Your uploaded lab list contains seven **8085** experiments. The 8086 path here includes its own programming challenges. If your course supplies an 8086 lab sheet later, add those exact contracts rather than guessing the assignment.

Completion is grouped: lesson reading, quiz mastery, code puzzles, independent programs, and lab validation. These are different skills; a quiz score alone does not prove you can write a program.`,
    questions: [q('Why clear BH after loading BL?', ['To zero-extend the byte', 'To change DS', 'To enable interrupts'], 0, 'BX is a word; stale BH would add an unintended high byte.'), q('Which test is important for a byte sum in AX?', ['Only one positive value', 'Values totaling more than 255', 'No data'], 1, 'It checks that the sum is really word-sized.'), q('Your uploaded lab sheet contains…', ['8086 DOS services', 'Seven 8085 experiments', 'Modern x86 programs'], 1, 'The provided list is an 8085 lab list.')],
    exercise: ex('Zero-extend a loaded byte using original 8086 instructions.', 'MOV BL, [SI]\nMOV ___, 0\nADD AX, BX', ['BH'], 'Clearing BH makes BX contain the unsigned value of BL.'),
    challenge: challenge('Sum a block into a word', 'Sum four unsigned bytes at 2400H into AX. Store the word result at 3000H. Inputs total 258.', '; Inputs: FFH, 01H, 01H, 01H\n', 'MOV SI, 2400H\nMOV CX, 4\nMOV AX, 0\nMOV BX, 0\nAGAIN: MOV BL, [SI]\nADD AX, BX\nINC SI\nLOOP AGAIN\nMOV [3000H], AX\nHLT', { memory: [{ address: 0x2400, values: [255, 1, 1, 1] }], expectedMemory: [{ address: 0x3000, values: [2, 1] }], expectedRegisters: { AX: 258 }, hints: ['Use AX for the sum, not AL.', 'Clear BX before loading BL.', 'A word 0102H is stored low byte first as 02H, 01H.'] }),
  },
];

export const lessons: Lesson[] = [...foundations('8085'), ...lessons85, ...foundations('8086'), ...lessons86];
