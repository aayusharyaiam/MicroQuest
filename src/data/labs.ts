import type { Lab } from '../types';

const swap = `LXI H, 2400H
LXI D, 2408H
MVI B, 08H
AGAIN: MOV C, M
LDAX D
MOV M, A
MOV A, C
STAX D
INX H
INX D
DCR B
JNZ AGAIN
HLT`;
const even = `LXI H, 2400H
MVI B, 10H
MVI C, 00H
MVI D, 00H
AGAIN: MOV A, M
ANI 01H
JNZ ODD
INR C
JMP NEXT
ODD: INR D
NEXT: INX H
DCR B
JNZ AGAIN
MOV A, C
STA 3000H
MOV A, D
STA 3002H
HLT`;
const patterns = `LXI H, 2400H
MVI B, 04H
UPBLOCK: MVI D, 00H
MVI C, 10H
UP: MOV M, D
MOV A, D
ADI 11H
MOV D, A
INX H
DCR C
JNZ UP
DCR B
JNZ UPBLOCK
MVI B, 04H
DOWNBLOCK: MVI D, 0FFH
MVI C, 10H
DOWN: MOV M, D
MOV A, D
SUI 11H
MOV D, A
INX H
DCR C
JNZ DOWN
DCR B
JNZ DOWNBLOCK
HLT`;
// Unpacked BCD, least-significant digit first. Three moving pointers are
// represented by HL (input 1), DE (input 2), and the word at 3100H (output).
const bcd = `LXI SP, 4000H
LXI H, 2440H
SHLD 3100H
LXI H, 2400H
LXI D, 2420H
MVI B, 14H
MVI C, 00H
NEXT: LDAX D
ADD M
ADD C
MVI C, 00H
CPI 0AH
JC STORE
SUI 0AH
MVI C, 01H
STORE: PUSH H
LHLD 3100H
MOV M, A
INX H
SHLD 3100H
POP H
INX H
INX D
DCR B
JNZ NEXT
MOV A, C
STA 2454H
HLT`;
const sort = `MVI B, 0FH
PASS: LXI H, 2400H
MOV C, B
PAIR: MOV A, M
INX H
CMP M
JNC NOSWAP
MOV D, M
MOV M, A
DCX H
MOV M, D
INX H
NOSWAP: DCR C
JNZ PAIR
DCR B
JNZ PASS
HLT`;
const ascii = `LXI SP, 4000H
LDA 2400H
MOV B, A
RRC
RRC
RRC
RRC
ANI 0FH
CALL HEXASCII
STA 3000H
MOV A, B
ANI 0FH
CALL HEXASCII
STA 3001H
HLT
HEXASCII: CPI 0AH
JC DIGIT
ADI 07H
DIGIT: ADI 30H
RET`;
const data = [0x34, 0x02, 0xff, 0x19, 0x80, 0x07, 0x42, 0x01, 0xab, 0x20, 0x10, 0x99, 0x03, 0x00, 0x55, 0x0e];

