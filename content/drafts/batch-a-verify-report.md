# Batch A — independent verification report (2026-10-21)

Result: 33 verified, 0 unsure, 0 rejected. Batch A has no `assign` item, so the coordinator's `assign Ayşe QA-123` ruling does not apply here.

## Method
- Dictionaries fetched with curl and read as text: Cambridge, Oxford Learner's and Longman LDOCE (including its GRAMMAR / "Don't say" notes). Collins, Merriam-Webster and COCA returned 403. The Merriam-Webster `log on` usage note was read through web search.
- Corpus: the SkELL JSON API (`https://skell.sketchengine.eu/api/concordance?lang=English&query=...`, corpus skell_3_11). Hit counts and example lines were checked for each target and each commonMistake. Contractions are tokenized (`did n't`).
- Domain sources: GitHub Docs "Re-run workflows and jobs", the pytest docs output example (`3 failed, 1 passed`) and the Rails Guides for `seed data`.
- Mechanical checks on the output: same ids and order as batch-a.json; 3–8 acceptedAnswers; acceptedAnswers[0] equals modelSentences[0]; commonMistake is not among the answers after the decision 7/19 normalization; no duplicates; the cloze has the same word count as the main answer and matches it outside the blanks; checklistTr has at most 3 entries; noteTr has at most 2 sentences; only the names Ayşe, Mert and Deniz appear. The JSON parses.

## Global changes
- Coordinator name rule: Tom, Sarah and Mehmet were replaced with Mert or Deniz, and the Turkish suffixes were fixed (Mert'e, Deniz'e).
- 11 noteTr fields had 3 sentences. Each is now 2 or fewer (checklist item 12), with the same content.

## Items

