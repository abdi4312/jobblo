import type { Job } from './Jobs';

/**
 * Favorite / saved list types, mirroring `backend/models/List.js`.
 *
 * Two shapes come back from the same collection and the difference matters:
 *
 * - `GET /api/lists` populates `services` only, so `user` and `contributors` arrive as
 *   raw id strings.
 * - `GET /api/lists/:listId` additionally populates `user` and `contributors` with a
 *   name/avatar projection.
 *
 * Rather than model those as two types that drift, every reference field is a union and
 * the helpers below do the narrowing. `latestservice` is never populated by either
 * endpoint, so the cover image is derived from `services` instead of trusting it.
 */

export interface FavoriteListMember {
  _id: string;
  name?: string;
  lastName?: string;
  avatarUrl?: string;
  email?: string;
}

export type FavoriteListRef = string | FavoriteListMember;

export interface FavoriteList {
  _id: string;
  name: string;
  description?: string;
  /** Owner ids. The model stores an array, so a list can carry more than one owner. */
  user?: FavoriteListRef[];
  contributors?: FavoriteListRef[];
  services?: Array<Job | string>;
  latestservice?: string | null;
  public?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** `POST /api/lists` accepts only `name` — verified against listController.createList. */
export interface CreateFavoriteListPayload {
  name: string;
}

/**
 * `PUT /api/lists/:listId` accepts name, description and public, and is owner-only.
 * Mobile sends `name` and `description`; visibility has its own explicit toggle.
 */
export interface UpdateFavoriteListPayload {
  name?: string;
  description?: string;
  public?: boolean;
}

export interface AddServiceToFavoriteListPayload {
  listId: string;
  serviceId: string;
}

/** Matches backend/controllers/listController.js LIST_NAME_MAX_LENGTH. */
export const FAVORITE_LIST_NAME_MAX_LENGTH = 60;

const refId = (ref: FavoriteListRef | null | undefined): string =>
  typeof ref === 'string' ? ref : String(ref?._id ?? '');

/** Saved services that actually arrived populated. Bare ids cannot be rendered. */
export function favoriteListServices(list: FavoriteList | undefined | null): Job[] {
  if (!Array.isArray(list?.services)) return [];
  return list.services.filter((service): service is Job => typeof service !== 'string');
}

/** Every saved service id, whether the entry came back populated or as a bare id. */
export function favoriteListServiceIds(list: FavoriteList | undefined | null): string[] {
  if (!Array.isArray(list?.services)) return [];
  return list.services.map((service) => (typeof service === 'string' ? service : service._id));
}

/**
 * How many services the list holds. This counts the stored array rather than the
 * populated subset, so it stays truthful even if a reference could not be resolved.
 */
export function favoriteListCount(list: FavoriteList | undefined | null): number {
  return Array.isArray(list?.services) ? list.services.length : 0;
}

/**
 * Cover image: the newest saved service that has one. Mongoose keeps the array in
 * insertion order, so the tail is the most recently added — the same rule the web
 * FavoritesPage card uses.
 */
export function favoriteListCoverImage(list: FavoriteList | undefined | null): string | undefined {
  const services = favoriteListServices(list);
  for (let index = services.length - 1; index >= 0; index -= 1) {
    const image = services[index]?.images?.[0];
    if (image) return image;
  }
  return undefined;
}

/** True when the signed-in user is in the list's owner array. */
export function isFavoriteListOwner(
  list: FavoriteList | undefined | null,
  currentUserId: string | null | undefined
): boolean {
  if (!list || !currentUserId) return false;
  return (list.user ?? []).some((owner) => refId(owner) === String(currentUserId));
}

/**
 * True when the signed-in user is a contributor rather than an owner.
 *
 * The backend lets a contributor view a list and add or remove services, but not rename,
 * re-publish or delete it. Mobile ships no contributor-management UI, so this exists only
 * to decide which controls a shared list may show.
 */
export function isFavoriteListContributor(
  list: FavoriteList | undefined | null,
  currentUserId: string | null | undefined
): boolean {
  if (!list || !currentUserId) return false;
  return (list.contributors ?? []).some(
    (contributor) => refId(contributor) === String(currentUserId)
  );
}

/** True when the given service is saved in the given list. */
export function favoriteListContainsService(
  list: FavoriteList | undefined | null,
  serviceId: string | undefined | null
): boolean {
  if (!serviceId) return false;
  return favoriteListServiceIds(list).includes(String(serviceId));
}

/**
 * Whether a service is saved in ANY of the user's lists.
 *
 * A service can live in several lists at once, so there is no server-side `isFavorite`
 * boolean to read — the state is derived from the one shared lists query. See
 * useIsServiceSaved in src/hooks/useFavoriteLists.ts.
 */
export function isServiceInAnyList(
  lists: FavoriteList[] | undefined,
  serviceId: string | undefined | null
): boolean {
  if (!serviceId || !Array.isArray(lists)) return false;
  return lists.some((list) => favoriteListContainsService(list, serviceId));
}
