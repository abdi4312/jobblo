/**
 * API URL → route template for the monitoring reporter: no host, no query string, no ids,
 * so reports never carry user data and the same endpoint groups together.
 * "/api/services/6ad90a9e94221dfd9681ff17/apply?x=1" → "/services/:id/apply"
 */
export function templatePath(url?: string) {
  if (!url) return '';
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0].replace(/^\/api(?=\/)/, '');
  return path.replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id').replace(/\/\d+(?=\/|$)/g, '/:id').slice(0, 200);
}
