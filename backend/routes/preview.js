const express = require('express');
const router = express.Router();
const Service = require('../models/Service');

// Escape HTML to avoid injection in meta tags
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Truncate text to a sensible length for social previews
function truncate(str, n = 200) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

router.get('/job-listing/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Service.findById(id).lean();

    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

    // Default safe values
    let title = 'Jobblo - Oppdrag';
    let description = 'Se oppdrag på Jobblo';
    let image = `${frontendBase}/favicon.svg`;
    let url = `${frontendBase}/job-listing/${escapeHtml(id)}`;

    if (
      !job ||
      job.status === 'draft' ||
      job.status === 'closed' ||
      job.status === 'private' ||
      job.status === 'cancelled'
    ) {
      // return generic preview for non-public or missing jobs
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:type" content="website"><meta property="og:url" content="${escapeHtml(url)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"></head><body><script>window.location='${url}';</script></body></html>`;
      res.status(404).send(html);
      return;
    }

    // Use job data
    title = job.title || title;
    description = truncate((job.description || '').replace(/\s+/g, ' ').trim(), 220) || description;
    url = `${frontendBase}/job-listing/${escapeHtml(id)}`;

    if (job.images && job.images.length > 0) {
      image = job.images[0];
      // ensure absolute https URL if possible
      if (image.startsWith('//')) image = 'https:' + image;
      if (!/^https?:\/\//i.test(image)) {
        image = `${frontendBase.replace(/\/$/, '')}/${image.replace(/^\//, '')}`;
      }
    }

    const safeTitle = escapeHtml(title);
    const safeDesc = escapeHtml(description);
    const safeImage = escapeHtml(image);
    const safeUrl = escapeHtml(url);

    const html = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${safeTitle}</title>
        <meta name="description" content="${safeDesc}" />

        <!-- Open Graph -->
        <meta property="og:title" content="${safeTitle}" />
        <meta property="og:description" content="${safeDesc}" />
        <meta property="og:image" content="${safeImage}" />
        <meta property="og:url" content="${safeUrl}" />
        <meta property="og:type" content="article" />

        <!-- Twitter -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${safeTitle}" />
        <meta name="twitter:description" content="${safeDesc}" />
        <meta name="twitter:image" content="${safeImage}" />

      </head>
      <body>
        <div id="root"></div>
        <script>location.replace('${safeUrl}');</script>
      </body>
    </html>`;

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.send(html);
  } catch (err) {
    console.error('Preview route error', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
