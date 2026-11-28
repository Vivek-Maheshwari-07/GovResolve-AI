// Helpers for the floating bilingual Chat & Helpline drawer (pure JS so node --test can cover them).
import { REASONS, STATUS } from './status.js';

export const HELPLINE_NUMBER = '09513886363';
export const HELPLINE_PIN = '7861-8563-65';

export const CHAT_TOPICS = [
  {
    id: 'panchvati',
    lang: 'gu',
    label: 'પંચવટી યોજના',
    sub: 'ગ્રામીણ બાગ-બગીચા યોજના',
    question: 'પંચવટી યોજના શું છે, એના વિશે માહિતી જોઈએ છે',
  },
  {
    id: 'ccc',
    lang: 'gu',
    label: 'CCC / CCC+ પરીક્ષા',
    sub: 'GTU ને કામગીરી સોંપણી',
    question: 'CCC અને CCC+ કોમ્પ્યુટર કૌશલ્ય પરીક્ષાની કામગીરી ટેકનિકલ પરીક્ષા બોર્ડને બદલે કોને સોંપવામાં આવી છે?',
  },
  {
    id: 'par_appeal',
    lang: 'en',
    label: 'Class-III Appraisal Appeal',
    sub: '2015 GAD Committee & Deadline',
    question: 'What is the committee composition and annual deadline for disposing of appeal applications on Class-III employee performance appraisal reports under the 2015 GAD resolution?',
  },
  {
    id: 'sarpanch',
    lang: 'en',
    label: '2024 Sarpanch Rules',
    sub: 'Reserved offices amendment',
    question: 'What percentage of Sarpanch offices in a taluka was substituted under the 2024 Gujarat Village Panchayats Election of Sarpanch Rules amendment?',
  },
];

const FOLLOW_UP_HINT = /^(and|what about|how about|which|when|who|why|explain|translate|more|details|also|in gujarati|in english|એના|તેમાં|વધુ|અને|શું|કેટલા|ક્યારે)\b/i;

const GUJLISH_FUNC = new Set([
  'su', 'shu', 'che', 'chhe', 'nathi', 'ketla', 'ketli', 'ketlu', 'kyare', 'kone', 'kon',
  'kaun', 'kevi', 'kevo', 'kevu', 'kem', 'mate', 'mateni', 'matena', 'joie', 'joye',
  'karvu', 'karva', 'batao', 'janavo', 'samjavo', 'kaho', 'aapo', 'apo', 'malse', 'malshe',
  'male', 'lagu', 'pade', 'padse', 'hethal', 'mujab', 'anusar', 'pachi', 'pahela', 'sudhi', 'vishe',
  'chalu', 'thai', 'thay', 'thayo', 'thayu', 'hati', 'hato', 'hatu', 'hata', 'avshe', 'aavshe', 'rite',
  'kya', 'kyan', 'kaya', 'kai', 'koi', 'thi', 'jashe', 'jase', 'jaay', 'hoy', 'hova', 'chalse', 'chale', 'chalshe',
  'amal', 'divas', 'gana', 'gani', 'athva', 'athwa', 'ane', 'tya', 'ma', 'ni', 'nu', 'na',
]);

const GUJLISH_ADMIN = new Set([
  'yojana', 'yojna', 'aayojana', 'ayojana', 'panchvati', 'panchwati', 'tharav', 'paripatra', 'niyam', 'niyamo',
  'karmchari', 'karmachari', 'karmchario', 'adhikari', 'sarkar', 'raja', 'rajao', 'pagar',
  'bhathu', 'bhadu', 'ganvesh', 'nikal', 'binjaruri', 'badli', 'badhti', 'bharti',
  'sahay', 'aadesh', 'hukam', 'arji', 'samiti', 'kamgiri', 'sarpanch',
]);

const EN_CUES = new Set([
  'what', 'how', 'when', 'where', 'which', 'who', 'why', 'is', 'are', 'was', 'were',
  'the', 'a', 'an', 'for', 'under', 'does', 'do', 'did', 'can', 'could', 'should',
  'rules', 'rule', 'explain', 'translate', 'list', 'show', 'give', 'tell', 'about',
]);

