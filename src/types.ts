export type Processor = '8085' | '8086';
export type Family = 'Data transfer' | 'Arithmetic' | 'Logical & bit' | 'Branching' | 'Stack & procedures' | 'I/O & control' | 'Strings';
export interface Question { prompt: string; options: string[]; answer: number; explanation: string }
export interface Exercise { prompt: string; code: string; answers: string[]; explanation: string }
export interface MemorySeed { address: number; values: number[] }
export interface Challenge {
  title: string; prompt: string; starter: string; solution: string;
  memory?: MemorySeed[]; expectedMemory?: MemorySeed[];
  expectedRegisters?: Record<string, number>; hints: string[];
}
export interface Lesson {
  id: string; processor: Processor; module: string; title: string; subtitle: string;
  minutes: number; body: string; questions: Question[]; exercise: Exercise; challenge?: Challenge;
}
export interface Module { id: string; processor: Processor; title: string; description: string; tag: string }
export interface Instruction {
  processor: Processor; mnemonic: string; family: Family; syntax: string;
  description: string; flags: string; example: string; simulated: boolean;
}
export interface Lab {
  id: string; number: number; title: string; description: string; concepts: string[];
  guide: string; challenge?: Challenge;
}
export interface Score { score: number; total: number; at: number }
export interface Draft { text: string; at: number }
export interface Progress {
  version: 1; completedLessons: Record<string, number>; quizzes: Record<string, Score>;
  exercises: Record<string, number>; programs: Record<string, number>; labs: Record<string, number>;
  drafts: Record<string, Draft>; practiceDays: string[]; lastLesson: string; updatedAt: number;
}
