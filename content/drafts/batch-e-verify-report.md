# Batch E verification report

Independent verifier, 2026-10-22. Input: `batch-e.json` (not modified). Output: `batch-e.verified.json` (32 items, all kept).

**Result: 32 verified, 0 unsure, 0 rejected.** 1 commonMistake was reworked because the old mistake could be correct English (take-medicine). 14 items were changed. 18 have no change: the dictionary quotes the author cited were re-read and match.

## Method
- Cambridge, Oxford Learner's and Longman pages were fetched with curl and grepped (102 pages, plus the Cambridge Grammar pages for present perfect continuous, marry and divorce, and have something done).
- SkELL concordance API. Note: SkELL splits contractions into tokens, so "why don't we" returns 0 lines but "why do n't we go" returns 40. That explains the author's empty result.
- Google Books Ngram (en-2019, 2010-2019 mean, exact form, 5 words max) for mistake ratios. The batch C benchmark is used: the Longman-flagged *discuss about* = 0.93%.
- `runChecks` was run from a scratch script with npx tsx, over batch A + B + C + D + E `.verified.json`. It used the modelBlanks and dailyContext overlays, the shipped-ids lock, the local denylist, C8 and the C10 allowlist.

## The author's flagged doubts
| Item | Decision | Evidence |
|---|---|---|
| why-dont-we | verified | Oxford *why*: "used to make or agree to a suggestion … Why don't we go together?" (A2). Cambridge grammar box: "We use why don't and why not to make suggestions". SkELL has 40 natural lines. Cambridge marks *Shall we* as "formal in US", and Oxford says North American English uses *should* in suggestions. Fixes: added "Should we go to the movies on Saturday?" and rewrote noteTr to say this. |
| let-me-know | verified | Oxford *know*, idiom "let somebody know". Oxford *let*: "Let me know (= tell me) how I can help". Longman *know*: "Let me know what time…". Cambridge grammar: "Let is followed by an object and an infinitive without to", which supports the noteTr claim. Ngram: *let me to know* = 0.01%. There is no commonMistake, which is correct. |
| how-long-have-you-been | verified | Cambridge Grammar, present perfect continuous: "How long have you been waiting for me?" and "He's been living in the village since 1995". Cambridge *long*: "How long have you been in England?". Ngram: *long have you lived* is 5 times as frequent as *long have you been living*. *long are you living* = 0.8%. Fixes: added *…living here?*, *…lived here?* and *How long have you been in this city?*. All are correct, and leaving them out would mark correct English wrong. |
| marry-someone | verified, mistake kept | The evidence is now strong. Cambridge Grammar "Marry and divorce": "We don't use to or with after marry … Not: She married with someone" and "Not: She got married with someone". Longman *married* GRAMMAR: "Don't say: … got married with [name]". Ngram: *marry with him* = 0.05%. Fixes: added *Mert and Deniz are getting married / are going to get married next year*. Model sentences 2–3 were rewritten, because the old ones had Deniz marrying both Ayşe and Mert. |

## Other fixes
| Item | Fix | Why |
|---|---|---|
| take-medicine | Moved to tablets. Mistake is now *I need to drink these tablets twice a day*. New situationTr ("Bu hapları … içmem"), answers (tablets/pills), cloze `I need to ___ these tablets twice a day.`, model 1 and noteTr. | The old mistake *drink this medicine* = 6% of *take this medicine* in Ngram, and Oxford defines medicine as "a liquid that you drink or swallow". With liquid medicine it can be correct. *drink these/the tablets* = 0. Longman *tablet*: "take a tablet". |
| arrive-in-at | London → London; situationTr uses Londra'ya | Privacy rule. A city is needed for *arrive in*. |
| be-good-at | Model 2: Alex → Deniz | Names rule (only Ayşe, Mert, Deniz). |
| pay-for-something | Model 3 *Can I pay by credit card?* → *How much did you pay for the tickets?* | The old model did not use *pay for* (checklist C11). |
| get-something-fixed | Added *get/have the boiler repaired*. noteTr: "have BrE'de resmî" → "have biraz daha resmî". | Correct variants with the same structure. The BrE claim was unsupported. |
| listen-to-music | noteTr: "listen daima to ister" → "dinlenen şey söylenince listen to gerekir" | *Listen!* without an object is correct, so "daima" was too absolute. |
| would-rather | Added *I'd rather stay in tonight than go out.* | The normaliser does not expand *I'd*. |
| do-the-shopping | Added AmE *I usually go grocery shopping on Saturdays.* | noteTr named it, but it was not accepted. |
| could-i-have, borrow-from-someone | Ellipsis removed from noteTr | The "..." was read as a sentence break (≤ 2 sentences rule). |

The verifiedNote fields no longer cite example names or places from the dictionaries, such as New York.

## Not changed, but noted
- pay-for-something: *I'll get the coffees* is natural BrE and is not accepted. Self-assessment covers it. It was not added because it skips the target *pay for*.
- enter-the-room: *enter the room* is a bit formal for a hotel check-in, but it is grammatical. *go into / get into* are accepted.
- could-i-have already has 8 answers (the maximum), so *May I have a coffee, please?* was not added.

## runChecks
- **0 errors.** 166 shipped (all of A–E). Batch E has 32 shipped. No duplicate id or targetChunk. Every cloze has the same word count as its canonical answer. All noteTr ≤ 2 sentences, all checklistTr ≤ 3 entries.
- Old warnings, not in batch E: C6 reminder-noun (batch A) and 50 C12 info findings in A–D.
- **C10 warnings left in batch E (71).** All are Turkish words or generic terms, and none is a real person or place except the generic *London / Londra*, which is allowed by the task rule:
  - Turkish words after the "[…]" bracket or inside quotes: Arkadaşına, Cumartesi, Kafede, Garsona, İstasyona, Bu, Yarın, Sohbet, Bir, Otel, Görevli, Sokakta, Müzenin, Yağmur, Mağazada, Elindeki, Dün, Dünkü, Havaalanında, Valizlerinin, Nerede, Ev, Kombinin, Nazikçe, Otobüste, Durakta, Hesabı, Fotoğrafçılıkla, Yemek, Uçmaktan, Hafta, Uçağının, Telefonda, Turistik, Fotoğrafınızı, Otelde, Kahvaltı, Market, Trafik, Eczanede, Eczacı.
  - Generic terms: Small (Small talk), Saturday, Saturdays, Fridays, English, TV, London, Londra.
- `content/privacy-allowlist.json`, `content/shipped-ids.lock.json` and `src/content/` were not edited (items.json md5 is unchanged). Nothing was committed.
