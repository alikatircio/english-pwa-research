# Batch H verification report

Independent verifier, 2026-10-23. Input: `batch-h.json`, `modelBlanks-h.json`, `dailyContext-h.json` (not modified). Output: `batch-h.verified.json` (36 items), `modelBlanks-h.verified.json`, `dailyContext-h.verified.json` (overlays for all 36 kept items).

**Result: 35 verified, 1 unsure (try-doing, `verified:false`), 0 rejected.** 27 items were changed and 9 were kept as written. Main fix types:
- Rewrites for originality: 11 sentences or contexts were too close to a book example or exercise line.
- Changes to commonMistake: 7 were removed or replaced, because they had no attestation or were not clearly wrong.
- New accepted variants: added to 13 items.
- Corrections to noteTr and checklistTr: wrong BrE/AmE claims, a noteTr with 3 sentences, and a garbled checklist item.
- Changes to situationTr: 4 now steer toward the target (`succeed in`, `blame … on`) or remove a stray second sentence (`sort it out`).

## Method
- **Dictionaries:** about 120 Cambridge, Oxford Learner's and Longman pages were fetched with curl and grepped. This includes the Oxford phrasal-verb pages and the Cambridge Grammar pages *In case*, *Unless*, *In order to*, *So that or in order that* and the word-pattern pages for avoid, consider, have difficulty, apologize to, invite someone to, provide and succeed.
- **SkELL:** concordance API (`/api/concordance`). The count of lines found is given per item.
- **Google Books Ngram:** en-2019, mean of 2010–2019, exact phrases of 5 words or fewer. Book text is edited, so learner errors often score 0. A ratio above 0 counts as attested. The batch C benchmark is used: the Longman-flagged *discuss about* = 0.93%.
- **Originality:** both book PDFs were extracted with macOS PDFKit. Every model sentence, accepted answer and dailyContext sentence was compared with every book sentence by word-run and stem-overlap. Matches were then read by hand. No book text is quoted here.
- **Build:** `npm run content:build` exits 0 (228 verified items). `content/shipped-ids.lock.json` was restored with `git checkout`.

## Unsure
| Item | Decision | Evidence |
|---|---|---|
| try-doing | unsure (`verified:false`), unchanged | Oxford and Cambridge separate try + -ing (experiment) from try to (effort). For "switch off your phone an hour before bed", both forms are natural advice, so *Try to switch off…* would be marked wrong. Ngram: *try to restart* is 2.3 times as frequent as *try restarting*, so native speakers use try to for remedies too. The mistake *try switch off* = 0. A fix needs a context where only -ing fits, or the item should accept both forms. |

