import type { Challenge, Processor } from '../types';

export interface Operation { op: string; args: string[]; line: number; source: string }
export type Flags = { Z: boolean; S: boolean; P: boolean; CY: boolean; AC: boolean; OF: boolean; DF: boolean };
const parity = (n: number) => [...(n & 255).toString(2)].filter(b => b === '1').length % 2 === 0;
export const hex = (n: number, width = 2) => (n >>> 0).toString(16).toUpperCase().padStart(width, '0');
export function numberValue(text: string): number {
  const t = text.trim().toUpperCase();
  if (/^[0-9A-F]+H$/.test(t)) return parseInt(t.slice(0, -1), 16);
  if (/^[01]+B$/.test(t)) return parseInt(t.slice(0, -1), 2);
  if (/^0X[0-9A-F]+$/.test(t)) return parseInt(t.slice(2), 16);
  if (/^-?\d+$/.test(t)) return Number(t);
  throw new Error(`“${text}” is not a number. Use decimal or a suffix H for hexadecimal.`);
}

function parse(source: string) {
  if (source.length > 64000) throw new Error('Keep teaching programs below 64,000 characters.');
  const ops: Operation[] = []; const labels: Record<string, number> = {};
  source.split('\n').forEach((raw, index) => {
    let text = raw.split(';')[0].trim().toUpperCase();
    if (!text) return;
    const label = text.match(/^([A-Z_][A-Z0-9_]*):/);
    if (label) {
      if (Object.hasOwn(labels, label[1])) throw new Error(`Line ${index + 1}: duplicate label ${label[1]}.`);
      labels[label[1]] = ops.length; text = text.slice(label[0].length).trim();
    }
    if (!text) return;
    const match = text.match(/^(\S+)(?:\s+(.*))?$/)!;
    ops.push({ op: match[1], args: (match[2] ?? '').split(',').map(a => a.trim()).filter(Boolean), line: index + 1, source: raw.trim() });
  });
  if (!ops.length) throw new Error('Write at least one instruction before loading.');
  return { ops, labels };
}

