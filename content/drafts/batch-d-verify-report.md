# Batch D verification report

Independent verifier, 2026-10-22. Input: `batch-d.json` (not modified). Output: `batch-d.verified.json` (31 items, all kept).

**Result: 31 verified, 0 unsure, 0 rejected.** No commonMistake was removed: all 9 are below the batch C benchmark or ungrammatical by dictionary pattern. 6 statements that called correct English wrong, or a correct answer missing, were fixed (impact-on, increase-in, raise-a-concern, although-clause, suggest-that-clause, would-it-be-possible-to). 4 situationTr fixes, 1 unnatural model sentence fixed.

## Method
- Dictionaries fetched with curl and grepped: Cambridge, Oxford Learner's, Longman. Collins and Merriam-Webster blocked curl.
- SkELL concordance API for every flagged mistake and chunk. Google Books Ngram (en-2019, 2010-2019 mean, exact form) for mistake ratios. Benchmark from batch C: the Longman-flagged *discuss about* = 0.93% of *discuss the*.
- `runChecks` (scratch script with npx tsx, not the build) over batch A + B + C + D `.verified.json`, with modelBlanks overlays, the shipped-ids lock (103), the local denylist (5 terms), C8 and the C10 allowlist: **no errors, no batch D findings**, 134 shipped. The only warning is the old C6 in reminder-noun (batch A). `src/content` and the lock file were not written.

## The author's flagged doubts
| Doubt | Decision | Evidence |
|---|---|---|
| due-to-noun *due to the API was down* | kept | Longman/Oxford/Cambridge: due to is a preposition (noun / "the fact that" only). SkELL "due to it was" 1 informal line; Ngram 5e-10. |
| it-might-be-worth-doing *worth to run* | kept | Oxford/Cambridge/Longman "worth doing". SkELL "worth to run" 0; Ngram "worth to try" 0.72% of "worth trying". |
| prevent-from-doing *prevent … to be merged* | kept | Ngram 0.33% / 0.75%; SkELL 2 technical lines; no dictionary gives prevent + to. |
| ensure-that-clause *ensure to pass* | kept | Ngram "ensure to" 0.70%; SkELL lines are web/SEO text; dictionaries give ensure (that) / ensure sth only. |
| result-in *resulted to* | kept | Ngram 0.13%. Native SkELL lines ("damage resulted to the bridge") use a different sense. |
| walk-someone-through: 1 source | resolved | Oxford walk-through_1 "walk somebody through something" + Cambridge. |
| raise-a-concern: 1 source | resolved | Oxford raise ("raised this issue with…", "raised concerns"), Longman concern. *raised … to* is attested (Ngram 19% of *with*), so it is now accepted and no longer implied wrong. |
| i-see-your-point-but: 1 source | resolved | Longman "see/take/get somebody's point … OK, I take your point. But…", Cambridge, Oxford. |
| address-an-issue vs address-review-comments | both kept | Different object and sense (deal with a problem vs act on review comments); Oxford "address a problem/concern". |
| be meant to / owing to / Considering that / led to, caused | all fine | Oxford mean + Cambridge "be meant to do sth"; Oxford + Cambridge owing to; Oxford considering (conjunction); Oxford/Longman result in + plain synonyms. |

## Notes
- Chrome/Firefox (verify, although, whereas) and Teams/Jira channel tags are kept: they are on `content/privacy-allowlist.json` and in verified batches A and C. No person names other than Ayşe, Mert, Deniz.
- Team terms (raise a bug, blocked on, corner case, EOD) are user-confirmed (batch-c notes).
- The 8-variant cap forced 3 swaps (suggest-that-clause, although-clause, i-see-your-point-but): each dropped variant is correct English the user may still self-grade "Doğru".

