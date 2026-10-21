# Batch A — author notes (aux_to, object, word_form)

33 items, all `verified: false`. aux_to 9 · object 11 · word_form 13.
Built with a script that checks the following. All required fields are present. ids are unique. There are 3–8 acceptedAnswers. acceptedAnswers[0] == modelSentences[0]. checklistTr has ≤3 entries. commonMistake is not among the accepted answers. The cloze has the same word count as the main answer.

## Sources actually consulted
Fetched with curl and read as text: Cambridge Dictionary, Longman LDOCE (its "GRAMMAR / Don't say" notes were the most useful) and Oxford Learner's (for some entries).
Not reachable: Merriam-Webster and Collins (403), SkELL API (empty response), Microsoft Style Guide (404). **No corpus check was done**, so the verifier should run SkELL/COCA checks.

## Skipped candidates
- **#64 requirement / require**: the typical error `*meet the requires` is marked "?" and I found no evidence for it. Skipped.
- The rest of my categories are written. Two "?" candidates were confirmed and included:
  - **#34 set up / setup**: Cambridge (setup noun, set something up phrasal verb) and Oxford (set up phrasal verb, set-up noun BrE). All of them give the verb as two words.
  - **#44 update someone on**: Cambridge and Longman both give "update someone/somebody on something". `commonMistake` is left **empty** because the "?" was about the error.

## Choices and doubts (for the verifier)
1. **take-a-look-at-it**: `commonMistake` is empty. 04 says "Could you take a look?" on its own is natural, so I could not write a confirmed mistake.
2. **remind-someone-to cloze**: the 06 example `I just wanted to ___ you ___ send...` leaves "you" visible. Under rule 04 §3 (the critical point is always blank) I blanked "you" too: `to ___ ___ ___ send`. The orchestrator can pick either.
3. **Variants marked "bağlama göre" (context-dependent)**: on/in Chrome (didnt-fail); in/during the daily (discuss); in/during/at the meeting (mention); need to / have to; wasn't able to / couldn't; take / have a look; information / info. These are all in acceptedAnswers and noted in noteTr.
4. **Alternatives deliberately left out** (marked "Kısmen", partly correct): `talk about it` (discuss), `let the team know` (inform), `sign in to` (log in), `explain the issue to Mert` (tell-someone-about). noteTr mentions these.
5. **log into**: Oxford/Cambridge give "log in (to)". I did not see "log into" in the entries I read but accepted it. Needs confirmation.
6. **pending approval**, **ran a quick analysis**, **rerun / re-run** spellings, **seed data** (term): based on my own judgement, needs confirmation.
7. **the-test-passed**: "pass" as an intransitive verb for software tests has no dictionary sense of its own (Oxford/Cambridge give the exam/test sense). A domain source (test runner docs) could be added.
8. **reminder-noun**: the normalizer only strips leading/trailing punctuation, so no variant has a colon inside it. The natural "Just a quick reminder: …" form is mentioned only in noteTr. Suggestion: the normalizer could treat inner `:`/`,` as optional, or this stays as it is.
9. **commonMistake sources**: Longman "Don't say" notes directly confirm discuss about, explain me, ask to someone, told about (no object), mentioned about, want that, need + bare verb, I'm agreeing, datas, informations, dependent of. The other mistakes (could you to, will to, let me to, wasn't fail, is passed, I said Mert, inform to, softwares, was success, setup as verb, login as verb, remind as noun, approve as noun, fail as noun, is depend, analyse as noun, judging) come from the 04 list or the seed. They are typical learner errors but have no corpus evidence. `judging question` comes from the seed's word-form note.
10. **Names**: Ayşe, Mert, Deniz, Mehmet, Sarah, Tom. No real company or person names.

## Questions (work terms)
- No term was invented. My judgement only: "seed data" (fixture/seed data for tests) and "nightly run" (in modelSentences). If these are not used in your team, please flag them.
- Which login wording does the team use: "log in" or "sign in"? If "sign in", it could be added to acceptedAnswers.
