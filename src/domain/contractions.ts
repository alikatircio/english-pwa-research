// Fixed contraction table (decision 8, 07 §3.3). Keys are lower-case with a
// straight apostrophe; values are the expanded form used for comparison.
//
// Deliberately NOT in the table:
//  - 'd   (would/had is ambiguous)
//  - let's
//  - possessive 's (Ayşe's ticket)
// "it's" always means "it is"; content authors list "It has …" variants explicitly.

const pronounsAre = ['you', 'we', 'they'] as const;
const pronounsHave = ['i', 'you', 'we', 'they'] as const;
const pronounsWill = ['i', 'you', 'we', 'they', 'it', 'he', 'she'] as const;
const negatives = [
  'do', 'does', 'did', 'is', 'are', 'was', 'were', 'have', 'has', 'had',
  'would', 'should', 'could', 'must', 'need',
] as const;
const isWords = ['it', 'that', 'there', 'what', 'here', 'he', 'she'] as const;

function build(): ReadonlyMap<string, string> {
  const m = new Map<string, string>();
  m.set("i'm", 'i am');
  for (const p of pronounsAre) m.set(`${p}'re`, `${p} are`);
  for (const p of pronounsHave) m.set(`${p}'ve`, `${p} have`);
  for (const p of pronounsWill) m.set(`${p}'ll`, `${p} will`);
  for (const v of negatives) m.set(`${v}n't`, `${v} not`);
  m.set("won't", 'will not');
  m.set("can't", 'cannot');
  for (const w of isWords) m.set(`${w}'s`, `${w} is`);
  return m;
}

export const CONTRACTIONS: ReadonlyMap<string, string> = build();
