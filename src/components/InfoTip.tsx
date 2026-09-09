"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { HELP, type HelpId } from "@/config/help";
import styles from "./InfoTip.module.css";

const TOOLTIP_WIDTH = 300;
const GAP = 8;

type InfoTipProps = {
  /** Key into the shared help copy, so wording stays consistent. */
  topic: HelpId;
  /** Override the accessible label; defaults to the topic's heading. */
  label?: string;
};

/**
 * Small "i" affordance that explains a figure on hover, focus or tap.
 *
 * Positioned fixed rather than absolute: several of these sit inside
 * horizontally scrolling tables, where an absolutely positioned panel would be
 * clipped by the scroll container.
 */
export default function InfoTip({ topic, label }: InfoTipProps) {
  const entry = HELP[topic];
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );

  const open = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - 2 * GAP);

    // Prefer below; flip above when there is not enough room.
    const spaceBelow = window.innerHeight - rect.bottom;
    const below = spaceBelow > 160 || spaceBelow > rect.top;

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(GAP, Math.min(left, window.innerWidth - width - GAP));

    setCoords({
      top: below ? rect.bottom + GAP : rect.top - GAP,
      left,
    });
  }, []);

  const close = useCallback(() => setCoords(null), []);

  useEffect(() => {
    if (!coords) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
    };
  }, [coords, close]);

  const isBelow =
    coords !== null &&
    triggerRef.current !== null &&
    coords.top > triggerRef.current.getBoundingClientRect().top;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={`What does "${label ?? entry.label}" mean?`}
        aria-expanded={coords !== null}
        aria-describedby={coords ? id : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={(event) => {
          event.preventDefault();
          if (coords) close();
          else open();
        }}
      >
        <span aria-hidden="true">i</span>
      </button>

      {coords && (
        <span
          id={id}
          role="tooltip"
          className={styles.tooltip}
          style={{
            top: coords.top,
            left: coords.left,
            width: Math.min(TOOLTIP_WIDTH, TOOLTIP_WIDTH),
            transform: isBelow ? undefined : "translateY(-100%)",
          }}
        >
          <span className={styles.tooltipLabel}>{entry.label}</span>
          {entry.short}
        </span>
      )}
    </>
  );
}