| id | verdict | evidence | change |
|---|---|---|---|
| could-you-base-verb | VERIFIED | Cambridge/Oxford modal + bare infinitive (core grammar); SkELL (skell_3_11, 2026-10-21) 'could you check' attested, 'could you to' 0 hits | none |
| will-base-verb | VERIFIED | Cambridge/Oxford will + bare infinitive; SkELL (skell_3_11, 2026-10-21) 'will to send' 3 hits, all noun 'will' or non-native | none |
| need-to-do | VERIFIED | Longman need GRAMMAR (fetched): 'Don't say: I don't need leave'; Cambridge need; SkELL (skell_3_11, 2026-10-21) 'need to update' 348 hits | none |
| let-me-check | VERIFIED | Longman let 'let somebody do something'; Cambridge let; SkELL (skell_3_11, 2026-10-21) 'let me check' 77 hits, 'let me to' only non-standard lines | none |
| i-agree-with-you | VERIFIED | Longman agree (fetched): 'You agree with someone... Don't say: I agree Tanya', not progressive; Cambridge agree; SkELL (skell_3_11, 2026-10-21) 'I agree with you' 1363 hits vs 'I am agree' 16 (non-native lines) | none |
| didnt-fail | VERIFIED | Cambridge fail verb; SkELL (skell_3_11, 2026-10-21) 'didn't fail' 65 / 'did not fail' 263; 'in Chrome' 294, 'on Chrome' 97 (both used) | none |
| the-test-passed | VERIFIED | Oxford pass [I,T] (fetched); Cambridge pass; domain: pytest docs output '3 failed, 1 passed' (docs.pytest.org/how-to/output); SkELL (skell_3_11, 2026-10-21) 'test passed' attested; 'is passed' lines are true passives (someone passes a test), not the software sense | noteTr shortened to 2 sentences and wording made definite ('edilgen yapma') |
| be-able-to | VERIFIED | Cambridge able 'be able to do sth'; Longman able; SkELL (skell_3_11, 2026-10-21) 'wasn't able to reproduce' / 'couldn't reproduce' / 'unable to reproduce' attested in bug-report-like lines | noteTr shortened to 2 sentences |
| want-someone-to | VERIFIED | Longman want (fetched): 'Want is not usually followed by a that clause. Don't say: They want that their son goes...'; Cambridge want; SkELL (skell_3_11, 2026-10-21) 'want me to check' 11, 'would you like me to' 174 | none |
| explain-something-to-someone | VERIFIED | Longman explain (fetched): 'Don't say: Alan explained me the system'; Cambridge explain sth to sb; SkELL (skell_3_11, 2026-10-21) 'explain it to me' 118, 'explain this to me' 37 | name Mehmet -> Mert (situationTr) |
| discuss-something | VERIFIED | Longman discuss (fetched): 'Don't say: discuss about something'; Cambridge discuss; SkELL (skell_3_11, 2026-10-21) 'discuss it' 2231 vs 'discuss about it' 10; 'at the meeting' 3163 > 'in the meeting' 1024 | added 'at the daily' variants (2); noteTr now lists in/during/at and is 2 sentences |
| remind-someone-to | VERIFIED | Longman remind 'remind somebody to do something'; Cambridge remind [T]; SkELL (skell_3_11, 2026-10-21) 'remind you to' 184; seed from 00-brief | clozeTemplate set to decision 18 exact form 'I just wanted to remind ___ to ___ the test plan.' |
| share-something-with-someone | VERIFIED | Longman/Cambridge share sth with sb; SkELL (skell_3_11, 2026-10-21) 'share it with you' 186; 'shared with you the' 7 hits, only with long/heavy objects, so short-object order is unnatural; seed from 00-brief | names Sarah -> Deniz (situationTr), Tom -> Mert (modelSentences); noteTr limited to short objects (heavy-NP shift exists) |
| take-a-look-at-it | VERIFIED | Cambridge look noun: 'take a look', 'have a look mainly UK'; Longman look at; SkELL (skell_3_11, 2026-10-21) 'take a look at it' 181, 'have a look at it' 205; seed from 00-brief | name Tom -> Mert (situationTr) |
| fix-it-today | VERIFIED | Cambridge fix verb [T]; Longman fix transitive; SkELL (skell_3_11, 2026-10-21) 'I'll fix it' 28 hits | none |
| tell-someone-about | VERIFIED | Longman tell (fetched): 'Don't say: He told to his mother the news... You tell someone about something'; Cambridge tell; SkELL (skell_3_11, 2026-10-21) 'told him about the' 280, 'said him about' 0 | none |
| ask-someone-to | VERIFIED | Longman ask (fetched): 'Don't say: ask to someone'; Cambridge ask; SkELL (skell_3_11, 2026-10-21) 'asked him to' 3466; spelling: Cambridge 'rerun' verb, GitHub Docs 'Re-run workflows and jobs' (both spellings in use) | name Tom -> Mert (modelSentences) |
| inform-someone-about | VERIFIED | Cambridge 'inform sb about sth' / 'inform sb of sth' (fetched); Longman inform; SkELL (skell_3_11, 2026-10-21) 'inform them of' 761, 'inform them about' 173 | noteTr shortened to 2 sentences |
| mention-something | VERIFIED | Longman mention (fetched): 'Don't say: He mentioned about a book'; Cambridge mention; SkELL (skell_3_11, 2026-10-21) 'in/at the meeting' both frequent, 'mentioned it during' attested | name Tom -> Mert throughout; model 3 'Did Mert' -> 'Did Deniz' to avoid repeating |
| update-someone-on | VERIFIED | Cambridge 'update sb on sth' (fetched); Longman update; SkELL (skell_3_11, 2026-10-21) 'update you on' 123, 'keep you updated on' 77, 'keep you posted' 355 | name Sarah -> Deniz; added 'I'll keep you posted on the status.'; noteTr 2 sentences |
| data-uncountable | VERIFIED | Longman data (fetched): 'Don't say: datas', singular verb in everyday English; Oxford data [U, pl]; SkELL (skell_3_11, 2026-10-21) 'the data is' 1854 vs 'the data are' 799; seed from 00-brief | none |
| feedback-uncountable | VERIFIED | Cambridge feedback [U] (fetched); Longman/Oxford uncountable; SkELL (skell_3_11, 2026-10-21) 'thanks for the feedback' 126 | name Tom -> Mert (situationTr) |
| information-uncountable | VERIFIED | Longman information (fetched): 'Don't say: I need some informations'; Cambridge [U]; SkELL (skell_3_11, 2026-10-21) 'missing information' 227 | noteTr shortened to 2 sentences |
| software-uncountable | VERIFIED | Cambridge software [U] (fetched); Longman uncountable; SkELL (skell_3_11, 2026-10-21) 'the software on' 242 | none |
| deployment-was-successful | VERIFIED | Cambridge success/successful; Longman success; SkELL (skell_3_11, 2026-10-21) 'was successful' 4593, 'was a success' 1680; 'was success' 35 hits are noun-subject uses ('my goal was success'), not adjective | none |
| set-up-verb | VERIFIED | Cambridge setup noun + set sth up phrasal verb; Oxford set up phrasal verb / set-up noun; SkELL (skell_3_11, 2026-10-21) 'set up the' 7471 vs 'setup the' 266 | noteTr shortened to 2 sentences |
| log-in-to | VERIFIED | Oxford 'log in/on (to something)' + login noun (fetched); Cambridge 'log in/on to sth' (fetched), Longman log in/on; Merriam-Webster log on entry: 'often written log onto and log into' (via web search); SkELL (skell_3_11, 2026-10-21) 'log into' 1471, 'log in to' 772 | added 'I can't sign in to staging.' (noteTr already called it correct; rule 9: context-dependent alternatives must be accepted); noteTr mentions 'log into', 2 sentences |
| reminder-noun | VERIFIED | Oxford reminder 'reminder that...'; Cambridge reminder noun (fetched); Longman reminder; SkELL (skell_3_11, 2026-10-21) 'just a reminder that' 65, 'quick reminder that' 9, 'a quick remind' 0 | added colon variant 'Just a quick reminder: the demo is at 2.' (decision 19 normalizer now ignores inner ':'); noteTr 2 sentences |
| waiting-for-approval | VERIFIED | Cambridge approval [U] + pending adjective (fetched); Oxford approval; SkELL (skell_3_11, 2026-10-21) 'pending approval' 157, 'awaiting approval' 99, 'waiting for approval' 33, 'waiting for approve' 0 | noteTr shortened to 2 sentences |
| failure-noun | VERIFIED | Cambridge fail noun = UK exam result / informal (fetched), failure noun; Oxford fail noun; SkELL (skell_3_11, 2026-10-21) 'failure was caused by' 20, 'fail is caused' 0 | none |
| dependent-on | VERIFIED | Oxford 'dependent on/upon' (fetched); Longman dependent; Cambridge dependent on; SkELL (skell_3_11, 2026-10-21) 'dependent on the' 5531, 'dependent upon the' 1353; domain: Rails Guides (Active Record Migrations) uses 'seed data' | noteTr shortened to 2 sentences |
| analysis-of | VERIFIED | Longman analysis collocations (fetched): 'do/carry out/perform/conduct an analysis', 'analysis of'; Cambridge 'carry out/perform/conduct an analysis'; Oxford analysis; SkELL (skell_3_11, 2026-10-21) 'did an analysis' 29, 'run/ran an analysis' 6/2 (data/tool context) | commonMistake 'I made a quick analyse...' -> 'I did a quick analyse of the logs.' so it contains only the word-form error ('make an analysis' is marginal, not the target) |
| judgmental-question | VERIFIED | Cambridge judgmental adj (also judgemental) (fetched); Oxford judgemental (also judgmental NAmE) (fetched); Longman judgmental; SkELL (skell_3_11, 2026-10-21) 'non-judgmental questions' attested, 'judgmental comments/tone' attested; exact 'judgmental question' low-frequency but grammatical; seed sentence from 00-brief | name Sarah -> Deniz; noteTr 2 sentences |

## Residual notes for the orchestrator (do not block verification)
- `judgmental-question`: the exact collocation "a judgmental question" is rare in SkELL (0 hits in the intended sense; "non-judgmental questions" and "judgmental comments/tone" are attested). It is grammatical and comes from the user's own seed sentence, so it was kept. A more frequent alternative is "That question sounds a bit judgmental."
- `log-in-to`: "sign in to" is now accepted, so a learner can skip the log in / login contrast and still be correct. This follows rule 9. Remove it if the team wants to drill only "log in".
- `the-test-passed`: no learner dictionary has a separate software sense for "pass". The pytest output stands as the domain source.
- `rerun` / `re-run`: Cambridge lists "rerun" as a verb (TV sense). GitHub's UI and docs use "Re-run". Both spellings are accepted.
