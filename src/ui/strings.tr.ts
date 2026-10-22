// All Turkish UI text in one place; e2e tests import these too.
export const t = {
  appTitle: 'İngilizce Üretim',
  loading: 'Yükleniyor…',
  bootFailed: 'Uygulama açılamadı. Sayfayı yenilemeyi dene.',
  storageUnavailable: 'Bu tarayıcıda kayıt alanı açılamadı (özel sekme olabilir).',

  questionHeading: 'Bunu İngilizce yaz',
  contextPrefix: 'Bağlam:',
  hint: 'İpucu:',
  answerLabel: 'İngilizce cevabın',
  answerPlaceholder: 'Tam cümle yaz…',
  check: 'Kontrol et',
  next: 'Sonraki',

  correct: 'Doğru',
  notMatched: 'Birebir eşleşmedi',
  yourAnswer: 'Senin cevabın',
  correctAnswer: 'Doğrusu',
  otherAnswers: 'Bu da olur',
  modelSentences: 'Örnek cümleler',
  checklist: 'Kendine sor',
  patternCard: 'Kalıp kartı',
  commonMistake: 'Sık hata',
  note: 'Not',
  howWasIt: 'Nasıldı?',
  gradeWrong: 'Yanlış',
  gradePartial: 'Kısmen',
  gradeCorrect: 'Doğru',
  gradedAs: (label: string) => `Kaydedildi: ${label}`,
  undo: 'Geri al',

  flag: 'Bu yanlış olabilir',
  flagged: 'İşaretlendi',

  saveFailed: 'Kaydedilemedi. Tekrar dene.',

  // Home (05 §1): the only number is "today's cards".
  todayCount: (n: number) => `Bugün: ${n} kart`,
  start: (n: number) => `Başla · bugün ${n}`,
  resume: 'Devam et',
  resumeDetail: 'Yarım kalan tur kaldığın karttan açılır.',
  todayDone: 'Bugün bitti.',
  todayDoneDetail: 'Yarın görüşürüz.',

  // Round (05 §2–3): no counts, no percentages.
  roundProgress: (at: number, of: number) => `Turda kart ${at} / ${of}`,
  roundDone: 'Tur bitti.',
  roundSummary: (chunks: readonly string[]) => `Bu turda: ${chunks.join(' · ')}`,
  anotherRound: 'Bir tur daha',
  enough: 'Bu kadar',
} as const;
