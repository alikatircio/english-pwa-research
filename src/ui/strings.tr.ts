// All Turkish UI text in one place; e2e tests import these too.
export const t = {
  appTitle: 'İngilizce Üretim',
  loading: 'Yükleniyor…',
  bootFailed: 'Uygulama açılamadı. Sayfayı yenilemeyi dene.',
  storageUnavailable: 'Bu tarayıcıda kayıt alanı açılamadı (özel sekme olabilir).',

  questionHeading: 'Bunu İngilizce yaz',
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

  saveFailed: 'Kaydedilemedi. Tekrar dene.',
  allDone: 'Şimdilik bu kadar.',
  allDoneDetail: 'Tüm kartları cevapladın. Yeni kartlar sonraki sürümde.',
} as const;
