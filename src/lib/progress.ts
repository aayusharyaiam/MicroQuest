import type { Progress } from '../types';
import { lessons } from '../data/curriculum';
import { labs } from '../data/labs';
import type { Processor } from '../types';

export const emptyProgress = (): Progress => ({ version: 1, completedLessons: {}, quizzes: {}, exercises: {}, programs: {}, labs: {}, drafts: {}, practiceDays: [], lastLesson: '', updatedAt: 0 });
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const validKey = (key: string) => /^[a-zA-Z0-9_-]{1,80}$/.test(key);
const ordered = <T,>(value: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
const draftIds = new Set([...lessons.filter(l => l.challenge).map(l => l.id), ...labs.filter(l => l.challenge).map(l => l.id), 'playground-8085', 'playground-8086']);
function timestamps(value: unknown): Record<string, number> {
  if (!record(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, at] of Object.entries(value)) if (validKey(key) && typeof at === 'number' && Number.isFinite(at) && at > 0) result[key] = at;
  return ordered(result);
}
export function normalizeProgress(value: unknown): Progress {
  const clean = emptyProgress(); if (!record(value) || value.version !== 1) return clean;
  clean.completedLessons = timestamps(value.completedLessons); clean.exercises = timestamps(value.exercises); clean.programs = timestamps(value.programs); clean.labs = timestamps(value.labs);
  if (record(value.quizzes)) for (const [key, v] of Object.entries(value.quizzes)) {
    if (validKey(key) && record(v) && typeof v.score === 'number' && typeof v.total === 'number' && typeof v.at === 'number' && Number.isFinite(v.at) && Number.isInteger(v.score) && Number.isInteger(v.total) && v.total > 0 && v.total <= 100 && v.score >= 0 && v.score <= v.total) clean.quizzes[key] = { score: v.score, total: v.total, at: v.at };
  }
  if (record(value.drafts)) for (const [key, v] of Object.entries(value.drafts)) if (draftIds.has(key) && record(v) && typeof v.text === 'string' && v.text.length <= 16000 && typeof v.at === 'number' && Number.isFinite(v.at)) clean.drafts[key] = { text: v.text, at: v.at };
  clean.quizzes = ordered(clean.quizzes); clean.drafts = ordered(clean.drafts);
  if (Array.isArray(value.practiceDays)) clean.practiceDays = [...new Set(value.practiceDays.filter(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)))].sort().slice(-366);
  if (typeof value.lastLesson === 'string' && lessons.some(l => l.id === value.lastLesson)) clean.lastLesson = value.lastLesson;
  if (typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)) clean.updatedAt = value.updatedAt;
  return clean;
}
function mergeTimes(a: Record<string, number>, b: Record<string, number>) { const merged = { ...a }; for (const [key, at] of Object.entries(b)) merged[key] = Math.max(merged[key] ?? 0, at); return ordered(merged); }
export function mergeProgress(a: Progress, b: Progress): Progress {
  const quizzes = { ...a.quizzes };
  for (const [key, score] of Object.entries(b.quizzes)) { const old = quizzes[key]; if (!old || score.score / score.total > old.score / old.total || (score.score / score.total === old.score / old.total && (score.at > old.at || (score.at === old.at && score.total > old.total)))) quizzes[key] = score; }
  const drafts = { ...a.drafts }; for (const [key, draft] of Object.entries(b.drafts)) if (!drafts[key] || draft.at > drafts[key].at || (draft.at === drafts[key].at && draft.text > drafts[key].text)) drafts[key] = draft;
  return { version: 1, completedLessons: mergeTimes(a.completedLessons, b.completedLessons), quizzes: ordered(quizzes), exercises: mergeTimes(a.exercises, b.exercises), programs: mergeTimes(a.programs, b.programs), labs: mergeTimes(a.labs, b.labs), drafts: ordered(drafts),
    practiceDays: [...new Set([...a.practiceDays, ...b.practiceDays])].sort().slice(-366), lastLesson: b.updatedAt === a.updatedAt ? [a.lastLesson, b.lastLesson].sort().at(-1)! : b.updatedAt > a.updatedAt ? b.lastLesson : a.lastLesson, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
}
export const quizPassed = (p: Progress, id: string) => !!p.quizzes[id] && p.quizzes[id].score / p.quizzes[id].total >= 0.8;
export function groups(p: Progress, processor: Processor) {
  const course = lessons.filter(l => l.processor === processor);
  const foundation = course.filter(l => l.module.endsWith('foundations')); const instruction = course.filter(l => l.module.endsWith('instructions')); const programs = course.filter(l => l.challenge);
  const concepts = course.filter(l => l.module.endsWith('programs'));
  return [
    { id: 'foundations', name: 'Foundations', detail: 'CPU basics, numbers & architecture', done: foundation.filter(l => p.completedLessons[l.id]).length, total: foundation.length, xp: 40 },
    { id: 'instructions', name: 'Instruction families', detail: 'Read and complete every family lesson', done: instruction.filter(l => p.completedLessons[l.id]).length, total: instruction.length, xp: 40 },
    { id: 'concepts', name: 'Programming concepts', detail: 'Representation, algorithms & debugging', done: concepts.filter(l => p.completedLessons[l.id]).length, total: concepts.length, xp: 40 },
    { id: 'quizzes', name: 'Quiz mastery', detail: 'Score at least 80% in each quiz', done: course.filter(l => quizPassed(p, l.id)).length, total: course.length, xp: 30 },
    { id: 'exercises', name: 'Guided code puzzles', detail: 'Solve every fill-in-the-blank exercise', done: course.filter(l => p.exercises[l.id]).length, total: course.length, xp: 35 },
    { id: 'programs', name: 'Independent programs', detail: 'Run programs and match the test outputs', done: programs.filter(l => p.programs[l.id]).length, total: programs.length, xp: 75 },
    { id: 'labs', name: 'Lab experiments', detail: processor === '8085' ? 'Your seven uploaded experiments' : 'No 8086 experiments in the uploaded sheet', done: processor === '8085' ? labs.filter(l => p.labs[l.id]).length : 0, total: processor === '8085' ? labs.length : 0, xp: 100 },
  ];
}
export function stats(p: Progress, processor?: Processor) {
  const selected = processor ? lessons.filter(l => l.processor === processor) : lessons;
  const reading = selected.filter(l => p.completedLessons[l.id]).length;
  const groupList = processor ? groups(p, processor) : [...groups(p, '8085'), ...groups(p, '8086')];
  const done = groupList.reduce((sum, g) => sum + g.done, 0);
  const total = groupList.reduce((sum, g) => sum + g.total, 0);
  const xp = reading * 40 + selected.filter(l => quizPassed(p, l.id)).length * 30 + selected.filter(l => p.exercises[l.id]).length * 35 + selected.filter(l => l.challenge && p.programs[l.id]).length * 75 + ((!processor || processor === '8085') ? labs.filter(l => p.labs[l.id]).length * 100 : 0);
  return { done, total, xp, percent: total ? Math.round(done / total * 100) : 0, level: Math.floor(xp / 400) + 1, reading };
}
export function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function streak(p: Progress) { let n = 0; const d = new Date(); if (!p.practiceDays.includes(localDay(d))) d.setDate(d.getDate() - 1); while (p.practiceDays.includes(localDay(d))) { n++; d.setDate(d.getDate() - 1); } return n; }
export function loadLocal(key: string) { try { const data = localStorage.getItem(key); return data ? normalizeProgress(JSON.parse(data)) : emptyProgress(); } catch { return emptyProgress(); } }
export function saveLocal(key: string, progress: Progress) { try { localStorage.setItem(key, JSON.stringify(progress)); return true; } catch { return false; } }
