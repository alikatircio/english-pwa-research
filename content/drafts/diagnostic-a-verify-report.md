# diagnostic-a verification report

Verifier session: 2026-10-23. Input: `content/drafts/diagnostic-a.json`. Output: `content/drafts/diagnostic-a.verified.json`, with all 48 entries in the same order.

The author notes file was not read. Book text is not quoted here. Units and PDF pages are cited only.

## Counts

| Result | Count |
|---|---|
| Verified (`verified: true`) | 48 |
| Unsure (`verified: false`) | 0 |
| Rejected | 0 |
| Changed (any field) | 41 |
| Unchanged apart from verifier fields | 7 |

Every area has 3 verified questions (16 × 3 = 48). The set therefore meets the "0 or exactly 48" build rule.

## Fix types (one question can have several)

| Fix type | Questions |
|---|---|
| Wrong book unit corrected | 26 |
| Second relevant unit added only | 4 |
| Rewritten for originality (too close to a Study guide item or a unit example) | 11 |
| Stem or options rewritten (any reason) | 10 |
| Distractor replaced (arguably correct, or echoed a Study guide option set) | 6 |
| promptTr corrected or clarified | 5 |
| explanationTr corrected | 4 |
| relatedItemIds added or dropped | 4 |
| Wording fix (spacing, unexplained "Yes,") | 2 |

## Method

- **Unit numbers:** checked against the Gram contents (PDF 5–8) and the explanation page of each unit (PDF 2n+12). Coll units were checked against the Coll contents and their pages (PDF 2n+8).
- **Originality:** each completed stem was compared by 4-gram overlap against the full text of both books. Every question was also compared by hand with the Gram Study guide (PDF 338–347).
- **Usage evidence:** Cambridge Dictionary for call off, come up, point out and log (curl). Google Ngram 2010–2019 for log/raise/file a bug, "might be worth checking" and "on call at/on the weekend".
- **Repo checks:** the output was run through the repo's `DiagnosticQuestionSchema`, `checkQuestion`, `checkDiagnosticSet` and the C8–C10 privacy checks (`runExtrasChecks`, run from a scratch script; no repo file was changed).
  - Result: 0 errors. C10 gave false-positive name warnings on words in explanationTr (Amerikan, İngilizcesinde, Could, Would, Do).
  - 27 questions keep an empty `relatedItemIds`. This is a warning, not an error.

## Reasons table (changed questions)

| id | Change | Reason |
|---|---|---|
| dq-present-past-2 | rewrite | Frame was close to a Gram Study guide item for unit 6. New alert/smoke-test context. |
| dq-present-past-3 | refs | Added Gram 2 (present simple routines). |
| dq-present-perfect-2 | refs | for/since is Gram 12, not 10. Added 9. |
| dq-present-perfect-3 | refs, reorder | Past perfect is Gram 15, not 16. Sentence moved away from the unit-example frame. |
| dq-future-1 | wording, distractor, refs | Removed "Yes,". Replaced "run" (borderline timetable use) with "have run". Added Gram 20. |
| dq-future-2 | option text, related | "I 'll take" spacing changed to "will take". Added will-base-verb and take-a-look-at-it. |
| dq-modals-2 | explanation | Clearer deduction vs prohibition note. |
| dq-modals-3 | distractor | must have / should have pair echoed a Study guide item. Replaced with "have to". |
| dq-if-wish-1 | refs | Added Gram 25. |
| dq-if-wish-2 | rewrite | The if-clause matched a unit 39 example. New content. |
| dq-if-wish-3 | refs | wish + past perfect is Gram 40, not 41. |
| dq-passive-1 | explanation | Turkish said "the person who made the bug". Corrected to the person who fixed it. |
| dq-passive-2 | prompt | promptTr now matches "rewritten". |
| dq-passive-3 | prompt | Turkish wording improved. |
| dq-questions-reported-speech-1 | refs, rewrite | Indirect questions are Gram 50, not 51. Option set mirrored Study guide items. New past-tense "why" item. |
| dq-questions-reported-speech-2 | refs, explanation | say/tell is Gram 48, not 52 (question tags). |
| dq-questions-reported-speech-3 | refs, rewrite, related | Questions are Gram 49, not 47. Distractor "is" was correct ("How often is the job run?" is a passive question). Verb changed to "fail". |
| dq-ing-to-1 | refs, rewrite | look forward to is Gram 60, not 63. Frame and options were close to a Study guide item. |
| dq-ing-to-3 | refs, distractors | suggest + -ing is Gram 53, not 56. Option set echoed a Study guide item. |
| dq-articles-nouns-2 | rewrite, prompt | promptTr gave the answer away. "QA" has no a/an trap. Changed to "a unit test". |
| dq-articles-nouns-3 | refs | Known "the" is Gram 72–73, not 74. |
| dq-pronouns-determiners-1 | refs | there is/are is Gram 84, not 82. |
| dq-pronouns-determiners-2 | refs | some/any is Gram 85, not 83. |
| dq-pronouns-determiners-3 | refs, explanation | each/every is Gram 91 (+90), not 88. |
| dq-relative-clauses-2 | refs | Object relative clauses are Gram 93 (+92), not 94. |
| dq-relative-clauses-3 | refs | Extra-information "who" is Gram 95, not 96. |
| dq-adjectives-adverbs-1 | refs | Adjective after be is Gram 100, not 98. |
| dq-adjectives-adverbs-2 | refs | Added Gram 106 (much + comparative). |
| dq-adjectives-adverbs-3 | rewrite | Stem matched a Gram unit 43 example almost word for word. |
| dq-conjunctions-1 | related | Added despite-doing. |
| dq-conjunctions-2 | refs | in case is Gram 114, not 115. |
| dq-conjunctions-3 | refs | as vs like is Gram 117, not 118. |
| dq-prepositions-1 | refs, rewrite | Weekend is Gram 121, not 123. The "See you ___ + time" frame echoed a Study guide item. Dropped "in" as a distractor (regional use). |
| dq-prepositions-2 | refs | interested in is Gram 131, not 130. |
| dq-prepositions-3 | refs | discuss (no preposition) is Gram 133, not 135. |
| dq-phrasal-verbs-1 | refs, rewrite | Same verb and contrast as the Gram 137 example and exercise. Now "point it out" (Gram 137, 139), which matches the related item. |
| dq-phrasal-verbs-2 | refs | come up is Gram 144, not 138. |
| dq-phrasal-verbs-3 | rewrite, related | go over/through is in no Gram unit. Now "call off" (Gram 140). Dropped walk-someone-through. |
| dq-work-collocations-1 | refs | Coll 6 is intensifying adverbs. Coll 7 (make/do) fits the distractors. |
| dq-work-collocations-2 | refs, prompt | "see someone's point" is in Coll 55, not 30. promptTr now makes "so" illogical. |
| dq-work-collocations-3 | refs, distractor | it's worth -ing is Gram 63. Coll 53 does not cover it. "good" (borderline) replaced by "worth of". |

## Residual notes

- **dq-adjectives-adverbs-3:** "still" in end position after a negative is treated as wrong (standard position is before the auxiliary). Informal speech sometimes has it.
- **dq-work-collocations-1:** Coll 7 covers the make/do distractors, not "log/raise a bug" itself, which no allowed Coll unit covers.
- **dq-articles-nouns-2:** Gram 71 covers a/an with singular countable nouns. The a/an pronunciation rule is not explained in a Gram unit.
