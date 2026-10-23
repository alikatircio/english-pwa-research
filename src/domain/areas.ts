// The 16 exam areas (12-pdf-roadmap §1.1), in test and result-table order.
export const AREAS = [
  { id: 'present-past', titleTr: 'Şimdiki ve geçmiş zaman' },
  { id: 'present-perfect', titleTr: 'Present perfect ve geçmiş (for / since, past perfect, used to)' },
  { id: 'future', titleTr: 'Gelecek zaman (plan, karar, tarife, when / as soon as + şimdiki zaman)' },
  { id: 'modals', titleTr: 'Kipler: can, must, should, rica ve izin' },
  { id: 'if-wish', titleTr: 'if ve wish' },
  { id: 'passive', titleTr: 'Edilgen yapı' },
  { id: 'questions-reported-speech', titleTr: 'Soru, dolaylı soru ve aktarılan söz' },
  { id: 'ing-to', titleTr: '-ing ve to (fiil kalıpları)' },
  { id: 'articles-nouns', titleTr: 'Tanımlık ve isimler (a / the, sayılabilen / sayılamayan)' },
  { id: 'pronouns-determiners', titleTr: 'Zamirler ve belirleyiciler (there / it, some / any, all / each)' },
  { id: 'relative-clauses', titleTr: 'İlgi cümleleri (who / that / which)' },
  { id: 'adjectives-adverbs', titleTr: 'Sıfat ve zarf (sözcük biçimi, karşılaştırma, söz dizimi, still / yet)' },
  { id: 'conjunctions', titleTr: 'Bağlaçlar (although, in case, unless, as / like, by / until)' },
  { id: 'prepositions', titleTr: 'Edatlar (zaman, yer, isim / sıfat / fiil + edat)' },
  { id: 'phrasal-verbs', titleTr: 'Phrasal verb' },
  { id: 'work-collocations', titleTr: 'İş eşdizimleri ve diplomatik dil' },
] as const;

export const AREA_IDS = AREAS.map((a) => a.id);

export type AreaId = (typeof AREAS)[number]['id'];
