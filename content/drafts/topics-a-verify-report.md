# topics-a verification report

Verifier session, 2026-10-23. Input: `content/drafts/topics-a.json` (41 topics). Output: `content/drafts/topics-a.verified.json` (same order).

## Counts

| Result | Count |
|---|---|
| Verified (`verified: true`) | 41 |
| Unsure | 0 |
| Rejected | 0 |
| Changed by the verifier | 36 |
| Unchanged | 5 (able-to-and-managed-to, obligation-and-advice, in-case-and-unless, have-take-and-meetings, cause-effect-language) |

All 16 areas still have at least one verified topic.

## Method

- Unit numbers and titles come from the contents pages: Gram pp. iii–vi (PDF 5–8) and Coll pp. 1–2 (PDF 5–6). The unit pages were opened at Gram PDF 2n+12 and Coll PDF 2n+8 to check that each unit covers the topic.
- Originality: both PDFs were converted to text with Ghostscript. Every example and every trap sentence was checked for 5-word overlap with the books. Hits were read in context. Sentences that were close to a book line were rewritten. After the fixes, the only overlaps left are fixed formulas ("If I were you, I…", "Could you tell me how", "How long have you been", "What is the difference between", "there is a lot of", "you will be able to").
- Grammar evidence: Cambridge Grammar (used to; despite and in spite of; questions with what/who as subject; could; unless; in case), Cambridge Dictionary (look into; due to; whereas) and Oxford Learner's (weekend: at BrE, on AmE).
- itemIds were checked against `content/shipped-ids.lock.json` and against `targetChunk` in `src/content/items.json`. No id is in two topics.
- `npm run content:build` exits 0 and gives no C17 findings. It builds 41 topics. `content/shipped-ids.lock.json` was restored with `git checkout`.

## Fix types

