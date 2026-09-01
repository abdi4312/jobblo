/**
 * Merge chat conversations that were duplicated by the direction-sensitive lookup.
 *
 *   node scripts/merge-duplicate-chats.js            # report only, changes nothing
 *   node scripts/merge-duplicate-chats.js --apply    # actually merge
 *
 * Background: applying to a job created { clientId: applicant, providerId: owner },
 * while the owner pressing "Send melding" looked for the opposite arrangement, missed,
 * and created a second conversation for the same pair and job. Both rows survive in
 * the database even though the lookup is now direction-agnostic.
 *
 * Merge policy, in order of preference for which row SURVIVES:
 *   1. the one carrying an orderId — an order points at a chat, so deleting that row
 *      would orphan a contract;
 *   2. otherwise the oldest, which is the apply-created one holding the original
 *      application message and status 'requested'.
 *
 * Messages from the losing row are appended and the whole thread re-sorted by
 * createdAt, so the conversation reads in the order it actually happened. Nothing is
 * deleted until the messages have been moved.
 *
 * Refuses to merge when BOTH rows carry a (different) orderId — that needs a human.
 */
require('dotenv').config({ path: __dirname + '/../.env' });

const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

/** Stable key for "these two people, about this job", regardless of slot order. */
function pairKey(chat) {
  const pair = [String(chat.clientId), String(chat.providerId)].sort();
  return `${String(chat.serviceId)}::${pair[0]}::${pair[1]}`;
}

function pickSurvivor(chats) {
  const withOrder = chats.filter((c) => c.orderId);
  if (withOrder.length === 1) return withOrder[0];
  if (withOrder.length > 1) return null; // ambiguous — needs a human
  return chats.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const Chat = require('../models/ChatMessage');

  console.log(`\nMerging duplicate chats${APPLY ? '' : '  (DRY RUN — pass --apply to write)'}\n`);

  const all = await Chat.find({ serviceId: { $ne: null } })
    .select('_id clientId providerId serviceId orderId status messages createdAt')
    .lean();

  const groups = new Map();
  for (const chat of all) {
    if (!chat.clientId || !chat.providerId) continue;
    const key = pairKey(chat);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(chat);
  }

  const dupes = [...groups.values()].filter((g) => g.length > 1);

  if (dupes.length === 0) {
    console.log('  No duplicate conversations found.\n');
    await mongoose.disconnect();
    process.exit(0);
  }

  let merged = 0;
  let skipped = 0;

  for (const group of dupes) {
    const survivor = pickSurvivor(group);

    if (!survivor) {
      skipped++;
      console.log(
        `  SKIP  service=${group[0].serviceId} — ${group.length} chats and more than one has an order:`
      );
      group.forEach((c) => console.log(`          ${c._id}  order=${c.orderId}`));
      continue;
    }

    const losers = group.filter((c) => String(c._id) !== String(survivor._id));
    const movedMessages = losers.reduce((n, c) => n + (c.messages?.length || 0), 0);

    console.log(
      `  MERGE service=${survivor.serviceId}  keep=${survivor._id}` +
        `${survivor.orderId ? ' (has order)' : ' (oldest)'}  ` +
        `drop=${losers.map((c) => c._id).join(', ')}  messages_moved=${movedMessages}`
    );

    if (APPLY) {
      const combined = [...(survivor.messages || [])];
      for (const loser of losers) combined.push(...(loser.messages || []));
      combined.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

      const last = combined[combined.length - 1];

      // Write the merged thread FIRST, then remove the losers, so a crash in between
      // duplicates a message rather than losing one.
      await Chat.updateOne(
        { _id: survivor._id },
        {
          $set: {
            messages: combined,
            ...(last?.text ? { lastMessage: last.text } : {}),
            // Keep an order link if only the losing row had one.
            ...(survivor.orderId ? {} : losers.find((l) => l.orderId)
              ? { orderId: losers.find((l) => l.orderId).orderId }
              : {}),
          },
        }
      );
      await Chat.deleteMany({ _id: { $in: losers.map((c) => c._id) } });
    }

    merged++;
  }

  console.log(
    `\n${APPLY ? 'Merged' : 'Would merge'} ${merged} conversation group(s)` +
      `${skipped ? `, skipped ${skipped} needing manual review` : ''}.` +
      `${APPLY ? '' : '  Re-run with --apply.'}\n`
  );

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error('merge failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
