# modelBlanks notes

Source: batch-{a,b,c}.verified.json (104 items, 208 other sentences). Output: modelBlanks-{a,b,c}.json.
Every entry was checked by script: refilling the blanks with the original words returns modelSentences[1..] exactly.

## Nulls (3 of 208)

- mention-something [1] "As I mentioned yesterday, staging is down." - the verb has no object, so the "no 'about'" point (the object slot) cannot be blanked.
- update-someone-on [2] "I'll keep you updated." - a different construction (keep ... updated), with no "update ... on".
- keep-me-in-the-loop [2] "Let's loop Mert in on this." - phrasal verb "loop in", not the chunk "in the loop".

## Judgement calls (blanks not strictly one-to-one with clozeTemplate)

- explain-something-to-someone, take-a-look-at-it, describe-something-to-someone, attach-logs-to-the-ticket, share-something-with-someone: where the main answer blanks a pronoun object plus the preposition, other sentences blank the preposition together with its full noun phrase (e.g. "to the team"), so the blank count follows the words, not the template.
- escalate-issue-to [1], take-over-from [2], investigate-the-failure [2], contact-someone [1], reach-out-to [1], progress and similar: the sentence lacks one slot of the template (no "to"/"from"/noun), so only the words that are present are blanked.
- Inflection or noun/verb variants are blanked as they appear (success, succeeded, setup, login, rollback, failures, fails, depends, dependency, analyse, edge cases, heads-up, etc.).
- discuss-something and mention-something: the object slot is blanked (e.g. "the test scope").
- agree-with-someone, fix-it-today, make-sure-the-tests-pass, etc.: non-adjacent blanks are used where the template has them (e.g. "with ... about", "sent it" and "checked it").
