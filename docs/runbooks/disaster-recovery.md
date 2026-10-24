# Runbook: database backup & disaster recovery

This runbook covers the production MongoDB. Today it runs on the VPS; it will move to MongoDB Atlas later. Status lives in the developer dashboard under **Infrastructure → Backup & DR**.

| Target | Value | Where it is checked |
|---|---|---|
| RPO (max data loss) | `BACKUP_MAX_AGE_HOURS`, default 26 h | Critical alert `backup_stale` / `backup_missing` |
| RTO (time to restore) | Measured by every restore drill, shown as "restore took …" | Weekly drill |
| Retention | `BACKUP_RETENTION_DAYS`, default 14; the newest 3 are always kept | `prune` after each backup |

## 1. One-time setup on the VPS

1. Install the **MongoDB Database Tools**, which provide `mongodump` and `mongorestore`. Set `MONGODUMP_BIN` / `MONGORESTORE_BIN` if they are not on `PATH`.
   - If the API runs in Docker, run the backup from the host instead (step 3). The image does not include the tools.
2. Create the backup directory outside the app, readable only by the service user:
   ```sh
   sudo mkdir -p /var/backups/jobblo && sudo chown jobblo: /var/backups/jobblo && sudo chmod 700 /var/backups/jobblo
   ```
   Then set `BACKUP_DIR=/var/backups/jobblo` in `backend/.env`.
3. Schedule backups on the host with cron. `crontab -e` as the service user:
   ```cron
   # daily backup 02:30, weekly restore drill Sunday 04:00
   30 2 * * *  cd /srv/jobblo/backend && node scripts/backup.js backup >> /var/log/jobblo-backup.log 2>&1
   0  4 * * 0  cd /srv/jobblo/backend && node scripts/backup.js drill  >> /var/log/jobblo-backup.log 2>&1
   ```
   The alternative is `BACKUP_SCHEDULE_HOURS=24`, which runs backups inside the API process instead.
4. **Offsite copy (required for real DR).** A dump on the same VPS is lost with the VPS. Configure an rclone remote with **crypt**, because dumps contain personal data:
   ```
   BACKUP_OFFSITE_CMD=rclone copyto {file} jobblo-offsite:jobblo-backups/{name}
   ```
   Give the offsite bucket its own retention or lifecycle rule, at least 30 days.
5. Run once by hand and confirm the dashboard shows *Last backup* and *Offsite: Copied*:
   ```sh
   node scripts/backup.js backup && node scripts/backup.js drill
   ```

**Safety notes:**
- The MongoDB URI is passed to the tools through a temporary `0600` config file, never on the command line.
- Error messages are stripped of credentials.

## 2. After moving to MongoDB Atlas

- `scripts/backup.js` keeps working unchanged against the Atlas URI. Keep it as an independent, provider-neutral copy.
- Turn on Atlas **Cloud Backup** for the cluster: a snapshot policy plus point-in-time restore if the tier allows it.
- For the dashboard's snapshot list, create a **Service Account** with the *Project Read Only* role. Then set `ATLAS_CLIENT_ID`, `ATLAS_CLIENT_SECRET`, `ATLAS_GROUP_ID` (the project ID) and `ATLAS_CLUSTER_NAME`.

## 3. Restore drill (weekly, and after any backup change)

A drill:
1. Verifies the archive's SHA-256.
2. Restores it into `<db>_restore_drill` on the same server.
3. Counts every collection against the counts recorded at backup time. A tolerance of max(5, 0.1%) covers writes made during the dump.
4. Drops the scratch database.

The live database is never written to. It runs from cron (above), or from the dashboard with operations access and a one-time code.

A failed drill raises the `restore_drill_failed` alert. Treat it as "we currently have no proven backup".

## 4. Disaster: restore production

Restoring over production is deliberately **not** possible from the dashboard. Do it by hand, with two people.

1. **Declare an incident** in the dashboard (Incidents) and put the site in maintenance mode, so no new writes are lost.
2. **Pick the archive.** Use the newest backup with a passing drill. Get it from `BACKUP_DIR` or from the offsite copy. Check it against the SHA-256 shown in Backup & DR → History:
   ```sh
   sha256sum jobblo-<stamp>.archive.gz
   ```
3. **Keep what is there.** If the current database is reachable, dump it first, even if it is damaged. Use `node scripts/backup.js backup`, or `mongodump --archive=pre-restore.gz --gzip`.
4. **Restore into a new database name first**, then verify:
   ```sh
   mongorestore --config=<file with uri: ...> --archive=jobblo-<stamp>.archive.gz --gzip \
     --nsInclude='jobblo.*' --nsFrom='jobblo.*' --nsTo='jobblo_restored.*' --stopOnError
   ```
   Spot-check users, orders, payments and payouts. Compare the counts with the backup's collection list in the dashboard.
5. **Switch over.** Point `MONGO_URI` at `jobblo_restored`, or restore with `--drop` into the original name once verified. Then restart the API.
6. **Reconcile money for the gap** between the backup time and the incident:
   - Stripe is the source of truth for payments, refunds and transfers that happened after the backup.
   - Re-deliver the Stripe webhook events from that window: Dashboard → Developers → Events → resend. The handlers are idempotent.
   - Then run Reconciliation and Data Integrity in the developer dashboard.
   - Do not release payouts or refunds by hand until both are clean.
7. Leave maintenance mode, write the incident timeline and record the real RTO.

**Atlas:** prefer an Atlas restore (snapshot or point in time) to a new cluster, then switch `MONGO_URI`. Steps 3, 6 and 7 still apply.
