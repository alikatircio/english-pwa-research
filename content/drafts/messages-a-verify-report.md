# messages-a verification report

Verifier: independent session, 2026-10-23
Input: `content/drafts/messages-a.json` (15 messages). Output: `content/drafts/messages-a.verified.json` (same order).

## Counts

| Result | Count |
|---|---|
| verified: true | 15 |
| unsure (verified: false) | 0 |
| rejected | 0 |
| changed (text, blanks or contextTr) | 12 |
| unchanged | 3 (msg-access-request, msg-deploy-postponed, msg-weekly-summary) |

## Method

- All 45 item ids exist in `src/content/items.json` and in the shipped-ids lock. For each blank, the answer word was checked against the item's `acceptedAnswers[0]`, which is the C18 rule.
- For each blank, the verifier first wrote the answer from the context, then looked for other natural fits. A blank was moved or removed when a second word fit naturally.
- Google Books Ngram (en, 2000–2022) was checked only for doubtful blanks. A ratio near 10:1 or higher, together with priming from the context, was accepted. A ratio near 3:1 or lower was not.
- Originality: the wording is QA/Teams/Jira text built on the app's own items. No sentences come from English Grammar in Use or English Collocations in Use. Names (Mert, Ayşe, Deniz) and the key QA-123 come from the fictional set.

## Per-message decisions

| id | Decision | Details |
|---|---|---|
| msg-standup-blocked | changed, verified | "progress" blank → "making" ("headway" also fit; this tests make vs do). "by" blank → "blocked" (the item itself accepts "blocked on"). Clause added: "so I can't run them". |
| msg-cannot-reproduce | changed, verified | "reproduce" blank removed: replicate/recreate fit (Ngram 1.4e-9 / 3.9e-10 / 2.3e-10). Replaced with be-able-to, blank "to" ("I tried, but I wasn't able ___ reproduce…"). |
| msg-handover-qa123 | changed, verified | The phrase "the ticket" appeared three times; now uses QA-123 and "I've attached". "hand off" is rarer (about 6:1) and the "Handover note" header primes "over". |
| msg-access-request | unchanged, verified | to / with / through are each unique. |
| msg-review-comment | changed, verified | "I'd suggest ___ the logs" also allowed reviewing/reading. contextTr now says "kontrol etmek", and the last line now follows from removing the wait. |
| msg-escalate-release | changed, verified | "We ran out of time" → "We're running out of time" (the past tense clashed with asking for a fix by Friday). |
| msg-deploy-postponed | unchanged, verified | been / far / yet are each unique. |
| msg-standup-staging | changed, verified | Blank "about" (be-about-to) removed because "going" fits equally. Now 3 blanks. "owing to" is rare (about 15:1). |
| msg-root-cause-update | changed, verified | contextTr adds "rağmen", so "After failing twice" no longer fits. "reason behind" is rare (about 20:1). |
| msg-restart-request | changed, verified | The "waiting ___ the new build" blank allowed "on" and did not test approval vs approve. That line was rewritten and the blank is now get-back-to-someone ("back"). |
| msg-weekly-summary | unchanged, verified | attention / take / sum are each unique. |
| msg-staging-heads-up | changed, verified | "Just a reminder:" also fit. contextTr now says this is the first announcement, not a reminder. |
| msg-fix-verified | changed, verified | Removed the redundant "earlier,". contextTr uses "test ortamı" as the other messages do. |
| msg-review-request | changed, verified | "catch up on the review notes" made no sense before the review was done. Now "catching up on my messages" (on vs with is about 9:1 for emails). The blank order changed with the text. |
| msg-ticket-takeover | changed, verified | "Given" blank → "that" (Considering/Seeing fit); this tests given that + clause. "as a consequence of" is rare (about 10:1). |

## Build

`npm run content:build` exited 0: 15 messages shipped, no C18 findings. C10 warnings flag the first word of a line ("Could", "Would", "Just", "Sorry") as a possible real name. These are heuristic warnings from line-initial capitals, not errors. Afterwards `git checkout content/shipped-ids.lock.json` restored the lock file.
