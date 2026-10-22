# Batch D: notes (level 3, B2+ to C1 workplace writing)

Author pass, 2026-10-22. 31 new items, all `level: 3`, `verified: false`; every `verifiedNote` starts with "author:".
Counts: aux_to 7, object 5, word_form 6, preposition 6, work_vocab 7.

Sources reached with curl (all returned 200): Cambridge, Oxford Learner's and Longman pages, plus the SkELL concordance API. The URLs are in each `verifiedNote`. Longman pages for given-that, about-to, supposed-to and lead-to returned only a "Suggestions" page, so they are not cited. Names used: Ayşe, Mert, Deniz only.

## Validation
- JSON parses (31 items). `runChecks` from `scripts/content-checks.ts` ran on batch A + B + C (`.verified.json`) + D with the privacy (C8), proper-noun (C10) and local denylist checks. Batch D has no errors, warnings or info findings. The only finding in the combined run is an old C6 warning in reminder-noun (batch A/B/C, not D).
- No id or targetChunk repeats one from A, B or C.
- Team terms used in model sentences: "raise a bug" (be-supposed-to, be-about-to, ensure-that-clause; as "raising a bug" in suggest-doing and it-might-be-worth-doing), "blocked on" (used-to-do, verify-that-clause, despite-doing, although-clause, i-see-your-point-but, to-sum-up, ensure-that-clause), "corner case" (suggest-doing, suggest-that-clause, prevent-from-doing, despite-doing, although-clause, mitigate-the-risk, it-might-be-worth-doing), "EOD" (would-it-be-possible-to, address-an-issue).

## Items
| Category | ids |
|---|---|
| aux_to | would-it-be-possible-to, be-supposed-to, be-about-to, used-to-do, be-used-to-doing, look-forward-to-doing, suggest-doing |
| object | suggest-that-clause, prevent-from-doing, verify-that-clause, ensure-that-clause, walk-someone-through |
| word_form | due-to-noun, despite-doing, although-clause, given-that-clause, as-a-result-of-noun, affect-vs-effect |
| preposition | impact-on, reason-for, solution-to, have-access-to, increase-in, result-in |
| work_vocab | mitigate-the-risk, address-an-issue, raise-a-concern, it-might-be-worth-doing, i-see-your-point-but, to-sum-up, whereas-contrast |

Contractions: the normaliser expands "I'm / it's / isn't" but not "'d", so "I'd" and "I would" are listed separately in suggest-doing and suggest-that-clause.

## commonMistake evidence
Strong (a learner-dictionary "Don't say" note or a Which Word note):
- suggest-doing (*suggest to check*) and suggest-that-clause (*suggest Mert to test*): Longman suggest GRAMMAR.
- despite-doing (*despite of*): Longman despite. although-clause (*despite* + clause): Longman despite, "Don't say: despite he was injured".
- reason-for (*reason of*): Longman reason. look-forward-to-doing: Longman (the "for" error), plus SkELL, where 1 of 40 "looking forward to see" lines is the base form.
- used-to-do and be-used-to-doing: Oxford "Which Word? used to / be used to". affect-vs-effect (*effects the*): Oxford "Which Word? affect / effect".

Weaker (the pattern is in the dictionaries, and SkELL shows the non-standard form really occurs, but no dictionary calls it wrong):
- prevent-from-doing (*prevent … to be merged*), ensure-that-clause (*ensure to pass*), result-in (*resulted to*).

Judgement only, so the verifier should look hardest at these:
- due-to-noun (*due to* + finite clause): dictionaries label *due to* a preposition with noun examples only.
- it-might-be-worth-doing (*worth to run*): SkELL has no "worth to + verb" lines, and Cambridge gives "worth doing".

## Left without commonMistake (no evidence)
would-it-be-possible-to, be-supposed-to, be-about-to, verify-that-clause, walk-someone-through, given-that-clause, as-a-result-of-noun, impact-on, solution-to, have-access-to, increase-in, mitigate-the-risk, address-an-issue, raise-a-concern, i-see-your-point-but, to-sum-up, whereas-contrast.

## Weak points for the verifier
- **walk-someone-through**: only Cambridge confirmed; Oxford and Longman pages did not resolve. **raise-a-concern**: Cambridge concern (collocation) and SkELL only; the "voiced … to" variant has just 3 SkELL lines. **i-see-your-point-but**: Cambridge point and SkELL only. A second dictionary is needed for all three.
- **Accepted variants that are not dictionary-checked**: *be meant to* (be-supposed-to), *owing to* (due-to-noun), *Considering that* (given-that-clause), *Even though / Though* (although-clause), *led to / caused* (result-in), *make sure* (ensure-that-clause), *Is it possible to* (would-it-be-possible-to; noteTr says it is less hedged). The hedged and polite items accept the common near-synonyms because C1 phrasing varies; items such as to-sum-up and whereas-contrast also accept *In short / In summary / While / but*.
- **address-an-issue** is close to the existing address-review-comments (work_vocab, batch B). The targetChunk and id differ, but the verifier may want to merge or drop one.
- **solution-to**: "solution of" is valid in maths and engineering, so there is no commonMistake, and the noteTr remark about it is my judgement from SkELL lines.
- **impact-on**: no commonMistake because "impact to" is common in business English and no source calls it wrong.
- **increase-in**: "an increase on" is a legitimate British pattern ("an increase on last year"), so it is not listed as a mistake.
- **suggest-that-clause** accepts both *tests* and *test* (subjunctive). noteTr says BrE and AmE differ; the claim is general, not dictionary-quoted.
- **although-clause**: checklist item 3 ("although … but" in one sentence) is a teaching convention that I did not test in a source.
- **be-supposed-to**: the situationTr is past ("olmalıydı"), so *is supposed to* is not accepted and the user would self-grade "Partial".

## Skipped
| Topic | Reason |
|---|---|
| "Would it be possible to" with *for you* | The situationTr names no addressee, so adding *for you* would not be a stable variant; noteTr mentions it. |
| ensure to do, access for, impact to as mistakes | Real-text hits exist (SkELL) but no dictionary calls them wrong, or they are legitimate in other senses. |
| lead to as its own item | Covered by result-in as an accepted alternative. |
| in short as its own item | Folded into to-sum-up. |
| "used to" negative and question forms (*didn't use to*) | Too many spelling variants for one stable cloze. |
| a separate "I'd suggest" hedging item | Merged into suggest-doing and suggest-that-clause to avoid duplicate targetChunks. |