## Items
| id | verdict | evidence | change |
|---|---|---|---|
| would-it-be-possible-to | VERIFIED | Cambridge possible ('Is it possible to buy tickets in advance?'), Oxford possible ('possible to do something'); SkELL 'would it be possible to' 40 natural lines. Is it possible to = less hedged, noteTr says so. EOD is a user-confirmed team term (batch-c notes) | added 'before/by the end of the day' variants (situationTr says 'mesai bitmeden', which does not force EOD) |
| be-supposed-to | VERIFIED | Cambridge supposed (INTENDED, B1 'These batteries are supposed to last for a year'), Oxford supposed 'be supposed to do/be something'. be meant to: Oxford mean ('You're meant to (= you are supposed to) pay'), Cambridge 'be meant to do sth' ('We were meant to have gone away this week') | noteTr: removed unsourced claim that be meant to is 'daha gündelik' |
| be-about-to | VERIFIED | Cambridge grammar 'Be about to' modal expression, Oxford about; SkELL natural lines | noteTr: 'birkaç saniye içinde' (overstated) -> 'hemen şimdi' |
| used-to-do | VERIFIED | Oxford used to, Cambridge used to (B1 'a particular thing always happened'). Mistake 'We were used to run' is ungrammatical with a person subject (Oxford Which Word used to / be used to) | none |
| be-used-to-doing | VERIFIED | Oxford used to (adjective) + Cambridge used. Mistake 'I'm used to work' (base verb after be used to) is the Oxford Which Word contrast | none |
| look-forward-to-doing | VERIFIED | Oxford look forward to (phrasal verb), Cambridge look forward to something. Mistake '… to see you': base form after preposition to, 1 of 40 SkELL lines, standard grammars call it wrong | none |
| suggest-doing | VERIFIED | Longman suggest 'suggest (that)' + GRAMMAR, Oxford suggest 'suggest doing something … I suggested going'. Ngram 'suggest him to' 0.39% of 'suggest that he' (benchmark discuss about 0.93%) | none |
| suggest-that-clause | VERIFIED | Oxford 'suggest (that)…', Longman suggest (that); SkELL 'suggested that he should' 40 native lines (BrE should). Ngram 'suggest him to' 0.39% of 'suggest that he' | added the BrE 'should test' variant that noteTr already names (replaced 'I would suggest that Mert test', 8-variant cap); dropped confusing checklist item 3 ('suggest a solution to someone') |
| prevent-from-doing | VERIFIED | Longman 'prevent somebody/something (from) doing something' (from optional), Oxford 'prevent somebody/something from doing something', Cambridge prevent. Mistake check: Ngram 'prevent them to' 0.33% of 'prevent them from', 'prevents it to be' 0.75% of 'prevents it from being' (below the discuss-about benchmark 0.93%); SkELL 'prevents it to be' 2 lines, both technical/Wikipedia text; no dictionary gives prevent + to. Kept as a mistake | none |
| verify-that-clause | VERIFIED | Oxford 'verify that…', Cambridge 'verify that'; SkELL natural lines | none |
| ensure-that-clause | VERIFIED | Longman 'ensure (that)' (+ Register note: make sure in everyday English), Oxford 'ensure (that)', Cambridge 'ensure that'. Mistake check: Ngram 'ensure to' 0.70% of 'ensure that the' (below benchmark); SkELL 'ensure to' lines are web/SEO text ('Ensure to include your main keywords'); no dictionary gives ensure + to. Kept as a mistake | situationTr: 'emin olmamız' -> 'geçmesini sağlamamız' + 'resmî' tag, so the prompt points to ensure and not only to make sure (batch C make-sure-the-tests-pass already has the 'emin ol' prompt); make sure still accepted |
| walk-someone-through | VERIFIED | Cambridge 'walk someone through something' ('She walked me through the six-page document'), Oxford 'walk somebody through something' (walk-through_1: 'She walked me through a demonstration of the software'); SkELL 'walk me through' 40 lines | none |
| due-to-noun | VERIFIED | Longman due to = preposition ('mostly used in formal contexts'), Oxford due 'due to … because of' (noun and 'due to the fact that' examples only), Cambridge due to something; owing to: Oxford + Cambridge, preposition. Mistake 'due to the API was down': preposition + finite clause, ungrammatical; SkELL 'due to it was' 1 informal blog line, Ngram 'due to it was' is tiny (5e-10). Kept | none |
| despite-doing | VERIFIED | Longman despite 'Don't say: despite of', Oxford despite (preposition); SkELL natural lines | none |
| although-clause | VERIFIED | Oxford although (conjunction), Longman although, Cambridge grammar 'Although, even though' (even though, though). 'although … but' checklist point is standard grammar-book guidance (Cambridge grammar uses although + main clause, never + but) | added the correct 'Despite the build being green, …' answer ('-mesine rağmen' invites it; replaced 'Though … on Firefox', 8-variant cap) |
| given-that-clause | VERIFIED | Oxford 'given that' (conjunction), Cambridge 'given that … given the fact that'; Considering that: Oxford considering (conjunction, 'Considering he's only just started…'), Cambridge considering | none |
| as-a-result-of-noun | VERIFIED | Oxford/Cambridge result ('as a result of'); SkELL natural lines; no commonMistake | none |
| affect-vs-effect | VERIFIED | Cambridge affect (verb), Longman affect (verb) + 'have an effect on'; mistake 'effects the login flow' is wrong here (effect as verb = bring about) | none |
| impact-on | VERIFIED | Cambridge impact 'impact on … have an impact', Oxford impact 'to have/make an impact', 'a negative impact' | checklist 2 no longer says 'make değil' (Oxford impact: 'to have/make an impact'); noteTr no longer calls 'impact to' wrong |
| reason-for | VERIFIED | Longman reason 'reason for', Oxford 'reason for something'; Longman flags 'reason of' | none |
| solution-to | VERIFIED | Oxford solution 'a solution to', Cambridge 'solution to … no easy solution to this problem' | none |
| have-access-to | VERIFIED | Oxford access 'access to something/somebody', Cambridge 'access to' | none |
| increase-in | VERIFIED | Oxford increase (noun) 'increase in', 'increase on something', 'increase of 12% on'; Cambridge increase | checklist 1 no longer says 'of / on değil' (Oxford: 'an increase of 12% on the previous year' is correct) |
| result-in | VERIFIED | Oxford result 'result in something' ('The cyclone has resulted in many thousands of deaths'), Longman 'result in something'; led to/caused are ordinary synonyms here. Mistake check: Ngram 'resulted to a' 0.13% of 'resulted in a'; SkELL 'resulted to' lines are mostly Philippine/news-wire English; the native ones ('No significant damage resulted to the bridge') use a different sense (to = thing affected), not 'X resulted to <outcome>'. Kept as a mistake | checklist 3 rewritten (old wording had cause/effect reversed) |
| mitigate-the-risk | VERIFIED | Oxford mitigate (formal; collocates effect, impact, problem), Longman mitigate, Cambridge mitigate; SkELL 'mitigate the risk' 40 + 'mitigate this risk' 37 natural lines | model 3 'mitigate this corner case' (unnatural object) -> 'mitigate the impact of this corner case'; added 'reduce the risk' variant that noteTr itself recommends |
| address-an-issue | VERIFIED | Oxford address 'to address a problem/concern/question', Cambridge address; SkELL 'address this issue' 40 lines | added 'deal with' variant (Oxford defines address as 'deal with'). Kept beside address-review-comments: different object and sense (deal with a problem vs act on review comments) |
| raise-a-concern | VERIFIED | Oxford raise ('I have raised this issue with the environmental health office', 'residents have raised concerns'), Cambridge concern, Longman concern 'concern about'; SkELL 'raise concern with' 40 lines; Ngram 'raised my concerns with' 5.1e-10, '… to' 19% of that, 'voiced my concerns to' 1.8e-09 | added 'raised … to Deniz' (attested); checklist 2 no longer implies 'to' is wrong; noteTr: removed unsourced claim about voice |
| it-might-be-worth-doing | VERIFIED | Oxford worth 'worth doing', Cambridge 'be worth doing', Longman 'be worth (doing'. Mistake check: SkELL 'worth to run' 0 lines; 'worth to' lines are 'net worth to gauge' / 'worth to you' (other structures) plus one non-native 'species worth to mention'; Ngram 'worth to try' 0.72% of 'worth trying'. Kept | added 'rerunning / re-running' variants (normaliser treats re-running as 're running', so both spellings listed) |
| i-see-your-point-but | VERIFIED | Cambridge point ('Yes, I can see your point, but I still disagree with you'; 'I take your point'), Longman point 'see/take/get somebody's point … OK, I take your point. But…', Oxford point 'I take your point'; SkELL 'see your point but' 6 lines | situationTr: 'Haklı olduğunu görüyorum' (= you are right, stronger than the chunk) -> 'Söylediğin mantıklı, anlıyorum'; added 'I see what you mean, but …' (replaced 'it … will' variant, 8-variant cap) |
| to-sum-up | VERIFIED | Oxford sum up, Cambridge sum up ('I'd just like to sum up by saying…'); In short / In summary common equivalents | situationTr: 'neden' (can read as 'why') -> 'sebep' |
| whereas-contrast | VERIFIED | Oxford whereas (conjunction), Cambridge whereas; while/but are ordinary contrast variants | none |
