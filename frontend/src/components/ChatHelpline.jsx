import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PhoneCall, X, Mic, Square, FileText, ExternalLink,
  RotateCcw, Copy, Check, AlertTriangle, Loader2, Sparkles, Globe,
} from 'lucide-react';
import { ask, needsTextTranslation, translateResponseFields, translateText, transcribeAudio, voiceTranscribeStatus } from '../api';
import { STATUS, TONES } from '../lib/status';
import {
  CHAT_TOPICS, HELPLINE_NUMBER, HELPLINE_PIN,
  buildBotMessage, detectChatLanguage, resolveChatTurn,
} from '../lib/chat';
import { statusText, reasonText } from '../lib/bilingualStrings';
import { useLanguage, useT } from '../lib/LanguageContext';

const WelcomeCard = React.memo(function WelcomeCard({ busy, onPickTopic }) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-[#E6E4DD] bg-white p-3.5 shadow-sm">
      <p className="gu-text text-[13px] font-semibold text-[#1E293B]">
        {t('chat.welcome_title')}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[#475569]">
        {t('chat.welcome_desc_prefix')}
      </p>
      <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {CHAT_TOPICS.map((topic) => (
          <button
            key={topic.id}
            type="button"
            disabled={busy}
            onClick={() => onPickTopic(topic)}
            className="rounded-xl border border-[#E6E4DD] bg-[#F8F7F4] px-2.5 py-2 text-left transition-colors hover:border-[#C7D2FE] hover:bg-[#EEF2FF]/70 disabled:opacity-50"
          >
            <span className={`block text-[12px] font-bold text-[#1E293B] ${topic.lang === 'gu' ? 'gu-text' : ''}`}>
              {topic.label}
            </span>
            <span className={`block truncate text-[10.5px] text-[#64748B] ${topic.lang === 'gu' ? 'gu-text' : ''}`}>
              {topic.sub}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});

const ChatMessageList = React.memo(function ChatMessageList({ messages, msgTranslations, onInspect }) {
  const { lang: uiLang } = useLanguage();
  const t = useT();
  return messages.map((m) => {
    if (m.role === 'user') {
      return (
        <div key={m.id} className="flex justify-end">
          <div className="gu-text max-w-[85%] rounded-2xl rounded-br-sm bg-[#4F46E5] px-3.5 py-2.5 text-[13px] leading-relaxed text-white shadow-sm">
            {m.text}
          </div>
        </div>
      );
    }

    const tr = msgTranslations?.[`${m.id}:${uiLang}`];
    const shownText = tr?.text ?? m.text;
    const shownWarnings = tr?.warnings ?? m.warnings ?? [];
    const tone = TONES[(STATUS[m.answerStatus] || STATUS.insufficient).tone];
    const cardLang = uiLang === 'gu' ? 'gu' : 'en';
    const badgeLabel = m.verdict === 'unavailable'
      ? t('chat.unavailable')
      : statusText(m.answerStatus, cardLang).short;
    const locReason = m.reasonCode ? (reasonText(m.reasonCode, cardLang) || m.reasonLabel) : m.reasonLabel;
    const hasWarnings = shownWarnings.length > 0;
    return (
      <div key={m.id} className="flex justify-start">
        <div className="max-w-[92%] space-y-2 rounded-2xl rounded-bl-sm border border-[#E6E4DD] bg-white p-3.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${tone.pill} ${tone.ring} ${tone.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              <span>{badgeLabel}</span>
            </span>
            {locReason && (
              <span className="mono-label text-[9.5px] text-[#9F1239]">{locReason}</span>
            )}
          </div>

          <p className="gu-text text-[13px] leading-relaxed text-[#1E293B]">{shownText}</p>

          {hasWarnings && (
            <div className="flex items-start gap-1.5 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1.5 text-[11px] text-[#92400E]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D97706]" />
              <span>{shownWarnings[0]}</span>
            </div>
          )}

          {m.citations?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {m.citations.slice(0, 3).map((cit, idx) => (
                <button
                  key={`${cit.gr_id}-${cit.page}-${idx}`}
                  type="button"
                  onClick={() => onInspect?.(m.question, m.rawResponse, cit)}
                  title={t('chat.inspect_page_title')}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E6E4DD] bg-[#F8F7F4] px-2 py-1 text-[11px] font-semibold text-[#4F46E5] transition-colors hover:border-[#C7D2FE] hover:bg-[#EEF2FF]"
                >
                  <FileText className="h-3 w-3" />
                  <span>{cit.gr_number && cit.gr_number !== 'UNKNOWN' ? cit.gr_number : cit.gr_id}</span>
                  <span className="text-[#64748B]">· p.{cit.page}</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </button>
              ))}
            </div>
          )}

          {m.verdict === 'answered' && (
            <div className="flex flex-wrap gap-1.5 border-t border-[#F1EFEA] pt-2">
              <button
                type="button"
                onClick={() => onInspect?.(m.question, m.rawResponse, m.citations?.[0] || null)}
                className="rounded-md border border-[#E6E4DD] bg-[#FAF9F5] px-2 py-0.5 text-[10.5px] font-semibold text-[#475569] hover:border-[#C7D2FE] hover:text-[#4F46E5]"
              >
                {t('chat.open_dossier')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  });
});

function pickAudioMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

const VoiceDock = React.memo(function VoiceDock({
  open, busy, hasHistory, uiMode, uiLang, onSubmitText, onDetectedLang,
}) {
  const t = useT();
  const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'recording' | 'transcribing'
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceNote, setVoiceNote] = useState('');
  const meterBarRef = useRef(null);
  const recRef = useRef(null);
  const mediaRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const previewTimerRef = useRef(null);
  const previewCtlRef = useRef(null);
  const safetyCapRef = useRef(null);

  const canMediaRecord = typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== 'undefined';
  const speechCtor = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null;
  const hasMic = canMediaRecord || Boolean(speechCtor);

  const cleanupRecordingResources = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (previewCtlRef.current) {
      previewCtlRef.current.abort();
      previewCtlRef.current = null;
    }
    if (safetyCapRef.current) {
      clearTimeout(safetyCapRef.current);
      safetyCapRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const abortRecording = useCallback(() => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current._discardOnStop = true;
      try { mediaRef.current.stop(); } catch { /* ignore */ }
    }
    if (recRef.current) {
      if (recRef.current._discardOnStop) recRef.current._discardOnStop();
      else { try { recRef.current.stop(); } catch { /* ignore */ } }
    }
    cleanupRecordingResources();
    setVoiceState('idle');
    setLiveTranscript('');
  }, [cleanupRecordingResources]);

  useEffect(() => {
    if (!open) {
      abortRecording();
      setVoiceNote('');
    }
  }, [open, abortRecording]);

  const startWebSpeechFallback = (noteText = '') => {
    if (!speechCtor) {
      setVoiceState('idle');
      setVoiceNote(noteText || 'Microphone unavailable in this browser.');
      return;
    }
    const rec = new speechCtor();
    const preferGuSpeech = uiLang === 'gu';
    rec.lang = preferGuSpeech ? 'gu-IN' : 'en-IN';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 3;
    let latestTranscript = '';
    let discarded = false;

    rec.onresult = (ev) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = 0; i < ev.results.length; i += 1) {
        const txt = ev.results[i]?.[0]?.transcript || '';
        if (ev.results[i].isFinal) finalChunk += ` ${txt}`;
        else interimChunk += ` ${txt}`;
      }
      const spoken = `${finalChunk} ${interimChunk}`.trim();
      if (spoken) {
        latestTranscript = spoken;
        setLiveTranscript(spoken);
        const d = detectChatLanguage(spoken);
        if (d) onDetectedLang(d);
      }
    };
    rec.onerror = (ev) => {
      setVoiceState('idle');
      if (ev?.error === 'not-allowed') setVoiceNote('Microphone access denied in browser.');
    };
    rec.onend = () => {
      setVoiceState('idle');
      const finalText = latestTranscript.trim();
      setLiveTranscript('');
      if (discarded) return;
      if (finalText) {
        setVoiceNote('');
        onSubmitText(finalText);
      } else {
        setVoiceNote('No speech captured — press mic and try again.');
      }
    };
    rec._discardOnStop = () => {
      discarded = true;
      try { rec.stop(); } catch { /* ignore */ }
    };
    recRef.current = rec;
    setLiveTranscript('');
    setVoiceState('recording');
    if (noteText) setVoiceNote(noteText);
    try {
      rec.start();
    } catch {
      setVoiceState('idle');
    }
  };

  const toggleMic = async () => {
    if (busy || voiceState === 'transcribing') return;
    setVoiceNote('');

    // Second press -> stops listening cleanly & sends the question
    if (voiceState === 'recording') {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') {
        mediaRef.current.stop();
      } else if (recRef.current) {
        try { recRef.current.stop(); } catch { /* ignore */ }
      }
      return;
    }

    if (!canMediaRecord) {
      startWebSpeechFallback();
      return;
    }

    const probeCtl = new AbortController();
    const probeTimer = setTimeout(() => probeCtl.abort(), 1200);
    const cloudSttReady = await voiceTranscribeStatus(probeCtl.signal).catch(() => false);
    clearTimeout(probeTimer);

    if (!cloudSttReady) {
      startWebSpeechFallback('Using browser live voice (restart backend for Whisper Gujarati + English).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mimeType = pickAudioMime();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks = [];
      let speechHeard = false;
      let livePreviewText = '';
      let previewBusy = false;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      // Live streaming partial transcription while user is speaking (stays open until second tap)
      previewTimerRef.current = setInterval(async () => {
        if (!mediaRef.current || mediaRef.current.state !== 'recording') return;
        if (!speechHeard || previewBusy || chunks.length < 2) return;
        const previewBlob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        if (previewBlob.size < 1600) return;

        previewBusy = true;
        const ctl = new AbortController();
        previewCtlRef.current = ctl;
        try {
          const res = await transcribeAudio(previewBlob, uiMode === 'auto' ? null : uiMode, ctl.signal, 'fast');
          const partial = (res?.text || '').trim();
          if (partial && mediaRef.current?.state === 'recording' && !recorder._discardOnStop) {
            livePreviewText = partial;
            setLiveTranscript(partial);
            const resolved = res.detected_language || detectChatLanguage(partial);
            if (resolved) onDetectedLang(resolved);
          }
        } catch {
          /* ignore transient partial preview failures */
        } finally {
          previewBusy = false;
          if (previewCtlRef.current === ctl) previewCtlRef.current = null;
        }
      }, 950);

      recorder.onstop = async () => {
        const discarded = Boolean(recorder._discardOnStop);
        cleanupRecordingResources();
        if (discarded) {
          setLiveTranscript('');
          setVoiceState('idle');
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        if (blob.size < 400) {
          setLiveTranscript('');
          setVoiceState('idle');
          setVoiceNote('No speech captured — press mic, speak, then press again.');
          return;
        }
        setVoiceState('transcribing');
        try {
          const res = await transcribeAudio(blob, uiMode === 'auto' ? null : uiMode, undefined, 'accurate');
          const spoken = (res?.text || '').trim() || livePreviewText;
          setLiveTranscript('');
          setVoiceState('idle');
          if (spoken) {
            const resolved = res?.detected_language || detectChatLanguage(spoken);
            if (resolved) onDetectedLang(resolved);
            setVoiceNote('');
            onSubmitText(spoken);
          } else {
            setVoiceNote('Could not hear clear speech — press mic and speak closer.');
          }
        } catch {
          setLiveTranscript('');
          setVoiceState('idle');
          if (livePreviewText) {
            setVoiceNote('');
            onSubmitText(livePreviewText);
          } else {
            setVoiceNote('Speech recognition interrupted — press mic to try again.');
          }
        }
      };

      mediaRef.current = recorder;
      setLiveTranscript('');
      recorder.start(350);
      setVoiceState('recording');

      // Live volume level bar only (NO auto-stop on silence — stops strictly when pressed again)
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          const buf = new Uint8Array(analyser.fftSize);

          const tick = () => {
            if (!mediaRef.current || mediaRef.current.state !== 'recording') return;
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i += 1) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            if (rms > 0.025) speechHeard = true;
            if (meterBarRef.current) {
              const scale = Math.min(1, Math.max(0.12, rms * 6));
              meterBarRef.current.style.transform = `scaleX(${scale})`;
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        } catch { /* meter optional */ }
      }

      // Safety cap at 60s if forgotten
      safetyCapRef.current = setTimeout(() => {
        if (mediaRef.current && mediaRef.current.state === 'recording') {
          mediaRef.current.stop();
        }
      }, 60000);
    } catch (err) {
      cleanupRecordingResources();
      if (err?.name === 'NotAllowedError') {
        setVoiceState('idle');
        setVoiceNote('Microphone access denied in browser.');
      } else {
        startWebSpeechFallback();
      }
    }
  };

  const recording = voiceState === 'recording';
  const transcribing = voiceState === 'transcribing';

  return (
    <div className="border-t border-[#E6E4DD] bg-white px-4 py-3">
      {(recording || liveTranscript) && (
        <div className="mb-2.5 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF]/60 px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-[10.5px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#BE123C]">
              <span className="h-2 w-2 rounded-full bg-[#E11D48]" />
              <span>{transcribing ? t('chat.finalizing') : t('chat.listening')}</span>
            </span>
            {recording && (
              <button
                type="button"
                onClick={abortRecording}
                className="font-semibold text-[#64748B] hover:text-[#1E293B]"
              >
                {t('chat.discard')}
              </button>
            )}
          </div>
          {recording && (
            <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#FFE4E6]">
              <span ref={meterBarRef} className="block h-full origin-left rounded-full bg-[#E11D48] transition-transform duration-75" style={{ transform: 'scaleX(0.15)' }} />
            </div>
          )}
          <p className="gu-text text-[13px] font-medium leading-snug text-[#1E293B]">
            {liveTranscript || t('chat.speak_prompt')}
          </p>
        </div>
      )}

      {!recording && !transcribing && voiceNote && (
        <p className="mb-2 text-center text-[11px] text-[#64748B]">{voiceNote}</p>
      )}

      <div className="flex flex-col items-center gap-1.5">
        {hasMic ? (
          <button
            type="button"
            disabled={busy || transcribing}
            onClick={toggleMic}
            aria-label={recording ? t('chat.stop_ask') : t('chat.press_mic_speak')}
            className={`inline-flex h-12 items-center justify-center gap-2.5 rounded-full px-6 text-[13px] font-semibold shadow-md transition-all active:scale-95 disabled:opacity-45 ${
              recording
                ? 'bg-[#E11D48] text-white ring-4 ring-[#FFE4E6] hover:bg-[#BE123C]'
                : 'btn-primary'
            }`}
          >
            {transcribing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('chat.recognizing')}</span>
              </>
            ) : recording ? (
              <>
                <Square className="h-4 w-4 fill-current" />
                <span>{t('chat.stop_ask')}</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                <span className="gu-text">{hasHistory ? t('chat.press_mic_followup') : t('chat.press_mic_speak')}</span>
              </>
            )}
          </button>
        ) : (
          <p className="text-center text-[11.5px] text-[#64748B]">
            {t('chat.voice_unavailable')}
          </p>
        )}
      </div>
    </div>
  );
});

export default function ChatHelpline({ open, onOpenChange, onInspect }) {
  const { mode: uiMode, lang: uiLang, detectedLang: uiDetected, setLang: setPlatformLang, setDetectedLang: setPlatformDetectedLang } = useLanguage();
  const t = useT();
  const [messages, setMessages] = useState([]);
  const [msgTranslations, setMsgTranslations] = useState({});
  const [busy, setBusy] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);
  const endRef = useRef(null);
  const abortRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const msgTranslationsRef = useRef(msgTranslations);
  msgTranslationsRef.current = msgTranslations;

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: 'auto' });
    });
    return () => cancelAnimationFrame(raf);
  }, [messages.length, busy, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Translate existing assistant replies in place when the single TopBar language switch changes.
  useEffect(() => {
    const target = uiLang === 'gu' ? 'gu' : 'en';
    const pending = messages.filter((m) => {
      if (m.role !== 'assistant' || m.verdict === 'unavailable') return false;
      if (msgTranslationsRef.current[`${m.id}:${target}`]) return false;
      const needMain = needsTextTranslation(m.text, target);
      const needWarn = (m.warnings || []).some((w) => needsTextTranslation(w, target));
      return needMain || needWarn;
    });
    if (!pending.length) return undefined;

    let cancelled = false;
    const ctl = new AbortController();
    Promise.all(
      pending.map(async (m) => {
        try {
          const text = needsTextTranslation(m.text, target)
            ? (await translateText(m.text, target, ctl.signal)) || m.text
            : m.text;
          const warnings = await Promise.all(
            (m.warnings || []).map(async (w) => (
              needsTextTranslation(w, target)
                ? (await translateText(w, target, ctl.signal)) || w
                : w
            )),
          );
          return [m.id, { text, warnings }];
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      const updates = {};
      for (const row of rows) {
        if (row) updates[`${row[0]}:${target}`] = row[1];
      }
      if (Object.keys(updates).length > 0) {
        setMsgTranslations((prev) => ({ ...prev, ...updates }));
      }
    });
    return () => {
      cancelled = true;
      ctl.abort();
    };
  }, [messages, uiLang]);

  const handleDetectedVoiceOrTextLang = useCallback((code) => {
    if (!code) return;
    setPlatformDetectedLang(code);
  }, [setPlatformDetectedLang]);

  const runTurn = useCallback(async ({
    displayText, resolvedQuestion, queryToSend, effectiveLang, detectedInputLang,
  }) => {
    if (!queryToSend || busy) return;
    if (detectedInputLang) setPlatformDetectedLang(detectedInputLang);

    const userMsg = {
      id: `${Date.now()}-u`,
      role: 'user',
      text: displayText,
    };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);

    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;

    try {
      const res = await ask(queryToSend, effectiveLang, ctl.signal, { includeChain: false });
      const bot = buildBotMessage(resolvedQuestion, res, effectiveLang);
      setMessages((prev) => [...prev, bot]);
      const qDetected = detectChatLanguage(resolvedQuestion);
      const qLang = (qDetected === 'gu' || qDetected === 'gujlish') ? 'gu' : 'en';
      setPlatformDetectedLang(uiMode === 'auto' ? bot.lang : qLang);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-err`,
          role: 'assistant',
          verdict: 'unavailable',
          answerStatus: 'insufficient',
          statusLabel: 'Unavailable',
          text: err?.message || 'Could not reach the backend right now.',
          citations: [],
          warnings: [],
        },
      ]);
    } finally {
      if (abortRef.current === ctl) setBusy(false);
    }
  }, [busy, uiMode, setPlatformDetectedLang]);

  const handleSubmitText = useCallback(async (rawText) => {
    const plan = resolveChatTurn(rawText, messagesRef.current, uiMode === 'auto' ? null : uiMode);
    if (plan.isPureSwitch && plan.effectiveLang && !busy) {
      const prevAns = [...messagesRef.current].reverse().find((m) => m.role === 'assistant' && m.rawResponse);
      const target = plan.effectiveLang === 'gu' ? 'gu' : 'en';
      if (prevAns) {
        setPlatformLang(target);
        const userMsg = { id: `${Date.now()}-u`, role: 'user', text: plan.displayText };
        setMessages((prev) => [...prev, userMsg]);
        setBusy(true);
        try {
          const translatedRes = await translateResponseFields(prevAns.rawResponse, target);
          const bot = buildBotMessage(prevAns.question, translatedRes, target);
          setMessages((prev) => [...prev, bot]);
        } catch {
          /* keep thread intact if translation call fails */
        } finally {
          setBusy(false);
        }
        return;
      }
    }
    runTurn(plan);
  }, [busy, uiMode, setPlatformLang, runTurn]);

  const handlePickTopic = useCallback((topic) => {
    runTurn({
      displayText: topic.question,
      resolvedQuestion: topic.question,
      queryToSend: topic.question,
      effectiveLang: uiMode === 'auto' ? topic.lang : uiMode,
      detectedInputLang: topic.lang,
    });
  }, [uiMode, runTurn]);

  const cancelInFlight = () => {
    abortRef.current?.abort();
    setBusy(false);
  };

  const copyHelpline = () => {
    try {
      navigator.clipboard?.writeText(HELPLINE_NUMBER);
      setCopiedNum(true);
      setTimeout(() => setCopiedNum(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  const syncedLangLabel = useMemo(() => {
    if (uiMode === 'gu') return t('topbar.lang_gu');
    if (uiMode === 'en') return t('topbar.lang_en');
    const tag = uiDetected === 'gu' ? 'ગુ' : 'EN';
    return `${t('topbar.ui_auto')} · ${tag}`;
  }, [uiMode, uiDetected, t]);

  return (
    <div className="print:hidden">
      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label={t('chat.fab_aria')}
          className="btn-primary fixed bottom-5 right-5 z-30 flex items-center gap-2.5 rounded-full px-4 py-3 text-[13px] font-semibold shadow-lg transition-transform hover:-translate-y-0.5 active:scale-95 md:bottom-11"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] ring-2 ring-white/40" />
          <Mic className="h-4 w-4" />
          <span className="gu-text">{t('chat.fab_label')}</span>
        </button>
      )}

      {open && (
        <aside
          role="dialog"
          aria-label={t('chat.dialog_aria')}
          className="fixed bottom-3 right-3 z-40 flex h-[min(82vh,640px)] w-[min(94vw,430px)] flex-col overflow-hidden rounded-2xl border border-[#D8D4CA] bg-white shadow-xl sm:bottom-5 sm:right-5 md:bottom-11"
        >
          {/* Header */}
          <div className="border-b border-[#E6E4DD] bg-[#F8F7F4] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#4F46E5] text-white shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-[14px] font-extrabold tracking-tight text-[#1E293B]">
                    GovResolve<span className="text-[#4F46E5]">·AI</span> {t('chat.title_suffix')}
                  </h2>
                  <p className="mono-label text-[9px] text-[#64748B]">{t('chat.subtitle')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      cancelInFlight();
                      setMessages([]);
                      setMsgTranslations({});
                    }}
                    title={t('chat.new_convo')}
                    aria-label={t('chat.new_convo')}
                    className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#EAE7DF] hover:text-[#1E293B]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label={t('chat.close')}
                  className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#EAE7DF] hover:text-[#1E293B]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Synced platform language badge + Helpline strip */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <span
                title={t('topbar.ui_lang_title')}
                className={`inline-flex items-center gap-1.5 rounded-lg border border-[#E6E4DD] bg-[#F1EFEA] px-2.5 py-1 text-[11px] font-semibold text-[#475569] ${uiLang === 'gu' ? 'gu-text' : ''}`}
              >
                <Globe className="h-3 w-3 text-[#4F46E5]" aria-hidden="true" />
                <span>{syncedLangLabel}</span>
              </span>

              <button
                type="button"
                onClick={copyHelpline}
                title={`Voice Helpline ${HELPLINE_NUMBER} (Trial PIN: ${HELPLINE_PIN})`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-2 py-1 text-[11px] font-semibold text-[#4338CA] transition-colors hover:bg-[#E0E7FF]"
              >
                <PhoneCall className="h-3 w-3" />
                <span className="font-mono">{HELPLINE_NUMBER}</span>
                {copiedNum ? <Check className="h-3 w-3 text-[#059669]" /> : <Copy className="h-3 w-3 opacity-70" />}
              </button>
            </div>
          </div>

          {/* Message Thread */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#FAF9F5] p-3.5">
            <WelcomeCard busy={busy} onPickTopic={handlePickTopic} />
            <ChatMessageList
              messages={messages}
              msgTranslations={msgTranslations}
              onInspect={onInspect}
            />

            {busy && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-[#E6E4DD] bg-white px-3.5 py-2 text-[12px] text-[#64748B] shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4F46E5]" />
                  <span>{t('chat.checking')}</span>
                  <button
                    type="button"
                    onClick={cancelInFlight}
                    className="ml-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold text-[#64748B] hover:bg-[#F1EFEA] hover:text-[#1E293B]"
                  >
                    {t('chat.stop')}
                  </button>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <VoiceDock
            open={open}
            busy={busy}
            hasHistory={messages.length > 0}
            uiMode={uiMode}
            uiLang={uiLang}
            onSubmitText={handleSubmitText}
            onDetectedLang={handleDetectedVoiceOrTextLang}
          />
        </aside>
      )}
    </div>
  );
}
