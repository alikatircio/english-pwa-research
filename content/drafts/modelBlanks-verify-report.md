# modelBlanks verify report

Rule applied: a blank is kept only when context forces one fill (or the only alternatives are marked/formal/rare, noted). Open verb/noun slots and equal-register variants (on/at my end, into/to, by/before, spelling variants) were narrowed to the function word or nulled. All non-null entries re-checked by script: refilling gives the original sentence exactly, max 5 blanks.

Totals: ok 22, fixed 61, nulled 125 (of 208).

| id | idx | verdict | reason |
|---|---|---|---|
| could-you-base-verb | 1 | nulled | verb slot open (rerun/run/restart/check; send/give/forward); modal alone also open (Can/Could/Would) |
| could-you-base-verb | 2 | nulled | verb slot open (rerun/run/restart/check; send/give/forward); modal alone also open (Can/Could/Would) |
| will-base-verb | 1 | nulled | verb slot open (update/close/review; merge/fix/deploy) |
| will-base-verb | 2 | nulled | verb slot open (update/close/review; merge/fix/deploy) |
| need-to-do | 1 | fixed | blank only "to" (forced); verb was open (rerun/run/restart). Rare "need not" is formal/marked [answer: to] |
| need-to-do | 2 | fixed | blank only "to" (forced); verb was open [answer: to] |
| let-me-check | 1 | nulled | verb open (rerun/run/try) |
| let-me-check | 2 | nulled | "Let me see if..." is equally correct as "Let me know if..." |
| i-agree-with-you | 1 | fixed | blank only "with"; "agree with"/"disagree with" both fit two-word blank [answer: with] |
| i-agree-with-you | 2 | fixed | blank only "agree"; "agree to" would be a different meaning, so "with" is kept given [answer: agree] |
| didnt-fail | 1 | nulled | both aux (didn't/did not/couldn't/won't) and verb (start/run/finish; fail/work/run) open |
| didnt-fail | 2 | nulled | both aux (didn't/did not/couldn't/won't) and verb (start/run/finish; fail/work/run) open |
| the-test-passed | 1 | nulled | passed/failed/ran/completed all fit |
| the-test-passed | 2 | nulled | passed/failed/ran/completed all fit |
| be-able-to | 1 | nulled | able to vs willing/ready/free/sure/going to; "were able to" also fits |
| be-able-to | 2 | nulled | able to vs willing/ready/free/sure/going to; "were able to" also fits |
| want-someone-to | 1 | fixed | blank only "to"; "want/need/expect you" was open [answer: to] |
| want-someone-to | 2 | fixed | blank only "to"; "like/want/prefer me to" was open [answer: to] |
| explain-something-to-someone | 1 | fixed | blank only "to"; noun phrase was open (to them/Mert/everyone). "for" has a different sense [answer: to] |
| explain-something-to-someone | 2 | fixed | blank only "to"; name is open. "for Ayşe" is marginal/different sense [answer: to] |
| discuss-something | 1 | nulled | object slot open (the test scope/it/this/the plan) |
| discuss-something | 2 | nulled | object slot open (the test scope/it/this/the plan) |
| remind-someone-to | 1 | fixed | blank only "to"; person and verb were open [answer: to] |
| remind-someone-to | 2 | fixed | blank only "to"; verb was open [answer: to] |
| share-something-with-someone | 1 | fixed | blank only "with"; object phrase open [answer: with] |
| share-something-with-someone | 2 | fixed | blank only "with"; "to" is non-standard [answer: with] |
| take-a-look-at-it | 1 | fixed | blank only "at"; noun phrase after at was open. "into" is marginal [answer: at] |
| take-a-look-at-it | 2 | fixed | blank only "at"; "over/into" marginal [answer: at] |
| fix-it-today | 1 | nulled | pronoun open (it/this/that/them) with no antecedent in the sentence |
| fix-it-today | 2 | nulled | pronoun open (it/this/that/them) with no antecedent in the sentence |
| tell-someone-about | 1 | fixed | blank only "about"; "of" is formal/marked [answer: about] |
| tell-someone-about | 2 | nulled | told me / showed me / assured me / said all fit |
| ask-someone-to | 1 | fixed | blank only "to"; person was open [answer: to] |
| ask-someone-to | 2 | fixed | blank only "to"; pronoun was open [answer: to] |
| inform-someone-about | 1 | nulled | "of" and "about" both correct (noteTr says so); person open |
| inform-someone-about | 2 | nulled | "of" and "about" both correct (noteTr says so); person open |
| mention-something | 1 | nulled | kept null from original (see modelBlanks-notes.md) |
| mention-something | 2 | nulled | object phrase open (the new deadline / it / the date) |
| update-someone-on | 1 | nulled | "on" and "about" both correct; person open |
| update-someone-on | 2 | nulled | kept null from original (see modelBlanks-notes.md) |
| data-uncountable | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| data-uncountable | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| feedback-uncountable | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| feedback-uncountable | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| information-uncountable | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| information-uncountable | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| software-uncountable | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| software-uncountable | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| deployment-was-successful | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| deployment-was-successful | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| set-up-verb | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| set-up-verb | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| log-in-to | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| log-in-to | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| reminder-noun | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| reminder-noun | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| waiting-for-approval | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| waiting-for-approval | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| failure-noun | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| failure-noun | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| dependent-on | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| dependent-on | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| analysis-of | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| analysis-of | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| judgmental-question | 1 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| judgmental-question | 2 | nulled | open verb/noun slot: several equally natural fills (target word is the only blank, not forced by context) |
| depend-on | 1 | ok | fixed collocation/preposition, one natural fill |
| depend-on | 2 | ok | fixed collocation/preposition, one natural fill |
| responsible-for | 1 | ok | fixed collocation/preposition, one natural fill |
| responsible-for | 2 | ok | fixed collocation/preposition, one natural fill |
| wait-for | 1 | nulled | "waiting on" is equally correct (esp. AmE) |
| wait-for | 2 | nulled | "waiting on" is equally correct (esp. AmE) |
| join-call-no-to | 1 | nulled | attend/join; joined/left/led all fit |
| join-call-no-to | 2 | nulled | attend/join; joined/left/led all fit |
| related-to | 1 | ok | fixed collocation/preposition, one natural fill |
| related-to | 2 | ok | fixed collocation/preposition, one natural fill |
| during-the-daily | 1 | nulled | during/in the night; during/in/at the retro all correct (noteTr) |
| during-the-daily | 2 | nulled | during/in the night; during/in/at the retro all correct (noteTr) |
| ask-for-access | 1 | ok | fixed collocation/preposition, one natural fill |
| ask-for-access | 2 | ok | fixed collocation/preposition, one natural fill |
| comment-on | 1 | ok | fixed collocation/preposition, one natural fill |
| comment-on | 2 | nulled | "comment on/about/in" all fit the noun |
| reply-to | 1 | ok | fixed collocation/preposition, one natural fill |
| reply-to | 2 | ok | fixed collocation/preposition, one natural fill |
| help-with | 1 | ok | fixed collocation/preposition, one natural fill |
| help-with | 2 | ok | fixed collocation/preposition, one natural fill |
| attend-meeting-no-to | 1 | nulled | attended/joined/watched; attend/join/lead |
| attend-meeting-no-to | 2 | nulled | attended/joined/watched; attend/join/lead |
| reach-out-to | 1 | ok | fixed collocation/preposition, one natural fill |
| reach-out-to | 2 | ok | fixed collocation/preposition, one natural fill |
| by-deadline | 1 | nulled | by/before both correct |
| by-deadline | 2 | nulled | by/before both correct |
| until-duration | 1 | ok | fixed collocation/preposition, one natural fill |
| until-duration | 2 | ok | fixed collocation/preposition, one natural fill |
| agree-with-someone | 1 | fixed | blank only "with"; "on/about" second blank had equal alternatives [answer: with] |
| agree-with-someone | 2 | nulled | "agreed on/about/to" the date all correct |
| consist-of | 1 | ok | fixed collocation/preposition, one natural fill |
| consist-of | 2 | ok | fixed collocation/preposition, one natural fill |
| reproduce-the-issue | 1 | nulled | reproduce/recreate/follow; reproduced/fixed/found/saw |
| reproduce-the-issue | 2 | nulled | reproduce/recreate/follow; reproduced/fixed/found/saw |
| assign-something-to-someone | 1 | fixed | blank only "to"; assigned/given/passed was open [answer: to] |
| assign-something-to-someone | 2 | fixed | blank only "to"; assigned/given/sent was open [answer: to] |
| get-back-to-someone | 1 | nulled | "get back to/with", "come back to" all correct |
| get-back-to-someone | 2 | nulled | "get back to/with", "come back to" all correct |
| log-a-bug | 1 | nulled | raise/log/file/report/open all correct (noteTr) |
| log-a-bug | 2 | nulled | raise/log/file/report/open all correct (noteTr) |
| have-a-meeting | 1 | nulled | have/hold/run/schedule (noteTr lists both have and hold) |
| have-a-meeting | 2 | nulled | have/hold/run/schedule (noteTr lists both have and hold) |
| look-into-it | 1 | nulled | "looking into/at", "working on", "investigating" all fit |
| look-into-it | 2 | nulled | "looking into/at", "working on", "investigating" all fit |
| escalate-issue-to | 1 | nulled | escalate/raise/report/fix all fit |
| escalate-issue-to | 2 | ok | fixed collocation/preposition, one natural fill |
| follow-up-on | 1 | fixed | blank only "on"; "follow up on" vs look into/check up on was open. "about" marginal [answer: on] |
| follow-up-on | 2 | fixed | blank only "on" [answer: on] |
| blocked-by | 1 | nulled | "blocked by" and "blocked on" both correct (noteTr); "dependent on/waiting on" also fit |
| blocked-by | 2 | nulled | "blocked by" and "blocked on" both correct (noteTr); "dependent on/waiting on" also fit |
| roll-back-release | 1 | fixed | blank only "back"; "revert/back out" was open [answer: back] |
| roll-back-release | 2 | nulled | rollback/deployment/build/migration all fit |
| flaky-test | 1 | nulled | flaky/failing/slow/broken/unstable |
| flaky-test | 2 | nulled | flaky/failing/slow/broken/unstable |
| keep-me-in-the-loop | 1 | nulled | "in the loop" vs "in the picture/in the know" ("keep you in the picture" is correct) |
| keep-me-in-the-loop | 2 | nulled | kept null from original (see modelBlanks-notes.md) |
| works-on-my-end | 1 | nulled | on/at my end, on my side all correct (noteTr) |
| works-on-my-end | 2 | nulled | on/at my end, on my side all correct (noteTr) |
| a-heads-up | 1 | nulled | heads-up/update/reminder/notice/warning |
| a-heads-up | 2 | nulled | heads-up/update/reminder/notice/warning |
| issue-has-come-up-again | 1 | fixed | blank only "up"; "come up/popped up/cropped up" was open [answer: up] |
| issue-has-come-up-again | 2 | fixed | blank only "up"; "was raised/arose/came out" was open [answer: up] |
| address-review-comments | 1 | nulled | address/resolve/handle/fix/review; addresses/fixes/solves |
| address-review-comments | 2 | nulled | address/resolve/handle/fix/review; addresses/fixes/solves |
| sign-off-on | 1 | fixed | blank only "off"; "signs off on" vs approves/agrees to was open [answer: off] |
| sign-off-on | 2 | fixed | blank only "off" [answer: off] |
| edge-case | 1 | nulled | edge/corner/error/extreme/negative case, test cases all fit |
| edge-case | 2 | nulled | edge/corner/error/extreme/negative case, test cases all fit |
| grant-someone-access-to | 1 | fixed | blank only "to"; given/granted open (give/grant equal per noteTr) [answer: to] |
| grant-someone-access-to | 2 | fixed | blank only "to"; grant/give equal [answer: to] |
| does-the-test-pass-question | 1 | nulled | Does/Did/Will + base verb, and Is ... failing (acceptedAnswers list it); verb open |
| does-the-test-pass-question | 2 | nulled | Does/Did/Will + base verb, and Is ... failing (acceptedAnswers list it); verb open |
| has-been-failing-since | 1 | fixed | blank only "since" (the tense chunk given); "has been/has started/has kept failing" was open [answer: since] |
| has-been-failing-since | 2 | fixed | blank only "since"; "have started failing" was open [answer: since] |
| it-turned-out-that | 1 | fixed | blank only "out"; "turns out/seems/appears" was open [answer: out] |
| it-turned-out-that | 2 | fixed | blank only "out" [answer: out] |
| not-sure-whether | 1 | nulled | whether/if both correct; subject/aux (the fix/it, has/had) open |
| not-sure-whether | 2 | nulled | whether/if both correct; subject/aux (the fix/it, has/had) open |
| had-to-rerun | 1 | fixed | blank only "to"; "had to/decided to/chose to/needed to skip" was open [answer: to] |
| had-to-rerun | 2 | fixed | blank only "to" [answer: to] |
| should-have-tested | 1 | fixed | blank only "have"; should/could/would/must have + participle was open; participle was open [answer: have] |
| should-have-tested | 2 | fixed | blank only "have"; participle open (raised/logged/filed) [answer: have] |
| make-sure-the-tests-pass | 1 | fixed | blank only "sure"; "Make sure" vs Check/Verify/Ensure; verb "is" given [answer: sure] |
| make-sure-the-tests-pass | 2 | fixed | blank only "sure"; rare "make certain" is marked [answer: sure] |
| describe-something-to-someone | 1 | nulled | "to me/for me" both correct (noteTr) |
| describe-something-to-someone | 2 | nulled | "to me/for me" both correct (noteTr) |
| point-it-out | 1 | nulled | pointed out/to/at, brought up, flagged |
| point-it-out | 2 | fixed | blank only "out"; pronoun given [answer: out] |
| investigate-the-failure | 1 | nulled | investigating/looking into; object noun open; investigate/understand/check/see |
| investigate-the-failure | 2 | nulled | investigating/looking into; object noun open; investigate/understand/check/see |
| clarify-the-requirements | 1 | nulled | verb and object both open |
| clarify-the-requirements | 2 | nulled | verb and object both open |
| attach-logs-to-the-ticket | 1 | fixed | blank only "to"; attach/add and object open [answer: to] |
| attach-logs-to-the-ticket | 2 | fixed | blank only "to" [answer: to] |
| hand-over-to | 1 | fixed | blank only "to" [answer: to] |
| hand-over-to | 2 | fixed | blank only "to" [answer: to] |
| contact-someone | 1 | nulled | contact/message/ping/email/call; contacted/emailed/pinged |
| contact-someone | 2 | nulled | contact/message/ping/email/call; contacted/emailed/pinged |
| fails-intermittently | 1 | nulled | intermittently/randomly/sporadically/occasionally |
| fails-intermittently | 2 | nulled | intermittently/randomly/sporadically/occasionally |
| progress-uncountable | 1 | nulled | good/some/great progress, headway; no/little progress |
| progress-uncountable | 2 | nulled | good/some/great progress, headway; no/little progress |
| documentation-uncountable | 1 | nulled | open verb/noun slot: several equally natural fills (documentation/docs/info/spec) |
| documentation-uncountable | 2 | nulled | open verb/noun slot: several equally natural fills (documentation/docs/info/spec) |
| a-lot-of-work | 1 | nulled | work/time/effort/hassle etc. fit |
| a-lot-of-work | 2 | nulled | work/time/effort/hassle etc. fit |
| in-terms-of | 1 | fixed | blank only "of"; "In terms of" vs "With regard to/As for" was open [answer: of] |
| in-terms-of | 2 | fixed | blank only "of"; "mean for testing" also possible [answer: of] |
| prioritise-verb | 1 | nulled | prioritise/prioritize spelling variants plus fix/triage/focus on |
| prioritise-verb | 2 | nulled | prioritise/prioritize spelling variants plus fix/triage/focus on |
| clarification-noun | 1 | nulled | clarification/details/context/help/info |
| clarification-noun | 2 | nulled | clarification/details/context/help/info |
| on-leave | 1 | ok | fixed collocation/preposition, one natural fill |
| on-leave | 2 | ok | fixed collocation/preposition, one natural fill |
| in-charge-of | 1 | fixed | blank only "of"; "responsible for" and "the owner of" also fit 3 blanks [answer: of] |
| in-charge-of | 2 | fixed | blank only "of" [answer: of] |
| get-rid-of | 1 | fixed | blank only "of"; "do away with/clean up/get hold of" fit [answer: of] |
| get-rid-of | 2 | fixed | blank only "of"; "took care of" fits [answer: of] |
| familiar-with | 1 | fixed | blank only "with"; "familiar with/comfortable with" was open [answer: with] |
| familiar-with | 2 | fixed | blank only "with" [answer: with] |
| similar-to | 1 | fixed | blank only "to"; similar/identical/related/close was open [answer: to] |
| similar-to | 2 | fixed | blank only "to" [answer: to] |
| focus-on | 1 | fixed | blank only "on"; "focusing/working on" was open [answer: on] |
| focus-on | 2 | fixed | blank only "on" [answer: on] |
| catch-up-on | 1 | nulled | "catch up on" and "catch up with" both correct (noteTr); alternatives working/going through |
| catch-up-on | 2 | nulled | "catch up on" and "catch up with" both correct (noteTr); alternatives working/going through |
| run-tests-against-staging | 1 | nulled | against/on both correct (noteTr) |
| run-tests-against-staging | 2 | nulled | against/on both correct (noteTr) |
| merge-pr-into-main | 1 | nulled | into/to/with main; merge/push/land |
| merge-pr-into-main | 2 | nulled | into/to/with main; merge/push/land |
| revert-the-change | 1 | nulled | revert/undo/remove/drop; reverted/rolled back |
| revert-the-change | 2 | nulled | revert/undo/remove/drop; reverted/rolled back |
| take-over-from | 1 | fixed | blank only "from"; verb phrase was open. "after/with" marginal [answer: from] |
| take-over-from | 2 | nulled | take over/run/lead/continue |
| double-check | 1 | nulled | double-check/check/verify/review |
| double-check | 2 | nulled | double-check/check/verify/review |
| run-out-of-time | 1 | fixed | blank only "of"; "ran short of/had no/didn't have" fit 3 blanks [answer: of] |
| run-out-of-time | 2 | fixed | blank only "of" [answer: of] |
| as-far-as-i-know | 1 | fixed | blank only second "as"; "So far as" is also correct, so only the sure slot is blanked [answer: as] |
| as-far-as-i-know | 2 | fixed | blank only second "as" [answer: as] |
| mention-someone-in-a-comment | 1 | nulled | mention/tag/ping/cc; in/on a PR/comment |
| mention-someone-in-a-comment | 2 | nulled | mention/tag/ping/cc; in/on a PR/comment |
