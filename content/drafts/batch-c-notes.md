# Batch C: notes (v1.1, all categories)

Author pass, 2026-10-22. 36 items, all `verified: false`, and every `verifiedNote` starts with "author".
Counts: aux_to 7, object 7, word_form 7, preposition 7, work_vocab 8.

Sources reached with curl: Cambridge, Oxford Learner's and Longman. Every cited URL returned 200. Corpus checks used the SkELL API (`skell.sketchengine.eu/api/concordance`). Domain sources were GitHub Docs (merge, revert, @mention) and the Playwright docs ("run tests against a staging environment", "flaky and fails intermittently"). Product names appear only in `verifiedNote`. User-facing fields contain no real company or product names, and the only people named are Ayşe, Mert and Deniz.

## Validation
- The JSON parses (36 items).
- I ran the real `runChecks` from `scripts/content-checks.ts` on batch A + B + C, with the privacy (C8) and proper-noun (C10) checks enabled. Batch C has no errors, no warnings and no info findings.
- No id or targetChunk is the same as one in batch A or B. `mention-someone-in-a-comment` is about @-tagging, which is not the same lesson as `mention-something` ("mention about").

## Items
| Category | ids |
|---|---|
| aux_to | does-the-test-pass-question, has-been-failing-since, it-turned-out-that, not-sure-whether, had-to-rerun, should-have-tested, make-sure-the-tests-pass |
| object | describe-something-to-someone, point-it-out, investigate-the-failure, clarify-the-requirements, attach-logs-to-the-ticket, hand-over-to, contact-someone |
| word_form | fails-intermittently, progress-uncountable, documentation-uncountable, a-lot-of-work, in-terms-of, prioritise-verb, clarification-noun |
| preposition | on-leave, in-charge-of, get-rid-of, familiar-with, similar-to, focus-on, catch-up-on |
| work_vocab | run-tests-against-staging, merge-pr-into-main, revert-the-change, take-over-from, double-check, run-out-of-time, as-far-as-i-know, mention-someone-in-a-comment |

Team terms confirmed by the user are used in model sentences: "raise a bug" (should-have-tested, double-check), "blocked on" (focus-on), "corner case" (it-turned-out-that) and "EOD" (hand-over-to).

## Skipped
| Topic | Reason |
|---|---|
| estimate a ticket | Cambridge confirms *give/make/provide an estimate*. But no typical error is clear (*an estimation* is not clearly wrong), and the Jira docs page is a JavaScript app I could not read. |
| deploy to staging | *to / on / in staging* are all in use, and the obvious Turkish error (*do a deploy*) is also native jargon. Uniqueness is too weak. It appears as a variant in as-far-as-i-know. |
| blocked on, corner case, EOD as separate items | These would duplicate existing items (blocked-by, edge-case, by-deadline). See the recommendations below. |

## Weak points for the verifier
- **commonMistake left empty** (no evidence of a typical error): prioritise-verb, catch-up-on, run-tests-against-staging, merge-pr-into-main, take-over-from, mention-someone-in-a-comment.
- **Mistakes based on my judgement, not on a source**: *It was turned out* (it-turned-out-that), *in charge for*, *clarify about*, *should have test*, *in term of*, *clarify* used as a noun (clarification-noun), and *Is the test pass*. Only similar-to (*similar with*) and progress (*a progress*) have a learner-dictionary "Don't say" note (Longman).
- **revert-the-change**: SkELL has 645 hits for *revert back*, mostly the intransitive *revert back to* in general English. Calling it a mistake is a redundancy and style judgement for the software sense.
- **merge-pr-into-main**: *merge to main* is accepted from industry usage only. No dictionary confirms it.
- **run-tests-against-staging**: a b.g. (context-dependent) item. *on* and *in* are also accepted. It is level 3.
- **has-been-failing-since**: *has failed since* is deliberately not accepted (the target is the continuous form). The verifier may want to add it.
- **not-sure-whether**: filed as aux_to (the error is where *is* goes). It could arguably be its own word-order type.
- **mention-someone-in-a-comment**: learner dictionaries have no @-mention sense. It rests on GitHub Docs plus the Cambridge "tag (social media)" sense.

## Recommendations for existing items (not edited, per instructions)
- `blocked-by`: add "I'm blocked on …" variants (user-confirmed).
- `edge-case`: accept *corner case* (user-confirmed).
- `log-a-bug`: make *raise* the canonical answer (user says it is primary).
- `get-back-to-someone` / `by-deadline`: consider *by EOD* variants.
