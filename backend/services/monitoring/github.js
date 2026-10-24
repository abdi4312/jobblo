const { MINUTE } = require('../../utils/devQuery');

/** GitHub Actions runs for the console (read-only token; cached 1 min). */

// ── 23. CI/CD & deployments ─────────────────────────────────────────────────
const ghCache = { at: 0, data: null };
async function githubRuns() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'abdi4312/jobblo';
  if (!token) return { configured: false, repo, reason: 'Set GITHUB_TOKEN (read-only: actions:read, contents:read) to show GitHub Actions runs.' };
  if (Date.now() - ghCache.at < MINUTE && ghCache.data) return ghCache.data;
  try {
    const { data } = await require('axios').get(`https://api.github.com/repos/${repo}/actions/runs?per_page=25`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      timeout: 8000,
    });
    const result = {
      configured: true,
      repo,
      runs: (data.workflow_runs || []).map((r) => ({
        id: r.id,
        name: r.name,
        title: r.display_title,
        branch: r.head_branch,
        sha: r.head_sha?.slice(0, 7),
        event: r.event,
        status: r.status,
        conclusion: r.conclusion,
        actor: r.actor?.login || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        durationMs: r.run_started_at ? new Date(r.updated_at) - new Date(r.run_started_at) : null,
        url: r.html_url,
        attempt: r.run_attempt || 1,
      })),
    };
    ghCache.at = Date.now();
    ghCache.data = result;
    return result;
  } catch (err) {
    return { configured: true, repo, error: err.response?.status ? `GitHub API ${err.response.status}` : err.message };
  }
}

module.exports = { ghCache, githubRuns };
