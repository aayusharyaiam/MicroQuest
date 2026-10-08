import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { emptyProgress, loadLocal, localDay, mergeProgress, normalizeProgress, saveLocal } from '../lib/progress';
import type { Progress } from '../types';

type Status = 'guest' | 'connecting' | 'saving' | 'synced' | 'offline' | 'error';
interface ProgressContextValue {
  progress: Progress; user: User | null; ready: boolean; status: Status; syncError: string; storageError: boolean;
  update: (change: (p: Progress) => Progress, activity?: boolean) => void;
  complete: (group: 'completedLessons' | 'exercises' | 'programs' | 'labs', id: string) => void;
  saveDraft: (id: string, text: string) => void; importBackup: (value: unknown) => void; logout: () => Promise<void>;
}
const Context = createContext<ProgressContextValue | null>(null);
const guestKey = 'microquest-progress-v1-guest';
const userKey = (uid: string) => `microquest-progress-v1-${uid}`;
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(() => auth ? emptyProgress() : loadLocal(guestKey));
  const [user, setUser] = useState<User | null>(null); const [ready, setReady] = useState(!auth);
  const [status, setStatus] = useState<Status>(auth ? 'connecting' : 'guest'); const [syncError, setSyncError] = useState(''); const [storageError, setStorageError] = useState(false);
  const [retry, setRetry] = useState(0);
  const latest = useRef(progress); const storageKey = useRef(guestKey); const remote = useRef(''); const cloudReady = useRef(false); const activeUid = useRef<string | null>(null);
  const persist = useCallback((next: Progress) => { latest.current = next; setProgress(next); setStorageError(!saveLocal(storageKey.current, next)); }, []);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, account => {
      activeUid.current = account?.uid ?? null; cloudReady.current = false; remote.current = '';
      storageKey.current = account ? userKey(account.uid) : guestKey;
      const local = account ? mergeProgress(loadLocal(userKey(account.uid)), loadLocal(guestKey)) : loadLocal(guestKey);
      persist(local);
      // Account-specific storage prevents one signed-in person's data from
      // appearing in a different account or in a signed-out guest session.
      if (account && saveLocal(userKey(account.uid), local)) saveLocal(guestKey, emptyProgress());
      setUser(account); setStatus(account ? 'connecting' : 'guest'); setSyncError(''); setReady(true);
    }, error => { setSyncError(error.message); setStatus('error'); setReady(true); persist(loadLocal(guestKey)); });
  }, [persist]);
  useEffect(() => {
    if (!user || !db) return;
    const uid = user.uid;
    return onSnapshot(doc(db, 'users', uid), { includeMetadataChanges: true }, snapshot => {
      if (activeUid.current !== uid) return;
      const cloud = normalizeProgress(snapshot.data()); const merged = mergeProgress(latest.current, cloud);
      remote.current = JSON.stringify(cloud); cloudReady.current = true;
      if (JSON.stringify(merged) !== JSON.stringify(latest.current)) persist(merged);
      if (snapshot.metadata.fromCache) { setStatus('offline'); }
      else { setSyncError(''); setStatus(!snapshot.metadata.hasPendingWrites && JSON.stringify(merged) === remote.current ? 'synced' : 'saving'); setRetry(r => r + 1); }
    }, error => { setSyncError(error.message); setStatus('error'); });
  }, [user, persist]);
  useEffect(() => {
    const online = () => setRetry(r => r + 1); const offline = () => { if (activeUid.current) setStatus('offline'); };
    window.addEventListener('online', online); window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== storageKey.current || !event.newValue) return;
      try { const merged = mergeProgress(latest.current, normalizeProgress(JSON.parse(event.newValue))); if (JSON.stringify(merged) !== JSON.stringify(latest.current)) persist(merged); } catch { /* Ignore invalid external browser-storage data. */ }
    };
    window.addEventListener('storage', changed); return () => window.removeEventListener('storage', changed);
  }, [persist]);
  useEffect(() => {
    if (!user || !db || !cloudReady.current || JSON.stringify(progress) === remote.current) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    const uid = user.uid; let cancelled = false; let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(async () => {
      if (activeUid.current !== uid) return;
      setStatus('saving');
      try {
        const synced = await runTransaction(db!, async transaction => {
          const ref = doc(db!, 'users', uid); const snapshot = await transaction.get(ref);
          const merged = mergeProgress(normalizeProgress(snapshot.data()), latest.current);
          transaction.set(ref, merged); return merged;
        });
        if (cancelled || activeUid.current !== uid) return;
        const merged = mergeProgress(latest.current, synced); remote.current = JSON.stringify(synced);
        if (JSON.stringify(merged) !== JSON.stringify(latest.current)) persist(merged);
        setStatus(JSON.stringify(merged) === remote.current ? 'synced' : 'saving'); setSyncError('');
      } catch (error) {
        if (cancelled || activeUid.current !== uid) return;
        setStatus(navigator.onLine ? 'error' : 'offline'); setSyncError((error as Error).message);
        retryTimer = setTimeout(() => setRetry(r => r + 1), 15000);
      }
    }, 1000);
    return () => { cancelled = true; clearTimeout(timer); if (retryTimer) clearTimeout(retryTimer); };
  }, [progress, user, retry, persist]);
  const update = useCallback((change: (p: Progress) => Progress, activity = true) => {
    const next = change(latest.current); next.updatedAt = Date.now();
    if (activity) next.practiceDays = [...new Set([...next.practiceDays, localDay()])].sort().slice(-366);
    persist(next);
    if (activeUid.current) setStatus(!navigator.onLine ? 'offline' : cloudReady.current ? 'saving' : 'connecting');
  }, [persist]);
  const complete: ProgressContextValue['complete'] = (group, id) => update(p => ({ ...p, [group]: { ...p[group], [id]: Date.now() } }));
  const saveDraft = (id: string, text: string) => update(p => ({ ...p, drafts: { ...p.drafts, [id]: { text, at: Date.now() } } }), false);
  const importBackup = (value: unknown) => { if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) throw new Error('This is not a MicroQuest v1 progress backup.'); update(p => mergeProgress(p, normalizeProgress(value)), false); };
  const logout = async () => { if (status !== 'synced' && status !== 'guest' && !window.confirm('Some changes are not confirmed in the cloud yet. They are saved on this device under your account. Sign out anyway?')) return; if (auth) await signOut(auth); };
  return <Context.Provider value={{ progress, user, ready, status, syncError, storageError, update, complete, saveDraft, importBackup, logout }}>{children}</Context.Provider>;
}
export function useProgress() { const context = useContext(Context); if (!context) throw new Error('ProgressProvider is required.'); return context; }
