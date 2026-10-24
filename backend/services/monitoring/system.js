/**
 * Host and database vitals for the developer console, capacity planning and runbooks.
 * Read-only and cheap; never throws.
 */
const os = require('os');
const fs = require('fs');
const mongoose = require('mongoose');

async function mongoPing() {
  if (mongoose.connection.readyState !== 1) return { ok: false, ms: null };
  const start = Date.now();
  try {
    await mongoose.connection.db.admin().ping();
    return { ok: true, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: null };
  }
}

function cpuPercent() {
  const load = os.loadavg()[0];
  const cores = os.cpus().length || 1;
  // loadavg is always 0 on Windows; report null instead of a fake 0%.
  return process.platform === 'win32' ? null : Math.min(100, Math.round((load / cores) * 100));
}

function diskUsage() {
  try {
    const s = fs.statfsSync(process.platform === 'win32' ? process.cwd().slice(0, 3) : '/');
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    return { total, free, used: total - free, percent: total ? Math.round(((total - free) / total) * 100) : null };
  } catch {
    return null;
  }
}

module.exports = { mongoPing, cpuPercent, diskUsage };