export class Machine {
  processor: Processor;
  memory: Uint8Array;
  registers: Record<string, number>;
  flags: Flags = { Z: false, S: false, P: false, CY: false, AC: false, OF: false, DF: false };
  operations: Operation[]; labels: Record<string, number>;
  pc = 0; steps = 0; halted = false; error = ''; outputs: Record<string, number> = {};
  constructor(processor: Processor, source: string, seeds: Challenge['memory'] = []) {
    this.processor = processor;
    this.memory = new Uint8Array(processor === '8085' ? 65536 : 1048576);
    this.registers = processor === '8085' ? { A: 0, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0, SP: 0x4000 } : { AX: 0, BX: 0, CX: 0, DX: 0, SI: 0, DI: 0, BP: 0, SP: 0x4000, CS: 0, DS: 0, SS: 0, ES: 0 };
    const { ops, labels } = parse(source); this.operations = ops; this.labels = labels;
    seeds?.forEach(seed => seed.values.forEach((v, i) => this.memory[(seed.address + i) % this.memory.length] = v & 255));
  }
  get(name: string): number {
    if (Object.hasOwn(this.registers, name)) return this.registers[name];
    if (this.processor === '8086' && /^[ABCD][HL]$/.test(name)) return name[1] === 'H' ? this.registers[name[0] + 'X'] >> 8 : this.registers[name[0] + 'X'] & 255;
    if (this.processor === '8085' && ['BC', 'DE', 'HL'].includes(name)) return this.registers[name[0]] * 256 + this.registers[name[1]];
    throw new Error(`Unknown register ${name}.`);
  }
  set(name: string, value: number) {
    if (Object.hasOwn(this.registers, name)) { this.registers[name] = value & (this.processor === '8085' && name !== 'SP' ? 255 : 65535); return; }
    if (this.processor === '8086' && /^[ABCD][HL]$/.test(name)) {
      const parent = name[0] + 'X'; this.registers[parent] = name[1] === 'H' ? (this.registers[parent] & 255) | ((value & 255) << 8) : (this.registers[parent] & 0xff00) | (value & 255); return;
    }
    if (this.processor === '8085' && ['BC', 'DE', 'HL'].includes(name)) { this.set(name[0], value >> 8); this.set(name[1], value); return; }
    throw new Error(`Unknown register ${name}.`);
  }
  private pair(name: string) { if (!['B', 'D', 'H', 'SP'].includes(name)) throw new Error('Register pair must be B, D, H, or SP.'); return ({ B: 'BC', D: 'DE', H: 'HL', SP: 'SP' } as Record<string, string>)[name]; }
  private status(value: number, bits: number) { const result = value & (bits === 8 ? 255 : 65535); this.flags.Z = result === 0; this.flags.S = !!(result & (1 << (bits - 1))); this.flags.P = parity(result); }
  private arithmetic(a: number, b: number, bits: number, subtract = false, carry = 0) {
    const mask = bits === 8 ? 255 : 65535; const sign = 1 << (bits - 1);
    const raw = subtract ? a - b - carry : a + b + carry; const result = raw & mask;
    this.status(result, bits); this.flags.CY = subtract ? raw < 0 : raw > mask;
    this.flags.AC = subtract ? (a & 15) < (b & 15) + carry : (a & 15) + (b & 15) + carry > 15;
    // 8085 AC on subtraction is the complemented half-borrow, unlike 8086 AF.
    if (subtract && this.processor === '8085') this.flags.AC = !this.flags.AC;
    this.flags.OF = subtract ? !!((a ^ b) & (a ^ result) & sign) : !!(~(a ^ b) & (a ^ result) & sign);
    return result;
  }
  private flagByte() { return (this.flags.S ? 128 : 0) | (this.flags.Z ? 64 : 0) | (this.flags.AC ? 16 : 0) | (this.flags.P ? 4 : 0) | 2 | (this.flags.CY ? 1 : 0); }
  private restoreByte(v: number) { this.flags.S = !!(v & 128); this.flags.Z = !!(v & 64); this.flags.AC = !!(v & 16); this.flags.P = !!(v & 4); this.flags.CY = !!(v & 1); }
  private stackAddress() { return this.processor === '8085' ? this.get('SP') : ((this.get('SS') << 4) + this.get('SP')) & 0xfffff; }
  private push(value: number) { this.set('SP', this.get('SP') - 2); const address = this.stackAddress(); this.writeMemory(address, value, 16); }
  private pop() { const value = this.readMemory(this.stackAddress(), 16); this.set('SP', this.get('SP') + 2); return value; }
  private readMemory(address: number, bits: number) { const a = address % this.memory.length; return this.memory[a] | (bits === 16 ? this.memory[(a + 1) % this.memory.length] << 8 : 0); }
  private writeMemory(address: number, value: number, bits: number) { const a = address % this.memory.length; this.memory[a] = value & 255; if (bits === 16) this.memory[(a + 1) % this.memory.length] = (value >> 8) & 255; }
  private target(label: string) { if (!Object.hasOwn(this.labels, label)) throw new Error(`Label ${label} was not found. Add “${label}:” at your destination.`); this.pc = this.labels[label]; }
  private condition(condition: string): boolean {
    const f = this.flags;
    const conditions: Record<string, boolean> = { Z: f.Z, NZ: !f.Z, C: f.CY, NC: !f.CY, M: f.S, P: !f.S, PE: f.P, PO: !f.P,
      E: f.Z, NE: !f.Z, B: f.CY, NAE: f.CY, AE: !f.CY, NB: !f.CY, A: !f.CY && !f.Z, NBE: !f.CY && !f.Z, BE: f.CY || f.Z, NA: f.CY || f.Z,
      L: f.S !== f.OF, NGE: f.S !== f.OF, GE: f.S === f.OF, NL: f.S === f.OF, G: !f.Z && f.S === f.OF, NLE: !f.Z && f.S === f.OF,
      LE: f.Z || f.S !== f.OF, NG: f.Z || f.S !== f.OF, O: f.OF, NO: !f.OF, S: f.S, NS: !f.S, NP: !f.P };
    if (this.processor === '8086') conditions.P = f.P;
    if (!Object.hasOwn(conditions, condition)) throw new Error(`Unknown condition ${condition}.`);
    return conditions[condition];
  }
  step() {
    if (this.halted || this.error) return;
    const ins = this.operations[this.pc];
    if (!ins) { this.error = 'Execution reached the end without HLT. Add HLT or check your branch/return.'; return; }
    this.pc++; this.steps++;
    try { if (this.processor === '8085') this.execute85(ins); else this.execute86(ins); }
    catch (error) { this.error = `Line ${ins.line}: ${(error as Error).message}`; }
  }
  run(budget = 20000) { let executed = 0; while (!this.halted && !this.error && executed < budget) { this.step(); executed++; } if (!this.halted && !this.error) this.error = `Paused after ${budget.toLocaleString()} instructions. Check for an endless loop or use a smaller test block.`; }

