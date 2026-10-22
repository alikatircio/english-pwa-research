// "Claude'a yapıştır": one text block the user pastes into claude.ai. Claude
// turns the open notebook entries into an items-import file (ItemsImportV1).
// Pure: no DOM, no clock. The app makes no LLM calls; the user copies by hand.
import { buildNotebookExport, FORMATS, SCHEMA_VERSION, type NotebookExportEntry } from './backup.ts';
import { CATEGORIES } from './itemSchema.ts';
import type { Item, NotebookEntry } from './types.ts';

/** An item as Claude returns it: source / verified / verifiedNote are set by the app (decision 14). */
export type ClaudeItem = Omit<Item, 'source' | 'verified' | 'verifiedNote'>;

/** Placeholder id for the example; real items use the entry id from the list. */
export const EXAMPLE_NOTEBOOK_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

/**
 * The one complete example shown in the prompt. A test parses it with the real
 * ItemsImportSchema and the content checks, so the prompt cannot drift from the schema.
 */
export const EXAMPLE_ITEM: ClaudeItem = {
  id: 'nb-escalate-something-to-someone',
  category: 'object',
  level: 2,
  targetChunk: 'escalate + something + to + someone',
  patternSlots: 'escalate ___ to ___',
  clozeTemplate: "I'll ___ the issue to the team lead.",
  situationTr: "[Teams] Mert'e yazıyorsun: hata hâlâ çözülmedi, konuyu takım liderine taşıyacaksın.",
  acceptedAnswers: [
    "I'll escalate the issue to the team lead.",
    "I'm going to escalate the issue to the team lead.",
    "I'll escalate this issue to the team lead.",
    "I'll escalate it to the team lead.",
  ],
  modelSentences: [
    "I'll escalate the issue to the team lead.",
    'Deniz escalated the bug to the product owner.',
    'Should we escalate this to the client?',
  ],
  commonMistake: "I'll escalate the issue for the team lead.",
  checklistTr: ['Nesneyi (the issue) yazdın mı?', "Kişiden önce 'to' var mı?"],
  noteTr: "escalate + şey + to + kişi. 'Takım liderine'deki -e eki to olur. will / going to seçimi bağlama göre.",
  notebookId: EXAMPLE_NOTEBOOK_ID,
};

export const EXAMPLE_FILE = {
  format: FORMATS.items,
  schemaVersion: SCHEMA_VERSION,
  items: [EXAMPLE_ITEM],
} as const;

const CATEGORY_HELP: Record<(typeof CATEGORIES)[number], string> = {
  aux_to: 'modal / yardımcı fiil + yalın fiil ya da to (could you check, need to fix, let me check)',
  object: 'fiil + nesne + edat kalıbı (explain something to someone, ask someone to)',
  word_form: 'sözcük biçimi: isim / fiil / sıfat, sayılamayan isimler (data, feedback, set up / setup)',
  preposition: 'edat seçimi (depend on, wait for, responsible for)',
  work_vocab: 'iş / yazılım sözcüğü ya da kalıbı (escalate, roll back, heads-up)',
};

function entryLines(e: NotebookExportEntry, n: number): string[] {
  const lines = [`${n}. id: ${e.id}`, `   textTr: ${JSON.stringify(e.textTr)}`];
  if (e.contextTr !== undefined) lines.push(`   contextTr: ${JSON.stringify(e.contextTr)}`);
  return lines;
}

/**
 * The full prompt: instructions, schema, one example, then the open entries
 * (oldest first, the same set as the notebook export). Converted entries are left out.
 */
