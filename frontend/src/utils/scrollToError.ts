/**
 * Take the person to the first thing that is wrong.
 *
 * The job form validates a whole step at once and reports the result in a toast — "Vennligst
 * fyll ut: adresse, fylke og kommune." On a form four screens tall that is a scavenger hunt:
 * the toast names the fields but the page does not move, so the one empty field can be a
 * thousand pixels above or below whatever is on screen. People conclude the button is broken.
 *
 * There is no field registry to look things up in, and building one would mean threading a
 * ref through every input on four step components. The DOM already knows: an invalid field
 * carries `aria-invalid`, or the red border the step components apply, or the `data-invalid`
 * marker used by the few controls that are validated outside the schema (the fylke/kommune
 * selects, the map). Reading the rendered result keeps this to one function.
 */

/**
 * Ordered by how specific the marker is. `aria-invalid` is the honest one — it is what a
 * screen reader announces — so it wins when a field carries both.
 */
const INVALID_SELECTOR = [
  '[aria-invalid="true"]',
  '[data-invalid="true"]',
  '.border-red-500',
].join(', ');

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * How many extra frames to keep looking after the first two.
 *
 * Two frames is enough when validation only marks fields on the step already on screen. It
 * is not enough when the caller also changes step — publishing from step 4 with no map pin
 * sends the person back to step 2, and that step mounts behind an `animate-in` transition,
 * so the marked field does not exist in the DOM yet on the frame we used to give up on.
 * That is the "sometimes it doesn't scroll" case. ~12 frames is about 200 ms at 60 Hz:
 * long enough for a step swap, short enough that nobody sees a delay.
 */
const MAX_EXTRA_FRAMES = 12;

/**
 * Scroll the first invalid control into view and focus it.
 *
 * The first two frames are waited out unconditionally. Validation calls `setErrors`, and the
 * red borders and `aria-invalid` attributes this looks for only exist once React has
 * committed that state — searching immediately finds the *previous* render, which would mean
 * scrolling to a field the person has already fixed. After those two frames it keeps looking
 * for up to `MAX_EXTRA_FRAMES` more, so a step change in the same tick still lands.
 *
 * @param root  Limit the search — pass the form element when a page has more than one.
 */
export function scrollToFirstError(root: ParentNode = document): void {
  if (typeof window === 'undefined') return;

  let framesLeft = MAX_EXTRA_FRAMES;

  const attempt = () => {
    const target = root.querySelector<HTMLElement>(INVALID_SELECTOR);

    if (!target) {
      if (framesLeft-- > 0) requestAnimationFrame(attempt);
      return;
    }

    target.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      // Centred rather than `start`: the site has a sticky header, and a field aligned to
      // the top of the viewport ends up underneath it.
      block: 'center',
      inline: 'nearest',
    });

    // Focus so the next keystroke goes where the person is looking. `preventScroll` because
    // focusing jumps the viewport instantly and would fight the smooth scroll above.
    // Non-focusable markers (the map wrapper, the image card) are skipped rather than made
    // tabbable.
    if (typeof target.focus === 'function' && target.tabIndex >= 0) {
      target.focus({ preventScroll: true });
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(attempt));
}
