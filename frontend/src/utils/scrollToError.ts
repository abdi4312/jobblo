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
 * Scroll the first invalid control into view and focus it.
 *
 * Runs after two frames on purpose. Validation calls `setErrors`, and the red borders and
 * `aria-invalid` attributes this looks for only exist once React has committed that state —
 * searching immediately finds the *previous* render, which on a first submit means finding
 * nothing at all.
 *
 * @param root  Limit the search — pass the form element when a page has more than one.
 */
export function scrollToFirstError(root: ParentNode = document): void {
  if (typeof window === 'undefined') return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const target = root.querySelector<HTMLElement>(INVALID_SELECTOR);
      if (!target) return;

      target.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        // Centred rather than `start`: the site has a sticky header, and a field aligned to
        // the top of the viewport ends up underneath it.
        block: 'center',
        inline: 'nearest',
      });

      // Focus so the next keystroke goes where the person is looking. `preventScroll` because
      // focusing jumps the viewport instantly and would fight the smooth scroll above.
      // Non-focusable markers (the map wrapper) are skipped rather than made tabbable.
      if (typeof target.focus === 'function' && target.tabIndex >= 0) {
        target.focus({ preventScroll: true });
      }
    });
  });
}
