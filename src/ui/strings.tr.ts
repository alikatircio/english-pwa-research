// All Turkish UI text in one place; e2e tests import these too.
export const t = {
  appTitle: 'İngilizce Üretim',
  loading: 'Yükleniyor…',
  bootFailed: 'Uygulama açılamadı. Sayfayı yenilemeyi dene.',
  storageUnavailable: 'Bu tarayıcıda kayıt alanı açılamadı (özel sekme olabilir).',

  questionHeading: 'Bunu İngilizce yaz',
  /** Heading for notebook (user-error) items (03 H3.3). */
  userErrorHeading: 'İngilizcesi neydi?',
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

  // Notebook (Slice 3). No counts or badges for open entries (05 §4).
  notebookFromCard: 'Bulamadım → deftere',
  notebookAdd: '+ Deftere ekle',
  notebookTitle: 'Deftere ekle',
  notebookLabel: 'Bulamadığın ifade (Türkçe)',
  notebookPlaceholder: 'ör. sorunu ekibe yükseltmek',
  notebookContext: 'Bağlam',
  notebookSave: 'Kaydet',
  notebookCancel: 'Vazgeç',
  notebookSaved: 'Deftere kaydedildi.',
  notebookDuplicate: 'Bu ifade defterde zaten var.',

  // Settings (first version, T3.3).
  settings: 'Ayarlar',
  back: 'Geri',
  notebookSection: 'Defter',
  notebookPending: 'Çözülmeyi bekleyen ifadeler var → dışa aktar',
  notebookNothingPending: 'Çözülmeyi bekleyen ifade yok.',
  notebookExport: 'Defteri dışa aktar',
  // "Claude'a yapıştır" (no API: the user pastes the prompt into claude.ai).
  claudeCopy: 'Claude’a yapıştır (kopyala)',
  claudeHelpTitle: 'Claude ile çözmek için:',
  claudeHelpSteps: [
    'Butona bas: defter notların hazır bir istemle kopyalanır.',
    'claude.ai’de yeni bir sohbet aç, yapıştır ve gönder.',
    'Gelen JSON’u .json dosyası olarak kaydet ve aşağıda “Item dosyası seç” ile içe aktar.',
  ],
  claudeCopied: 'Kopyalandı. claude.ai’de yapıştır, gelen JSON’u buraya içe aktar.',
  claudeShared: 'Metin paylaşıldı. claude.ai’de yapıştır, gelen JSON’u buraya içe aktar.',
  claudeCopyFailed: 'Kopyalanamadı. Defteri dışa aktarıp dosyayı Claude’a yükleyebilirsin.',
  flagsSection: 'Yanlış olabilir işaretleri',
  flagsHint: 'İşaretlediğin kartlar inceleme için dosyaya çıkar.',
  flagsNone: 'İşaretli kart yok.',
  flagsExport: 'İşaret raporunu dışa aktar',
  exportShared: 'Dosya paylaşıldı.',
  exportDownloaded: 'Dosya indirildi.',
  exportFailed: 'Dosya hazırlanamadı. Tekrar dene.',

  // Items import (T3.4). Codes come from domain/backup.ts (ImportErrorCode, RejectedItemReason).
  itemsSection: 'Item içe aktar',
  itemsHint: 'Claude’da çözdürdüğün item dosyasını (JSON) seç. Yeni kartlar sıranın başına gelir.',
  itemsChoose: 'Item dosyası seç',
  itemsImported: 'İçe aktarıldı. Yeni kartlar sıraya eklendi.',
  itemsNoneImported: 'Hiçbir item alınmadı.',
  itemsInvalid: 'Dosya içe aktarılmadı, hiçbir şey kaydedilmedi:',
  itemsRejected: 'Alınmayan item’lar:',
  itemsMoreErrors: (n: number) => `… ve ${n} hata daha`,
  importErrors: {
    'invalid-json': 'Dosya okunamadı: geçerli bir JSON değil.',
    'unknown-format': 'Bu dosya bu uygulamaya ait değil.',
    'wrong-format': 'Bu bir item dosyası değil (format "english-pwa-items" olmalı).',
    'unsupported-version': 'Dosya bu uygulamanın desteklediğinden daha yeni bir sürümde.',
    invalid: 'Geçersiz veya eksik alan',
  },
  rejectReasons: {
    'builtin-id': 'uygulamadaki bir kartla aynı id',
    'duplicate-in-file': 'dosyada iki kez geçiyor',
  },
} as const;