| Fix type | Topics | What it was |
|---|---|---|
| ref | 28 | Wrong unit numbers or unit titles. Examples: indirect questions are Gram 50, not 49. by/until is Gram 120 and for/during is Gram 119, not 123/124. Gram 63 and 64 had their titles swapped. Units that did not cover the topic were removed (for example Gram 6, 22, 54, 94, 99, 109, 116, 118, 130, 134 and Coll 8, 57). Titles that were word-for-word translations of the book's unit title were rewritten. |
| trap | 15 | The wrongEn was not clearly wrong (it was redundant, impolite, emphatic or a common variant), or it had two errors when the note named one, or rightEn was in Turkish (uncountable-nouns). |
| grammar | 10 | Rules stated too strongly or wrongly: always backshift in reported speech, "for + verb" without the for + -ing nuance, the "No, go ahead" answer to "Do you mind -ing", "get the access", and "who/which is always the subject". |
| originality | 7 | Example or trap too close to a book line: Gram 8, 18, 49, 64, 110 and 129, and a Gram additional exercise. Each one was rewritten in a new context. |
| translation | 5 | Turkish translation fixes: ekibin → ekibimizin, the wish clause (olsaydı → olsa), the so-that sentence, "soruna bir çözüme", and "I see your point". |
| itemIds | 5 | Removed `try-doing` (not shipped). Removed `let-me-check`, `fix-it-today`, `merge-pr-into-main`, `revert-the-change` and `sign-off-on` (they do not match the topic's pattern). |
| coverage | 4 | Text or an example was added so that every ref and item has content in the topic: have/get something done, -ed/-ing adjectives and adverbs, at/on the weekend, and "I agree". |
| highlight | 1 | articles-a-the: the highlight was cut down to the pattern ("Most teams"). |

## Per-topic decisions

| # | Topic | Decision | Notes |
|---|---|---|---|
| 1 | past-simple-negatives-questions | verified, changed | Gram 6 (past continuous) removed. |
| 2 | present-perfect-vs-past-simple | verified, changed | "so far" example rewritten (close to Gram 8). Gram 14 title rewritten. |
| 3 | for-since-how-long | verified, changed | Trap 2 now has only the for/since error. |
| 4 | used-to-past-habits | verified, changed | Cambridge lists "didn't used to" as common, so it is not used as a trap any more. The new trap is "use to" in a positive sentence. The old rightEn was close to Gram 18. |
| 5 | plans-and-timetables | verified, changed | The "I will meet…" trap was not clearly wrong. It was replaced with present simple used for a personal plan. The Turkish contrast was corrected. |
| 6 | will-offers-and-decisions | verified, changed | Gram 22 removed. `let-me-check` dropped. Its example was replaced with an I'll example. |
| 7 | time-clauses-if-when | verified, changed | "get the access" → "get access". |
| 8 | able-to-and-managed-to | verified | No change. |
| 9 | obligation-and-advice | verified | No change. Gram 33 covers should have. |
| 10 | polite-requests | verified, changed | Answer to "Do you mind -ing" corrected. |
| 11 | conditionals-and-wish | verified, changed | Trap now has one error. Summary and translation of the wish sentence fixed. |
| 12 | passive-voice-basics | verified, changed | The "by someone" trap is grammatical, so it was replaced. A have/get something done example was added for Gram 46. |
| 13 | subject-and-yes-no-questions | verified, changed | Only Gram 49 kept. The old trap repeated a note from Unit 49 and was replaced with "Is … pass?". |
| 14 | indirect-questions | verified, changed | Ref changed from Gram 49 to Gram 50. |
| 15 | reported-speech-say-tell | verified, changed | Backshift described as usual, not always. Say rule rewritten. |
| 16 | verbs-followed-by-ing | verified, changed | Gram 54 removed. |
| 17 | verbs-followed-by-to | verified, changed | Gram 54 added. Titles of Gram 55 and 57 corrected. `try-doing` dropped. |
| 18 | preposition-plus-ing | verified, changed | The "for to help" trap is not a typical error. It was replaced with "succeeded to". Gram 62 title rewritten. |
| 19 | look-forward-used-to-prevent | verified, changed | Gram 61 (be used to) added. |
| 20 | purpose-and-difficulty | verified, changed | Titles of Gram 63 and 64 swapped. The purpose example was close to Gram 64 and was rewritten. The trap and the for-rule were corrected. |
| 21 | articles-a-the | verified, changed | Gram 69 replaced with Gram 71 (a/an with jobs). Highlight cut down. |
| 22 | uncountable-nouns | verified, changed | Gram 71 and 72 removed. Trap rightEn was Turkish and is now English. |
| 23 | there-it-and-negatives | verified, changed | "It was a problem…" can be grammatical, so it was replaced. Gram 85/86 titles rewritten. |
| 24 | relative-clauses-who-that-which | verified, changed | Gram 94 removed. Subject rule made precise. |
| 25 | word-forms-noun-verb-adjective | verified, changed | Gram 99 replaced with Gram 100. A second section on -ed/-ing adjectives and adverbs was added. The trap was replaced. |
| 26 | adverb-position-still-yet | verified, changed | Example 1 was a sentence from Gram 110 word for word and was rewritten. Gram 109 removed. |
| 27 | contrast-although-despite | verified, changed | Gram 116 removed. |
| 28 | reasons-due-to-given-that | verified, changed | Gram 118 removed. Refs are now Gram 113 (because vs because of) and Coll 53. The trap's rightEn is more natural. |
| 29 | in-case-and-unless | verified | No change. |
| 30 | time-prepositions | verified, changed | Refs changed to Gram 119, 120 and 121. A BrE/AmE weekend note was added. |
| 31 | noun-plus-preposition | verified, changed | Gram 130 removed. The reason-for example was close to Gram 129 and was rewritten. |
| 32 | adjective-plus-preposition | verified, changed | Gram 130 removed. Gram 131 covers every adjective in the topic. |
| 33 | verb-plus-preposition | verified, changed | Refs changed to Gram 132, 133 and 135. |
| 34 | verbs-without-preposition | verified, changed | Refs changed to Gram 126, 132 and 133. |
| 35 | phrasal-verbs-object-position | verified, changed | Gram 140 added (call off, put off). `fix-it-today` dropped. |
| 36 | phrasal-verbs-for-work | verified, changed | Refs changed to Gram 139, 144 and 145. "find it out" is not wrong, so the trap was replaced with "look it into". Two items that are not phrasal verbs were dropped. |
| 37 | make-and-do | verified, changed | Coll 8 removed. The decision example was close to a Gram exercise line and was rewritten. The "make a test" trap was ambiguous and was replaced. |
| 38 | have-take-and-meetings | verified | No change. |
| 39 | bug-reporting-collocations | verified, changed | Title rewritten. Coll 30 is the closest unit; the book has no QA-specific unit. |
| 40 | cause-effect-language | verified | No change. |
| 41 | diplomatic-agreeing-and-summing-up | verified, changed | Coll 57 removed. The tone-only trap was replaced with "I am agree". `sign-off-on` dropped. Translation fixed. |

## Open points (not blocking)

- C10 gives warnings for capitalised words in topics: V3, BrE, AmE, Playwright, Berlin, Android, Fridays. These are product names, a city, or abbreviations. There is no person, employer or client data. The allowlist was not edited.
- Gram has no unit on due to or given that. The refs for `reasons-due-to-given-that` cover the rule "noun after because of, clause after because" (Gram 113) and cause/effect wording (Coll 53).
