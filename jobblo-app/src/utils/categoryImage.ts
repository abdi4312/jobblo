import type { ImageSourcePropType } from 'react-native';

/**
 * Stand-in photo for a job posted without one, chosen by category. Same photos, keys and
 * order as the web (frontend/src/assets/images/categories/index.ts `jobImage`).
 */
const PHOTOS = {
  maling: require('../../assets/category-showcase/maling.webp'),
  rengjoring: require('../../assets/category-showcase/rengjoring.webp'),
  hagearbeid: require('../../assets/category-showcase/hagearbeid.webp'),
  flytting: require('../../assets/category-showcase/flytting.webp'),
  rorlegger: require('../../assets/category-showcase/rorlegger.webp'),
  montering: require('../../assets/category-showcase/montering.webp'),
  oppussing: require('../../assets/category-showcase/oppussing.webp'),
  transport: require('../../assets/category-showcase/transport.webp'),
} as const;

const BY_CATEGORY: Record<string, ImageSourcePropType> = {
  ...PHOTOS,
  smajobber: PHOTOS.montering,
  painting: PHOTOS.maling,
  cleaning: PHOTOS.rengjoring,
  gardening: PHOTOS.hagearbeid,
  moving: PHOTOS.flytting,
  plumbing: PHOTOS.rorlegger,
  renovation: PHOTOS.oppussing,
  delivery: PHOTOS.transport,
  assembly: PHOTOS.montering,
  handyman: PHOTOS.montering,
};
const ROTATION = Object.values(PHOTOS) as ImageSourcePropType[];

/** The services the Hjem hero shows, in the web's SERVICE_SHOWCASE order. */
export const SERVICE_SHOWCASE: Array<{ name: string; src: ImageSourcePropType }> = [
  { name: 'Maling', src: PHOTOS.maling },
  { name: 'Rengjøring', src: PHOTOS.rengjoring },
  { name: 'Rørlegger', src: PHOTOS.rorlegger },
  { name: 'Flytting', src: PHOTOS.flytting },
  { name: 'Hagearbeid', src: PHOTOS.hagearbeid },
  { name: 'Montering', src: PHOTOS.montering },
  { name: 'Oppussing', src: PHOTOS.oppussing },
  { name: 'Transport', src: PHOTOS.transport },
];

const normalise = (name: string) =>
  name.toLowerCase().trim().replace(/ø/g, 'o').replace(/æ/g, 'a').replace(/å/g, 'a');

/** Category photo for a job; `index` spreads uncategorised jobs over the rotation. */
export function categoryImage(categories: string[] | undefined, index = 0): ImageSourcePropType {
  return (
    categories?.map((name) => BY_CATEGORY[normalise(name)]).find(Boolean) ??
    ROTATION[Math.abs(index) % ROTATION.length]
  );
}

/** The job's own first photo, else its category photo. */
export function jobImageSource(job: { images?: string[]; categories?: string[] }, index = 0): ImageSourcePropType {
  const own = job.images?.find(Boolean);
  return own ? { uri: own } : categoryImage(job.categories, index);
}
