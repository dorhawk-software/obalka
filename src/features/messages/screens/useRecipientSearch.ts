// Compose's recipient search (R12): run as the person types, after a pause and from two characters,
// with its results and the words for why it failed. Out of `ComposeScreen.tsx`, which keeps what is
// done with a pick.

import { useCallback, useEffect, useRef, useState } from 'react';
import { sendController } from '../../accounts/deps';
import { reauthKey } from '../../accounts/state/reauthCopy';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount, Recipient } from '../../../services/isds/types';

// Recipient search runs automatically as the user types: wait for a typing pause, and require a
// couple of characters so one keystroke doesn't hit the network on every box in the country.
const SEARCH_DEBOUNCE_MS = 400;
const MIN_SEARCH_CHARS = 2;

export function useRecipientSearch(account: DataBoxAccount) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  // The sender, read at call time: the search re-runs when the sender really changes (its `boxId`),
  // not on every re-read of the accounts (audit 2026-10-03).
  const accountRef = useRef(account);
  accountRef.current = account;

  // Stable across keystrokes and across re-reads of the accounts (keyed on the sender's `boxId`) - the
  // query is passed in, so the debounce effect below can call it without re-subscribing.
  const runSearch = useCallback(
    async (q: string) => {
      inFlight.current?.abort();
      if (q.trim() === '') {
        return;
      }
      const ac = new AbortController();
      inFlight.current = ac;
      setSearching(true);
      setError(null);
      const out = await sendController.searchRecipients(
        accountRef.current,
        q,
        ac.signal,
      );
      if (ac.signal.aborted) {
        return;
      }
      setSearching(false);
      setSearched(true);
      if (out.kind === 'recipients') {
        setResults(out.recipients);
      } else {
        // A refused sign-in says so, in the words sending uses: "try again" could never help
        // (walked on Obalka_Demo, T050.10, 2026-11-16).
        setError(
          out.kind === 'reauth'
            ? t(reauthKey(accountRef.current, 'send.reauth', 'send.reauth.credentials'))
            : t(out.messageKey),
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account.boxId],
  );

  // Auto-search as the user types (no Find button): debounce, and require a couple of characters so
  // a single keystroke doesn't hit the network. Clearing the field resets the results.
  useEffect(() => {
    const q = query.trim();
    if (q === '') {
      inFlight.current?.abort();
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    if (q.length < MIN_SEARCH_CHARS) {
      return;
    }
    const handle = setTimeout(() => void runSearch(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, runSearch]);


  /** A recipient was picked and then let go: the search starts over. */
  const clear = useCallback(() => {
    setResults([]);
    setSearched(false);
  }, []);

  return { query, setQuery, results, searching, searched, error, runSearch, clear };
}
