import type { HistoryEntry } from './history-types';

export const MAX_HISTORY_ITEMS = 18;

export function trimHistoryEntries(entries: HistoryEntry[]) {
  return [...entries]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_HISTORY_ITEMS);
}