  private execute85({ op, args }: Operation) {
    const [x, y] = args;
    const count = (n: number) => { if (args.length !== n) throw new Error(`${op} needs ${n} operand${n === 1 ? '' : 's'}.`); };
    const read = (r: string) => { if (!['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M'].includes(r)) throw new Error('Use an 8-bit register or M.'); return r === 'M' ? this.memory[this.get('HL')] : this.get(r); };
    const write = (r: string, value: number) => { read(r); if (r === 'M') this.memory[this.get('HL')] = value & 255; else this.set(r, value); };
    const immediate = (text: string, max: number) => { const value = numberValue(text); if (value < 0 || value > max) throw new Error(`Value must be between 0 and ${max}.`); return value; };
    if (op === 'NOP' || op === 'HLT') { count(0); if (op === 'HLT') this.halted = true; return; }
    if (op === 'MOV') { count(2); if (x === 'M' && y === 'M') throw new Error('MOV M, M is invalid.'); write(x, read(y)); return; }
    if (op === 'MVI') { count(2); write(x, immediate(y, 255)); return; }
    if (op === 'LXI') { count(2); this.set(this.pair(x), immediate(y, 65535)); return; }
    if (['LDA', 'STA', 'LHLD', 'SHLD'].includes(op)) { count(1); const address = immediate(x, 65535); if (op === 'LDA') this.set('A', this.readMemory(address, 8)); if (op === 'STA') this.writeMemory(address, this.get('A'), 8); if (op === 'LHLD') this.set('HL', this.readMemory(address, 16)); if (op === 'SHLD') this.writeMemory(address, this.get('HL'), 16); return; }
    if (op === 'LDAX' || op === 'STAX') { count(1); if (!['B', 'D'].includes(x)) throw new Error(`${op} requires B or D.`); const address = this.get(this.pair(x)); if (op === 'LDAX') this.set('A', this.memory[address]); else this.memory[address] = this.get('A'); return; }
    if (op === 'XCHG') { count(0); const old = this.get('HL'); this.set('HL', this.get('DE')); this.set('DE', old); return; }
    if (op === 'INX' || op === 'DCX') { count(1); const pair = this.pair(x); this.set(pair, this.get(pair) + (op === 'INX' ? 1 : -1)); return; }
    if (op === 'DAD') { count(1); const raw = this.get('HL') + this.get(this.pair(x)); this.flags.CY = raw > 65535; this.set('HL', raw); return; }
    if (op === 'INR' || op === 'DCR') { count(1); const carry = this.flags.CY; write(x, this.arithmetic(read(x), 1, 8, op === 'DCR')); this.flags.CY = carry; return; }
    if (['ADD', 'ADC', 'ADI', 'ACI', 'SUB', 'SBB', 'SUI', 'SBI', 'CMP', 'CPI'].includes(op)) {
      count(1); const b = ['ADI', 'ACI', 'SUI', 'SBI', 'CPI'].includes(op) ? immediate(x, 255) : read(x);
      const result = this.arithmetic(this.get('A'), b, 8, ['SUB', 'SBB', 'SUI', 'SBI', 'CMP', 'CPI'].includes(op), ['ADC', 'ACI', 'SBB', 'SBI'].includes(op) && this.flags.CY ? 1 : 0);
      if (!['CMP', 'CPI'].includes(op)) this.set('A', result); return;
    }
    if (['ANA', 'ANI', 'ORA', 'ORI', 'XRA', 'XRI'].includes(op)) { count(1); const value = op.endsWith('I') ? immediate(x, 255) : read(x); const a = this.get('A'); const result = op.startsWith('AN') ? a & value : op.startsWith('OR') ? a | value : a ^ value; this.set('A', result); this.status(result, 8); this.flags.CY = false; this.flags.AC = op.startsWith('AN'); return; }
    if (op === 'DAA') { count(0); const a = this.get('A'); const oldCarry = this.flags.CY; const correction = ((a & 15) > 9 || this.flags.AC ? 6 : 0) + (a > 0x99 || oldCarry ? 0x60 : 0); this.set('A', this.arithmetic(a, correction, 8)); this.flags.CY ||= oldCarry; return; }
    if (['RLC', 'RRC', 'RAL', 'RAR'].includes(op)) { count(0); const a = this.get('A'); const old = this.flags.CY ? 1 : 0; const left = op === 'RLC' || op === 'RAL'; const out = left ? a >> 7 : a & 1; this.set('A', left ? (a << 1) | (op === 'RAL' ? old : out) : (a >> 1) | ((op === 'RAR' ? old : out) << 7)); this.flags.CY = !!out; return; }
    if (['CMA', 'CMC', 'STC'].includes(op)) { count(0); if (op === 'CMA') this.set('A', ~this.get('A')); else this.flags.CY = op === 'STC' || !this.flags.CY; return; }
    if (op === 'JMP' || /^J(Z|NZ|C|NC|M|P|PE|PO)$/.test(op)) { count(1); if (op === 'JMP' || this.condition(op.slice(1))) this.target(x); return; }
    if (op === 'CALL' || /^(CZ|CNZ|CC|CNC|CM|CP|CPE|CPO)$/.test(op)) { count(1); if (op === 'CALL' || this.condition(op.slice(1))) { this.push(this.pc); this.target(x); } return; }
    if (op === 'RET' || /^R(Z|NZ|C|NC|M|P|PE|PO)$/.test(op)) { count(0); if (op === 'RET' || this.condition(op.slice(1))) this.pc = this.pop(); return; }
    if (op === 'PUSH' || op === 'POP') { count(1); if (!['B', 'D', 'H', 'PSW'].includes(x)) throw new Error('Use B, D, H, or PSW.'); if (op === 'PUSH') this.push(x === 'PSW' ? (this.get('A') << 8) | this.flagByte() : this.get(this.pair(x))); else { const value = this.pop(); if (x === 'PSW') { this.set('A', value >> 8); this.restoreByte(value); } else this.set(this.pair(x), value); } return; }
    if (op === 'SPHL') { count(0); this.set('SP', this.get('HL')); return; }
    if (op === 'PCHL') { count(0); this.pc = this.get('HL'); return; }
    if (op === 'XTHL') { count(0); const old = this.get('HL'); this.set('HL', this.readMemory(this.get('SP'), 16)); this.writeMemory(this.get('SP'), old, 16); return; }
    if (op === 'IN' || op === 'OUT') { count(1); const port = immediate(x, 255); if (op === 'IN') this.set('A', 0); else this.outputs[hex(port)] = this.get('A'); return; }
    throw new Error(`${op} is not runnable in this teaching workspace. See its instruction-reference entry for syntax and hardware limits.`);
  }

