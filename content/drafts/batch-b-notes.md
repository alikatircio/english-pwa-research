# Batch B: notes (preposition, work_vocab)

Author pass, 2026-10-21. 35 items, all `verified: false`. preposition: 16, work_vocab: 19.
Sources I could reach: Cambridge and Oxford Learner's (fetched directly with curl and a browser user-agent), Longman (WebFetch). Merriam-Webster and Collins returned 403, and SkELL needs JavaScript, so **no corpus check was done**. The verifier should run SkELL/COCA, mainly for the items flagged below.

## Coverage of 04 candidates
- Preposition: #15 to #22, #42, #45 to #49 and #66 are all written. #48 is split into two items, `by-deadline` and `until-duration`.
- Work_vocab: #23 to #27, #50 to #54, #56 to #61, #67 and #68 are written.
- Seeds used: during the daily, grant access, come up.

## Skipped candidates
| # | Candidate | Reason |
|---|---|---|
| 55 | push a fix | Real usage (forum and PR threads) but no learner-dictionary sense. A Turkish prompt cannot separate *pushed* from *committed / merged a fix* without leaking "push", so it fails the uniqueness rule (2.1/8). The typical error *made a fix* is unconfirmed. |
| 62 | out of scope | Oxford and Cambridge list only *beyond / outside the scope of*. The question of *out of scope* vs *out of the scope* is unresolved without a corpus. |
| 69 | covered by tests / test coverage | No dictionary pattern, and the ISTQB glossary is a JS app I could not reach. |
| 70 | run tests against an environment | No source found. It is a b.g. case (*on staging* is also fine) and has no clear typical error. |

## Included "?" candidates and what was confirmed
For all of these, `commonMistake` is left **empty** because the typical error itself was the uncertain part.
- #26 `log-a-bug`: Cambridge *log* means "officially record", and Oxford gives *file a complaint/report*. *raise a bug* has no dictionary collocation (the verifier should check it). The item accepts log, raise, file, report and create, and the note mentions *open*.
- #52 `follow-up-on`: Cambridge has *follow up on* and Oxford has *follow something up*. Both are accepted.
- #57 `keep-me-in-the-loop`: Oxford has the idiom *in the loop*, and Longman has *loop someone in*.
- #58 `works-on-my-end`: Oxford only gives "problems **at your end**". *on my end* and *on my side* have no dictionary entry and need a corpus check. This is the weakest item.
- #61 `address-review-comments`: Oxford and Cambridge give *address a problem/concern/question*. PR tooling uses "address PR comments".
- #67 `sign-off-on`: Cambridge, Longman and Oxford all confirm it (AmE *sign off on*, BrE *sign something off*).
- #68 `edge-case`: confirmed in both Cambridge and Oxford.

## Places where 04 was wrong, and what I changed
- #24 assign: Oxford lists **assign somebody something** as correct, so *Could you assign Ayşe QA-123?* is grammatical and **not used** as the common mistake. The item uses *assign to Ayşe QA-123* as the mistake instead. The grammatical variant is mentioned in noteTr but kept out of acceptedAnswers (rule 2.2/2). The verifier should decide whether to accept it.
- #49 agree: Cambridge and Oxford both list **agree about** as correct, so 04's mistake *agreed about* is wrong. I rewrote the item as `agree-with-someone`: the mistake is *agree to you*, and both *on* and *about* are accepted. It overlaps with the other author's aux_to "I agree" item, but the critical point is different (1.6).
- Seed "The S3 issue has come up again": S3 is a real product name, so I replaced it with "the upload issue".

## Questions for the user / verifier
1. Does your team say **"I'm blocked on X"** as well as "blocked by"? Only *by* is accepted for now (it matches Jira's "is blocked by").
2. **corner case** vs **edge case**: is *corner case* used at your workplace? It is not in acceptedAnswers.
3. **EOD / by end of day**: is "EOD" common in your Teams chats? I left it out because it is unverified.
4. **raise a bug** vs **log a bug**: which does your team use? (raise may lean BrE.)
5. Normalizer: `a-heads-up` uses the hyphenated "heads-up". Should "heads up" without the hyphen match? An engineering note is needed.

## Other doubts for the verifier
- `during-the-daily`: *at the daily* is accepted by analogy with *at the meeting*.
- `grant-someone-access-to`: the mistake *an access* is my own judgement.
- `roll-back-release`: the mistake *took back* comes from 04 and is unconfirmed. Dictionaries don't define the software sense explicitly.
- `blocked-by`: the mistake *I'm blocking from* comes from 04 and is unconfirmed.
- `until-duration`: there are BrE/AmE variants (*on holiday* / *on vacation*), and *till* is accepted.
- `have-a-meeting`: "3 pm" vs "3pm" depends on whether the normalizer collapses spaces inside a word. Only "3 pm" is listed.
