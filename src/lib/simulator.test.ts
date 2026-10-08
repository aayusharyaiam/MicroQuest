import { describe, expect, it } from 'vitest';
import { lessons } from '../data/curriculum';
import { labs } from '../data/labs';
import { Machine, validateChallenge } from './simulator';
import type { Processor } from '../types';

function run(processor: Processor, source: string) { const machine = new Machine(processor, source); machine.run(); expect(machine.error).toBe(''); expect(machine.halted).toBe(true); return machine; }
describe('Every supplied programming solution', () => {
  for (const lesson of lessons) if (lesson.challenge) it(`${lesson.processor}: ${lesson.challenge.title}`, () => { const machine = new Machine(lesson.processor, lesson.challenge!.solution, lesson.challenge!.memory); machine.run(); expect(validateChallenge(machine, lesson.challenge!).message).not.toMatch(/expected .*found/); expect(validateChallenge(machine, lesson.challenge!).passed, machine.error).toBe(true); });
  for (const lab of labs) if (lab.challenge) it(`Lab ${lab.number}: ${lab.title}`, () => { const machine = new Machine('8085', lab.challenge!.solution, lab.challenge!.memory); machine.run(); expect(validateChallenge(machine, lab.challenge!).passed, validateChallenge(machine, lab.challenge!).message).toBe(true); });
});
describe('8085 behavior', () => {
  it('propagates carry through unchanged MVI and INR flags', () => { const m = run('8085', 'MVI A, 0FFH\nADI 1\nMVI B, 0\nINR B\nMVI A, 0\nACI 0\nHLT'); expect(m.get('A')).toBe(1); expect(m.get('B')).toBe(1); });
  it('compares unsigned values without changing A', () => { const m = run('8085', 'MVI A, 80H\nCPI 0FFH\nHLT'); expect(m.get('A')).toBe(128); expect(m.flags.CY).toBe(true); });
  it('models the 8085 complemented auxiliary half-borrow on decrement', () => { const m = run('8085', 'MVI B, 10H\nDCR B\nHLT'); expect(m.get('B')).toBe(15); expect(m.flags.AC).toBe(false); const n = run('8085', 'MVI B, 11H\nDCR B\nHLT'); expect(n.flags.AC).toBe(true); });
  it('returns from nested calls with balanced stack data', () => { const m = run('8085', 'LXI SP, 4000H\nMVI A, 3\nCALL ONE\nHLT\nONE: PUSH B\nCALL TWO\nPOP B\nRET\nTWO: ADD A\nRET'); expect(m.get('A')).toBe(6); expect(m.get('SP')).toBe(0x4000); });
  it('corrects a packed BCD carry', () => { const m = run('8085', 'MVI A, 99H\nADI 1\nDAA\nHLT'); expect(m.get('A')).toBe(0); expect(m.flags.CY).toBe(true); });
  it('preserves data-transfer flags', () => { const m = run('8085', 'MVI A, 0\nCPI 0\nMVI B, 1\nLXI H, 2400H\nINX H\nMOV A, B\nHLT'); expect(m.flags.Z).toBe(true); });
  it('writes output ports', () => { expect(run('8085', 'MVI A, 55H\nOUT 2\nHLT').outputs['02']).toBe(0x55); });
});
describe('8086 behavior', () => {
  it('preserves AH when writing AL', () => { expect(run('8086', 'MOV AX, 1234H\nMOV AL, 56H\nHLT').get('AX')).toBe(0x1256); });
  it('distinguishes signed overflow from unsigned carry', () => { const m = run('8086', 'MOV AX, 7FFFH\nADD AX, 1\nHLT'); expect(m.flags.OF).toBe(true); expect(m.flags.CY).toBe(false); const n = run('8086', 'MOV AX, 0FFFFH\nADD AX, 1\nHLT'); expect(n.flags.CY).toBe(true); expect(n.flags.OF).toBe(false); });
  it('uses the correct signed and unsigned jump conditions', () => { const m = run('8086', 'MOV AL, 0FFH\nCMP AL, 1\nJL SIGNED\nMOV BX, 99\nSIGNED: JA UNSIGNED\nMOV BX, 98\nUNSIGNED: MOV BX, 7\nHLT'); expect(m.get('BX')).toBe(7); });
  it('uses SS for BP addresses and supports explicit overrides', () => { const m = run('8086', 'MOV AX, 1000H\nMOV SS, AX\nMOV BP, 20H\nMOV BYTE PTR [BP], 5\nMOV BYTE PTR DS:[BP], 9\nHLT'); expect(m.memory[0x10020]).toBe(5); expect(m.memory[0x20]).toBe(9); });
  it('places little-endian words at a segmented address', () => { const m = run('8086', 'MOV AX, 1000H\nMOV DS, AX\nMOV WORD PTR [20H], 1234H\nHLT'); expect([...m.memory.slice(0x10020, 0x10022)]).toEqual([0x34, 0x12]); });
  it('does not execute REP when CX is zero', () => { const m = run('8086', 'MOV SI, 2400H\nMOV DI, 3000H\nMOV CX, 0\nREP MOVSB\nHLT'); expect(m.get('SI')).toBe(0x2400); expect(m.get('DI')).toBe(0x3000); });
  it('copies backward with DF', () => { const m = new Machine('8086', 'STD\nMOV SI, 2403H\nMOV DI, 3003H\nMOV CX, 4\nREP MOVSB\nHLT', [{ address: 0x2400, values: [1, 2, 3, 4] }]); m.run(); expect([...m.memory.slice(0x3000, 0x3004)]).toEqual([1, 2, 3, 4]); expect(m.get('SI')).toBe(0x23ff); });
  it('preserves carry through INC', () => { expect(run('8086', 'STC\nMOV AX, 1\nINC AX\nHLT').flags.CY).toBe(true); });
  it('produces signed multiplication and sign extension', () => { const m = run('8086', 'MOV AX, -2\nMOV BX, 3\nIMUL BX\nHLT'); expect(m.get('AX')).toBe(65530); expect(m.get('DX')).toBe(65535); expect(m.flags.OF).toBe(false); });
  it.each(['MOV AX, AL', 'MOV AL, [AX]', 'MOV [BX+BP], AX', 'MOV [2400H], 1', 'MOV DS, 1000H', 'MOV CS, AX', 'SHR AL, 4', 'PUSH 1234H'])('rejects invalid original 8086 form: %s', source => { const m = new Machine('8086', `${source}\nHLT`); m.run(); expect(m.error).not.toBe(''); });
});
describe('Boundary data and failure feedback', () => {
  it('sorts duplicates and unsigned boundaries', () => { const lab = labs.find(l => l.number === 6)!; const values = [0, 255, 128, 1, 1, 200, 42, 42, 0, 255, 2, 3, 4, 5, 6, 7]; const m = new Machine('8085', lab.challenge!.solution, [{ address: 0x2400, values }]); m.run(); expect([...m.memory.slice(0x2400, 0x2410)]).toEqual([...values].sort((a, b) => b - a)); });
  it.each([0x00, 0x09, 0x0a, 0xff])('converts both nibbles of %s', value => { const lab = labs.find(l => l.number === 7)!; const m = new Machine('8085', lab.challenge!.solution, [{ address: 0x2400, values: [value] }]); m.run(); const expected = value.toString(16).toUpperCase().padStart(2, '0').split('').map(c => c.charCodeAt(0)); expect([...m.memory.slice(0x3000, 0x3002)]).toEqual(expected); });
  it('prevents an endless program from freezing the browser', () => { const m = new Machine('8085', 'AGAIN: JMP AGAIN'); m.run(50); expect(m.steps).toBe(50); expect(m.error).toContain('endless loop'); });
  it('reports source line for unsupported hardware', () => { const m = new Machine('8086', '; comment\nINT 21H\nHLT'); m.run(); expect(m.error).toContain('Line 2'); expect(m.error).toContain('not runnable'); });
  it('refuses completion when HLT has not executed', () => { const c = lessons.find(l => l.challenge)!.challenge!; const m = new Machine('8085', c.solution, c.memory); expect(validateChallenge(m, c).passed).toBe(false); });
});