  private operand(text: string): { bits: number; kind: 'register' | 'memory' | 'immediate'; value: number; name?: string; address?: number; offset?: number } {
    let clean = text.trim(); const size = clean.match(/^(BYTE|WORD)\s+(?:PTR\s+)?/); if (size) clean = clean.slice(size[0].length);
    const segment = clean.match(/^(CS|DS|SS|ES):/); if (segment) clean = clean.slice(segment[0].length);
    if (clean.startsWith('[') && clean.endsWith(']')) {
      const expression = clean.slice(1, -1).replaceAll(' ', ''); const terms = expression.match(/[+-]?[^+-]+/g) ?? [];
      let offset = 0; const used: string[] = [];
      for (const term of terms) {
        const negative = term.startsWith('-'); const token = term.replace(/^[+-]/, '');
        if (['BX', 'BP', 'SI', 'DI'].includes(token)) { if (negative) throw new Error('Address registers cannot be subtracted.'); used.push(token); offset += this.get(token); }
        else offset += numberValue(token) * (negative ? -1 : 1);
      }
      if (!terms.length) throw new Error('A memory operand needs an address.');
      if (used.length > 2 || new Set(used).size !== used.length || (used.length === 2 && !(used.some(v => ['BX', 'BP'].includes(v)) && used.some(v => ['SI', 'DI'].includes(v))))) throw new Error('Invalid original 8086 effective-address combination.');
      offset &= 65535; const seg = segment?.[1] ?? (used.includes('BP') ? 'SS' : 'DS'); const address = ((this.get(seg) << 4) + offset) & 0xfffff;
      const bits = size ? size[1] === 'BYTE' ? 8 : 16 : 0;
      return { bits, kind: 'memory', value: this.readMemory(address, bits || 16), address, offset };
    }
    if (size || segment) throw new Error('Size and segment prefixes require a memory operand.');
    if (Object.hasOwn(this.registers, clean) || /^[ABCD][HL]$/.test(clean)) return { bits: /^[ABCD][HL]$/.test(clean) ? 8 : 16, kind: 'register', value: this.get(clean), name: clean };
    return { bits: 0, kind: 'immediate', value: numberValue(clean) };
  }
  private execute86({ op, args }: Operation) {
    const [x, y] = args;
    const count = (n: number) => { if (args.length !== n) throw new Error(`${op} needs ${n} operand${n === 1 ? '' : 's'}.`); };
    type Operand = ReturnType<Machine['operand']>;
    const bitsFor = (a: Operand, b?: Operand) => { if (a.bits && b?.bits && a.bits !== b.bits) throw new Error('Operand sizes do not match.'); const bits = a.bits || b?.bits; if (!bits) throw new Error('Specify BYTE PTR or WORD PTR for a memory operand without a register size.'); return bits; };
    const read = (a: Operand, bits: number) => a.kind === 'memory' ? this.readMemory(a.address!, bits) : a.value & (bits === 8 ? 255 : 65535);
    const write = (a: Operand, value: number, bits: number) => { if (a.kind === 'immediate') throw new Error('The destination cannot be an immediate value.'); if (a.kind === 'memory') this.writeMemory(a.address!, value, bits); else this.set(a.name!, value); };
    const segments = ['CS', 'DS', 'ES', 'SS'];
    const noSegments = (...ops: Operand[]) => { if (ops.some(a => a.name && segments.includes(a.name))) throw new Error('This operation does not accept a segment register.'); };
    if (op === 'NOP' || op === 'HLT') { count(0); if (op === 'HLT') this.halted = true; return; }
    if (['MOV', 'XCHG', 'ADD', 'ADC', 'SUB', 'SBB', 'CMP', 'AND', 'OR', 'XOR', 'TEST'].includes(op)) {
      count(2); const a = this.operand(x), b = this.operand(y); const bits = bitsFor(a, b);
      if (a.kind === 'immediate') throw new Error('The left operand must be a register or memory.');
      if (a.kind === 'memory' && b.kind === 'memory') throw new Error('Memory-to-memory operands are not allowed.');
      if (b.kind === 'immediate' && (b.value < -(bits === 8 ? 128 : 32768) || b.value > (bits === 8 ? 255 : 65535))) throw new Error('Immediate value is outside the operand size.');
      if (op === 'MOV') { if (a.name === 'CS' || (a.name && segments.includes(a.name) && b.kind === 'immediate') || (a.name && b.name && segments.includes(a.name) && segments.includes(b.name))) throw new Error('Invalid segment-register MOV. Use a general 16-bit register as the intermediate.'); write(a, read(b, bits), bits); return; }
      noSegments(a, b);
      if (op === 'XCHG') { if (b.kind === 'immediate') throw new Error('XCHG cannot use an immediate operand.'); const old = read(a, bits); write(a, read(b, bits), bits); write(b, old, bits); return; }
      const av = read(a, bits), bv = read(b, bits); let result: number;
      if (['AND', 'OR', 'XOR', 'TEST'].includes(op)) { result = op === 'OR' ? av | bv : op === 'XOR' ? av ^ bv : av & bv; this.status(result, bits); this.flags.CY = false; this.flags.OF = false; this.flags.AC = false; }
      else result = this.arithmetic(av, bv, bits, ['SUB', 'SBB', 'CMP'].includes(op), ['ADC', 'SBB'].includes(op) && this.flags.CY ? 1 : 0);
      if (!['CMP', 'TEST'].includes(op)) write(a, result, bits); return;
    }
    if (['INC', 'DEC', 'NEG', 'NOT'].includes(op)) { count(1); const a = this.operand(x); noSegments(a); const bits = bitsFor(a); const oldCarry = this.flags.CY; const value = read(a, bits); const result = op === 'NOT' ? ~value : op === 'NEG' ? this.arithmetic(0, value, bits, true) : this.arithmetic(value, 1, bits, op === 'DEC'); write(a, result, bits); if (op === 'INC' || op === 'DEC') this.flags.CY = oldCarry; return; }
    if (op === 'LEA') { count(2); const a = this.operand(x), b = this.operand(y); noSegments(a); if (a.kind !== 'register' || a.bits !== 16 || b.kind !== 'memory') throw new Error('LEA requires a general word register and a memory-address expression.'); write(a, b.offset!, 16); return; }
    if (op === 'XLAT') { count(0); this.set('AL', this.memory[((this.get('DS') << 4) + ((this.get('BX') + this.get('AL')) & 65535)) & 0xfffff]); return; }
    if (op === 'CBW' || op === 'CWD') { count(0); if (op === 'CBW') this.set('AH', this.get('AL') & 128 ? 255 : 0); else this.set('DX', this.get('AX') & 0x8000 ? 65535 : 0); return; }
    if (op === 'MUL' || op === 'IMUL') {
      count(1); const a = this.operand(x); noSegments(a); if (a.kind === 'immediate') throw new Error('MUL/IMUL require a register or memory operand.'); const bits = bitsFor(a); const signed = (v: number) => v >= (1 << (bits - 1)) ? v - (bits === 8 ? 256 : 65536) : v;
      const left = this.get(bits === 8 ? 'AL' : 'AX'), right = read(a, bits); const result = op === 'IMUL' ? signed(left) * signed(right) : left * right;
      this.set('AX', result); if (bits === 16) this.set('DX', Math.floor(result / 65536));
      const overflow = op === 'IMUL' ? result < -(2 ** (bits - 1)) || result >= 2 ** (bits - 1) : result > (bits === 8 ? 255 : 65535);
      this.flags.CY = this.flags.OF = overflow; return;
    }
    if (['SHL', 'SAL', 'SHR', 'SAR', 'ROL', 'ROR', 'RCL', 'RCR'].includes(op)) {
      count(2); const a = this.operand(x); noSegments(a); const bits = bitsFor(a);
      if (y !== '1' && y !== 'CL') throw new Error('Original 8086 shift/rotate count must be 1 or CL.');
      const n = y === 'CL' ? this.get('CL') : 1; if (!n) return;
      let v = read(a, bits); const mask = bits === 8 ? 255 : 65535; const sign = 1 << (bits - 1); const left = ['SHL', 'SAL', 'ROL', 'RCL'].includes(op);
      const original = v;
      for (let i = 0; i < n; i++) { const previous = this.flags.CY ? 1 : 0; const out = left ? !!(v & sign) : !!(v & 1); if (left) v = ((v << 1) | (op === 'ROL' ? Number(out) : op === 'RCL' ? previous : 0)) & mask; else v = (v >>> 1) | (op === 'SAR' ? v & sign : op === 'ROR' ? Number(out) * sign : op === 'RCR' ? previous * sign : 0); this.flags.CY = out; }
      write(a, v, bits); if (['SHL', 'SAL', 'SHR', 'SAR'].includes(op)) this.status(v, bits);
      if (n === 1) this.flags.OF = left ? !!(v & sign) !== this.flags.CY : op === 'SAR' ? false : op === 'SHR' ? !!(original & sign) : !!(v & sign) !== !!(v & (sign >> 1)); return;
    }
    if (op === 'JMP' || /^J(E|Z|NE|NZ|B|C|NAE|AE|NB|NC|A|NBE|BE|NA|L|NGE|GE|NL|G|NLE|LE|NG|O|NO|S|NS|P|PE|NP|PO|CXZ)$/.test(op)) { count(1); if (op === 'JMP' || (op === 'JCXZ' ? this.get('CX') === 0 : this.condition(op.slice(1)))) this.target(x); return; }
    if (['LOOP', 'LOOPE', 'LOOPZ', 'LOOPNE', 'LOOPNZ'].includes(op)) { count(1); this.set('CX', this.get('CX') - 1); const yes = op === 'LOOP' || (['LOOPE', 'LOOPZ'].includes(op) ? this.flags.Z : !this.flags.Z); if (this.get('CX') && yes) this.target(x); return; }
    if (op === 'CALL') { count(1); this.push(this.pc); this.target(x); return; }
    if (op === 'RET') { count(0); this.pc = this.pop(); return; }
    if (op === 'PUSH' || op === 'POP') { count(1); const a = this.operand(x); if (a.kind === 'immediate' || a.bits === 8 || (op === 'POP' && a.name === 'CS')) throw new Error('Use a word register or WORD PTR memory; POP CS is not supported.'); if (op === 'PUSH') this.push(read(a, 16)); else write(a, this.pop(), 16); return; }
    if (op === 'PUSHF' || op === 'POPF') { count(0); if (op === 'PUSHF') this.push(this.flagByte() | (this.flags.OF ? 0x800 : 0) | (this.flags.DF ? 0x400 : 0)); else { const v = this.pop(); this.restoreByte(v); this.flags.OF = !!(v & 0x800); this.flags.DF = !!(v & 0x400); } return; }
    if (op === 'LAHF' || op === 'SAHF') { count(0); if (op === 'LAHF') this.set('AH', this.flagByte()); else this.restoreByte(this.get('AH')); return; }
    if (['CLC', 'STC', 'CMC', 'CLD', 'STD'].includes(op)) { count(0); if (op === 'CLD' || op === 'STD') this.flags.DF = op === 'STD'; else this.flags.CY = op === 'STC' || (op === 'CMC' && !this.flags.CY); return; }
    if (op === 'REP' || ['MOVSB', 'MOVSW', 'LODSB', 'LODSW', 'STOSB', 'STOSW'].includes(op)) {
      const stringOp = op === 'REP' ? x : op; count(op === 'REP' ? 1 : 0);
      if (!['MOVSB', 'MOVSW', 'LODSB', 'LODSW', 'STOSB', 'STOSW'].includes(stringOp)) throw new Error('REP supports MOVSB/W, LODSB/W, and STOSB/W here.');
      const repeat = op === 'REP'; if (repeat && !this.get('CX')) return;
      const bits = stringOp.endsWith('W') ? 16 : 8; const delta = (this.flags.DF ? -1 : 1) * (bits / 8);
      const source = ((this.get('DS') << 4) + this.get('SI')) & 0xfffff; const destination = ((this.get('ES') << 4) + this.get('DI')) & 0xfffff;
      if (stringOp.startsWith('MOVS')) this.writeMemory(destination, this.readMemory(source, bits), bits);
      if (stringOp.startsWith('LODS')) this.set(bits === 8 ? 'AL' : 'AX', this.readMemory(source, bits));
      if (stringOp.startsWith('STOS')) this.writeMemory(destination, this.get(bits === 8 ? 'AL' : 'AX'), bits);
      if (!stringOp.startsWith('STOS')) this.set('SI', this.get('SI') + delta);
      if (!stringOp.startsWith('LODS')) this.set('DI', this.get('DI') + delta);
      if (repeat) { this.set('CX', this.get('CX') - 1); if (this.get('CX')) this.pc--; } return;
    }
    if (op === 'IN' || op === 'OUT') { count(2); const register = op === 'IN' ? x : y; const portText = op === 'IN' ? y : x; if (!['AL', 'AX'].includes(register)) throw new Error('I/O data register must be AL or AX.'); const port = portText === 'DX' ? this.get('DX') : numberValue(portText); if (port < 0 || port > (portText === 'DX' ? 65535 : 255)) throw new Error('Immediate port must be 00H–FFH; use DX for larger ports.'); if (op === 'IN') this.set(register, 0); else this.outputs[hex(port, 4)] = this.get(register); return; }
    throw new Error(`${op} is not runnable in this teaching workspace. Check the reference for syntax and supported operations.`);
  }
}

export function validateChallenge(machine: Machine, challenge: Challenge) {
  if (machine.error) return { passed: false, message: machine.error };
  if (!machine.halted) return { passed: false, message: 'Run your program through HLT before checking the result.' };
  for (const block of challenge.expectedMemory ?? []) for (let i = 0; i < block.values.length; i++) {
    const address = block.address + i; const actual = machine.memory[address];
    if (actual !== block.values[i]) return { passed: false, message: `At ${hex(address, 4)}H: expected ${hex(block.values[i])}H, found ${hex(actual)}H. Trace the writes to this address.` };
  }
  for (const [register, expected] of Object.entries(challenge.expectedRegisters ?? {})) if (machine.get(register) !== expected) return { passed: false, message: `${register}: expected ${hex(expected, register.length === 2 && register.endsWith('X') ? 4 : 2)}H, found ${hex(machine.get(register), 4)}H.` };
  return { passed: true, message: 'All expected outputs match this test case. Try changing the inputs and trace your algorithm to check it more deeply.' };
}