export const labs: Lab[] = [
  {
    id: 'lab-01', number: 1, title: 'Meet the VMC 8085 trainer', description: 'Get comfortable with the trainer, memory entry, and a safe execution workflow.', concepts: ['Trainer basics', 'Memory', 'Single-step'],
    guide: `## Your experiment
“Introduction to VMC 8085 op.” Your sheet does not give an exact trainer model, so key labels and monitor commands must come from the manual/instructor.

## What to identify
Find reset, address entry, data entry, examine memory, run/go, and single-step functions. Identify available user RAM and the monitor's reserved area. Never assume 2400H is safe on every trainer just because it appears in a sample.

## Your first workflow
1. Confirm the RAM map with your instructor.
2. Reset the trainer and select the program start address.
3. Enter the machine-code bytes supplied by the assembler/manual.
4. Examine them to verify the entry.
5. Set input data and any required stack address.
6. Single-step, inspect registers, then run.
7. Examine the result memory and record observations.

## Try the concept here
Open the playground, select 8085, and run MVI A, 05H / ADI 03H / HLT. Predict A = 08H. Step through each instruction and watch the register change.

The browser editor reads assembly; a keypad trainer may require opcodes. The emulator's PC is a logical instruction index, not the byte address of assembled code. This checklist is orientation, not a claim about your trainer's key sequence.`,
  },
  {
    id: 'lab-02', number: 2, title: 'Swap the two halves of a block', description: 'Rearrange 16 bytes at 2400H so the lower eight and higher eight exchange places.', concepts: ['Two pointers', 'Temporary storage', 'Loop'],
    guide: `## Memory contract
Input/output: 16 bytes at **2400H–240FH**. Swap 2400H–2407H with 2408H–240FH, keeping each half's internal order.

## Algorithm
HL points to the lower half; DE to the upper half. For eight iterations, save the lower byte in C, read the higher byte into A, store it in the lower location, then write the saved lower byte to the higher location. Advance both pointers.

## Why the temporary register matters
Without C, writing the first byte would destroy data you still need. Memory rearrangement often needs a temporary value.

## Trace
If the original block is 00H, 01H, …, 0FH, the result is 08H, …, 0FH, 00H, …, 07H. B starts at 08H, not 10H: each iteration swaps a pair.`,
    challenge: { title: 'Swap the halves', prompt: 'Swap both eight-byte halves in place. Test data is 00H through 0FH.', starter: '; HL = lower half, DE = upper half, B = pair count\n', solution: swap, memory: [{ address: 0x2400, values: Array.from({ length: 16 }, (_, i) => i) }], expectedMemory: [{ address: 0x2400, values: [...Array.from({ length: 8 }, (_, i) => i + 8), ...Array.from({ length: 8 }, (_, i) => i)] }], hints: ['Initialize HL to 2400H, DE to 2408H, and B to 08H.', 'Save memory[HL] in C before replacing it.', 'LDAX D / STAX D accesses the upper pointer.'] },
  },
  {
    id: 'lab-03', number: 3, title: 'Count even & odd bytes', description: 'Count a 16-byte block. Store even count at 3000H and odd count at 3002H.', concepts: ['AND mask', 'Conditional branch', 'Counters'],
    guide: `## Memory contract
Input: 16 bytes at **2400H–240FH** (chosen start address; the sheet specifies the length but not the source address). Even count: **3000H**. Odd count: **3002H**. These are byte counters; 3001H is left unused.

## Algorithm
Use HL as pointer, B as remaining count, C for even, D for odd. Load a byte into A and mask bit 0 with ANI 01H. If Z = 1, increment the even counter; otherwise increment odd. Advance and repeat.

## An important distinction
“Even number” means low bit zero. **Even parity** means an even number of 1 bits. They are not the same: 03H is odd numerically but has even bit parity.

## Verify
The two counts must sum to 16. The provided test block has eight even and eight odd values. Zero counts as even.`,
    challenge: { title: 'Count the block', prompt: 'Count the seeded 16 bytes and write 08H at both 3000H and 3002H.', starter: '; Plan HL, B, C, D before writing the loop\n', solution: even, memory: [{ address: 0x2400, values: data }], expectedMemory: [{ address: 0x3000, values: [8] }, { address: 0x3002, values: [8] }], hints: ['ANI 01H isolates the least significant bit.', 'JNZ selects the odd path after the mask.', 'Store both counters only after the loop.'] },
  },
  {
    id: 'lab-04', number: 4, title: 'Generate 128 bit-pattern bytes', description: 'Write 00H→FFH four times, followed by FFH→00H four times in steps of 11H.', concepts: ['Nested loops', 'Pattern generation', 'Pointer'],
    guide: `## Interpret the length
One sequence has 16 values: 00H, 11H, …, FFH. Four ascending sequences use 64 locations. Four descending sequences use another 64. Total: **128 bytes, 2400H–247FH**.

## Algorithm
Keep HL advancing across the entire block. B counts four repetitions; C counts sixteen entries per repetition; D holds the current pattern. Add 11H for the ascending part and subtract 11H for the descending part. Reset D at the beginning of each sequence.

## Loop boundaries
After writing FFH on ascent, adding 11H wraps—but the inner counter has finished, so that wrapped value is never written. On descent, the analogous underflow after 00H is also never written.

## Verification points
2400H = 00H, 240FH = FFH, 243FH = FFH, 2440H = FFH, 247FH = 00H. HL ends at 2480H.`,
    challenge: { title: 'Build the pattern', prompt: 'Fill the full 128-byte ascending-then-descending pattern.', starter: '; Use an outer repetition count and an inner 16-byte count\n', solution: patterns, expectedMemory: [{ address: 0x2400, values: [...Array.from({ length: 64 }, (_, i) => (i % 16) * 17), ...Array.from({ length: 64 }, (_, i) => (15 - i % 16) * 17)] }], hints: ['Start HL at 2400H and leave it advancing throughout.', 'B = 04H for repetitions; C = 10H for each sequence.', 'Use ADI 11H upward, SUI 11H downward.'] },
  },
  {
    id: 'lab-05', number: 5, title: 'Add two 20-digit BCD numbers', description: 'Inputs at 2400H and 2420H, with a 21-digit result beginning at 2440H.', concepts: ['BCD representation', 'Decimal carry', 'Three pointers', 'Stack'],
    guide: `## Resolve the representation first
The sheet says “20 digit BCD” but does not specify packed versus unpacked, or digit order. **This worked version uses unpacked BCD: one digit (00H–09H) per byte, least-significant digit first.** Confirm that with your instructor before entering it on the trainer. Packed BCD would require a different algorithm and ten-byte inputs.

## Memory contract
Input 1: 2400H–2413H. Input 2: 2420H–2433H. Result: 2440H–2454H (21 digits). 3100H–3101H stores a temporary output pointer. SP starts at 4000H for PUSH/POP.

## Algorithm
For each digit, add input1 + input2 + decimal carry. The maximum is 19. If it is at least ten, subtract ten and set carry to one; otherwise clear carry. Store the result digit and advance all pointers. Store the final carry as digit 21.

## Register plan
HL and DE point to the two inputs; B counts 20 digits (**14H**, not 20H); C stores decimal carry. PUSH H saves the input pointer while LHLD temporarily loads the output pointer. POP H restores it.

## Test case
Twenty 9 digits plus one produces twenty zero digits and a final one. This tests carry propagation through the entire number.`,
    challenge: { title: 'Twenty-digit carry chain', prompt: 'Add 99999999999999999999 + 1 using the unpacked, least-significant-digit-first layout.', starter: '; B = 14H digits. C = decimal carry. Output has 21 bytes.\n', solution: bcd, memory: [{ address: 0x2400, values: Array(20).fill(9) }, { address: 0x2420, values: [1, ...Array(19).fill(0)] }], expectedMemory: [{ address: 0x2440, values: [...Array(20).fill(0), 1] }], hints: ['Use explicit decimal correction: compare with 0AH and subtract 0AH if needed.', 'Keep decimal carry in C, not in CY across unrelated instructions.', 'Save HL on the stack while using the output pointer at 3100H.'] },
  },
  {
    id: 'lab-06', number: 6, title: 'Sort in descending order', description: 'Compare adjacent bytes and rearrange a block from largest to smallest.', concepts: ['Bubble sort', 'Unsigned compare', 'Nested loops'],
    guide: `## Explicit assumptions
The lab title gives no address or length. This version sorts **16 unsigned bytes at 2400H–240FH in place**. Adjust the contract if your instructor supplies a different one.

## Algorithm
Use bubble-sort passes. Compare the left byte in A with the right byte at M. If A < M (CY = 1), swap them so the larger comes first. After each pass, the smallest remaining element reaches its final position at the right end.

## Register plan
B counts the shrinking pass length (15 down to 1). C counts adjacent comparisons in the current pass. HL points at the pair. D temporarily holds the right byte during a swap.

## Beware equality
JNC skips the swap when A is greater than or equal to the right byte. Repeated values are fine. Sorting unsigned values must use carry, not the sign bit.

## Verify
Every output byte is at least the next byte, and the multiset of values is unchanged. Test repeated, already ordered, and reverse ordered data.`,
    challenge: { title: 'Order the block', prompt: 'Sort the seeded 16 unsigned bytes in descending order at 2400H.', starter: '; 15 bubble-sort passes; compare adjacent unsigned bytes\n', solution: sort, memory: [{ address: 0x2400, values: data }], expectedMemory: [{ address: 0x2400, values: [...data].sort((a, b) => b - a) }], hints: ['Load the left byte into A, then INX H to reach the right byte.', 'CMP M sets CY if the left value is smaller.', 'If swapping, move back to write the left position, then return to the right.'] },
  },
  {
    id: 'lab-07', number: 7, title: 'Convert both nibbles to ASCII', description: 'Turn a byte into two readable hexadecimal characters.', concepts: ['Rotations', 'Masking', 'ASCII', 'Subroutine'],
    guide: `## Explicit memory contract
The sheet specifies no addresses. Here the input byte is at **2400H**. Store the high-nibble ASCII at **3000H** and the low-nibble ASCII at **3001H**. ABH should become 41H ('A') and 42H ('B').

## Algorithm
Save the original byte in B. Rotate A four times, mask with 0FH, and convert the high nibble. Restore the original into A, mask with 0FH, and convert the low nibble.

## Shared converter
Compare the nibble with 0AH. Below ten, add 30H. For ten through fifteen, add 37H (implemented as +07H then +30H). CALL the same routine twice, with SP initialized.

## Boundary tests
00H → '00', 09H → '09', 0AH → '0A', FFH → 'FF'. These cover the transition between digit and letter codes.`,
    challenge: { title: 'Make AB readable', prompt: 'Convert ABH at 2400H into ASCII A and B at 3000H and 3001H.', starter: '; Save the original byte and convert each masked nibble\n', solution: ascii, memory: [{ address: 0x2400, values: [0xab] }], expectedMemory: [{ address: 0x3000, values: [0x41, 0x42] }], hints: ['Four RRC instructions place the original high nibble in the low position.', 'ANI 0FH extracts one nibble.', 'Use +30H for 0–9 and +37H for A–F.'] },
  },
];
