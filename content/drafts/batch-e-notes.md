# Batch E: notes (daily life / social, decision 44a)

Author pass, 2026-10-22. 32 new items, all `verified: false`; every `verifiedNote` starts with "author:". Names used: Ayşe, Mert, Deniz only. No brands.
Counts: aux_to 5, object 7, word_form 5, preposition 9, work_vocab 6 (daily collocations). Levels: 1 = 14, 2 = 10, 3 = 8.
Topics: plans with a friend (why-dont-we, let-me-know, would-rather), travel (arrive-in-at, miss-the-flight, enter-the-room, ask-someone-for-directions, luggage-uncountable, have-breakfast), café/restaurant (could-i-have, pay-for-something, make-a-reservation, do-you-mind-doing), doctor/pharmacy (take-medicine), landlord/repairs (get-something-fixed), shopping (try-it-on, do-the-shopping, lend/borrow), small talk (call-someone, marry-someone, listen-to-music, be-interested-in, be-good-at, be-afraid-of, at-the-weekend, how-long-have-you-been, enjoy-something, bored-vs-boring, advice-uncountable), phone/text (call-someone, let-me-know, take-a-photo).

## Validation
`runChecks` (scripts/content-checks.ts) over a+b+c+d `.verified.json` + `batch-e.json`, with privacy (C8), local denylist (C9) and proper-noun (C10) checks, run by a scratch script (not in the repo): 0 errors. Batch E has no C1-C7 or C12 findings. The only findings on batch E are 71 C10 warnings: Turkish sentence-start words after the "[channel]" bracket (Arkadaşına, Kafede ...), "Small talk", Saturday(s)/Friday(s), London, English, TV. They are false positives of the "not sentence-initial" rule; if you want a clean run, add those words to `content/privacy-allowlist.json` (I did not edit it). No id or targetChunk repeats one from A-D. Batch E ids are new; used-to and look-forward-to already exist in batch D, so I skipped them.

## Sources
Cambridge, Oxford Learner's and Longman pages (all returned 200 via curl) and the SkELL concordance API. Quoted dictionary notes were read from the page text, not from memory.

## commonMistake evidence
Strong (learner-dictionary "Don't say" or Which Word note):
- listen-to-music (*listen music*), wait-for-the-bus (*wait the bus*), call-someone (*call to you*), enter-the-room (*enter into*), pay-for-something (*pay the coffees*), be-interested-in (*interested on*), be-afraid-of (*afraid about*), arrive-in-at (*arrive to*), would-rather (*would rather to stay*), enjoy-something (*enjoyed to watch*), luggage-uncountable (*luggages*), advice-uncountable (*advices*), take-medicine (*drink medicine*), ask-someone-for-directions (*ask to someone*): Longman GRAMMAR boxes.
- lend-someone-something (*borrow me*) and borrow-from-someone (*lent ... from*): Oxford "Which Word? borrow / lend", Longman "Do not confuse".
- do-you-mind-doing (*mind to open*): Cambridge mind "typical errors: we don't use to-infinitive after would you mind / do you mind".
Weaker (verifier: look hardest here):
- marry-someone (*marry with*): Longman/Oxford show transitive use with no preposition, but no dictionary calls "with" wrong. SkELL shows "got married with" in 12 non-standard lines.
- ask-someone-for-directions: Longman's note is about "ask to someone", my mistake sentence adds "ask to you for".

## Left without commonMistake (no evidence)
why-dont-we, could-i-have, let-me-know, how-long-have-you-been, try-it-on, bored-vs-boring (swapped -ed/-ing only in definitions), get-something-fixed, be-good-at, at-the-weekend (both forms correct by region), make-a-reservation, take-a-photo (SkELL "make a photo" lines are non-native but no dictionary says so), have-breakfast, do-the-shopping, miss-the-flight.

## Weak points for the verifier
- **why-dont-we**: Cambridge lists "why don't you...?" and "why not...?", not "why don't we". The SkELL query for "why don't we" returned no lines. The pattern is standard but not quoted. Accepted variants "Shall we go..." and "Why not go..." are not dictionary-checked.
- **let-me-know**: only Cambridge (idiom list) and SkELL; Longman did not show the phrase. noteTr claims "let'ten sonra to gelmez"; I found no "Don't say".
- **how-long-have-you-been**: only Cambridge long (two examples) and SkELL. Accepts "have you lived" as an equal variant.
- **marry-someone**: accepts "get married to" and "is marrying"; situationTr says "evlenecek" (future), so "married" past is not accepted.
- **enter-the-room**: accepts "go into / get into" (valid) but they are not the target chunk; noteTr says so.
- **bored-vs-boring**: level 3 by my judgement; no commonMistake.
- **at-the-weekend**: accepts "at / on / over / this weekend". "this weekend" with a past verb is fine in speech but is not dictionary-checked. noteTr says "bağlama göre" for BrE/AmE.
- **do-the-shopping**: Oxford marks "do the shopping" as British English; the AmE alternative is only in noteTr and is not accepted.
- **make-a-reservation, take-a-photo, miss-the-flight, have-breakfast**: "book a table", "make a booking", "eat breakfast", "get breakfast", "due to" are accepted as near-synonyms, partly BrE; not all are dictionary-checked.
- **have-breakfast**: "What time can we get breakfast?" is plausible but not checked.
- **call-someone**: accepts "phone" and "ring" (BrE); the target is "call".
- **advice-uncountable**: accepts "any advice" (grammatical in questions).
- Contractions: "I'd" is not expanded by the normaliser, so "I'd like" / "I would like" (make-a-reservation, would-rather) are listed separately. "I'm / I'll" are expanded, so only one form is listed.
- Cloze: critical points (preposition, object, modal+verb, participle) are blanked; for would-rather and how-long-have-you-been the whole target phrase is blank (3-4 words).

## Skipped
| Topic | Reason |
|---|---|
| used to, look forward to + -ing | Already in batch D (used-to-do, look-forward-to-doing). |
| make a photo / do a reservation as mistakes | No dictionary evidence. |
| problem with the heating, move into a flat, speak to someone, get to the station, allergic to | Over the ~30 target; can go in a later batch. |
| try on it / "try it on" as commonMistake | No source labels it wrong. |
