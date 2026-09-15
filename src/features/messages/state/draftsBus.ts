// A tiny synchronous pub/sub for "drafts changed" (feature 005). Draft mutations can happen on a
// DIFFERENT screen than the one showing the draft count - e.g. the auto-save snackbar's "Zahodit"
// (discard) / "Vrátit zpět" (undo) fire while the message list is already focused, so a focus-effect
// re-read won't catch them. Mutators call `emit()`; the list subscribes and re-reads the count live.

type Listener = () => void;

const listeners = new Set<Listener>();

export const draftsBus = {
  /** Notify subscribers that a box's drafts changed (saved / removed / restored). */
  emit(): void {
    for (const listener of listeners) {
      listener();
    }
  },
  /** Subscribe to draft changes; returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