const REQ_GU_RE = /(?:\b(?:in|into|to|explain\s+in|answer\s+in|reply\s+in|speak\s+in|translate\s+(?:this\s+|it\s+)?(?:in|into|to))\s+gujarati\b|\bgujarati\s+(?:ma|maa|me|mein|please)\b|ગુજરાતી\s*માં|ગુજરાતી\s*ભાષા)/i;
const REQ_EN_RE = /(?:\b(?:in|into|to|explain\s+in|answer\s+in|reply\s+in|speak\s+in|translate\s+(?:this\s+|it\s+)?(?:in|into|to))\s+english\b|\benglish\s+(?:ma|maa|me|mein|please)\b|અંગ્રેજી\s*માં|ઇંગ્લિશ\s*માં)/i;
const SWITCH_FILLER_RE = /\b(?:explain|answer|reply|speak|tell\s+me|samjavo|kaho|batao|translate|this|it|please|now|in|into|to|ma|maa|me|mein)\b|ગુજરાતી\s*માં|અંગ્રેજી\s*માં|ઇંગ્લિશ\s*માં|સમજાવો|કહો|જણાવો|[?!.,:\-\s]+/gi;

/** Detect input language automatically: 'gu' | 'gujlish' | 'en' | null. */
export function detectChatLanguage(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const guChars = (s.match(/[\u0A80-\u0AFF]/g) || []).length;
  const enChars = (s.match(/[A-Za-z]/g) || []).length;
  if (guChars > 0 && (guChars >= enChars * 0.25 || guChars >= 2)) return 'gu';

  const words = (s.toLowerCase().match(/[a-z]+/g) || []);
  if (!words.length) return null;

  let guHits = 0;
  let enHits = 0;
  let hasFunc = false;
  for (const w of words) {
    if (GUJLISH_FUNC.has(w)) { hasFunc = true; guHits += 1; }
    else if (GUJLISH_ADMIN.has(w)) { guHits += 1; }
    if (EN_CUES.has(w)) enHits += 1;
  }
  if (hasFunc || (guHits >= 2 && enHits === 0) || (guHits > enHits && guHits >= 1)) {
    return 'gujlish';
  }
  return enChars >= 2 ? 'en' : null;
}

