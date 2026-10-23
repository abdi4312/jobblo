/**
 * Collapses each run of consecutive system messages (payment, contract, status…) into one
 * "Oppdragsstatus" item, so eight status lines in a row read as one card. Within a run an
 * exact repeat of the same text is dropped (keeps the latest). Pure; check:
 * node src/utils/chatGrouping.check.mjs
 */
export interface GroupableMessage {
  _id?: string;
  type?: string;
  text?: string;
  createdAt?: string;
}

export interface StatusGroup<T> {
  kind: 'status';
  key: string;
  /** Oldest first; never empty. */
  items: T[];
}

export type ChatItem<T> = T | StatusGroup<T>;

const isSystem = (message: GroupableMessage) => Boolean(message.type?.startsWith('system_'));

export function groupSystemMessages<T extends GroupableMessage>(messages: T[]): ChatItem<T>[] {
  const out: ChatItem<T>[] = [];
  let run: T[] = [];
  const flush = () => {
    if (!run.length) return;
    const latestByText = new Map<string, T>();
    for (const message of run) {
      const text = (message.text ?? '').trim();
      latestByText.delete(text); // re-insert so the latest copy keeps its position
      latestByText.set(text, message);
    }
    const items = [...latestByText.values()];
    out.push({ kind: 'status', key: `status-${items[0]._id ?? items[0].createdAt ?? out.length}`, items });
    run = [];
  };
  for (const message of messages) {
    if (isSystem(message)) run.push(message);
    else {
      flush();
      out.push(message);
    }
  }
  flush();
  return out;
}

export function isStatusGroup<T>(item: ChatItem<T>): item is StatusGroup<T> {
  return typeof item === 'object' && item !== null && (item as StatusGroup<T>).kind === 'status';
}
