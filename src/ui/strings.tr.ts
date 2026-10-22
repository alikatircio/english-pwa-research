// All Turkish UI text in one place; e2e tests import these too.
export const t = {
  appTitle: 'İngilizce Üretim',
  loading: 'Yükleniyor…',
  bootFailed: 'Uygulama açılamadı. Sayfayı yenilemeyi dene.',

  questionHeading: 'Bunu İngilizce yaz',
  /** Heading for notebook (user-error) items (03 H3.3). */
  userErrorHeading: 'İngilizcesi neydi?',
  contextPrefix: 'Bağlam:',
  hint: 'İpucu:',
  answerPlaceholder: 'Tam cümle yaz…',
  /** Decision 31: "Hatayı düzelt" shape. */
  fixHeading: 'Bu cümledeki hatayı düzelt:',
  fixPlaceholder: 'Doğru cümleyi yaz…',
  /** Decision 31: "Sırala" shape. */
  orderHeading: 'Kelimeleri sıraya diz',
  orderPlacedLabel: 'Kurduğun cümle',
  orderPoolLabel: 'Kalan kelimeler',
  orderEmpty: 'Aşağıdaki kelimelere dokun, cümle burada oluşsun.',
  orderChipAdd: (word: string) => `${word}, cümleye ekle`,
  orderChipRemove: (word: string, pos: number) => `${word}, ${pos}. sırada, geri koymak için dokun`,
  orderProgress: (placed: number, total: number) => `${placed}/${total} kelime yerleşti`,
  check: 'Kontrol et',
  /** Decision 33: a new card's study view and its "ready" button. */
  studyHeading: 'Önce kalıbı gör',
  studyReady: 'Hazırım',
  /** Decision 34. */
  dontKnow: 'Bilmiyorum',
  noAnswer: '(cevap yok)',
  next: 'Sonraki',

  correct: 'Doğru',
  notMatched: 'Birebir eşleşmedi',
  yourAnswer: 'Senin cevabın',
  correctAnswer: 'Doğrusu',
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

  // Free practice (decision 30): offered when today is done.
  practice: 'Serbest pratik',
  practiceDetail: 'Daha önce gördüğün kartlardan; ilerlemeni etkilemez.',

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
  // Notebook help (decision 32).
  notebookHelpTitle: 'Nasıl kullanılır',
  notebookHelpSteps: [
    'İşte bulamadığın ifadeyi Türkçe yaz, Kaydet.',
    'Haftada bir Ayarlar → “Claude’a yapıştır”, claude.ai’de gönder.',
    'Cevabı Ayarlar → “JSON’u yapıştır” → İçe aktar; ifadeler “İngilizcesi neydi?” kartı olur.',
  ],
  notebookEmptyHint: 'İşte İngilizcesini bulamadığın ifadeyi + Deftere ekle ile kaydet.',
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
    'Claude’un cevabını kopyala, aşağıdaki kutuya yapıştır, İçe aktar’a bas.',
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
  // Paste import: Claude's reply copied from claude.ai (the first ```json block is taken).
  itemsPasteLabel: 'JSON’u yapıştır',
  itemsPastePlaceholder: 'Claude’un cevabını buraya yapıştır',
  itemsPasteImport: 'İçe aktar',
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

  // Daily new-card cap (decision 29).
  capSection: 'Günlük yeni kart',
  capHint: 'Her gün en fazla bu kadar yeni kart gelir. Değişiklik bir sonraki turdan itibaren geçerli.',
  capLabel: 'Günlük yeni kart sayısı',

  // Full backup (Slice 5, T5.4). Error codes come from domain/backup.ts (ImportErrorCode).
  backupSection: 'Yedek',
  backupHint: 'Tüm ilerlemen, defterin ve item’ların tek bir dosyada. Dosyalar’a ya da iCloud Drive’a kaydet.',
  backupExport: 'Yedeği dışa aktar',
  backupRestore: 'Yedekten geri yükle',
  backupChooseMode: 'Yedek dosyası geçerli. Nasıl yükleyelim?',
  backupMerge: 'Birleştir',
  backupMergeHint: 'Bu cihazdaki ilerleme kalır; yedekteki yeni ve daha güncel kayıtlar eklenir.',
  backupReplace: 'Tümünü değiştir',
  backupReplaceHint: 'Bu cihazdaki ilerleme silinir, yerine yedektekiler gelir.',
  backupReplaceConfirm: 'Emin misin? Bu cihazdaki tüm ilerleme, defter ve item’lar yedektekilerle değiştirilecek. Geri alınamaz.',
  backupReplaceYes: 'Evet, tümünü değiştir',
  backupCancel: 'Vazgeç',
  backupRestored: 'Yedek yüklendi.',
  backupInvalid: 'Yedek yüklenmedi, hiçbir şey değişmedi:',
  backupRejected: 'Alınmayan item’lar:',
  backupImportErrors: {
    'invalid-json': 'Dosya okunamadı: geçerli bir JSON değil.',
    'unknown-format': 'Bu dosya bu uygulamaya ait değil.',
    'wrong-format': 'Bu bir yedek dosyası değil (format "english-pwa-backup" olmalı).',
    'unsupported-version': 'Yedek bu uygulamanın desteklediğinden daha yeni bir sürümde. Önce uygulamayı güncelle.',
    invalid: 'Geçersiz veya eksik alan',
  },
  lastBackup: (date: string) => `Son yedek: ${date}`,
  lastBackupNever: 'Son yedek: hiç',

  // First run, storage and hints (Slice 5, T5.5).
  welcome: 'Hoş geldin. Her gün birkaç Türkçe durum göreceksin; her birini İngilizce tam bir cümleyle yaz.',
  welcomeRestore: 'Başka bir cihazdan yedeğin varsa önce onu yükle.',
  installHint: 'Safari → Paylaş → Ana Ekrana Ekle. Ana ekrana eklemezsen iOS verilerini silebilir.',
  backupReminder: 'Yedeğin 1 haftadan eski',
  dismiss: 'Kapat',
  storageSection: 'Depolama',
  persistOn: 'Kalıcı depolama: açık',
  persistOff: 'Kalıcı depolama: kapalı',
  persistHint: 'Açıkken tarayıcı yer açmak için verilerini kendiliğinden silmez.',
  persistRequest: 'Kalıcı depolamayı iste',
} as const;
