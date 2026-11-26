/**
 * i18n.js — Pure JavaScript translation dictionary & lookup helpers for GovResolve-AI UI.
 *
 * Kept free of React/JSX imports so Node's built-in test runner (`npm test`) can import
 * and verify keys/helpers directly alongside Vite builds.
 *
 * Scope:
 *  - Translates all UI chrome (navigation, headers, labels, tooltips, buttons, dialogs,
 *    landing page, library, method, tour, voice assistant, status taxonomy & shields).
 *  - Leaves official GR body text, OCR passages, GR numbers, and backend-generated
 *    summaries untouched (those follow the backend RAG language).
 */

export const TRANSLATIONS = {
  // ── TopBar ────────────────────────────────────────────────────────────────
  'topbar.subtitle': {
    en: 'PS000230 · Executive Legal Command',
    gu: 'PS000230 · વહીવટી કાયદાકીય કમાન્ડ',
  },
  'topbar.back_to_intro': {
    en: 'Back to the introduction',
    gu: 'પ્રારંભિક પૃષ્ઠ પર જાઓ',
  },
  'topbar.back_to_intro_aria': {
    en: 'GovResolve-AI: back to the introduction',
    gu: 'GovResolve-AI: પ્રારંભિક પૃષ્ઠ પર જાઓ',
  },
  'topbar.ask_placeholder': {
    en: 'Ask about a resolution…',
    gu: 'ઠરાવ વિશે પૂછો…',
  },
  'topbar.focus_question': {
    en: 'Focus the question box',
    gu: 'પ્રશ્ન બૉક્સ પર જાઓ',
  },
  'topbar.system_live': {
    en: 'System Live',
    gu: 'સિસ્ટમ લાઇવ',
  },
  'topbar.offline': {
    en: 'Offline',
    gu: 'ઑફલાઇન',
  },
  'topbar.backend_online': {
    en: 'Backend reachable',
    gu: 'સર્વર જોડાયેલ છે',
  },
  'topbar.backend_offline': {
    en: 'Backend not reachable',
    gu: 'સર્વર જોડાયેલ નથી',
  },
  'topbar.grs': {
    en: 'GRs',
    gu: 'ઠરાવો',
  },
  'topbar.passages': {
    en: 'passages',
    gu: 'ફકરા',
  },
  'topbar.links': {
    en: 'links',
    gu: 'કડીઓ',
  },
  'topbar.ui_lang_label': {
    en: 'Platform UI language',
    gu: 'પ્લેટફોર્મની ભાષા',
  },
  'topbar.ui_lang_title': {
    en: 'Switch platform language (English / ગુજરાતી)',
    gu: 'સંપૂર્ણ પ્લેટફોર્મની ભાષા બદલો (English / ગુજરાતી)',
  },
  'topbar.answer_label': {
    en: 'Answer:',
    gu: 'જવાબ:',
  },
  'topbar.answer_title': {
    en: 'Target language for the answer / પરિણામ ભાષા',
    gu: 'જવાબ માટે પસંદગીની ભાષા',
  },
  'topbar.lang_auto': {
    en: 'Auto',
    gu: 'સ્વયં',
  },
  'topbar.ui_auto': {
    en: 'Auto',
    gu: 'સ્વયં',
  },
  'topbar.lang_en': {
    en: 'English',
    gu: 'English',
  },
  'topbar.lang_gu': {
    en: 'ગુજરાતી',
    gu: 'ગુજરાતી',
  },
  'topbar.lang_gujlish': {
    en: 'Gujlish',
    gu: 'Gujlish',
  },
  'topbar.rules_as_of': {
    en: 'Rules as of',
    gu: 'આ તારીખે નિયમ',
  },
  'topbar.rules_as_of_aria': {
    en: 'View rules as of this date',
    gu: 'આ તારીખ મુજબ નિયમો જુઓ',
  },
  'topbar.timemachine_title': {
    en: 'Rule Time Machine: see which amendments existed on a given day (uses the documents\' issue dates)',
    gu: 'નિયમ ટાઇમ મશીન: કોઈ ચોક્કસ તારીખે કયા સુધારા અમલમાં હતા તે જુઓ',
  },
  'topbar.clear_date': {
    en: 'Clear date',
    gu: 'તારીખ દૂર કરો',
  },
  'topbar.back_to_today': {
    en: 'Back to today',
    gu: 'આજની તારીખ પર પાછા જાઓ',
  },

  // ── Rail / MobileTabs ─────────────────────────────────────────────────────
  'rail.workspaces_aria': {
    en: 'Workspaces',
    gu: 'કાર્યક્ષેત્રો',
  },
  'rail.inquiry': {
    en: 'Inquiry',
    gu: 'પૂછપરછ',
  },
  'rail.library': {
    en: 'Library',
    gu: 'સંગ્રહ',
  },
  'rail.method': {
    en: 'Method',
    gu: 'પદ્ધતિ',
  },
  'rail.tour': {
    en: 'Tour',
    gu: 'માર્ગદર્શન',
  },
  'rail.tour_hint': {
    en: 'Interactive guided tour (?)',
    gu: 'ઇન્ટરેક્ટિવ માર્ગદર્શન ટૂર (?)',
  },
  'rail.keys': {
    en: 'Keys',
    gu: 'શૉર્ટકટ',
  },
  'rail.keys_hint': {
    en: 'Keyboard shortcuts',
    gu: 'કીબોર્ડ શૉર્ટકટ',
  },

  // ── QueryDock ─────────────────────────────────────────────────────────────
  'query.official_inquiry': {
    en: 'Official Inquiry · ગુજરાતી / English / Gujlish',
    gu: 'સત્તાવાર પૂછપરછ · ગુજરાતી / English / Gujlish',
  },
  'query.to_focus': {
    en: 'to focus',
    gu: 'ફૉકસ કરવા',
  },
  'query.placeholder_hero': {
    en: 'Ask about any government resolution, in any language…',
    gu: 'કોઈપણ સરકારી ઠરાવ વિશે તમારી ભાષામાં પ્રશ્ન પૂછો…',
  },
  'query.placeholder_followup': {
    en: 'Ask a follow-up or a new administrative question…',
    gu: 'આગળનો અથવા નવો વહીવટી પ્રશ્ન પૂછો…',
  },
  'query.your_question': {
    en: 'Your question',
    gu: 'તમારો પ્રશ્ન',
  },
  'query.clear': {
    en: 'Clear question',
    gu: 'પ્રશ્ન સાફ કરો',
  },
  'query.clear_input': {
    en: 'Clear input',
    gu: 'લખાણ સાફ કરો',
  },
  'query.searching': {
    en: 'Searching…',
    gu: 'શોધ ચાલુ છે…',
  },
  'query.ask': {
    en: 'Ask',
    gu: 'પૂછો',
  },
  'query.enter_to_send': {
    en: 'Enter to send',
    gu: 'મોકલવા Enter દબાવો',
  },
  'query.gujarati_keyboard': {
    en: 'ગુજરાતી',
    gu: 'કીપૅડ',
  },
  'query.quick_examples': {
    en: 'Quick examples:',
    gu: 'ઝડપી ઉદાહરણો:',
  },
  'query.tpl_gr': {
    en: 'GR No. search',
    gu: 'ઠરાવ નં. શોધ',
  },
  'query.tpl_leave': {
    en: 'Leave rules',
    gu: 'રજાના નિયમો',
  },
  'query.tpl_pay': {
    en: 'Pay & allowances',
    gu: 'પગાર અને ભથ્થાં',
  },
  'query.voice_assistant': {
    en: 'Voice Assistant',
    gu: 'વૉઇસ સહાયક',
  },

  // ── GujaratiKeyboard ──────────────────────────────────────────────────────
  'kb.title': {
    en: 'ગુજરાતી કીબોર્ડ સહાયક',
    gu: 'ગુજરાતી કીબોર્ડ સહાયક',
  },
  'kb.subtitle': {
    en: 'Virtual Keypad',
    gu: 'વર્ચ્યુઅલ કીપૅડ',
  },
  'kb.close': {
    en: 'Close keyboard',
    gu: 'કીબોર્ડ બંધ કરો',
  },
  'kb.sec_numerals': {
    en: 'Numerals · અંકો',
    gu: 'અંકો · Numerals',
  },
  'kb.sec_vowels': {
    en: 'Vowels · સ્વર',
    gu: 'સ્વર · Vowels',
  },
  'kb.sec_consonants': {
    en: 'Consonants · વ્યંજન',
    gu: 'વ્યંજન · Consonants',
  },
  'kb.sec_matras': {
    en: 'Matras & Signs · માત્રાઓ અને ચિહ્નો',
    gu: 'માત્રાઓ અને ચિહ્નો',
  },
  'kb.space': {
    en: 'Space',
    gu: 'જગ્યા (Space)',
  },
  'kb.backspace': {
    en: 'Backspace',
    gu: 'પાછળ કાઢો (Backspace)',
  },

  // ── HistoryMenu ───────────────────────────────────────────────────────────
  'history.label': {
    en: 'History',
    gu: 'ઇતિહાસ',
  },
  'history.title': {
    en: 'Earlier questions this session',
    gu: 'આ સત્રના અગાઉના પ્રશ્નો',
  },
  'history.this_session': {
    en: 'This session',
    gu: 'આ સત્ર',
  },
  'history.clear': {
    en: 'Clear',
    gu: 'સાફ કરો',
  },
  'history.aria': {
    en: 'Earlier questions',
    gu: 'અગાઉના પ્રશ્નો',
  },
  'history.answered': {
    en: 'answered',
    gu: 'જવાબ મળ્યો',
  },
  'history.refused': {
    en: 'refused',
    gu: 'ઇનકાર',
  },
  'history.just_now': {
    en: 'just now',
    gu: 'હમણાં જ',
  },
  'history.min_ago': {
    en: '{n} min ago',
    gu: '{n} મિનિટ પહેલાં',
  },
  'history.hr_ago': {
    en: '{n} h ago',
    gu: '{n} કલાક પહેલાં',
  },

  // ── AskLanding ────────────────────────────────────────────────────────────
  'hero.eyebrow': {
    en: 'Government Resolution Intelligence',
    gu: 'સરકારી ઠરાવ ઇન્ટેલિજન્સ',
  },
  'hero.headline_pre': {
    en: 'Is this rule',
    gu: 'શું આ નિયમ',
  },
  'hero.headline_em': {
    en: 'still',
    gu: 'હજુ પણ',
  },
  'hero.headline_post': {
    en: 'the order to follow?',
    gu: 'અમલ કરવા યોગ્ય છે?',
  },
  'hero.subhead_en': {
    en: 'Ask about any Gujarat Government Resolution. Get a direct answer with the verbatim clause, its page, and every later amendment.',
    gu: 'કોઈપણ ગુજરાત સરકારી ઠરાવ વિશે પૂછો. મૂળ કલમ, પૃષ્ઠ નંબર અને પછીના દરેક સુધારા સાથે સચોટ જવાબ મેળવો.',
  },
  'hero.subhead_gu': {
    en: 'કોઈપણ ઠરાવ વિશે પૂછો: અધિકૃત જવાબ, પાનું, મૂળ લખાણ અને પછીના સુધારા સાથે.',
    gu: 'ગુજરાતી, English કે Gujlish માં પૂછો — દરેક વિધાન મૂળ ઠરાવના પ્રમાણ સાથે.',
  },
  'hero.case_files': {
    en: 'Case files',
    gu: 'નમૂના પ્રશ્નો',
  },
  'hero.open_one': {
    en: 'Open one to see the answer',
    gu: 'જવાબ જોવા માટે એક પસંદ કરો',
  },
  'hero.one_click': {
    en: 'One click · real corpus',
    gu: 'એક ક્લિક · સત્તાવાર સંગ્રહ',
  },
  'hero.feature_lang_title': {
    en: 'Ask in your language',
    gu: 'તમારી ભાષામાં પૂછો',
  },
  'hero.feature_lang_text': {
    en: 'ગુજરાતી, English or Gujlish, matched across Gujarati and English resolutions.',
    gu: 'ગુજરાતી, અંગ્રેજી અથવા ગુજલિશમાં પૂછો — બંને ભાષાના ઠરાવોમાંથી શોધ.',
  },
  'hero.feature_proof_title': {
    en: 'Proof, not prose',
    gu: 'માત્ર વાત નહીં, પુરાવો',
  },
  'hero.feature_proof_text': {
    en: 'Every statement cites the GR number, the page and the exact verbatim paragraph.',
    gu: 'દરેક વિધાન સાથે ઠરાવ નંબર, પૃષ્ઠ અને મૂળ શબ્દશઃ ફકરો ટાંકવામાં આવે છે.',
  },
  'hero.feature_lineage_title': {
    en: 'Amendment lineage',
    gu: 'સુધારાની વંશાવળી',
  },
  'hero.feature_lineage_text': {
    en: 'See which orders amend, supersede or cancel the one you are reading.',
    gu: 'તમે વાંચી રહ્યા છો તે ઠરાવમાં કયા આદેશથી સુધારો કે રદબાતલ થયો તે જુઓ.',
  },
  'hero.feature_refusal_title': {
    en: 'Refuses to guess',
    gu: 'અનુમાન કરતું નથી',
  },
  'hero.feature_refusal_text': {
    en: 'Without sufficient proof you get a coded refusal, never an invention.',
    gu: 'પૂરતા પુરાવા વગર સિસ્ટમ કોડ સાથે ઇનકાર કરે છે, ક્યારેય મનઘડંત જવાબ નહીં.',
  },
  'hero.every_seal': {
    en: 'Every finding carries one seal',
    gu: 'દરેક તારણ પર એક અધિકૃત સીલ હોય છે',
  },
  'hero.reserved_badge': {
    en: 'Reserved · not emitted yet',
    gu: 'અનામત · હાલમાં વપરાતું નથી',
  },
  'hero.no_change_disclaimer': {
    en: '“No later change” means no modifying order was found in the indexed collection. It never claims a rule is in force.',
    gu: '“પછીનો કોઈ ફેરફાર નથી” નો અર્થ એટલો જ કે ઇન્ડેક્સ કરેલા સંગ્રહમાં કોઈ સુધારો મળ્યો નથી. તે નિયમ હાલ અમલમાં હોવાની ખાતરી આપતું નથી.',
  },
  'hero.specimen_badge': {
    en: 'Example · illustrative',
    gu: 'ઉદાહરણ · નમૂનારૂપ',
  },
  'hero.specimen_title': {
    en: 'Recruitment rules: age relaxation',
    gu: 'ભરતી નિયમો: વયમર્યાદામાં છૂટછાટ',
  },
  'hero.specimen_meta': {
    en: 'DOSSIER № EX-0007 · 3 ORDERS IN CHAIN',
    gu: 'ફાઇલ નં. EX-0007 · શ્રૃંખલામાં ૩ આદેશો',
  },
  'hero.specimen_amends': {
    en: 'AMENDS',
    gu: 'સુધારો કરે છે',
  },
  'hero.specimen_quote': {
    en: '“…the upper age limit shall stand relaxed by one year…”',
    gu: '“…ઉપલી વયમર્યાદામાં એક વર્ષની છૂટછાટ આપવામાં આવે છે…”',
  },
  'hero.specimen_footer': {
    en: 'p.2 · verbatim · illustrative text',
    gu: 'પૃ. ૨ · શબ્દશઃ · નમૂનારૂપ લખાણ',
  },

  // ── Library ───────────────────────────────────────────────────────────────
  'library.eyebrow_prefix': {
    en: 'Corpus library',
    gu: 'ઠરાવ સંગ્રહ',
  },
  'library.indexed_resolutions': {
    en: 'indexed resolutions',
    gu: 'ઇન્ડેક્સ થયેલા ઠરાવો',
  },
  'library.title': {
    en: 'Official resolution register',
    gu: 'સત્તાવાર ઠરાવ રજિસ્ટર',
  },
  'library.subtitle': {
    en: 'Search by GR number, subject or year. Open any row to read the source page and trace its amendments.',
    gu: 'ઠરાવ નંબર, વિષય અથવા વર્ષ દ્વારા શોધો. મૂળ પૃષ્ઠ વાંચવા અને સુધારાની શ્રૃંખલા જોવા કોઈપણ હરોળ ખોલો.',
  },
  'library.search_placeholder': {
    en: 'GR number, keyword or year (e.g. CRR, રજા, 2022)…',
    gu: 'ઠરાવ નં., શબ્દ અથવા વર્ષ શોધો (દા.ત. CRR, રજા, 2022)…',
  },
  'library.search_aria': {
    en: 'Search the library',
    gu: 'સંગ્રહમાં શોધો',
  },
  'library.clear_search': {
    en: 'Clear search',
    gu: 'શોધ સાફ કરો',
  },
  'library.all_languages': {
    en: 'All languages',
    gu: 'બધી ભાષાઓ',
  },
  'library.all_statuses': {
    en: 'All',
    gu: 'બધા',
  },
  'library.all_departments': {
    en: 'All departments',
    gu: 'તમામ વિભાગો',
  },
  'library.filter_dept_aria': {
    en: 'Filter by department',
    gu: 'વિભાગ મુજબ ફિલ્ટર કરો',
  },
  'library.newest_first': {
    en: 'Newest first',
    gu: 'નવા પ્રથમ',
  },
  'library.oldest_first': {
    en: 'Oldest first',
    gu: 'જૂના પ્રથમ',
  },
  'library.col_subject': {
    en: 'Subject · GR No.',
    gu: 'વિષય · ઠરાવ નં.',
  },
  'library.col_issued': {
    en: 'Issued',
    gu: 'બહાર પાડ્યા તારીખ',
  },
  'library.col_status': {
    en: 'Status',
    gu: 'સ્થિતિ',
  },
  'library.loading': {
    en: 'Loading indexed resolutions…',
    gu: 'ઇન્ડેક્સ કરેલા ઠરાવો લોડ થઈ રહ્યા છે…',
  },
  'library.retrieve_error': {
    en: 'Could not retrieve resolution index',
    gu: 'ઠરાવ સૂચિ મળી શકી નહીં',
  },
  'library.no_match': {
    en: 'No matching resolutions. Try a GR number (e.g. CRR) or a keyword.',
    gu: 'કોઈ મેળ ખાતો ઠરાવ મળ્યો નથી. ઠરાવ નંબર (દા.ત. CRR) અથવા બીજો શબ્દ અજમાવો.',
  },
  'library.undated': {
    en: 'Undated',
    gu: 'તારીખ ઉપલબ્ધ નથી',
  },
  'library.general_admin': {
    en: 'General Administration',
    gu: 'સામાન્ય વહીવટ વિભાગ',
  },
  'library.status_unknown': {
    en: 'Unknown',
    gu: 'અજ્ઞાત',
  },
  'library.status_note': {
    en: 'Status is derived only from explicit amendment, supersession or cancellation references in the documents.',
    gu: 'સ્થિતિ ફક્ત દસ્તાવેજોમાં રહેલા સુધારા, અવેજી અથવા રદ કરવાના સ્પષ્ટ સંદર્ભો પરથી જ નક્કી થાય છે.',
  },

  // ── StatusBanner & Taxonomy ───────────────────────────────────────────────
  'status.dossier_verdict': {
    en: 'Resolution Status',
    gu: 'ઠરાવ સ્થિતિ',
  },
  'status.no_change_label': {
    en: 'Found + No later change',
    gu: 'મળ્યું · પછીનો ફેરફાર નથી',
  },
  'status.no_change_short': {
    en: 'No later change',
    gu: 'કોઈ ફેરફાર નથી',
  },
  'status.no_change_headline': {
    en: 'No later change found',
    gu: 'પછીનો કોઈ ફેરફાર મળ્યો નથી',
  },
  'status.no_change_note': {
    en: 'Checked only against the indexed documents. This does not prove the rule is still in force: look for newer orders.',
    gu: 'ફક્ત ઉપલબ્ધ ઠરાવોમાં ચકાસેલ છે. આ નિયમ હાલ અમલમાં જ છે તેની ખાતરી નથી: નવા આદેશો જુઓ.',
  },
  'status.amended_label': {
    en: 'Found + Amended',
    gu: 'મળ્યું · સુધારેલ',
  },
  'status.amended_short': {
    en: 'Amended',
    gu: 'સુધારેલ',
  },
  'status.amended_headline': {
    en: 'Caution: an amendment was found',
    gu: 'સાવચેતી: આ ઠરાવમાં સુધારો થયેલ છે',
  },
  'status.amended_note': {
    en: 'Read the amending order together with the original. The lineage below shows which orders change it.',
    gu: 'મૂળ ઠરાવ સાથે સુધારા આદેશ પણ વાંચો. નીચે કયા આદેશથી ફેરફાર થયો છે તે દર્શાવેલ છે.',
  },
  'status.superseded_label': {
    en: 'Found + Superseded',
    gu: 'મળ્યું · રદબાતલ / અવેજી',
  },
  'status.superseded_short': {
    en: 'Superseded',
    gu: 'રદ / અવેજી',
  },
  'status.superseded_headline': {
    en: 'Do not act: order superseded',
    gu: 'અમલ ન કરવો: આ આદેશ રદ થયેલ છે',
  },
  'status.superseded_note': {
    en: 'A later order replaces a cited document. See its successor in the lineage.',
    gu: 'પછીના આદેશથી આ દસ્તાવેજ બદલાયેલ છે. નીચે નવો આદેશ જુઓ.',
  },
  'status.conflict_label': {
    en: 'Conflict',
    gu: 'વિરોધાભાસ',
  },
  'status.conflict_short': {
    en: 'Conflict',
    gu: 'વિરોધાભાસ',
  },
  'status.conflict_headline': {
    en: 'Orders contradict each other',
    gu: 'આદેશો એકબીજાથી વિરોધાભાસી છે',
  },
  'status.conflict_note': {
    en: 'Two orders in the collection say different things. Resolve the conflict before relying on either.',
    gu: 'સંગ્રહમાંના બે આદેશો અલગ-અલગ વાત કહે છે. કોઈપણ પર આધાર રાખતા પહેલા સ્પષ્ટતા કરો.',
  },
  'status.insufficient_label': {
    en: 'Insufficient evidence',
    gu: 'અપૂરતા પુરાવા',
  },
  'status.insufficient_short': {
    en: 'Insufficient evidence',
    gu: 'અપૂરતા પુરાવા',
  },
  'status.insufficient_headline': {
    en: 'The documents cannot establish an answer',
    gu: 'દસ્તાવેજોમાંથી ચોક્કસ જવાબ સાબિત થઈ શકતો નથી',
  },
  'status.insufficient_note': {
    en: 'The system refuses rather than guess.',
    gu: 'અનુમાન કરવાને બદલે સિસ્ટમ ઇનકાર કરે છે.',
  },
  'status.as_of_prefix': {
    en: 'As of {date}:',
    gu: 'તારીખ {date} મુજબ:',
  },
  'status.as_of_not_issued': {
    en: 'the cited document had not been issued yet.',
    gu: 'ટાંકેલો દસ્તાવેજ તે તારીખ સુધી બહાર પાડવામાં આવ્યો ન હતો.',
  },
  'status.as_of_would_show': {
    en: 'this document would have shown “{label}”.',
    gu: 'આ દસ્તાવેજની સ્થિતિ “{label}” હોત.',
  },
  'reason.NO_DOCUMENT': {
    en: 'Not in the collection',
    gu: 'સંગ્રહમાં ઉપલબ્ધ નથી',
  },
  'reason.TOO_VAGUE': {
    en: 'Question too vague',
    gu: 'પ્રશ્ન અસ્પષ્ટ છે',
  },
  'reason.OUT_OF_SCOPE': {
    en: 'Outside what GRs can answer',
    gu: 'ઠરાવોના કાર્યક્ષેત્રની બહાર',
  },
  'reason.MISSING_FACTS': {
    en: 'Facts missing',
    gu: 'વિગતો ખૂટે છે',
  },
  'reason.BROKEN_CHAIN': {
    en: 'Broken amendment chain',
    gu: 'અપૂર્ણ સુધારા શ્રૃંખલા',
  },
  'reason.POOR_SCAN': {
    en: 'Poor scan',
    gu: 'અસ્પષ્ટ સ્કૅન',
  },

  // ── AnswerCard ────────────────────────────────────────────────────────────
  'answer.finding': {
    en: 'Administrative Finding',
    gu: 'મુખ્ય જવાબ',
  },
  'answer.no_finding': {
    en: 'Why No Finding',
    gu: 'જવાબ કેમ મળ્યો નથી',
  },
  'answer.result_lang': {
    en: 'Result language toggle',
    gu: 'જવાબની ભાષા બદલો',
  },
  'answer.show_en_title': {
    en: 'Show answer in English',
    gu: 'જવાબ અંગ્રેજીમાં જુઓ',
  },
  'answer.show_gu_title': {
    en: 'પરિણામ ગુજરાતીમાં જુઓ (Show answer in Gujarati)',
    gu: 'પરિણામ ગુજરાતીમાં જુઓ',
  },
  'answer.verified_badge': {
    en: 'Verified from official text',
    gu: 'સત્તાવાર લખાણમાંથી ચકાસાયેલ',
  },
  'answer.export_memo': {
    en: 'Print / PDF',
    gu: 'પ્રિન્ટ / PDF',
  },
  'answer.export_memo_title': {
    en: 'Export or print Secretariat Action Memorandum',
    gu: 'સત્તાવાર સચિવાલય નોંધ પ્રિન્ટ અથવા PDF તરીકે સાચવો',
  },
  'answer.verbatim_passages': {
    en: 'Verbatim Passages',
    gu: 'મૂળ ફકરા (પુરાવા)',
  },
  'answer.statements': {
    en: 'Statements',
    gu: 'મુખ્ય મુદ્દાઓ',
  },
  'answer.collapse': {
    en: 'Collapse',
    gu: 'બંધ કરો',
  },
  'answer.expand': {
    en: 'Expand',
    gu: 'ખોલો',
  },
  'answer.locked_on_page': {
    en: 'Showing on right',
    gu: 'બાજુમાં ખૂલેલ છે',
  },
  'answer.lock_on_page': {
    en: 'Open passage',
    gu: 'પૂરો ફકરો જુઓ',
  },
  'answer.translate_gu': {
    en: 'ગુજરાતી અર્થ જુઓ',
    gu: 'ગુજરાતી અર્થ જુઓ',
  },
  'answer.translate_en': {
    en: 'English meaning',
    gu: 'અંગ્રેજી અર્થ જુઓ',
  },
  'answer.hide_translation': {
    en: 'Hide meaning',
    gu: 'અર્થ છુપાવો',
  },
  'answer.translating': {
    en: 'Translating…',
    gu: 'અનુવાદ થાય છે…',
  },
  'answer.translation_helper_gu': {
    en: 'Gujarati meaning (official quote kept verbatim above):',
    gu: 'ગુજરાતી અર્થ (મૂળ સત્તાવાર લખાણ ઉપર દર્શાવેલ છે):',
  },
  'answer.translation_helper_en': {
    en: 'English meaning (official quote kept verbatim above):',
    gu: 'અંગ્રેજી અર્થ (મૂળ સત્તાવાર લખાણ ઉપર દર્શાવેલ છે):',
  },
  'answer.cited_in': {
    en: 'Cited in',
    gu: 'આ ઠરાવમાંથી:',
  },
  'answer.label_established': {
    en: 'Established',
    gu: 'સીધો પુરાવો',
  },
  'answer.label_established_note': {
    en: 'Directly supported by a cited passage',
    gu: 'મૂળ ફકરામાં સીધું લખેલું છે',
  },
  'answer.label_inferred': {
    en: 'Inferred',
    gu: 'અનુમાનિત',
  },
  'answer.label_inferred_note': {
    en: 'Reasoned from the passages, not stated in them',
    gu: 'ફકરા પરથી તારવેલ મુદ્દો',
  },
  'answer.label_unverified': {
    en: 'Unverified',
    gu: 'અચકાસાયેલ',
  },
  'answer.label_unverified_note': {
    en: 'Not found in the documents',
    gu: 'દસ્તાવેજમાં મળ્યું નથી',
  },
  'answer.evidence_views_aria': {
    en: 'Evidence views',
    gu: 'પુરાવા દૃશ્ય',
  },

  // ── TrustShield ───────────────────────────────────────────────────────────
  'trust.title': {
    en: 'Trust Shield',
    gu: 'પુરાવાની ખાતરી',
  },
  'trust.nothing_guessed': {
    en: 'Nothing was guessed.',
    gu: 'કોઈ અનુમાન કરવામાં આવ્યું નથી.',
  },
  'trust.nothing_guessed_sub': {
    en: 'No passage met the evidence bar, so no answer was written and no quote was shown.',
    gu: 'કોઈપણ ફકરો પુરાવાના ધોરણ પર ખરો ઊતર્યો નથી, તેથી કોઈ જવાબ આપવામાં આવ્યો નથી.',
  },
  'trust.verbatim_quote_one': {
    en: '{n} verbatim quote',
    gu: '{n} મૂળ ઉદ્ધરણ',
  },
  'trust.verbatim_quote_many': {
    en: '{n} verbatim quotes',
    gu: '{n} મૂળ ઉદ્ધરણો',
  },
  'trust.verbatim_sub': {
    en: 'copied from the source page, with page and date',
    gu: 'મૂળ પૃષ્ઠ નંબર અને તારીખ સાથે લીધેલ',
  },
  'trust.res_one': {
    en: '{n} resolution cited',
    gu: '{n} ઠરાવમાંથી',
  },
  'trust.res_many': {
    en: '{n} resolutions cited',
    gu: '{n} ઠરાવોમાંથી',
  },
  'trust.issued_span': {
    en: 'issued {span}',
    gu: 'તારીખ: {span}',
  },
  'trust.lineage_checked': {
    en: 'Amendment history checked',
    gu: 'પછીના સુધારા તપાસેલ',
  },
  'trust.lineage_sup_amd': {
    en: '{sup} superseded · {amd} amended: read the warning',
    gu: '{sup} રદ · {amd} સુધારેલ: ચેતવણી વાંચો',
  },
  'trust.lineage_unknown': {
    en: '{unk} could not be placed in a chain',
    gu: '{unk} ની કડી મળી શકી નથી',
  },
  'trust.lineage_none': {
    en: 'no later amendment found in the collection',
    gu: 'સંગ્રહમાં પછીનો કોઈ સુધારો મળ્યો નથી',
  },
  'trust.est_inf': {
    en: '{est} established · {inf} inferred',
    gu: '{est} સીધો પુરાવો · {inf} તારણ',
  },
  'trust.est_only_sub': {
    en: 'every statement is stated in a cited passage',
    gu: 'દરેક મુદ્દો મૂળ ફકરામાં સીધો દર્શાવેલ છે',
  },
  'trust.inf_sub': {
    en: 'inferred statements are reasoned, not stated in the text',
    gu: 'કેટલાક મુદ્દા ફકરા પરથી તારવેલા છે',
  },

  // ── LineageGraph ──────────────────────────────────────────────────────────
  'lineage.title': {
    en: 'Amendment history',
    gu: 'સુધારા ઇતિહાસ',
  },
  'lineage.aria': {
    en: 'Amendment history',
    gu: 'સુધારા ઇતિહાસ',
  },
  'lineage.order': {
    en: 'order',
    gu: 'આદેશ',
  },
  'lineage.orders': {
    en: 'orders',
    gu: 'આદેશો',
  },
  'lineage.direction': {
    en: 'newer → older',
    gu: 'નવો → જૂનો',
  },
  'lineage.chain_of': {
    en: 'chain of {gr}',
    gu: '{gr} ની શ્રૃંખલા',
  },
  'lineage.as_of_badge': {
    en: 'as of {date} · {issued}/{total} issued',
    gu: 'તારીખ {date} મુજબ · {issued}/{total} બહાર પડેલ',
  },
  'lineage.map': {
    en: 'Map',
    gu: 'નકશો',
  },
  'lineage.ledger': {
    en: 'Ledger',
    gu: 'યાદી',
  },
  'lineage.view_aria': {
    en: 'Lineage view',
    gu: 'વંશાવળી દૃશ્ય',
  },
  'lineage.not_in_corpus': {
    en: 'Not in corpus',
    gu: 'સંગ્રહમાં નથી',
  },
  'lineage.not_yet_issued': {
    en: 'Not yet issued',
    gu: 'હજુ બહાર પડ્યો નથી',
  },
  'lineage.open_pill': {
    en: 'Open',
    gu: 'ખુલ્લું',
  },
  'lineage.today': {
    en: 'today',
    gu: 'આજે',
  },
  'lineage.as_of_handle': {
    en: 'as of {date}',
    gu: '{date} મુજબ',
  },
  'lineage.open_page': {
    en: 'Open page {page}',
    gu: 'પૃષ્ઠ {page} ખોલો',
  },
  'lineage.no_clause': {
    en: 'No verbatim sentence was stored for this link.',
    gu: 'આ કડી માટે કોઈ શબ્દશઃ વાક્ય સંગ્રહિત નથી.',
  },
  'lineage.no_links_found': {
    en: 'No amendment, supersession or cancellation links were found for this document in the indexed collection.',
    gu: 'ઇન્ડેક્સ કરેલા સંગ્રહમાં આ દસ્તાવેજ માટે કોઈ સુધારો, અવેજી કે રદબાતલની કડી મળી નથી.',
  },
  'lineage.select_link_hint': {
    en: 'Select a link to read the exact clause that created it.',
    gu: 'કડી બનાવનાર ચોક્કસ કલમ વાંચવા માટે કડી પસંદ કરો.',
  },
  'lineage.drag_hint': {
    en: 'Drag the handle to see the chain on any date.',
    gu: 'કોઈપણ તારીખની સ્થિતિ જોવા નીચેનો હેન્ડલ ખસેડો.',
  },
  'lineage.no_links_chain': {
    en: 'No amendment links in this chain.',
    gu: 'આ શ્રૃંખલામાં કોઈ સુધારા કડી નથી.',
  },

  // ── PdfInspector ──────────────────────────────────────────────────────────
  'pdf.empty_title': {
    en: 'Document Viewer',
    gu: 'દસ્તાવેજ નિરીક્ષક',
  },
  'pdf.empty_desc': {
    en: 'Select any citation or resolution on the left to read the source page and highlighted passage.',
    gu: 'મૂળ પૃષ્ઠ અને હાઇલાઇટ કરેલ ફકરો વાંચવા ડાબી બાજુથી કોઈપણ સંદર્ભ અથવા ઠરાવ પસંદ કરો.',
  },
  'pdf.empty_keys': {
    en: 'step through cited passages',
    gu: 'ટાંકેલા ફકરાઓ વચ્ચે ફેરવો',
  },
  'pdf.gr_number': {
    en: 'GR Number',
    gu: 'ઠરાવ નંબર',
  },
  'pdf.issue_date': {
    en: 'Issue Date',
    gu: 'તારીખ',
  },
  'pdf.department': {
    en: 'Department',
    gu: 'વિભાગ',
  },
  'pdf.official_gr': {
    en: 'Official GR',
    gu: 'સત્તાવાર ઠરાવ',
  },
  'pdf.locked_strip': {
    en: 'Cited passage · Page {page}',
    gu: 'ટાંકેલ ફકરો · પૃષ્ઠ {page}',
  },
  'pdf.prev_page': {
    en: 'Previous page',
    gu: 'પાછલું પૃષ્ઠ',
  },
  'pdf.next_page': {
    en: 'Next page',
    gu: 'આગલું પૃષ્ઠ',
  },
  'pdf.zoom_out': {
    en: 'Zoom out',
    gu: 'નાનું કરો',
  },
  'pdf.zoom_in': {
    en: 'Zoom in',
    gu: 'મોટું કરો',
  },
  'pdf.zoom_reset': {
    en: 'Reset zoom to 100%',
    gu: 'ઝૂમ ૧૦૦%',
  },
  'pdf.view_scan': {
    en: 'Scan',
    gu: 'સ્કૅન',
  },
  'pdf.view_scan_title': {
    en: 'Scanned PDF view',
    gu: 'PDF સ્કૅન જુઓ',
  },
  'pdf.view_text': {
    en: 'Text',
    gu: 'લખાણ',
  },
  'pdf.view_text_title': {
    en: 'Document text view',
    gu: 'ઠરાવનું લખાણ જુઓ',
  },
  'pdf.copy_citation': {
    en: 'Copy citation',
    gu: 'સંદર્ભ કૉપિ કરો',
  },
  'pdf.cite_btn': {
    en: 'Cite',
    gu: 'નકલ',
  },
  'pdf.copied_citation': {
    en: 'Citation copied',
    gu: 'સંદર્ભ કૉપિ થયો',
  },
  'pdf.report_wrong': {
    en: 'Report issue with this citation',
    gu: 'આ સંદર્ભમાં ભૂલ જણાવો',
  },
  'pdf.report_btn': {
    en: 'Report',
    gu: 'ભૂલ',
  },
  'pdf.copied_report': {
    en: 'Report copied',
    gu: 'માહિતી કૉપિ થઈ',
  },
  'pdf.open_raw': {
    en: 'Open PDF file',
    gu: 'મૂળ PDF ખોલો',
  },
  'pdf.raw_btn': {
    en: 'PDF',
    gu: 'PDF',
  },
  'pdf.clipboard_error': {
    en: 'Clipboard action not permitted',
    gu: 'ક્લિપબોર્ડની મંજૂરી નથી',
  },
  'pdf.scan_unavailable': {
    en: 'Source scan unavailable',
    gu: 'મૂળ PDF ઉપલબ્ધ નથી',
  },
  'pdf.text_fallback_note': {
    en: 'Original PDF file is not stored locally · showing verified extracted GR text.',
    gu: 'મૂળ PDF ફાઇલ સ્થાનિક રીતે સંગ્રહિત નથી · નીચે ચકાસેલ ઠરાવ લખાણ દર્શાવેલ છે.',
  },
  'pdf.scan_fallback_msg': {
    en: 'The original PDF document is not cached locally. The verified OCR quote is displayed below.',
    gu: 'મૂળ PDF દસ્તાવેજ સ્થાનિક રીતે સંગ્રહિત નથી.',
  },
  'pdf.read_ocr': {
    en: 'Read document text',
    gu: 'લખાણ વાંચો',
  },
  'pdf.raw_ocr_page': {
    en: 'Document text · Page {page}',
    gu: 'દસ્તાવેજ લખાણ · પૃષ્ઠ {page}',
  },
  'pdf.blocks': {
    en: '{n} sections',
    gu: '{n} ફકરા',
  },
  'pdf.no_blocks': {
    en: 'No text blocks stored for this page.',
    gu: 'આ પૃષ્ઠ માટે લખાણ ઉપલબ્ધ નથી.',
  },
  'pdf.lock_label': {
    en: 'Cited · p.{page}',
    gu: 'ટાંકેલ · પૃ.{page}',
  },

  // ── PipelineLoader ────────────────────────────────────────────────────────
  'loader.working': {
    en: 'Working',
    gu: 'પ્રક્રિયા ચાલુ છે',
  },
  'loader.title': {
    en: 'Investigating the resolutions',
    gu: 'ઠરાવોની તપાસ ચાલી રહી છે',
  },
  'loader.subtitle': {
    en: 'Local models can take up to a minute. Nothing is shown until every quote is verified.',
    gu: 'દરેક ઉદ્ધરણની સત્યતા ચકાસ્યા બાદ જ જવાબ બતાવવામાં આવશે.',
  },
  'loader.elapsed': {
    en: 'elapsed',
    gu: 'વીતેલો સમય',
  },
  'loader.stage1_label': {
    en: 'Reading the question',
    gu: 'પ્રશ્નનું વિશ્લેષણ',
  },
  'loader.stage1_detail': {
    en: 'Detecting language, expanding legal synonyms',
    gu: 'ભાષાની ઓળખ અને કાયદાકીય સમાનાર્થી શબ્દોનું વિસ્તરણ',
  },
  'loader.stage2_label': {
    en: 'Searching the collection',
    gu: 'ઠરાવ સંગ્રહમાં શોધ',
  },
  'loader.stage2_detail': {
    en: 'Fusing keyword hits with semantic embeddings',
    gu: 'કીવર્ડ અને અર્થ આધારિત શોધનો સમન્વય',
  },
  'loader.stage3_label': {
    en: 'Tracing amendment lineage',
    gu: 'સુધારાની વંશાવળીની તપાસ',
  },
  'loader.stage3_detail': {
    en: 'Following explicit amend / supersede references',
    gu: 'સુધારો અને રદબાતલના સ્પષ્ટ સંદર્ભોની ચકાસણી',
  },
  'loader.stage4_label': {
    en: 'Checking quotes against the page',
    gu: 'મૂળ પૃષ્ઠ સાથે ઉદ્ધરણની ચકાસણી',
  },
  'loader.stage4_detail': {
    en: 'Every quote must appear verbatim in the source text',
    gu: 'દરેક ઉદ્ધરણ મૂળ દસ્તાવેજમાં શબ્દશઃ હોવું આવશ્યક છે',
  },
  'loader.footnote': {
    en: 'Stages show the usual order; the server does not report live progress.',
    gu: 'આ તબક્કા સામાન્ય ક્રમ દર્શાવે છે.',
  },
  'loader.cancel': {
    en: 'Cancel',
    gu: 'રદ કરો',
  },

  // ── Method ────────────────────────────────────────────────────────────────
  'method.eyebrow': {
    en: 'Method & architecture',
    gu: 'પદ્ધતિ અને માળખું',
  },
  'method.title': {
    en: 'From a question to verifiable proof',
    gu: 'પ્રશ્નથી લઈને ચકાસી શકાય તેવા પુરાવા સુધી',
  },
  'method.subtitle': {
    en: 'Five stages, built so that a wrong answer is far more likely to be a refusal than an invention. Below: what each stage does, how it scored, and the rules it can never break.',
    gu: 'પાંચ તબક્કા, જેથી અપૂરતી માહિતીમાં ખોટો જવાબ આપવાને બદલે ઇનકાર થાય. દરેક તબક્કાની કામગીરી, પરિણામ અને અટલ નિયમો નીચે મુજબ છે.',
  },
  'method.stage': {
    en: 'Stage {n}',
    gu: 'તબક્કો {n}',
  },
  'method.s1_t': { en: 'Understand', gu: 'સમજવું' },
  'method.s1_b': {
    en: 'Detects ગુજરાતી, English or Gujlish and normalises legal synonyms so a question matches both Gujarati and English GRs.',
    gu: 'ગુજરાતી, English કે Gujlish ઓળખે છે અને ગુજરાતી તથા અંગ્રેજી બંને ઠરાવો સાથે મેળવવા કાયદાકીય શબ્દોનું સંયોજન કરે છે.',
  },
  'method.s2_t': { en: 'Retrieve', gu: 'શોધવું' },
  'method.s2_b': {
    en: 'BM25 keyword search fused with dense embeddings across the indexed passages. A GR number routes straight to that document.',
    gu: 'ઇન્ડેક્સ કરેલા ફકરાઓમાં કીવર્ડ અને અર્થ આધારિત શોધ. ઠરાવ નંબર આપવાથી સીધો તે દસ્તાવેજ ખૂલે છે.',
  },
  'method.s3_t': { en: 'Select evidence', gu: 'પુરાવા પસંદગી' },
  'method.s3_b': {
    en: 'Candidate passages compete for a fixed token budget. OCR noise and form boilerplate are filtered out.',
    gu: 'યોગ્ય ફકરાઓની પસંદગી થાય છે અને OCR અશુદ્ધિઓ કે બિનજરૂરી લખાણ દૂર કરવામાં આવે છે.',
  },
  'method.s4_t': { en: 'Formulate', gu: 'તારણ તૈયાર કરવું' },
  'method.s4_b': {
    en: 'The model writes findings grounded in numbered evidence. Each statement is labelled Established or Inferred.',
    gu: 'પુરાવાના આધારે તારણ લખાય છે. દરેક વિધાનને સ્થાપિત અથવા અનુમાનિત તરીકે દર્શાવાય છે.',
  },
  'method.s5_t': { en: 'Verify & trace', gu: 'ચકાસણી અને વંશાવળી' },
  'method.s5_b': {
    en: 'Every quote is checked verbatim on its page, lineage is attached from explicit references, and missing proof becomes a refusal.',
    gu: 'દરેક ઉદ્ધરણ મૂળ પૃષ્ઠ પર ચકાસાય છે, સુધારાની શ્રૃંખલા જોડાય છે અને પુરાવા વિના ઇનકાર થાય છે.',
  },
  'method.scorecard': {
    en: 'Scorecard',
    gu: 'ગુણવત્તા માપદંડ',
  },
  'method.scorecard_sub': {
    en: 'Local model qwen3.5:4b. The dev set (50 questions) was used to tune the code, so read the held-out column as the better guide. 16 questions is a small sample.',
    gu: 'મૂળભૂત મૂલ્યાંકન અહેવાલ (Dev ૫૦ પ્રશ્નો અને Held-out ૧૬ પ્રશ્નો પર).',
  },
  'method.col_metric': { en: 'Metric', gu: 'માપદંડ' },
  'method.col_dev': { en: 'Dev · 50 q', gu: 'Dev · ૫૦ પ્રશ્નો' },
  'method.col_held': { en: 'Held-out · 16 q', gu: 'Held-out · ૧૬ પ્રશ્નો' },
  'method.r1': { en: 'Correct document first', gu: 'પ્રથમ ક્રમે સાચો દસ્તાવેજ' },
  'method.r2': { en: 'Correct document in first three', gu: 'પ્રથમ ત્રણમાં સાચો દસ્તાવેજ' },
  'method.r3': { en: 'Answerable questions answered correctly', gu: 'જવાબયોગ્ય પ્રશ્નોના સાચા ઉત્તર' },
  'method.r4': { en: 'Citation on the gold page', gu: 'સાચા પૃષ્ઠ પર સંદર્ભ' },
  'method.r5': { en: 'Quote verbatim on its page', gu: 'મૂળ પૃષ્ઠ પર શબ્દશઃ ઉદ્ધરણ' },
  'method.r6': { en: 'Unanswerable questions refused, right reason code', gu: 'અનુત્તર પ્રશ્નોનો સાચા કોડ સાથે ઇનકાર' },
  'method.r7': { en: 'Median / p95 seconds per answer', gu: 'જવાબ દીઠ સરેરાશ / p95 સેકન્ડ' },
  'method.scorecard_foot': {
    en: 'Lineage: precision 0.972 and recall 0.972 on 71 English amendment pairs (not yet officer-verified; Gujarati lineage is a known gap). Gold questions were drafted by Claude and are not officer-validated. Hosted-model latency of 9–11 s is measured on one partial run.',
    gu: 'વંશાવળી: ૭૧ અંગ્રેજી સુધારા જોડીઓ પર ૦.૯૭૨ ચોકસાઈ. હાલમાં અધિકારી દ્વારા ચકાસણી બાકી છે.',
  },
  'method.indexed_kb': {
    en: 'Indexed knowledge base',
    gu: 'ઇન્ડેક્સ થયેલ જ્ઞાન-ભંડાર',
  },
  'method.grs': {
    en: 'Government resolutions',
    gu: 'સરકારી ઠરાવો',
  },
  'method.passages': {
    en: 'Text passages indexed',
    gu: 'ઇન્ડેક્સ થયેલા ફકરા',
  },
  'method.links': {
    en: 'Lineage links found',
    gu: 'મળેલી સુધારા કડીઓ',
  },
  'method.kb_foot': {
    en: 'Bilingual General Administration and Finance resolutions, read with Gujarati + English OCR.',
    gu: 'સામાન્ય વહીવટ અને નાણાં વિભાગના દ્વિભાષી ઠરાવો, ગુજરાતી અને અંગ્રેજી OCR સહિત.',
  },
  'method.invariants': {
    en: 'Five articles the system cannot break',
    gu: 'પાંચ અટલ નિયમો જે સિસ્ટમ ક્યારેય તોડતી નથી',
  },
  'method.a1_t': { en: 'Never says a rule is in force', gu: 'નિયમ અમલમાં છે તેવો દાવો ક્યારેય નહીં' },
  'method.a1_b': { en: '“No later change” only means none was found in the indexed collection. Absence of an amendment is not proof of validity.', gu: '“પછીનો કોઈ ફેરફાર નથી” નો અર્થ માત્ર એ જ છે કે સંગ્રહમાં સુધારો મળ્યો નથી; તે અમલીકરણની ખાતરી નથી.' },
  'method.a2_t': { en: 'Explicit references only', gu: 'ફક્ત સ્પષ્ટ સંદર્ભો જ' },
  'method.a2_b': { en: 'A GR is amended or superseded only when a later order says so in words. Similarity never creates a link.', gu: 'પછીના આદેશમાં સ્પષ્ટ શબ્દોમાં ઉલ્લેખ હોય તો જ સુધારો કે અવેજી ગણાય; માત્ર સમાનતાથી કડી બનતી નથી.' },
  'method.a3_t': { en: 'Newer acts on older', gu: 'નવો આદેશ જૂના પર અસર કરે' },
  'method.a3_b': { en: 'Every link points from the modifying order to the prior order it changes.', gu: 'દરેક કડી સુધારો કરનાર નવા આદેશથી મૂળ જૂના આદેશ તરફ નિર્દેશ કરે છે.' },
  'method.a4_t': { en: 'Quotes are verbatim', gu: 'ઉદ્ધરણો સંપૂર્ણ શબ્દશઃ' },
  'method.a4_b': { en: 'A cited passage must appear exactly in the page text of the source document, or it is dropped.', gu: 'ટાંકેલો ફકરો મૂળ દસ્તાવેજના પૃષ્ઠમાં શબ્દશઃ હોવો જોઈએ, નહીંતર તે રદ કરવામાં આવે છે.' },
  'method.a5_t': { en: 'Refuse rather than guess', gu: 'અનુમાન કરવા કરતાં ઇનકાર શ્રેષ્ઠ' },
  'method.a5_b': { en: 'Without sufficient evidence the answer is a refusal with a standard reason code. No legal advice, no predictions.', gu: 'પૂરતા પુરાવા વગર ચોક્કસ કારણ કોડ સાથે ઇનકાર કરવામાં આવે છે — કોઈ કાનૂની સલાહ કે અટકળ નહીં.' },

  // ── Tour ──────────────────────────────────────────────────────────────────
  'tour.progress': {
    en: 'Tour · {n} of {total}',
    gu: 'માર્ગદર્શન · {n} / {total}',
  },
  'tour.aria': {
    en: 'Guided tour',
    gu: 'માર્ગદર્શિત ટૂર',
  },
  'tour.welcome_title': {
    en: 'A two-minute walk',
    gu: 'બે મિનિટની સફર',
  },
  'tour.welcome_text': {
    en: 'We will ask one question for you, then follow the answer from its verdict down to the page it came from. The answer is produced by the same system you are about to use.',
    gu: 'અમે તમારા માટે એક પ્રશ્ન પૂછીશું, અને પછી ચુકાદાથી લઈને મૂળ પૃષ્ઠ સુધીનો જવાબ જોઈશું.',
  },
  'tour.rail_title': {
    en: 'Three workspaces',
    gu: 'ત્રણ કાર્યક્ષેત્રો',
  },
  'tour.rail_text': {
    en: 'Inquiry is where you ask. The Library lists every indexed resolution with its status. Method shows how answers are built and how they scored in our own tests.',
    gu: 'પૂછપરછમાં પ્રશ્ન પૂછો. સંગ્રહમાં તમામ ઠરાવો અને તેમની સ્થિતિ જુઓ. પદ્ધતિમાં જવાબ કઈ રીતે બને છે તે જાણો.',
  },
  'tour.ask_title': {
    en: 'Ask in any language',
    gu: 'કોઈપણ ભાષામાં પૂછો',
  },
  'tour.ask_text': {
    en: 'Gujarati, English, or a mix. We are typing a sample question now. The on-screen Gujarati keypad is one tap away, and the language switch in the header can pin the language.',
    gu: 'ગુજરાતી, English અથવા મિશ્ર ભાષામાં. ઑન-સ્ક્રીન ગુજરાતી કીપૅડ એક ક્લિક દૂર છે અને ઉપરના ભાષા બટનથી ભાષા પસંદ કરી શકાય છે.',
  },
  'tour.verdict_title': {
    en: 'The verdict comes first',
    gu: 'પ્રથમ આવે છે ચુકાદો',
  },
  'tour.verdict_text': {
    en: 'Every answer opens with a seal: No later change, Amended, Superseded, Conflict or Insufficient evidence. It describes the documents we hold. It never claims a rule is in force.',
    gu: 'દરેક જવાબ એક સીલ સાથે શરૂ થાય છે. તે સંગ્રહમાંના દસ્તાવેજોની સ્થિતિ દર્શાવે છે, નિયમ અમલમાં હોવાનો દાવો નથી કરતું.',
  },
  'tour.finding_title': {
    en: 'The finding and its Trust Shield',
    gu: 'તારણ અને વિશ્વસનીયતા કવચ',
  },
  'tour.finding_text': {
    en: 'Statements are labelled Established or Inferred. The Trust Shield counts the verbatim quotes, the resolutions behind them and the lineage checks that were run.',
    gu: 'વિધાનોને સ્થાપિત કે અનુમાનિત તરીકે દર્શાવાય છે. વિશ્વસનીયતા કવચ શબ્દશઃ ઉદ્ધરણો અને સુધારા-તપાસની ગણતરી બતાવે છે.',
  },
  'tour.passages_title': {
    en: 'Verbatim passages',
    gu: 'શબ્દશઃ ઉદ્ધરણો',
  },
  'tour.passages_text': {
    en: 'Each quote is copied from the source page with its GR number, issue date and page. Select one to lock it on the original document.',
    gu: 'દરેક ઉદ્ધરણ ઠરાવ નંબર, તારીખ અને પૃષ્ઠ સાથે મૂળ પાના પરથી લીધેલું છે. મૂળ દસ્તાવેજ પર જોવા માટે કોઈપણ પસંદ કરો.',
  },
  'tour.evidence_title': {
    en: 'The page, with the paragraph locked',
    gu: 'મૂળ પૃષ્ઠ પર ફકરો ચિહ્નિત',
  },
  'tour.evidence_text': {
    en: 'The original opens on the cited page with the exact paragraph framed. Switch between Scan and Text to compare the original with the OCR, or copy a court-ready citation.',
    gu: 'મૂળ દસ્તાવેજનું ટાંકેલું પૃષ્ઠ ચોક્કસ ફકરાના ફ્રૅમ સાથે ખૂલે છે. સ્કૅન અને લખાણ વચ્ચે સ્વિચ કરો કે અદાલતી સંદર્ભ કૉપિ કરો.',
  },
  'tour.lineage_title': {
    en: 'What happened next',
    gu: 'પછી શું ફેરફારો થયા',
  },
  'tour.lineage_text': {
    en: 'Arrows run from the newer order to the older one it changes. Click a link to read the clause behind it, and drag the handle underneath to see the chain as it stood on any date.',
    gu: 'તીર નવા આદેશથી જૂના આદેશ તરફ જાય છે. કલમ વાંચવા કડી પર ક્લિક કરો અને તારીખ બદલવા નીચેનો હેન્ડલ ખસેડો.',
  },
  'tour.timemachine_title': {
    en: 'Rules as of any day',
    gu: 'કોઈપણ દિવસની સ્થિતિ',
  },
  'tour.timemachine_text': {
    en: 'Choose a date and every status is recomputed from the orders\' own issue dates. Orders issued later are dimmed as not yet issued.',
    gu: 'કોઈપણ તારીખ પસંદ કરો અને આદેશોની તારીખ પ્રમાણે દરેક સ્થિતિ ફરી ગણાશે.',
  },
  'tour.library_title': {
    en: 'The Library',
    gu: 'ઠરાવ સંગ્રહ (Library)',
  },
  'tour.library_text': {
    en: 'Search by GR number, subject or year, and filter by language, department and status. Open a row to read the document and trace its amendments.',
    gu: 'ઠરાવ નંબર, વિષય અથવા વર્ષ દ્વારા શોધો અને ભાષા, વિભાગ તથા સ્થિતિ મુજબ ફિલ્ટર કરો.',
  },
  'tour.done_title': {
    en: 'That is the whole loop',
    gu: 'સંપૂર્ણ પ્રક્રિયા પૂર્ણ',
  },
  'tour.done_text': {
    en: 'Ask, read the verdict, check the quote on its page, follow the chain. Your sample answer is still on screen. Ask your own question next, or press ? any time to replay this tour.',
    gu: 'પૂછો, ચુકાદો વાંચો, મૂળ પૃષ્ઠ પર ઉદ્ધરણ ચકાસો અને શ્રૃંખલા જુઓ. ફરી ટૂર જોવા ? દબાવો.',
  },
  'tour.cta_open': {
    en: 'Open the application',
    gu: 'એપ્લિકેશન ખોલો',
  },
  'tour.waiting': {
    en: 'Waiting for the answer. A local model can take up to a minute.',
    gu: 'જવાબની રાહ જોવાઈ રહી છે…',
  },
  'tour.skip_part': {
    en: 'Skip this part',
    gu: 'આ ભાગ છોડો',
  },
  'tour.answer_in': {
    en: 'The answer is in.',
    gu: 'જવાબ આવી ગયો છે.',
  },
  'tour.skip': {
    en: 'Skip tour',
    gu: 'ટૂર છોડો',
  },
  'tour.back': {
    en: 'Back',
    gu: 'પાછળ',
  },
  'tour.start': {
    en: 'Start the tour',
    gu: 'ટૂર શરૂ કરો',
  },
  'tour.next': {
    en: 'Next',
    gu: 'આગળ',
  },
  'tour.close': {
    en: 'Close tour',
    gu: 'ટૂર બંધ કરો',
  },

  // ── ChatHelpline (Voice Assistant) ────────────────────────────────────────
  'chat.fab_label': {
    en: 'GR Voice · ગુજરાતી / EN',
    gu: 'વૉઇસ સહાયક · ગુજરાતી / EN',
  },
  'chat.fab_aria': {
    en: 'Open Voice Assistant and Helpline',
    gu: 'વૉઇસ સહાયક અને હેલ્પલાઇન ખોલો',
  },
  'chat.dialog_aria': {
    en: 'GovResolve-AI Voice Assistant & Helpline',
    gu: 'GovResolve-AI વૉઇસ સહાયક અને હેલ્પલાઇન',
  },
  'chat.title_suffix': {
    en: 'Voice',
    gu: 'વૉઇસ',
  },
  'chat.subtitle': {
    en: 'Press-to-speak GR assistant · Auto Language',
    gu: 'બોલીને પૂછો · સ્વયં ભાષા ઓળખ',
  },
  'chat.new_convo': {
    en: 'New conversation',
    gu: 'નવી વાતચીત',
  },
  'chat.close': {
    en: 'Close voice assistant',
    gu: 'વૉઇસ સહાયક બંધ કરો',
  },
  'chat.welcome_title': {
    en: 'નમસ્તે! GovResolve-AI Voice Assistant.',
    gu: 'નમસ્તે! GovResolve-AI વૉઇસ સહાયક.',
  },
  'chat.welcome_desc_prefix': {
    en: 'Press the mic to ask aloud in ગુજરાતી, English, or Gujlish—press again when done, or tap a topic:',
    gu: 'માઇક દબાવીને ગુજરાતી, English અથવા Gujlish માં બોલો — પૂરું થાય એટલે ફરી દબાવો, અથવા વિષય પસંદ કરો:',
  },
  'chat.reply_lang_aria': {
    en: 'Voice reply language',
    gu: 'વૉઇસ જવાબની ભાષા',
  },
  'chat.checking': {
    en: 'Checking official resolutions…',
    gu: 'સત્તાવાર ઠરાવો ચકાસી રહ્યા છીએ…',
  },
  'chat.stop': {
    en: 'Stop',
    gu: 'રોકો',
  },
  'chat.unavailable': {
    en: 'Unavailable',
    gu: 'ઉપલબ્ધ નથી',
  },
  'chat.listening': {
    en: 'Listening… press stop when done',
    gu: 'સાંભળી રહ્યા છીએ… પૂરું થાય ત્યારે રોકો દબાવો',
  },
  'chat.finalizing': {
    en: 'Finalizing transcript…',
    gu: 'અવાજનું લખાણ તૈયાર થઈ રહ્યું છે…',
  },
  'chat.discard': {
    en: 'Discard',
    gu: 'રદ કરો',
  },
  'chat.speak_prompt': {
    en: 'Speak now in ગુજરાતી, English, or Gujlish…',
    gu: 'હવે ગુજરાતી, English અથવા Gujlish માં બોલો…',
  },
  'chat.recognizing': {
    en: 'Recognizing & asking…',
    gu: 'ઓળખીને પૂછી રહ્યા છીએ…',
  },
  'chat.stop_ask': {
    en: 'Stop & Ask',
    gu: 'રોકો અને પૂછો',
  },
  'chat.press_mic_followup': {
    en: 'Press Mic for Follow-up',
    gu: 'આગળ પૂછવા માઇક દબાવો',
  },
  'chat.press_mic_speak': {
    en: 'Press Mic to Speak',
    gu: 'બોલવા માટે માઇક દબાવો',
  },
  'chat.voice_unavailable': {
    en: 'Voice input is unavailable in this browser.',
    gu: 'આ બ્રાઉઝરમાં વૉઇસ ઇનપુટ ઉપલબ્ધ નથી.',
  },
  'chat.explain_en': {
    en: 'Explain in English',
    gu: 'Explain in English',
  },
  'chat.explain_gu': {
    en: 'ગુજરાતીમાં સમજાવો',
    gu: 'ગુજરાતીમાં સમજાવો',
  },
  'chat.open_dossier': {
    en: 'Open full dossier',
    gu: 'સંપૂર્ણ ફાઇલ ખોલો',
  },
  'chat.inspect_page_title': {
    en: 'Open this cited GR page in PDF Inspector',
    gu: 'ટાંકેલો ઠરાવ PDF નિરીક્ષકમાં ખોલો',
  },

  // ── Shortcuts dialog & StatusBar & App ────────────────────────────────────
  'shortcuts.title': {
    en: 'Keyboard shortcuts',
    gu: 'કીબોર્ડ શૉર્ટકટ',
  },
  'shortcuts.close': {
    en: 'Close',
    gu: 'બંધ કરો',
  },
  'shortcut.inquire': {
    en: 'Focus inquiry input',
    gu: 'પ્રશ્ન બૉક્સ પર જાઓ',
  },
  'shortcut.workspaces': {
    en: 'Inquiry · Library · Method',
    gu: 'પૂછપરછ · સંગ્રહ · પદ્ધતિ',
  },
  'shortcut.citations': {
    en: 'Previous / next verified citation',
    gu: 'પાછલો / આગળનો ચકાસેલ સંદર્ભ',
  },
  'shortcut.tour': {
    en: 'Interactive guided tour',
    gu: 'ઇન્ટરેક્ટિવ માર્ગદર્શન ટૂર',
  },
  'shortcut.close': {
    en: 'Close the open dialog',
    gu: 'ખુલ્લું બૉક્સ બંધ કરો',
  },
  'statusbar.inquire': {
    en: 'inquire',
    gu: 'પૂછપરછ',
  },
  'statusbar.workspaces': {
    en: 'workspaces',
    gu: 'કાર્યક્ષેત્ર',
  },
  'statusbar.citations': {
    en: 'citations',
    gu: 'સંદર્ભો',
  },
  'statusbar.tour': {
    en: 'tour',
    gu: 'ટૂર',
  },
  'statusbar.asked': {
    en: 'asked',
    gu: 'પૂછેલ',
  },
  'statusbar.verified': {
    en: 'verified',
    gu: 'ચકાસેલ',
  },
  'statusbar.refused': {
    en: 'refused',
    gu: 'ઇનકાર',
  },
  'statusbar.latency': {
    en: 'latency',
    gu: 'સમય',
  },
  'statusbar.footer_note': {
    en: 'Indexed official resolutions only · Quoted verbatim',
    gu: 'માત્ર ઇન્ડેક્સ કરેલા સત્તાવાર ઠરાવો · શબ્દશઃ ઉદ્ધરણ',
  },
  'app.error_title': {
    en: 'The inquiry could not be completed',
    gu: 'પૂછપરછ પૂર્ણ થઈ શકી નહીં',
  },
  'app.try_again': {
    en: 'Try again',
    gu: 'ફરી પ્રયાસ કરો',
  },
  'app.resize_title': {
    en: 'Drag to resize · double-click to reset',
    gu: 'માપ બદલવા ખેંચો · મૂળ માપ માટે ડબલ-ક્લિક કરો',
  },

  // ── First-visit Landing Page (pages/Hero.jsx) ─────────────────────────────
  'landing.nav_why': { en: 'The problem', gu: 'સમસ્યા' },
  'landing.nav_how': { en: 'How it works', gu: 'કાર્યપદ્ધતિ' },
  'landing.nav_limits': { en: 'Limits', gu: 'મર્યાદાઓ' },
  'landing.skip_app': { en: 'Skip to the app', gu: 'સીધા એપમાં જાઓ' },
  'landing.get_started': { en: 'Get Started', gu: 'શરૂ કરો' },
  'landing.eyebrow': {
    en: 'Problem PS000230 · Seva First Innovation Challenge',
    gu: 'સમસ્યા PS000230 · સેવા ફર્સ્ટ ઇનોવેશન ચેલેન્જ',
  },
  'landing.h1_pre': { en: 'The rule you found', gu: 'તમને મળેલો નિયમ' },
  'landing.h1_em': { en: 'may not be', gu: 'કદાચ' },
  'landing.h1_mid': { en: 'the rule that', gu: 'હાલમાં' },
  'landing.h1_end': { en: 'applies.', gu: 'લાગુ પડતો ન હોય.' },
  'landing.desc': {
    en: 'GovResolve-AI answers questions about Gujarat Government Resolutions in Gujarati, English, or a mix of both. Every answer comes with the page it came from, the exact words, and whether a later order has changed them.',
    gu: 'GovResolve-AI ગુજરાત સરકારના ઠરાવો અંગે ગુજરાતી, અંગ્રેજી અથવા બંનેના મિશ્રણમાં જવાબ આપે છે — મૂળ પૃષ્ઠ, ચોક્કસ શબ્દો અને પછીના સુધારાની વિગત સાથે.',
  },
  'landing.desc_sub': {
    en: 'તમે જે ઠરાવ વાંચ્યો તે હજુ લાગુ પડે છે કે કેમ, પાનાં, મૂળ શબ્દો અને પછીના સુધારા સાથે જાણો.',
    gu: 'અનુમાન વગર, દરેક વિધાન મૂળ સત્તાવાર દસ્તાવેજના શબ્દશઃ પુરાવા પર આધારિત.',
  },
  'landing.see_why': { en: 'See why it matters', gu: 'શા માટે મહત્ત્વનું છે તે જુઓ' },
  'landing.enter_begin': { en: 'to begin', gu: 'શરૂ કરવા' },
  'landing.pill1': { en: 'Gujarati · English · Gujlish', gu: 'ગુજરાતી · English · Gujlish' },
  'landing.pill2': { en: 'Quotes copied, never retyped', gu: 'શબ્દશઃ નકલ કરેલા ઉદ્ધરણો' },
  'landing.pill3': { en: 'Says “insufficient evidence” instead of guessing', gu: 'અનુમાનને બદલે “અપૂરતા પુરાવા” જણાવે છે' },
  'landing.sec1_num': { en: 'Why this exists', gu: 'આની જરૂર શા માટે' },
  'landing.sec1_title': {
    en: 'One rule, three different answers, depending on the day you read it.',
    gu: 'એક જ નિયમ, પરંતુ તમે કઈ તારીખે વાંચો છો તેના આધારે ત્રણ અલગ જવાબો.',
  },
  'landing.sec1_body': {
    en: 'Resolutions are amended and replaced quietly. A 2018 order can be superseded in 2021 while the old copy stays in the file. A keyword search finds the old copy just as happily as the new one, and nothing on the page says which to trust.',
    gu: 'ઠરાવોમાં સમયાંતરે સુધારા અને અવેજી થતા રહે છે. ૨૦૧૮ નો આદેશ ૨૦૨૧ માં બદલાઈ ગયો હોય છતાં જૂની નકલ ફાઇલમાં રહે છે. સાદી શોધ જૂની અને નવી બંને નકલ બતાવે છે, પરંતુ વિશ્વાસ કોના પર કરવો તે દેખાતું નથી.',
  },
  'landing.sec2_num': { en: 'How an answer is made', gu: 'જવાબ કઈ રીતે બને છે' },
  'landing.sec2_title': {
    en: 'Four steps, and you can inspect every one of them.',
    gu: 'ચાર પગલાં, અને તમે દરેકની ચકાસણી કરી શકો છો.',
  },
  'landing.sec3_num': { en: 'Where it stops', gu: 'તેની મર્યાદાઓ' },
  'landing.sec3_title': {
    en: 'It would rather say “I can’t establish that” than guess.',
    gu: 'અનુમાન કરવાને બદલે સિસ્ટમ “સાબિત થઈ શકતું નથી” કહેવાનું પસંદ કરે છે.',
  },
  'landing.sec4_num': { en: 'Who asks', gu: 'કોના માટે ઉપયોગી' },
  'landing.sec4_title': {
    en: 'Built for the people who have to act on the rule.',
    gu: 'જેમને નિયમના આધારે નિર્ણય લેવાનો હોય છે તેમના માટે નિર્મિત.',
  },
  'landing.cta_title': { en: 'Ask your first question.', gu: 'તમારો પ્રથમ પ્રશ્ન પૂછો.' },
  'landing.cta_desc': {
    en: 'We will walk you through one real answer in about two minutes: the verdict, the exact page, and the amendment chain behind it.',
    gu: 'લગભગ બે મિનિટમાં અમે તમને એક સાચા જવાબ દ્વારા ચુકાદો, મૂળ પૃષ્ઠ અને સુધારાની શ્રૃંખલા બતાવીશું.',
  },
  'landing.skip_tour_open': { en: 'Skip the tour and open the app', gu: 'ટૂર છોડીને સીધા એપ ખોલો' },
  'landing.footer_note': {
    en: 'Specimens on this page are invented for illustration. Inside the app, answers come only from the indexed official resolutions and are quoted verbatim. This is not legal advice.',
    gu: 'આ પૃષ્ઠ પરના નમૂના સમજૂતી માટે છે. એપની અંદરના જવાબો ફક્ત ઇન્ડેક્સ કરેલા સત્તાવાર ઠરાવોમાંથી શબ્દશઃ આપવામાં આવે છે. આ કાનૂની સલાહ નથી.',
  },

  // ── Landing sub-components (Sections / Specimen / TimeDemo) ───────────────
  'sections.cost1_t': { en: 'A penalty overturned', gu: 'દંડનો આદેશ રદ થવો' },
  'sections.cost1_b': {
    en: 'A department acts on a 2015 resolution. At the Civil Services Tribunal it turns out the resolution was amended in 2018, and the defence falls apart.',
    gu: 'વિભાગ ૨૦૧૫ ના ઠરાવ મુજબ કાર્યવાહી કરે છે. ટ્રિબ્યુનલમાં ખબર પડે છે કે ૨૦૧૮ માં સુધારો થયો હતો, અને બચાવ ટકી શકતો નથી.',
  },
  'sections.cost2_t': { en: 'An audit para', gu: 'ઑડિટ વાંધો (પૅરા)' },
  'sections.cost2_b': {
    en: 'Allowances are paid under a legacy circular. The auditors flag them, and the money is recovered from clerks who followed the paper in front of them.',
    gu: 'જૂના પરિપત્ર મુજબ ભથ્થાં ચૂકવાય છે. ઑડિટમાં વાંધો આવે છે અને સામે રહેલા કાગળ મુજબ કામ કરનાર કર્મચારીઓ પાસેથી વસૂલાત થાય છે.',
  },
  'sections.cost3_t': { en: 'A citizen turned away', gu: 'નાગરિકને ધક્કો ખાવો પડવો' },
  'sections.cost3_b': {
    en: 'A local desk applies a rule that no longer stands and asks for a certificate that is no longer required. A grievance petition follows, then an RTI.',
    gu: 'સ્થાનિક કચેરી રદ થયેલો નિયમ લગાવે છે અને બિનજરૂરી પ્રમાણપત્ર માંગે છે — જેનાથી ફરિયાદ અને RTI થાય છે.',
  },
  'sections.s1_t': { en: 'Ask in whatever language comes naturally', gu: 'તમને અનુકૂળ હોય તે ભાષામાં પૂછો' },
  'sections.s1_b': {
    en: 'Gujarati, English, or Gujarati typed in Latin letters. The question is normalised against a glossary of administrative terms, and if it is not English it is also rendered in English so it can reach English resolutions.',
    gu: 'ગુજરાતી, English અથવા રોમન અક્ષરોમાં (Gujlish) પૂછો. વહીવટી શબ્દકોશ દ્વારા પ્રશ્ન બંને ભાષાના ઠરાવો સાથે મેળવવામાં આવે છે.',
  },
  'sections.s2_t': { en: 'Search scans and digital files together', gu: 'સ્કૅન અને ડિજિટલ ફાઇલો એકસાથે શોધો' },
  'sections.s2_b': {
    en: 'Scanned Gujarati pages are read with OCR; digital PDFs are read directly. Keyword search and meaning-based search run side by side, and an exact GR number or date jumps straight to that document.',
    gu: 'સ્કૅન કરેલ ગુજરાતી પૃષ્ઠો OCR દ્વારા અને ડિજિટલ PDF સીધી વંચાય છે. કીવર્ડ અને અર્થ-આધારિત શોધ સાથે ચોક્કસ ઠરાવ નંબર સીધો જ દસ્તાવેજ ખોલે છે.',
  },
  'sections.s3_t': { en: 'Prove it on the page', gu: 'મૂળ પૃષ્ઠ પર પુરાવો બતાવો' },
  'sections.s3_b': {
    en: 'The model chooses which numbered sentences support its answer. The application copies those sentences from the page, so a quote can never be reworded. The paragraph is then highlighted on the original PDF.',
    gu: 'જવાબને સમર્થન આપતા વાક્યો મૂળ પૃષ્ઠ પરથી શબ્દશઃ નકલ કરવામાં આવે છે અને મૂળ PDF પર ફકરો હાઇલાઇટ થાય છે.',
  },
  'sections.s4_t': { en: 'Trace what happened next', gu: 'પછી શું સુધારા થયા તે જુઓ' },
  'sections.s4_b': {
    en: 'Explicit words such as “in supersession of” or “further to amend” create a link from the newer order to the older one. Each answer is checked against those links, and the chain is drawn so you can read the clause behind every arrow.',
    gu: '“આથી સુધારો કરવામાં આવે છે” કે “રદબાતલ કરીને” જેવા સ્પષ્ટ શબ્દો પરથી નવા અને જૂના આદેશો વચ્ચેની વંશાવળી તૈયાર થાય છે.',
  },
  'sections.p1_t': { en: 'It never says a rule is in force.', gu: 'નિયમ અમલમાં છે તેવો દાવો ક્યારેય નહીં.' },
  'sections.p1_b': {
    en: '“No later change found” only describes the documents we hold. Absence of an amendment is not proof of validity.',
    gu: '“પછીનો કોઈ ફેરફાર મળ્યો નથી” નો અર્થ માત્ર સંગ્રહમાંના દસ્તાવેજો પૂરતો જ છે; તે નિયમ અમલી હોવાની ખાતરી નથી.',
  },
  'sections.p2_t': { en: 'It does not retype quotes.', gu: 'ઉદ્ધરણો ફરીથી લખવામાં આવતા નથી.' },
  'sections.p2_b': {
    en: 'A quote is copied from the stored page text, with its page number and the box of its paragraph.',
    gu: 'દરેક ઉદ્ધરણ સંગ્રહિત પૃષ્ઠના લખાણમાંથી પૃષ્ઠ નંબર અને ફકરાના સ્થાન સાથે શબ્દશઃ લેવાય છે.',
  },
  'sections.p3_t': { en: 'It refuses, with a reason.', gu: 'અપૂરતા પુરાવામાં કારણ સાથે ઇનકાર.' },
  'sections.p3_b': {
    en: 'Not in the collection, too vague, outside what resolutions can answer, a broken amendment chain, or a poor scan.',
    gu: 'સંગ્રહમાં ન હોવું, અસ્પષ્ટ પ્રશ્ન, કાર્યક્ષેત્રની બહાર, અધૂરી શ્રૃંખલા અથવા અસ્પષ્ટ સ્કૅન જેવા સ્પષ્ટ કારણો સાથે ઇનકાર.',
  },
  'sections.p4_t': { en: 'It gives no legal advice.', gu: 'કોઈ કાનૂની સલાહ આપતું નથી.' },
  'sections.p4_b': {
    en: 'Questions asking for an opinion on what someone should do are declined and explained.',
    gu: 'વ્યક્તિએ શું કરવું જોઈએ તેવા સલાહ-સૂચન અંગેના પ્રશ્નો નમ્રતાપૂર્વક નકારવામાં આવે છે.',
  },
  'sections.honest_title': { en: 'Where it is today, honestly', gu: 'હાલની વાસ્તવિક સ્થિતિ અને ગુણવત્તા' },
  'sections.honest_1': { en: 'quotes found verbatim on their page', gu: 'મૂળ પૃષ્ઠ પર શબ્દશઃ મળેલા ઉદ્ધરણો' },
  'sections.honest_2': { en: 'unanswerable questions refused with the right code', gu: 'અનુત્તર પ્રશ્નોનો સાચા કારણ કોડ સાથે ઇનકાર' },
  'sections.honest_3': { en: 'of answerable questions fully correct', gu: 'જવાબયોગ્ય પ્રશ્નોના સંપૂર્ણ સાચા ઉત્તર' },
  'sections.honest_4': { en: 'median answer time on a laptop CPU', gu: 'લેપટોપ CPU પર સરેરાશ જવાબ સમય' },
  'sections.honest_foot': {
    en: 'Our own tests: 50 development and 16 held-out questions on a local 4B model. The question sets were drafted by us and are not yet validated by officers. The full scorecard is in the Method workspace.',
    gu: 'અમારા પરીક્ષણ: ૫૦ વિકાસ અને ૧૬ સ્વતંત્ર પ્રશ્નો પર. સંપૂર્ણ વિગત પદ્ધતિ (Method) વિભાગમાં ઉપલબ્ધ છે.',
  },
  'sections.who1_who': { en: 'Officers', gu: 'અધિકારીઓ' },
  'sections.who1_what': { en: 'Finding the operative rule', gu: 'હાલનો અમલી નિયમ શોધવા' },
  'sections.who2_who': { en: 'Establishment branches', gu: 'મહેકમ શાખાઓ' },
  'sections.who2_what': { en: 'Checking before processing', gu: 'ફાઇલ પર કાર્યવાહી પહેલાં ચકાસણી' },
  'sections.who3_who': { en: 'Citizens', gu: 'નાગરિકો' },
  'sections.who3_what': { en: 'Asking in their own words', gu: 'પોતાની સરળ ભાષામાં પૂછપરછ' },

  'specimen.badge': { en: 'Specimen · invented for illustration', gu: 'નમૂનો · સમજૂતી માટે' },
  'specimen.page': { en: 'p. 2 of 3', gu: 'પૃ. ૨ / ૩' },
  'specimen.title': { en: 'Leave: documents required with an application', gu: 'રજા: અરજી સાથે રજૂ કરવાના દસ્તાવેજો' },
  'specimen.lock': { en: 'Verbatim lock · p.2', gu: 'શબ્દશઃ ચિહ્નિત · પૃ.૨' },
  'specimen.replaced': { en: 'Replaced by GR/EX/2021/130 · dated 2 Aug 2021', gu: '૨ ઓગસ્ટ ૨૦૨૧ ના GR/EX/2021/130 દ્વારા રદ/અવેજી' },
  'specimen.answer_eyebrow': { en: 'Answer', gu: 'જવાબ' },
  'specimen.answer_text': { en: 'A medical certificate must be submitted with the leave application.', gu: 'રજાની અરજી સાથે તબીબી પ્રમાણપત્ર રજૂ કરવું આવશ્યક છે.' },
  'specimen.do_not_act': { en: 'do not act on this order', gu: 'આ આદેશ પર અમલ ન કરવો' },

  'timedemo.eyebrow': { en: 'Try it · three invented orders', gu: 'અજમાવી જુઓ · ત્રણ નમૂના આદેશો' },
  'timedemo.sub': { en: 'Pick the order you found, then drag the date. This is the same logic as the app’s Rule Time Machine.', gu: 'તમને મળેલો આદેશ પસંદ કરો, પછી તારીખ ખસેડો. આ જ નિયમ એપના ટાઇમ મશીનમાં વપરાય છે.' },
  'timedemo.order_2014': { en: '2014 order', gu: '૨૦૧૪ નો આદેશ' },
  'timedemo.order_2018': { en: '2018 order', gu: '૨૦૧૮ નો આદેશ' },
  'timedemo.jump_to': { en: 'Jump to', gu: 'તારીખ પસંદ કરો' },
  'timedemo.on_date': { en: 'On {date}, an officer holding', gu: '{date} ના રોજ, આદેશ ધરાવતા અધિકારી માટે' },
  'timedemo.not_exist_h': { en: 'This order did not exist yet', gu: 'આ આદેશ હજુ બહાર પડ્યો ન હતો' },
  'timedemo.not_exist_n': {
    en: '{gr} is dated {grDate}. On {date} an officer could not have found it.',
    gu: '{gr} ની તારીખ {grDate} છે. {date} ના રોજ અધિકારીને આ આદેશ મળ્યો ન હોત.',
  },
  'timedemo.amended_sup_n': {
    en: 'Amended by {b}, but that amending order has itself been superseded by {c}. Read the successor before relying on either.',
    gu: '{b} દ્વારા સુધારો થયો હતો, પરંતુ તે સુધારા આદેશને પણ {c} દ્વારા અવેજી કરવામાં આવેલ છે. નિર્ણય લેતા પહેલા નવો આદેશ વાંચો.',
  },
  'timedemo.sup_n': {
    en: 'Replaced by {c} on 2 Aug 2021. Do not act on this order; see its successor.',
    gu: '૨ ઓગસ્ટ ૨૦૨૧ ના રોજ {c} દ્વારા બદલવામાં આવેલ. આ આદેશ પર અમલ ન કરવો; નવો આદેશ જુઓ.',
  },
  'timedemo.no_change_n': {
    en: 'No later amendment or replacement exists in the documents we hold. That is all this means: it does not prove the rule is in force.',
    gu: 'અમારી પાસેના દસ્તાવેજોમાં પછીનો કોઈ સુધારો કે અવેજી નથી. આ નિયમ અમલમાં જ હોવાની ખાતરી નથી.',
  },
  'timedemo.amends': { en: 'Amends', gu: 'સુધારો' },
  'timedemo.supersedes': { en: 'Supersedes', gu: 'અવેજી' },
};