/** Detect an explicit language-change phrase like "Explain in Gujarati" or "English ma". */
export function detectLanguageSwitchIntent(text) {
  const s = String(text || '').trim();
  if (!s) return { targetLang: null, isPureSwitch: false, cleanedText: '' };

  const guMatch = s.match(REQ_GU_RE);
  const enMatch = s.match(REQ_EN_RE);
  let targetLang = null;
  if (guMatch && enMatch) {
    targetLang = (guMatch.index ?? 0) > (enMatch.index ?? 0) ? 'gu' : 'en';
  } else if (guMatch) {
    targetLang = 'gu';
  } else if (enMatch) {
    targetLang = 'en';
  }
  if (!targetLang) return { targetLang: null, isPureSwitch: false, cleanedText: s };

  const cleanedText = s
    .replace(REQ_GU_RE, ' ')
    .replace(REQ_EN_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const leftover = s
    .replace(REQ_GU_RE, ' ')
    .replace(REQ_EN_RE, ' ')
    .replace(SWITCH_FILLER_RE, '')
    .trim();
  return {
    targetLang,
    isPureSwitch: leftover.length === 0,
    cleanedText: leftover.length === 0 ? '' : (cleanedText || s),
  };
}

/**
 * Rewrite short follow-up questions using the most recent answered turn so single-turn `/query`
 * keeps conversational context without changing the frozen backend API contract.
 */
export function rewriteFollowUp(input, turns = []) {
  const q = String(input || '').trim();
  if (!q) return '';
  const prev = [...turns].reverse().find((t) => t.role === 'assistant' && t.verdict === 'answered' && t.question);
  if (!prev) return q;

  const wordCount = q.split(/\s+/).filter(Boolean).length;
  const looksLikeFollowUp = wordCount <= 6 || FOLLOW_UP_HINT.test(q);
  const mentionsGr = /\b(?:gr|resolution|rules|act|yojana|yojna|યોજના|ઠરાવ)\b/i.test(q);
  if (!looksLikeFollowUp || (mentionsGr && wordCount > 5)) return q;

  const primary = prev.citations?.[0];
  const ref = primary?.gr_number && primary.gr_number !== 'UNKNOWN' ? primary.gr_number : primary?.gr_id;
  const refTag = ref ? ` [Reference: ${ref}]` : '';
  return `Follow-up to "${prev.question}"${refTag}: ${q}`;
}

/** Resolve user input + history + optional pinned language into exact `/query` payload args. */
export function resolveChatTurn(input, turns = [], pinnedLang = null) {
  const clean = String(input || '').trim();
  const sw = detectLanguageSwitchIntent(clean);
  const detectedInputLang = detectChatLanguage(clean);
  const prev = [...turns].reverse().find((t) => t.role === 'assistant' && t.verdict === 'answered' && t.question);

  if (sw.isPureSwitch && sw.targetLang && prev) {
    return {
      displayText: clean,
      resolvedQuestion: prev.question,
      queryToSend: prev.question,
      effectiveLang: sw.targetLang,
      detectedInputLang: sw.targetLang,
      isLanguageSwitch: true,
      isPureSwitch: true,
    };
  }

  const baseQuery = sw.targetLang && sw.cleanedText ? sw.cleanedText : clean;
  const queryToSend = rewriteFollowUp(baseQuery, turns);
  const effectiveLang = sw.targetLang || (pinnedLang && pinnedLang !== 'auto' ? pinnedLang : null);

  return {
    displayText: clean,
    resolvedQuestion: clean,
    queryToSend,
    effectiveLang,
    detectedInputLang: sw.targetLang || detectedInputLang,
    isLanguageSwitch: Boolean(sw.targetLang),
    isPureSwitch: false,
  };
}

/**
 * Language a reply should be shown in. `replyLang` is the chat's selector: 'en' | 'gu' force it, 'auto' answers in the
 * language the question was asked in (Gujlish counts as Gujarati).
 */
export function replyTargetLang(message, replyLang = 'auto') {
  if (replyLang === 'en' || replyLang === 'gu') return replyLang;
  const asked = detectChatLanguage(message?.question);
  return asked === 'gu' || asked === 'gujlish' ? 'gu' : 'en';
}

/** Determine the actual language of an assistant reply ('gu' or 'en'). */
export function detectReplyLanguage(result, explicitLang = null) {
  const sample = `${result?.summary || ''} ${result?.insufficient_reason || ''}`;
  if (/[\u0A80-\u0AFF]/.test(sample)) return 'gu';
  if (explicitLang === 'gu' || result?.language === 'gu') return 'gu';
  return 'en';
}

/** Shape an `ask()` response into a grounded assistant chat message (never labelling anything "active"). */
export function buildBotMessage(question, result, lang = null) {
  const answered = result?.verdict === 'answered' && Boolean(result?.summary);
  const statusKey = answered ? (result.answer_status || 'no_change') : 'insufficient';
  const statusMeta = STATUS[statusKey] || STATUS.insufficient;
  const reasonLabel = result?.reason_code ? REASONS[result.reason_code] || result.reason_code : null;
  const text = answered
    ? result.summary
    : (result?.insufficient_reason || 'The available Government Resolutions do not cover that question.');
  const replyLang = detectReplyLanguage(result, lang);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'assistant',
    question,
    lang: replyLang,
    verdict: answered ? 'answered' : 'insufficient_evidence',
    answerStatus: statusKey,
    statusLabel: statusMeta.short,
    reasonCode: result?.reason_code || null,
    reasonLabel,
    text,
    citations: result?.citations || [],
    warnings: result?.warnings || [],
    rawResponse: result,
  };
}
