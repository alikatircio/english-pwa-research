# Batch G verification report

Independent verifier, 2026-10-23. Input: `batch-g.json`, `modelBlanks-g.json` and `dailyContext-g.json` (none of them modified). Output: `batch-g.verified.json` (28 items, all kept), `modelBlanks-g.verified.json` and `dailyContext-g.verified.json` (28 entries each, copied unchanged; every blank still refills).

**Result: 28 verified, 0 unsure, 0 rejected.** 24 items were changed and 4 have no change. The main fix types:
- 8 commonMistakes were replaced because the old one is correct English or barely attested. 3 commonMistakes were removed.
- 5 items moved from a private-life scene to a work channel (04 §2.3 says work_vocab needs a work context).
- 3 situationTr texts leaked the target or were calques.
- 6 answer lists were missing correct forms.
- 7 noteTr or checklist lines had wrong claims or more than 2 sentences.

## Method
- Cambridge, Oxford Learner's and Longman pages were fetched with curl and grepped, with 2–3 dictionaries per item. Two Cambridge Grammar pages were also used: *very* and gradable/non-gradable adjectives.
- SkELL concordance API (`/api/concordance`). Note: SkELL splits *don't* into *do n't*.
- Google Books Ngram (en-2019, mean for 2010–2019, exact form). For comparison, the batch C benchmark *discuss about* = 0.93%. The rule used here: a mistake that is correct in real English (several %) is not kept. A mistake with 0 hits is omitted.
- Originality: the cited Collocations units (6, 7, 9, 28, 32–33, 53, 55, 56) were extracted with Ghostscript. Every answer, model and dailyContext sentence was checked for 5-word overlaps. The only overlaps are the bare collocation frames (*it is highly unlikely that*, *I have serious misgivings about*, *agree up to a point, but*, *I would strongly recommend that you*, *the underlying cause of the*). In each case the rest of the sentence is our own. One noteTr that followed the structure of a unit (immediate vs underlying cause) was rewritten.
- Privacy: only Ayşe, Mert and Deniz are used. There is no real company, person or URL.

