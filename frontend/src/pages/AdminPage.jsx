import React, { useRef, useState } from 'react';
import { Lock, LogOut, UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { adminLogin, adminUpload } from '../api';

const KEY = 'govresolve.admin-session';

// The password lives only in this tab's sessionStorage (gone when the tab closes) and is sent as the X-Admin-Token header.
const loadSaved = () => {
  try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; }
};
const save = (v) => {
  try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch { /* the page still works without storage */ }
};

function Shell({ children, onSignOut }) {
  return (
    <div className="min-h-full bg-canvas px-4 py-10 font-sans">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="mono-label text-[#4F46E5]">GovResolve·AI · Admin</p>
            <h1 className="display mt-1 text-[26px] font-bold text-[#1E293B]">Add a Government Resolution</h1>
          </div>
          {onSignOut && (
            <button type="button" onClick={onSignOut} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E4DD] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#1E293B] hover:border-[#4F46E5]">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          )}
        </div>
        {children}
        <p className="mt-6 text-center text-[12px] text-[#64748B]"><a href="/" className="underline hover:text-[#4F46E5]">Back to the public portal</a></p>
      </div>
    </div>
  );
}

function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const info = await adminLogin(password);
      save(password);
      onDone(password, info);
    } catch (err) {
      setError(err.status === 401 ? 'Wrong password.' : err.status === 429 ? 'Too many wrong attempts. Wait a minute and try again.' : err.message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <form onSubmit={submit} className="sheet p-6" autoComplete="off">
        <div className="flex items-center gap-2 text-[#1E293B]">
          <Lock className="h-4 w-4 text-[#4F46E5]" />
          <h2 className="text-[15px] font-bold">Sign in</h2>
        </div>
        <p className="mt-1 text-[12.5px] text-[#64748B]">Only administrators and government staff can add resolutions.</p>
        <label htmlFor="admin-password" className="mt-5 block text-[12.5px] font-semibold text-[#1E293B]">Password</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-xl border border-[#E6E4DD] bg-white px-3.5 py-2.5 text-[14px] text-[#1E293B] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/15"
        />
        {error && <p role="alert" className="mt-3 flex items-start gap-1.5 text-[12.5px] font-medium text-[#9F1239]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>}
        <button
          type="submit"
          disabled={!password || busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
        </button>
      </form>
    </Shell>
  );
}

function Upload({ password, info, onSignOut }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState([]);   // uploads in this tab, newest first
  const input = useRef(null);
  const maxMb = info?.max_upload_mb || 50;

  const pick = (f) => {
    setError('');
    if (!f) return setFile(null);
    if (!/\.pdf$/i.test(f.name)) { setFile(null); return setError('Only PDF files can be added.'); }
    if (f.size > maxMb * 1_000_000) { setFile(null); return setError(`That PDF is larger than ${maxMb} MB.`); }
    setFile(f);
  };

  const send = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await adminUpload(file, password);
      setDone((d) => [{ ...r, name: file.name }, ...d]);
      setFile(null);
      if (input.current) input.current.value = '';
    } catch (err) {
      if (err.status === 401 || err.status === 429) { save(''); onSignOut(err.status === 429 ? 'Too many wrong attempts. Wait a minute and try again.' : 'Your session ended. Sign in again.'); return; }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell onSignOut={() => onSignOut('')}>
      <div className="sheet p-6">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
          className="flex flex-col items-center rounded-xl border-2 border-dashed border-[#E6E4DD] bg-[#F1EFEA]/50 px-4 py-8 text-center"
        >
          <UploadCloud className="h-8 w-8 text-[#4F46E5]" />
          <p className="mt-2 text-[14px] font-semibold text-[#1E293B]">{file ? file.name : 'Choose a PDF or drop it here'}</p>
          <p className="mt-0.5 text-[12px] text-[#64748B]">{file ? `${(file.size / 1_000_000).toFixed(1)} MB` : `One resolution at a time, up to ${maxMb} MB`}</p>
          <input ref={input} id="admin-file" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          <label htmlFor="admin-file" className="mt-3 cursor-pointer rounded-lg border border-[#E6E4DD] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#1E293B] hover:border-[#4F46E5]">Browse files</label>
        </div>

        <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-[#FFFBEB] px-3 py-2 text-[12px] leading-relaxed text-[#92400E]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Add official, public Government Resolutions only. Once added, a resolution is visible to everyone who uses the portal. Do not upload personal or confidential documents.
        </p>

        {error && <p role="alert" className="mt-3 text-[12.5px] font-medium text-[#9F1239]">{error}</p>}
        <button
          type="button"
          onClick={send}
          disabled={!file || busy}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:opacity-50"
        >
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading the PDF… scanned files can take a minute</> : 'Add to the collection'}
        </button>
      </div>

      {done.length > 0 && (
        <ul className="mt-5 space-y-3" aria-label="Added in this session">
          {done.map((d, i) => (
            <li key={`${d.gr_id}-${i}`} className="sheet flex gap-3 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#10B981]" />
              <div className="min-w-0 text-[13px] text-[#1E293B]">
                <p className="flex items-center gap-1.5 font-semibold"><FileText className="h-3.5 w-3.5 text-[#64748B]" /><span className="truncate">{d.name}</span></p>
                <p className="mt-1 font-mono text-[12px] text-[#64748B]">{d.gr_number || d.gr_id} · {d.pages} page{d.pages === 1 ? '' : 's'}</p>
                {d.note && <p className="mt-1.5 text-[12px] leading-relaxed text-[#64748B]">{d.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(() => !!loadSaved());
  const [notice, setNotice] = useState('');

  // a password kept from earlier in this tab is checked again before the upload form is shown
  React.useEffect(() => {
    const saved = loadSaved();
    if (!saved) return undefined;
    let alive = true;
    adminLogin(saved)
      .then((i) => { if (alive) { setPassword(saved); setInfo(i); } })
      .catch(() => save(''))
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  if (checking) return <Shell><p className="text-center text-[13px] text-[#64748B]">Checking your session…</p></Shell>;
  if (!password) {
    return (
      <>
        {notice && <p role="status" className="mx-auto mt-6 max-w-xl px-4 text-center text-[12.5px] font-medium text-[#92400E]">{notice}</p>}
        <Login onDone={(p, i) => { setNotice(''); setPassword(p); setInfo(i); }} />
      </>
    );
  }
  return <Upload password={password} info={info} onSignOut={(msg) => { save(''); setPassword(''); setInfo(null); setNotice(msg || ''); }} />;
}
