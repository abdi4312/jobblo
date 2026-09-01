import maling from './maling.webp';
import rengjoring from './rengjoring.webp';
import hagearbeid from './hagearbeid.webp';
import flytting from './flytting.webp';
import rorlegger from './rorlegger.webp';
import montering from './montering.webp';
import oppussing from './oppussing.webp';
import transport from './transport.webp';

/**
 * Stand-in photography for jobs posted without a picture of their own.
 *
 * A job's own `images[0]` always wins. This is only what fills the frame when a poster
 * uploaded nothing — and it is chosen by the job's *category*, so what a visitor sees is
 * an illustration of the kind of work being asked for rather than an arbitrary photo
 * standing in as if it were the job. `CATEGORY_FALLBACKS` is the rotation for the cases
 * where even the category is missing or is one we have no photo for.
 *
 * The keys are the category names the API returns (`seeds/categories.seed.js`), matched
 * case- and accent-insensitively so "Rengjøring", "rengjoring" and "RENGJØRING" all hit.
 * Adding a category to the backend without adding a photo here is safe: it falls through
 * to the rotation.
 *
 * Every one shows the work actually being done — a painter on a roller, movers carrying a
 * wrapped chair, a plumber hanging a radiator — rather than an empty room or a tool on a
 * table. That is the point: the frame has to read as the service Jobblo gets you.
 *
 * All eight are Unsplash, used under the Unsplash License, re-encoded to 900 px WebP.
 * That covers ~2× on the largest slot they fill (the 420 px hero arch). The garden and
 * plaster shots are encoded lower than the rest — foliage and wall texture cost far more
 * bits at the same setting, and at q≈46 they are indistinguishable at display size.
 *
 *   maling      painter rolling a ceiling      Ahmet Kurt          4OlkffjTOL8
 *   rengjoring  cleaner wiping a worktop       Getty Images        CJjVfom7_Mo
 *   hagearbeid  mowing a back garden           Ahmet Kurt          sHwyoOAJaZQ
 *   flytting    two movers carrying a chair    Curated Lifestyle   DEpgEDdtr-M
 *   rorlegger   plumber hanging a radiator     Getty Images        VZDzvfLnuBw
 *   oppussing   plastering a wall              Karolina Grabowska  1BnCBIJxXzI
 *   transport   loading a van                  Getty Images        6nIkztwmYMQ
 *   montering   fitting a kitchen cupboard     Getty Images        EhSPx8KgLZs
 */
const BY_CATEGORY: Record<string, string> = {
  maling,
  rengjoring,
  hagearbeid,
  flytting,
  rorlegger,
  montering,
  oppussing,
  transport,
  // Norwegian names that differ from their photo's key.
  smajobber: montering,
  // The category collection is Norwegian, but services carry English strings in their
  // own `categories` array ("Cleaning", "House Service") — the two were seeded from
  // different lists and never reconciled. Both spellings resolve to the same photo so
  // the page looks right either way, whichever the record happens to use.
  painting: maling,
  painter: maling,
  cleaning: rengjoring,
  gardening: hagearbeid,
  garden: hagearbeid,
  moving: flytting,
  movers: flytting,
  plumbing: rorlegger,
  plumber: rorlegger,
  renovation: oppussing,
  remodeling: oppussing,
  delivery: transport,
  assembly: montering,
  handyman: montering,
};

/**
 * The showcase the landing hero is built from — fixed, and deliberately not derived from
 * anything in the database.
 *
 * The collage used to be the six newest open jobs, which meant it vanished entirely on an
 * empty database and rendered whatever placeholder art the seed data happened to carry.
 * These eight are always there, always the same, and each is labelled with the service it
 * shows, so the picture and its caption can never disagree. `href` points at the real
 * listing route, so the frames are still a way into the product.
 */
export const SERVICE_SHOWCASE = [
  { name: 'Maling', src: maling },
  { name: 'Rengjøring', src: rengjoring },
  { name: 'Rørlegger', src: rorlegger },
  { name: 'Flytting', src: flytting },
  { name: 'Hagearbeid', src: hagearbeid },
  { name: 'Montering', src: montering },
  { name: 'Oppussing', src: oppussing },
  { name: 'Transport', src: transport },
] as const;

/** The order used when a job carries no category we recognise. */
export const CATEGORY_FALLBACKS = [
  maling,
  rengjoring,
  hagearbeid,
  flytting,
  rorlegger,
  montering,
  oppussing,
  transport,
];

/** "Rengjøring" → "rengjoring", so lookups survive case and Norwegian vowels. */
const normalise = (name: string) =>
  name.toLowerCase().trim().replace(/ø/g, 'o').replace(/æ/g, 'a').replace(/å/g, 'a');

/**
 * Filler-image services the seed data points at, which are not real job photos.
 *
 * `seeds/constants/images.js` gives every seeded service three `picsum.photos` URLs, and
 * Picsum answers each request with a *random* stock photo — which is why the demo data
 * renders brick walls and landscapes under job titles like "Service 15". Treating these
 * hosts as "no image" lets the category photo take over, so local and staging data look
 * like the product instead of like a placeholder generator. A genuinely uploaded image is
 * never on one of these hosts, so production is unaffected.
 */
const PLACEHOLDER_HOSTS = [
  'picsum.photos',
  'placehold.co',
  'via.placeholder.com',
  'placeholder.com',
  'dummyimage.com',
  'loremflickr.com',
  'placekitten.com',
  'pravatar.cc',
];

const isRealPhoto = (url: string | undefined): url is string =>
  Boolean(url) && !PLACEHOLDER_HOSTS.some((host) => url!.includes(host));

/**
 * The picture to show for a job: its own first real image, else its category's photo,
 * else the next one in the rotation. `index` keeps two adjacent uncategorised jobs from
 * landing on the same stand-in.
 */
export const jobImage = (job: { images?: string[]; categories?: string[] }, index = 0): string =>
  job.images?.find(isRealPhoto) ||
  // Every category the job carries gets a look, not just the first: a record tagged
  // ["House Service", "Cleaning"] should still find the cleaning photo.
  job.categories?.map((name) => BY_CATEGORY[normalise(name)]).find(Boolean) ||
  CATEGORY_FALLBACKS[index % CATEGORY_FALLBACKS.length];