/**
 * Translate a key into `lang` ('en' | 'gu'), replacing any `{var}` tokens.
 */
export function translate(key, lang = 'en', vars) {
  const entry = TRANSLATIONS[key];
  let str = entry ? (entry[lang] ?? entry.en ?? key) : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

/**
 * Localized taxonomy text for a GR status key (preserves English STATUS object cleanly).
 */
export function statusText(key, lang = 'en') {
  const k = ['no_change', 'amended', 'superseded', 'conflict', 'insufficient'].includes(key)
    ? key
    : 'insufficient';
  return {
    label: translate(`status.${k}_label`, lang),
    short: translate(`status.${k}_short`, lang),
    headline: translate(`status.${k}_headline`, lang),
    note: translate(`status.${k}_note`, lang),
  };
}

/**
 * Localized reason label for refusal reason codes.
 */
export function reasonText(code, lang = 'en') {
  const k = `reason.${code}`;
  return TRANSLATIONS[k] ? translate(k, lang) : '';
}

/**
 * Pick the localized document title when bilingual metadata is available.
 */
export function pickSubject(item, lang = 'en') {
  if (!item) return '';
  if (lang === 'gu') return item.subject_gu || item.subject || item.gr_number || '';
  return item.subject_en || item.subject || item.gr_number || '';
}
