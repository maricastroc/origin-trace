import { useCallback, useEffect, useRef } from "react";

/**
 * Bridges the gap between a user action (submit / example click) and the
 * results that render below the form. Attach `ref` to the results container,
 * call `reveal()` the moment a run starts, and pass the current `status` plus
 * whether the flow is still `busy` (a loading-type status).
 *
 * The scroll runs from an effect, not inline, so it fires *after* React commits
 * and the browser has laid the results out — scrolling inline races the layout
 * and lands short. Two wrinkles it handles:
 *  - Flows that show nothing until a status arrives (idle → loading): keying on
 *    `status` means the first scroll waits for real content, never an
 *    `empty:hidden` (display:none) container.
 *  - A loading → results reflow can cut an in-flight smooth scroll short. Rather
 *    than snap (which reads as abrupt), we re-issue the smooth glide on every
 *    status change and let the last one — fired once the flow has settled
 *    (`!busy`), after the final reflow — carry it home. Re-issues that are
 *    already at the target are no-ops.
 */
export function useRevealResults<T extends HTMLElement = HTMLDivElement>(
  status: string,
  busy: boolean,
) {
  const ref = useRef<T>(null);
  const pending = useRef(false);

  const reveal = useCallback(() => {
    pending.current = true;
  }, []);

  useEffect(() => {
    if (!pending.current || status === "idle") return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!busy) pending.current = false;
  }, [status, busy]);

  return { ref, reveal };
}
