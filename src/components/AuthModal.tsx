import { useEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { ArrowRight, Check, Cloud, LoaderCircle, X } from 'lucide-react';
import { auth, cloudConfigured } from '../lib/firebase';
import { useProgress } from '../context/ProgressContext';

export function AuthModal({ close }: { close: () => void }) {
  const { user, status, logout } = useProgress(); const [signup, setSignup] = useState(false); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  async function action(work: () => Promise<unknown>, dismiss = true) { setBusy(true); setError(''); setMessage(''); try { await work(); if (dismiss) close(); } catch (error) { const code = (error as { code?: string }).code; const friendly: Record<string, string> = { 'auth/invalid-credential': 'Email or password is incorrect.', 'auth/email-already-in-use': 'That email already has an account. Switch to sign in.', 'auth/weak-password': 'Choose a password with at least six characters.', 'auth/popup-blocked': 'The browser blocked sign-in. Allow popups or use email.', 'auth/unauthorized-domain': 'This hosting domain must be added to Firebase Authentication → Authorized domains.', 'auth/operation-not-allowed': 'Enable this sign-in provider in your Firebase Authentication settings.', 'auth/popup-closed-by-user': 'Sign-in was closed. You can try again.', 'auth/too-many-requests': 'Too many attempts. Please wait and try again.' }; setError(friendly[code ?? ''] ?? (error as Error).message); } finally { setBusy(false); } }
  return <dialog ref={dialog} className="auth-dialog" onCancel={close} onClick={event => { if (event.target === dialog.current) close(); }}>
    <button className="icon-button dialog-close" onClick={close} aria-label="Close account dialog"><X size={20} /></button>
    <div className="auth-icon"><Cloud size={28} /></div>
    <p className="eyebrow">YOUR JOURNEY, EVERYWHERE</p>
    <h2>{user ? 'Your learning account' : 'Pick up where you left off.'}</h2>
    {user ? <><p className="muted">Signed in as <strong>{user.email ?? user.displayName}</strong>.</p><div className="note"><Check size={18} /><span>Progress, quiz scores, completed labs, and code drafts sync with this account. Current status: {status}.</span></div><button className="button secondary wide" onClick={() => action(logout)}>Sign out</button></> : !cloudConfigured ? <>
      <p className="muted">You’re learning in guest mode. Progress is saved in this browser. Cross-device sync is ready to connect once Firebase is configured.</p>
      <ol className="setup-list"><li>Create a Firebase project and register a web app.</li><li>Enable email/password and Google sign-in.</li><li>Create Firestore and publish the included <code>firestore.rules</code>.</li><li>Fill in <code>.env.local</code> using <code>.env.example</code>, then rebuild.</li></ol>
      <p className="small muted">Full setup instructions are in README.md. For now, use Export / Import on the Progress page to move your progress between devices.</p><button className="button primary wide" onClick={close}>Continue learning <ArrowRight size={16} /></button>
    </> : <>
      <p className="muted">Save your progress across devices. Your guest achievements merge into your account when you sign in.</p>
      <button disabled={busy} className="button secondary wide google-button" onClick={() => action(() => signInWithPopup(auth!, new GoogleAuthProvider()))}><span className="google-g">G</span> Continue with Google</button>
      <div className="divider-text">or use your email</div>
      <form onSubmit={event => { event.preventDefault(); void action(() => signup ? createUserWithEmailAndPassword(auth!, email.trim(), password) : signInWithEmailAndPassword(auth!, email.trim(), password)); }}>
        <label>Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label>Password<input required type="password" minLength={6} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></label>
        <button className="button primary wide" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : null}{signup ? 'Create your account' : 'Sign in'} <ArrowRight size={16} /></button>
      </form>
      <button disabled={busy} className="text-button wide" onClick={() => { setSignup(!signup); setError(''); }}>{signup ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
      {!signup && <button disabled={busy} className="text-button wide muted" onClick={() => { if (!email.trim()) { setError('Enter your email first to request a reset link.'); return; } void action(async () => { await sendPasswordResetEmail(auth!, email.trim()); setMessage('If this email has an account, a reset link will be sent. Check your inbox.'); }, false); }}>Forgot password?</button>}
    </>}
    {error && <p className="feedback error" role="alert">{error}</p>}{message && <p className="feedback success" role="status">{message}</p>}
  </dialog>;
}
