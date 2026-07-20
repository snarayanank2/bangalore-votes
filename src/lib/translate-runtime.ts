// Task 40 implements the actual machine-translation trigger (queues or
// directly kicks off translation of the authored-language value into the
// other language). Until then this is a synchronous no-op so callers (e.g.
// publishCandidateField) can fire-and-forget without awaiting anything.
export function translateFieldSoon(_target: {
  table: 'candidate_fields' | 'ward_issues' | 'candidate_stances';
  id: number;
}): void {}
