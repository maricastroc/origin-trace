import { useCallback, useEffect, useRef } from "react";

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
