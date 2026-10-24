/**
 * Read-only view of MongoDB Atlas cloud backup snapshots, for when the database moves to
 * Atlas. Uses an Atlas Service Account (OAuth client credentials) with the Project Read
 * Only role:
 *   ATLAS_CLIENT_ID, ATLAS_CLIENT_SECRET, ATLAS_GROUP_ID (project id), ATLAS_CLUSTER_NAME
 * Not configured → { configured: false }; the mongodump backups keep working either way.
 */

const BASE = 'https://cloud.mongodb.com';
const ACCEPT = 'application/vnd.atlas.2023-01-01+json';

const configured = () => Boolean(process.env.ATLAS_CLIENT_ID && process.env.ATLAS_CLIENT_SECRET && process.env.ATLAS_GROUP_ID && process.env.ATLAS_CLUSTER_NAME);

let token = null;
async function accessToken() {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${process.env.ATLAS_CLIENT_ID}:${process.env.ATLAS_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Atlas token request failed (${res.status})`);
  const body = await res.json();
  token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in || 3600) * 1000 };
  return token.value;
}

async function listSnapshots() {
  if (!configured()) return { configured: false, snapshots: [] };
  try {
    const url = `${BASE}/api/atlas/v2/groups/${encodeURIComponent(process.env.ATLAS_GROUP_ID)}/clusters/${encodeURIComponent(process.env.ATLAS_CLUSTER_NAME)}/backup/snapshots?itemsPerPage=50`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}`, Accept: ACCEPT }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Atlas snapshots request failed (${res.status})`);
    const body = await res.json();
    const snapshots = (body.results || [])
      .map((s) => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt, status: s.status, type: s.snapshotType, frequency: s.frequencyType || null, sizeBytes: s.storageSizeBytes ?? null }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { configured: true, cluster: process.env.ATLAS_CLUSTER_NAME, snapshots };
  } catch (e) {
    return { configured: true, cluster: process.env.ATLAS_CLUSTER_NAME, snapshots: [], error: e.message };
  }
}

module.exports = { configured, listSnapshots };
