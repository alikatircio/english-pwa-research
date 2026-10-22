// All-or-nothing writes in one readwrite transaction (07 §3.7, review 09 #4).
//
// A request that fails asynchronously aborts its transaction on its own. A request
// that throws synchronously (DataError for a missing key, DataCloneError) does not:
// the requests queued before it would auto-commit. writeAll aborts in both cases.

/** The part of an idb transaction writeAll needs. */
export interface WriteTx {
  abort(): void;
  readonly done: Promise<void>;
}

/** Registers a request with writeAll; returns the same promise so it can be chained. */
export type Track = <T>(request: Promise<T>) => Promise<T>;

function abortQuietly(tx: WriteTx): void {
  try {
    tx.abort();
  } catch {
    // Already committed or aborted.
  }
}

/**
 * Queue writes via `enqueue(track)` and wait for all of them and the commit.
 * Any synchronous throw in `enqueue`, and any rejection of a tracked promise
 * (including a callback chained on a tracked request, as long as the result is
 * tracked too), aborts the transaction, so nothing is written. Rethrows the first error.
 */
export async function writeAll(tx: WriteTx, enqueue: (track: Track) => void): Promise<void> {
  const requests: Promise<unknown>[] = [];
  const track: Track = (request) => {
    requests.push(request);
    // Abort as soon as one fails, while the transaction is still active.
    request.catch(() => abortQuietly(tx));
    return request;
  };
  try {
    enqueue(track);
  } catch (e) {
    abortQuietly(tx);
    await Promise.allSettled([...requests, tx.done]);
    throw e;
  }
  try {
    await Promise.all([...requests, tx.done]);
  } catch (e) {
    abortQuietly(tx);
    await Promise.allSettled([...requests, tx.done]);
    throw e;
  }
}
