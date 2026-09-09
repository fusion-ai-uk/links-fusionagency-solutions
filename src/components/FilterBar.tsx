"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import InfoTip from "@/components/InfoTip";
import {
  CLASS_META,
  EVENT_CLASSES,
  PRESETS,
  presetFor,
  serializeClasses,
  type ClassCount,
  type EventClass,
} from "@/lib/view";
import styles from "./FilterBar.module.css";

export interface WaveOption {
  id: string;
  label: string;
  statusLabel: string | null;
}

type FilterBarProps = {
  /** Programme in scope, or "all"/"unassigned". Carried through untouched. */
  programme?: string;
  scopeLabel: string;
  waves: WaveOption[];
  selected: string[];
  classes: EventClass[];
  classCounts: Record<EventClass, ClassCount>;
  windowSeconds: number;
  windowOptions: readonly number[];
  /** List-only filters, carried through untouched. */
  q?: string;
  status?: string;
  exportHref: string | null;
  summary: string;
};

/**
 * Every figure-changing control, in one bar that stays at the top.
 *
 * Changes apply immediately: the bar rewrites the URL and the page re-renders
 * on the server. `useTransition` gives a pending flag for the progress bar and
 * for dimming the results, so it is always obvious when numbers are stale.
 */
export default function FilterBar(props: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [waveOpen, setWaveOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const wavePopover = useRef<HTMLDivElement>(null);

  // Dim the results while a change is in flight.
  useEffect(() => {
    const root = document.documentElement;
    if (pending) root.setAttribute("data-loading", "true");
    else root.removeAttribute("data-loading");
    return () => root.removeAttribute("data-loading");
  }, [pending]);

  // Close the wave popover on outside click or Escape.
  useEffect(() => {
    if (!waveOpen) return;
    function onDown(event: MouseEvent) {
      if (!wavePopover.current?.contains(event.target as Node)) setWaveOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setWaveOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [waveOpen]);

  function navigate(next: {
    selected?: string[];
    classes?: EventClass[];
    windowSeconds?: number;
  }) {
    const selected = next.selected ?? props.selected;
    const classes = next.classes ?? props.classes;
    const windowSeconds = next.windowSeconds ?? props.windowSeconds;

    const search = new URLSearchParams();
    if (props.programme && props.programme !== "all") search.set("programme", props.programme);
    for (const id of selected) search.append("campaign", id);
    const include = serializeClasses(classes);
    if (include !== null) search.set("include", include);
    if (windowSeconds !== 10) search.set("window", String(windowSeconds));
    if (props.q) search.set("q", props.q);
    if (props.status) search.set("status", props.status);

    const query = search.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function toggleClass(cls: EventClass) {
    const set = new Set(props.classes);
    if (set.has(cls)) set.delete(cls);
    else set.add(cls);
    navigate({ classes: EVENT_CLASSES.filter((c) => set.has(c)) });
  }

  function toggleWave(id: string) {
    const set = new Set(props.selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    navigate({ selected: props.waves.filter((w) => set.has(w.id)).map((w) => w.id) });
  }

  const preset = presetFor(props.classes);
  const selectedWaves = props.waves.filter((w) => props.selected.includes(w.id));
  const waveButtonLabel =
    selectedWaves.length === 0
      ? `All ${props.waves.length} emails`
      : selectedWaves.length === 1
        ? selectedWaves[0].label
        : `${selectedWaves.length} emails`;

  return (
    <div className={styles.bar} aria-busy={pending}>
      {pending && <div className={styles.progress} role="progressbar" aria-label="Updating figures" />}

      <div className={styles.row}>
        {/* ---- Which emails ---------------------------------------------- */}
        <div className={styles.group} ref={wavePopover}>
          <span className={styles.groupLabel}>
            <Icon name="mail" /> {props.scopeLabel}
          </span>
          <button
            type="button"
            className={`${styles.picker} ${selectedWaves.length > 0 ? styles.pickerActive : ""}`}
            onClick={() => setWaveOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={waveOpen}
            disabled={props.waves.length === 0}
          >
            <span>{waveButtonLabel}</span>
            <Icon name="chevron" size={12} />
          </button>
          <InfoTip topic="campaignId" label="Which emails count" />

          {waveOpen && (
            <div className={styles.popover} role="listbox" aria-multiselectable="true" aria-label="Emails">
              <button
                type="button"
                role="option"
                aria-selected={selectedWaves.length === 0}
                className={`${styles.option} ${selectedWaves.length === 0 ? styles.optionOn : ""}`}
                onClick={() => {
                  navigate({ selected: [] });
                  setWaveOpen(false);
                }}
              >
                <span className={styles.optionBox} aria-hidden="true">
                  {selectedWaves.length === 0 && <Icon name="check" size={11} />}
                </span>
                <span className={styles.optionLabel}>All emails in this view</span>
              </button>
              <div className={styles.optionDivider} />
              {props.waves.map((w) => {
                const on = props.selected.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`${styles.option} ${on ? styles.optionOn : ""}`}
                    onClick={() => toggleWave(w.id)}
                  >
                    <span className={styles.optionBox} aria-hidden="true">
                      {on && <Icon name="check" size={11} />}
                    </span>
                    <span className={styles.optionLabel}>{w.label}</span>
                    {w.statusLabel && <span className={styles.optionMeta}>{w.statusLabel}</span>}
                  </button>
                );
              })}
              <div className={styles.popoverHint}>
                Tick several to compare them together. Click an email&rsquo;s name in the table to focus on it alone.
              </div>
            </div>
          )}
        </div>

        <span className={styles.divider} aria-hidden="true" />

        {/* ---- Which signals count ---------------------------------------- */}
        <div className={styles.group}>
          <span className={styles.groupLabel}>
            <Icon name="filter" /> Count
          </span>
          <div className={styles.chips} role="group" aria-label="Which events count">
            {EVENT_CLASSES.map((cls) => {
              const meta = CLASS_META[cls];
              const on = props.classes.includes(cls);
              const count = props.classCounts[cls];
              const opensNote = meta.opens
                ? ` ${count.opens.toLocaleString("en-GB")} open${count.opens === 1 ? "" : "s"} of this kind too.`
                : "";
              return (
                <button
                  key={cls}
                  type="button"
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  style={{ ["--chip" as string]: meta.colour }}
                  aria-pressed={on}
                  title={`${meta.label} — ${meta.short} ${count.clicks.toLocaleString("en-GB")} click${count.clicks === 1 ? "" : "s"} in this selection.${opensNote}${on ? " Counted." : " Not counted — click to include."}`}
                  onClick={() => toggleClass(cls)}
                >
                  <Icon name={meta.icon} size={12} />
                  <span>{meta.label}</span>
                  <span className={styles.chipCount} aria-label={`${count.clicks} clicks`}>
                    {count.clicks.toLocaleString("en-GB")}
                  </span>
                </button>
              );
            })}
            <InfoTip topic="signalFilters" />
          </div>
        </div>

        <span className={styles.divider} aria-hidden="true" />

        {/* ---- Presets ---------------------------------------------------- */}
        <div className={styles.group} role="group" aria-label="Presets">
          {(
            [
              ["live", "All live", "Every live event; nothing from before the send. The default."],
              ["genuine", "Genuine only", "Only clicks and opens with nothing against them — the figure to report."],
              ["everything", "Everything", "Every event recorded, including test and pre-send."],
            ] as [keyof typeof PRESETS, string, string][]
          ).map(([name, label, title]) => (
            <button
              key={name}
              type="button"
              className={`${styles.preset} ${preset === name ? styles.presetOn : ""}`}
              aria-pressed={preset === name}
              title={title}
              onClick={() => navigate({ classes: PRESETS[name] })}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ---- Right: advanced + export ---------------------------------- */}
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.iconButton} ${advancedOpen ? styles.iconButtonOn : ""}`}
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            title="Echo window and other settings"
          >
            <Icon name="settings" /> <span>{props.windowSeconds}s</span>
          </button>
          {props.exportHref ? (
            <a href={props.exportHref} className={styles.iconButton} title="Download every event in this view as CSV, with phase and triage columns">
              <Icon name="download" /> <span>CSV</span>
            </a>
          ) : (
            <span className={`${styles.iconButton} ${styles.iconButtonDisabled}`} title="The raw event export is limited to administrator accounts.">
              <Icon name="download" /> <span>CSV</span>
            </span>
          )}
        </div>
      </div>

      {advancedOpen && (
        <div className={styles.advanced}>
          <label className={styles.advancedLabel} htmlFor="echo-window">
            <Icon name="echo" size={12} /> Echo window
          </label>
          <div className={styles.segmented} id="echo-window" role="group" aria-label="Echo window in seconds">
            {props.windowOptions.map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.segment} ${s === props.windowSeconds ? styles.segmentOn : ""}`}
                aria-pressed={s === props.windowSeconds}
                onClick={() => navigate({ windowSeconds: s })}
              >
                {s}s
              </button>
            ))}
          </div>
          <span className={styles.advancedHint}>
            Two clicks on the same link within this many seconds are treated as one person. 10s is the safe default.
          </span>
          <InfoTip topic="echoWindow" />
        </div>
      )}

      <p className={styles.summary}>
        <Icon name="eye" size={12} /> {props.summary}
      </p>

      {/* Announced to screen readers; visually the summary line above says the same. */}
      <span
        role="status"
        aria-live="polite"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}
      >
        {pending ? "Updating figures" : `Showing ${props.summary}`}
      </span>
    </div>
  );
}