export function buildClaudePrompt(entries: readonly NotebookEntry[], nowIso: string): string {
  // Same selection and order as the notebook export; its timestamp is not used here.
  const open = buildNotebookExport(entries, 0).entries;
  const categories = CATEGORIES.map((c) => `  - ${c}: ${CATEGORY_HELP[c]}`);
  const list = open.flatMap((e, i) => entryLines(e, i + 1));

  return [
    '# Görev / Task',
    '',
    'Sen bir İngilizce öğretmenisin ve yazılım / QA ekiplerinde iş İngilizcesi konusunda uzmansın.',
    'You are an English teacher who specialises in workplace English for software / QA teams.',
    'Öğrenci Türk, seviyesi B1–B2, bir yazılım ekibinde QA olarak çalışıyor. Aşağıdaki defter',
    'notları, işte İngilizcesini bulamadığı Türkçe ifadeler. Her not için bir üretim kartı (item) yaz.',
    'The learner is a Turkish B1–B2 QA engineer. Each notebook entry below is a Turkish phrase they',
    'could not say in English at work. Write one practice item per entry.',
    '',
    '# Kurallar / Rules',
    '',
    '- İçerik QA / yazılım iş yeri İngilizcesi olsun: Teams mesajı, daily, PR yorumu, bug raporu, ticket.',
    '- Kalıbı öğret, tek sözcüğü değil: fiil + nesne + edat (ör. "explain something to someone").',
    '  targetChunk bu kalıbı yazar; patternSlots kalıbı ___ boşluklarıyla gösterir.',
    '- situationTr Türkçedir, durumu anlatır ve cevabı ele vermez: İngilizce cevabın sözcükleri',
    '  situationTr içinde geçmez. Başına kanalı köşeli parantezle yazabilirsin, ör. "[Teams] ...".',
    '- acceptedAnswers tam cümledir, 3–8 tane. İlki ana cevaptır ve modelSentences[0] ile birebir',
    '  aynıdır. commonMistake asla acceptedAnswers içinde olmaz. Sadece kısaltma farkı olan iki',
    '  varyant yazma ("I\'ll" ile "I will" uygulamada zaten aynı sayılır).',
    '- modelSentences 2–3 cümledir; ilki ana cevap, diğerleri kalıbı başka bir iş durumunda gösterir.',
    '- clozeTemplate ana cevabın kendisidir; sadece kritik kısım "___" ile değiştirilir. Sözcük sayısı',
    '  ana cevapla aynı kalır (ör. "I\'ll ___ the issue to the team lead.").',
    '- commonMistake (isteğe bağlı): bir Türk öğrencinin gerçekten yapacağı tipik hata.',
    '- checklistTr en fazla 3 kısa Türkçe kontrol sorusudur.',
    '- noteTr kısa Türkçe bir açıklamadır. Kullanım bağlama göre değişiyorsa "bağlama göre" yazar.',
    '- Gerçek şirket, ürün ya da kişi adı yok. Kişi adı gerekiyorsa sadece Ayşe, Mert, Deniz.',
    '  E-posta, URL, telefon numarası yok.',
    '- Bir ifadenin doğal olduğundan emin değilsen uydurma; bunu açıkça söyle.',
    '  If you are not sure a phrase is natural English, do not invent one: say so.',
    '',
    '# Alanlar / Fields',
    '',
    '- id: kebab-case (küçük harf, rakam, tire), "nb-" ile başlar, kalıbı anlatır,',
    '  ör. "nb-escalate-something-to-someone". Her item için farklı.',
    '- notebookId: defter notunun id değeri, aşağıdaki listeden aynen kopyala.',
    '- level: 1 (temel), 2 (orta), 3 (ileri); hepsi B1–B2 aralığında.',
    '- category: şu listeden biri / one of:',
    ...categories,
    '- source, verified, verifiedNote yazma; uygulama bunları kendisi ekler.',
    '- Başka alan ekleme: bilinmeyen bir alan dosyanın tamamını geçersiz yapar.',
    '  Do not add any other field: an unknown key makes the whole file invalid.',
    '',
    '# Çıktı / Output',
    '',
    'SADECE tek bir JSON kod bloğu döndür (```json ... ```), öncesinde açıklama olmasın.',
    'Return ONLY one JSON code block. Shape: format, schemaVersion and items, exactly like this example:',
    '',
    '```json',
    JSON.stringify(EXAMPLE_FILE, null, 2),
    '```',
    '',
    'Emin olmadığın notları JSON\'a koyma; JSON bloğundan SONRA bunları id ve kısa nedeniyle listele.',
    'Omit items you are unsure about and list them after the JSON (id + short reason).',
    '',
    '# Defter notları / Notebook entries',
    '',
    `Dışa aktarma / Exported at: ${nowIso}`,
    '',
    ...list,
    '',
  ].join('\n');
}
