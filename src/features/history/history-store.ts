import { trimHistoryEntries } from './history-retention';
import type { HistoryEntry } from './history-types';

export function prependHistoryEntry(
  entries: HistoryEntry[],
  entry: HistoryEntry,
): HistoryEntry[] {
  return trimHistoryEntries([entry, ...entries.filter((item) => item.id !== entry.id)]);
}
