"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Collapsible.module.css";

type CollapsibleProps = {
  /** Stable key; the open/closed choice is remembered per key in this browser. */
  id: string;
  title: ReactNode;
  /** Short facts shown in the header even when collapsed — the answer at a glance. */
  summary?: ReactNode;
  /** Right-hand slot in the header, e.g. a link. Clicks here do not toggle. */
  aside?: ReactNode;
  defaultOpen?: boolean;
  /** Accent for the left bar; defaults to the border colour. */
  accent?: string;
  children: ReactNode;
};

const STORAGE_PREFIX = "dashboard:section:";

/**
 * A native <details> section styled to the brand. The user's choice to open or
 * close each section is remembered in localStorage, so the dashboard settles
 * into the shape they want.
 */
export default function Collapsible({
  id,
  title,
  summary,
  aside,
  defaultOpen = false,
  accent,
  children,
}: CollapsibleProps) {
  const ref = useRef<HTMLDetailsElement>(null);

  // Apply the remembered state after hydration, so server and client agree
  // on the first render.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_PREFIX + id);
      if (stored === "open" || stored === "closed") {
        if (ref.current) ref.current.open = stored === "open";
      }
    } catch {
      // Storage unavailable — fall back to the default.
    }
  }, [id]);

  function onToggle() {
    try {
      window.localStorage.setItem(
        STORAGE_PREFIX + id,
        ref.current?.open ? "open" : "closed"
      );
    } catch {
      // Ignore — a preference that cannot be saved is not an error.
    }
  }

  return (
    <details
      ref={ref}
      className={styles.details}
      open={defaultOpen}
      onToggle={onToggle}
      style={accent ? ({ ["--item-accent" as string]: accent } as React.CSSProperties) : undefined}
    >
      <summary className={styles.summary}>
        <span className={styles.chevron} aria-hidden="true" />
        <span className={styles.title}>{title}</span>
        {summary && <span className={styles.facts}>{summary}</span>}
        {aside && (
          <span
            className={styles.aside}
            onClick={(event) => event.stopPropagation()}
          >
            {aside}
          </span>
        )}
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
