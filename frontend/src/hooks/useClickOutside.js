import { useEffect, useRef } from "react";

/**
 * Invokes a callback when a pointer press occurs outside the referenced element.
 * @param {import("react").RefObject<HTMLElement|null>} containerRef Element boundary.
 * @param {(event: MouseEvent) => void} onOutside Outside-click handler.
 * @param {boolean} enabled Whether the document listener should be active.
 */
export default function useClickOutside(containerRef, onOutside, enabled = true) {
  const onOutsideRef = useRef(onOutside);
  onOutsideRef.current = onOutside;

  useEffect(() => {
    if (!enabled) return undefined;

    function handleMouseDown(event) {
      const container = containerRef.current;
      if (container && !container.contains(event.target)) {
        onOutsideRef.current(event);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [containerRef, enabled]);
}
