# Runbook — archiving orphan duplicate Payment records

**Why:** duplicate `payments` rows per `orderId` stop MongoDB from building the unique
`{ orderId }` index, so nothing in the database enforces "one Payment per order".
**Root cause:** commit `ff7eaab8` (2026-06-01) created `new Payment({ status: 'released' })`
on every job-completion call. That code is gone. Payments are now upserted by `orderId`.
**Tool:** `backend/scripts/archive-orphan-duplicate-payments.js`. It is read-only unless you pass `--apply` or `--restore`.

Do **not** run `--apply` on production until every step below is signed off.

## 1. Production dry run (read-only)

```bash
MONGO_URI=<production URI> node scripts/archive-orphan-duplicate-payments.js \
  --export dup-review-prod.json --verify-stripe
```

Record the output. A group is only listed as a **candidate** when all of these hold:
- its order no longer exists
- no row has any Stripe reference (`stripePaymentIntentId`, `stripeSessionId`, `stripeEventId`, `stripeRefundId`, `paymentProviderId`, `transactionId`, `capturedAmountMinor`)
- there are no related SafePayHistory, Payout, StripeFinancialOperation or StripePaymentIncident records

Every other group appears under **needs human review** and must be decided case by case.

## 2. Verified backup

1. Back up the collection: `mongodump --uri=<production URI> --collection=payments --out=backup-payments-<date>`. Also take the platform's managed backup or snapshot.
2. **Test-restore** the dump into a scratch database: `mongorestore --nsFrom=<db>.payments --nsTo=restore_check.payments …`.
3. Compare the document count and a sample of `_id`s with production. Then drop the scratch database.
4. Write down the backup ID. It becomes `--backup-ref`.

## 3. Manual review of every row

Use `dup-review-prod.json`. For every candidate row, a reviewer confirms all of the following:

- [ ] The order really no longer exists. Also check `orders` in the backups, and why it was deleted.
- [ ] Amount and timestamps line up with the ff7eaab8 bug: same amount, minutes apart, `status: released`.
- [ ] No Stripe reference. In the **current** Stripe accounts, `--verify-stripe` searches PaymentIntents by `metadata.orderId`.
- [ ] **Old or rotated Stripe accounts:** an account owner searches each dashboard by the order ID, the amount and the date. The script cannot reach accounts whose keys we no longer hold.
- [ ] Accounting: no ledger or export references these rows.
- [ ] No payout or transfer was ever made for the order.

Two people sign off. Note the total number of reviewed rows; it becomes `--reviewed`.

## 4. Apply (approved maintenance window only)

```bash
MONGO_URI=<production URI> node scripts/archive-orphan-duplicate-payments.js \
  --apply --backup-ref=<backup id> --reviewed=<row count>
```

- The script refuses to run without `--backup-ref`. It also refuses if `--reviewed` differs from the candidate count, which changes whenever the data changed after the review.
- Rows are **copied** to `payments_archive` with `archiveBatch`, `archiveBackupRef` and `archiveDb` set, and only then deleted.
- The unique index is built only when no group still needs review.
- Keep the printed `archiveBatch` ID.

Verify afterwards:
- `db.payments.getIndexes()` shows `orderId_1` with `unique: true`.
- The count of `payments_archive` rows for the batch equals the reviewed count.
- The developer dashboard → Performance shows no failing `createIndexes payments`.

## 5. Restore / rollback

```bash
MONGO_URI=<production URI> node scripts/archive-orphan-duplicate-payments.js --restore=<archiveBatch> --drop-unique-index
```

- Pre-flight check: it changes **nothing** if the unique index exists and `--drop-unique-index` was not given.
- It is idempotent: rows are upserted by `_id`, so a re-run after an interruption reaches the same state.
- Last resort: `mongorestore` from the backup taken in step 2.

**Tested 2026-10-23** in a throwaway database (`jobblo_dup_drill`) with a copy of the 12 local rows:
- the archive step built the unique index
- a restore without the flag changed nothing
- a restore with the flag brought back all 12 rows

The first drill exposed a partial-restore bug. It was fixed before this runbook was written.