## Per-item decisions
| Item | Decision | Evidence / change |
|---|---|---|
| avoid-doing | verified, changed | O/C/L "avoid doing"; Cambridge word-patterns flags *avoid to*. Ngram *avoid to use* 0.24%. Added *have to* variant. Model 3 rewritten (close to a book example). |
| consider-doing | verified, changed | O/C/L "consider doing"; Cambridge word-patterns. SkELL 40. Ngram *considering to move* 0.74%. noteTr: *thinking of moving* is correct but not the target. |
| postpone-doing | verified | Oxford "postpone doing", "postpone sth until/to sth". Ngram *postpone to do* 0.89%, *postponed to do* 1.20%. |
| manage-to-do | verified, changed | O/C/L "manage to do". SkELL 10. Ngram *managed get* 0.04%. Added *issue* variants. |
| fail-to-do | verified | O/C/L "fail to do". SkELL 40. Ngram *failed doing* 0.09%, *fail doing* 0.26%. |
| tend-to-do | verified | O/C/L "tend to do". SkELL 16. Ngram *tends be* 0.10%. |
| to-infinitive-of-purpose | verified, changed | Cambridge Grammar *in order to*. SkELL 40. Mistake *for buy* (0) replaced by *for buying* (2.35% of *to buy tickets*). This is wrong for a person's purpose. |
| so-that-purpose | verified, changed | Cambridge Grammar *so that*: modal after so that, and *that* is often dropped. Ngram *so that everyone to* 0.08%. Model 3 rewritten (close to a book exercise answer). |
| have-trouble-doing | verified, changed | Cambridge [+ -ing] for trouble and difficulty; Oxford "difficulty (in) doing". Ngram *trouble to connect* 2.08%. Added *problems/issues connecting* (21.5% / 5.5% of the *trouble* form), which keeps the -ing point. |
| in-case-clause | verified, changed | Rewritten to *I'm leaving early in case there's traffic.* (8 variants). The umbrella/rain canonical was a tense-shifted book example, and the daily jacket sentence paraphrased a book exercise. The new daily sentence is about cash and cards. Cambridge Grammar *In case*. Ngram *in case it will* 2.01%. |
| unless-clause | verified, changed | Cambridge Grammar *Unless*: no will after unless, and the page explicitly rejects the double negative. Added *comes up* and fronted *shows up* variants (8). |
| thanks-for-doing | verified, changed | Oxford "thank sb for doing". SkELL 40. Ngram *for help me* 0.10%. Added *move house* and *with the move*. Daily sentence rewritten (close to a book example). |
| apologise-for-doing | verified, changed | Oxford/Longman "apologize for (doing)". Mistake *apologise to reply* removed (0 in Ngram, and the noteTr reasoning was weak). noteTr and checklist rewritten. Model 3 changed away from a Cambridge Grammar example. |
| succeed-in-doing | verified, changed | O/C/L "succeed in doing". Ngram *succeeded to fix* 0.85%. situationTr changed from *başardık* (which elicits *managed to*) to *düzeltmede başarılı olduk*. Daily sentence rewritten (close to a book exercise). |
| insist-on-doing | verified | O/C/L "insist on doing". SkELL 23. Ngram *insisted to pay* 0.49%. |
| aware-of | verified, changed | O/C/L "aware of". Ngram *aware about the* 0.25%. noteTr no longer says aware takes "only of" (*aware that* exists). |
| short-of | verified, changed | Oxford: *short of*, and *short on* (informal) with no BrE/AmE label, so the BrE/AmE claim was removed. Ngram *short on staff* 35% of *short of staff*, so both are accepted. Changed from staff to testers: the old canonical was the corrected form of a book exercise. |
| damage-to | verified, changed | O/C/L "damage to". Ngram *no damage on the* 3.73%. Model 2 and the daily sentence rewritten (storm/roof paraphrased a Collocations example). Added *The restore did no damage…*. |
| demand-for | verified | O/C/L "demand for". Ngram *high demand of* 7.9%, *demand of the product* 5.6%. |
| difference-between | verified, changed | O/C/L "difference between A and B". Mistake *between staging with production* removed (no attestation; *difference between it with* = 0). modelBlanks[1] no longer blanks *the*. |
| invitation-to | verified, changed | O/L/C "invitation to". Rewritten to *…the invitation to your wedding!*: the birthday-party canonical and the daily sentence matched book lines. The new daily sentence is about the neighbours' barbecue. Mistake removed: Oxford lists *invitation for dinner*, and Ngram *invitation for the party* = 6.6% (partly legitimate). noteTr now explains *for dinner*. |
| answer-someone-no-to | verified | L/C "answer a question/my question". SkELL 4. Ngram *answered to the question* 0.36%. |
| apologise-to-someone-for | verified, changed | Cambridge word-patterns "apologize to someone". Ngram *apologized him* 0.25%. situationTr now names a team channel, so the third-person wording is natural. |
| provide-someone-with | verified | O/C/L "provide sb with sth". SkELL 40. No mistake, which is correct. |
| remind-someone-about | verified, changed | Oxford "remind sb about/of sth", Longman "remind sb about sth". Ngram *to remind about the* 4.8%. Model 2 changed away from a book frame. |
| blame-something-on | verified, changed | O/C/L "blame sth on sth". SkELL 7. Ngram *blamed it to* 0.09%. situationTr *bağladı* (which elicits *attributed to*) changed to *suçunu … attı*. Added *corrupted*. noteTr mentions *blame X for Y*. |
| find-out | verified | Cambridge/Oxford/Longman find out. SkELL 40. A general phrasal verb, so dictionary evidence stands in for a QA domain source. |
| sort-it-out | verified, changed | Oxford sort out "(especially British English)". Ngram *sort out it* 0.05%, *sort out them* 0.35%. Removed the extra quoted Turkish sentence. Added a BrE note. |
| work-out-what | verified, changed | Oxford work out / figure out; Cambridge "(US usually figure sth out)". Rewritten to *…what broke the build*: the old canonical paraphrased a book example. Mistake removed (0). Model 2 changed. |
| call-off | verified, changed | Oxford "call sth off = cancel". Ngram *cancelled off the* 0.04%. Changed from match/rain (a book exercise) to concert/singer ill. Model 2 and the daily sentence changed. noteTr adds ill/sick. |
| put-off | verified, changed | Oxford put off "synonym postpone". Ngram *postponed by a week* 17% of *for a week*, so *by a week* variants were added. Mistake removed (0 attestation). Daily dentist sentence rewritten. |
| fill-in-a-form | verified, changed | Oxford: fill in "especially BrE", fill out "BrE and NAmE". Ngram *fill up the form* 6.2% / 3.0%. noteTr BrE/AmE wording corrected. |
| come-up-with | verified, changed | Oxford/Cambridge come up with. Ngram *came up an idea* 0.12%. noteTr cut from 3 to 2 sentences. |
| get-held-up | verified, changed | Cambridge hold up "B1 to delay". SkELL 30. Ngram *was hold up* 1.09%. Fixed the garbled checklist item 2 and the noteTr claim that *oyalandım* is active. Model 2 now uses *Sorry I'm late*. |
| carry-out | verified, changed | Oxford carry out and "run a test/check". Ngram *carried the survey* 3.8%. Added *ran* (an established QA collocation, as the work_vocab rule requires). noteTr wrongly called carry out the most informal; corrected. |

## Build
- `npm run content:build`: exit 0. 228 verified items, including 35 from batch H.
- Batch H has no errors and no C6 warnings. The C10 warnings are Turkish words or generic terms only: Arkadaşına, Daily, Dün, VPN, URL, Fridays, Mondays and similar. No real names are used.
- `content/shipped-ids.lock.json` was restored with `git checkout`. No other tracked file was edited. `src/content/items.json` and `extras.json` were regenerated by the build, and both are gitignored.