## Per-item table
| Item | Decision | Changes | Evidence |
|---|---|---|---|
| make-a-decision | verified | situationTr typo (*Konuda* → *Bu konuda*) | Longman: *take a decision* is BrE (important or formal), which supports the register note. Cambridge: *decision on*. SkELL *make a decision on*: 541 lines. Ngram *do a decision* 0.01% |
| make-a-mistake | verified | Work context: deploy to the wrong environment. New cloze, answers, model 1 and mistake | Longman COMMON ERRORS: *do a mistake* is wrong. Oxford: *make a mistake*. Ngram *did a mistake* 0.07% |
| make-progress | verified | none | Longman: *make progress*, *progress on/with*, and not used with *a*. SkELL *make progress on*: 291 lines. Ngram *do progress* 0.86% |
| make-changes | verified | mistake *did a few* → *did some changes* | Longman: *make some changes to*. Ngram *did some changes* 1.47%, *did a few changes* 0 |
| carry-out-research | verified | none | Longman: *do/carry out research*, and COMMON ERRORS: not *make research*. Oxford: *do/conduct/undertake research*. SkELL *carry out some research*: 11 lines |
| take-action | verified | Checklist 2 no longer calls *take an action* wrong | Longman/Oxford: *take action*. Ngram *do an action* 0.54%. *take an action* 2.47% (AmE/tech use) |
| take-a-risk | verified | Work context: releasing on Friday. Mistake *get a risk* removed. Unsupported "more formal" claim removed | Oxford/Longman: *take a risk/risks*, *take the risk of doing*. SkELL *take a risk by*: 38 lines. *get a risk*: SkELL 0 real lines |
| pay-attention-to | verified | Mistake *give attention* → *put attention to*. noteTr "pay = harcamak" corrected | Longman: *pay attention to*. Oxford: *pay close attention*. Ngram *give attention to* 4.31% (correct English), *put attention to* 0.03% |
| highly-unlikely | verified | *very unlikely* added. Checklist 2 rewritten | Oxford: *highly/extremely unlikely that*. Longman: *highly/most/very unlikely*. Ngram *strongly unlikely* 0.01%, *very unlikely* 71% |
| strongly-recommend | verified | Mistake *recommend you to run* → *recommend to run*. noteTr and checklist updated | Oxford lists *recommend somebody to do* (BrE), so the old mistake was correct English. Cambridge: *+ that* and *+ -ing*. Ngram *recommend to run* 4.5% |
| fully-aware | verified | *very aware* added. Checklist 1 no longer calls *very aware* wrong | Oxford: *fully/well aware of*. Longman: *fully aware of*. Ngram *aware about the* 0.25%, *very aware of* 41% |
| deeply-concerned | verified | Mistake *concerned for* removed. noteTr cut to 2 sentences | Oxford: *deeply concerned about*; *concerned for* is also listed. Ngram *concerned for the* 8% |
| absolutely-exhausted | verified | Work context. *really exhausted* added | Cambridge Grammar *very*: extreme adjectives take *absolutely/completely/really/totally*, not normally *very*. Oxford *absolutely*: used with extreme adjectives. Ngram *absolutely tired* 6% (informal) |
| provide-evidence | verified | Mistake *give evidence* → *provide an evidence*. noteTr updated | Cambridge/Longman: *provide evidence (that)*. Longman: do not say *evidences*; use *a piece of evidence*. Ngram *give evidence that* 10%, *provide an evidence* 0.98% |
| draw-a-conclusion | verified | none | Longman: *draw a conclusion*. Cambridge: *reach/come to/draw a conclusion*. Ngram *take a conclusion* 0.25% |
| take-into-consideration | verified | Checklist 3 rewritten | Oxford/Longman: *take something into consideration*. Ngram *take in consideration* 0.93% |
| draw-attention-to | verified | Mistake *attract* → *pull attention to*. *I'd like* variants added. Checklist 3 (*draws*) replaced | Oxford/Cambridge/Longman: *draw attention to*. Ngram *attract attention to* 4.45%, *pull attention to* 0.03% |
| underlying-cause | verified | Mistake *basic cause* → *root reason*. noteTr rewritten | Oxford/Cambridge/Longman: *underlying cause*. Oxford/Cambridge: *root cause*. Ngram *basic cause of* 11%, *root reason of* 0.08% |
| minimise-the-impact | verified | noteTr: *mitigate* → *reduce* | Oxford *minimize* (BrE also *minimise*). Oxford *impact*: *reduce/minimize the impact*. Ngram *minimum the impact* 0.86% |
| tend-to-agree | verified | none | Oxford *tend*: *I tend to agree with*. SkELL: 180 lines. Ngram *tend to agree to* 2.1% |
| agree-up-to-a-point | verified | *agree with you* variants added. Mistake *until a point* removed. Checklist 3 removed | Oxford *point*: *agree with you up to a point*. Cambridge: *up to a point*. Oxford: *to some/a certain extent*. *agree until a point*: Ngram 0, SkELL 0 |
| have-serious-misgivings | verified | *grave misgivings* added. Checklist and noteTr (3 → 2 sentences) | Longman: *grave/serious/deep misgivings about*. Cambridge/Oxford: *misgivings about*. Ngram *misgivings for* 1.4%, *on* 4.7% |
| reserve-judgement | verified | situationTr was a calque of the target. noteTr cut from 4 to 2 sentences | Cambridge: *reserve judgment*. Longman: *reserve judgement until*. SkELL: 40 lines. Ngram *keep my judgement* 0.6% |
| have-second-thoughts | verified | Work context. situationTr leaked "second" | Oxford/Cambridge: *have second thoughts (about)*. Ngram *having second thought* 0.10% |
| constructive-criticism | verified | Checklist and noteTr no longer call *criticism* uncountable only | Oxford/Longman: *constructive criticism*, *criticism* [U, C]. Ngram *constructive critic* 1.8% |
| give-credit-to | verified | situationTr leaked the target (*krediyi vermek*) → *hakkını vermek* | Oxford: *give due credit to*, *give him credit for*. Longman: *give somebody credit for*. Ngram *give a credit to* 0.40% |
| dont-quite-understand | verified | *didn't quite understand/get … meant* added. Model 3 *see* → *understand* | Oxford *quite*: *I don't quite know/follow*. SkELL *do n't quite understand*: 190 lines, *quite do n't understand*: 1 |
| take-advantage-of | verified | Work context: quiet week, old tests. Checklist 3 fixed | Oxford/Longman: *take advantage of something*. Ngram *take an advantage of* 0.05% |

## Not changed, but noted
- *I made a few changes in the config file* is kept. *Changes in* is natural when it names the place.
- minimise-the-impact: *reduce the impact* is correct, but it is not accepted because it skips *minimise*. noteTr explains this.
- draw-a-conclusion: *make a conclusion* = 20% in Ngram, so it is not used as the mistake.
- Overlays: the 5 dailyContext sentences stay in private life, which is their purpose. modelBlanks were not changed. Model 3 of dont-quite-understand now refills with *understand*.

## content:build
- **Exit 0, 0 errors.** 256 verified items (work_vocab 76). Batch G has no C3, C4, C5, C6, C14 or C15 finding.
- C10 warnings in batch G are Turkish words (Aceleyle, Başarıyı, Hatanı …) or generic terms (Code, Daily, Docker, RCA, E-posta). None is a real person.
- `batch-h.verified.json` appeared later. A rebuild with it also exited 0 with 256 items, so none of its items shipped yet. There were no batch H errors.
- `content/shipped-ids.lock.json` was restored with `git checkout`. The other verifier's build had also added the batch G ids to it, and that was undone too. `src/content/items.json` is gitignored. Nothing was committed.
