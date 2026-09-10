"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { UNKNOWN_COUNTRY } from "@/lib/geo-names";
import type { MapView, WorldMapPaths } from "@/lib/map";
import type { CountryCount } from "@/lib/view";
import styles from "./WorldMap.module.css";

type Metric = "opens" | "clicks";
type View = MapView;

type WorldMapProps = {
  counts: CountryCount[];
  /** Countries currently selected in the filter (codes or "unknown"). */
  selected: string[];
  /** Search string for the current view without the `country` parameter. */
  hrefBase: string;
  pathname: string;
};

const n = (value: number) => value.toLocaleString("en-GB");
const METRIC_STORAGE = "dashboard:map:metric";
const VIEW_STORAGE = "dashboard:map:view";

/**
 * Bump when the shape of /admin/map-paths changes. The response is cached in
 * the browser for a day, so a new shape must arrive under a new URL — and a
 * stale cached copy is detected and re-fetched rather than trusted.
 */
const MAP_PATHS_VERSION = 3;
const MAP_PATHS_URL = `/admin/map-paths?v=${MAP_PATHS_VERSION}`;

let cachedPaths: WorldMapPaths | null = null;

function isWorldMapPaths(value: unknown): value is WorldMapPaths {
  if (!value || typeof value !== "object") return false;
  const views = (value as { views?: Record<string, unknown> }).views;
  return !!views && ["world", "europe", "uk"].every((v) => {
    const view = views[v] as { features?: unknown[]; width?: number } | undefined;
    return !!view && Array.isArray(view.features) && typeof view.width === "number";
  });
}

async function fetchMapPaths(): Promise<WorldMapPaths> {
  const load = (cache: RequestCache) =>
    fetch(MAP_PATHS_URL, { credentials: "same-origin", cache }).then((r) =>
      r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
    );
  const first = await load("default");
  if (isWorldMapPaths(first)) return first;
  // A cached copy in an older shape: go round the cache once.
  const fresh = await load("reload");
  if (isWorldMapPaths(fresh)) return fresh;
  throw new Error("map paths in an unexpected shape");
}

/**
 * Where the activity comes from. Countries are filled by intensity for the
 * chosen metric; the selected countries are outlined; clicking a country
 * toggles it in the country filter. The geometry is fetched once and cached.
 */
export default function WorldMap({ counts, selected, hrefBase, pathname }: WorldMapProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [paths, setPaths] = useState<WorldMapPaths | null>(cachedPaths);
  const [failed, setFailed] = useState(false);
  const [metric, setMetric] = useState<Metric>("opens");
  const [view, setView] = useState<View>("europe");
  const [hover, setHover] = useState<{ code: string | null; name: string; x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      const m = window.localStorage.getItem(METRIC_STORAGE);
      if (m === "opens" || m === "clicks") setMetric(m);
      const v = window.localStorage.getItem(VIEW_STORAGE);
      if (v === "world" || v === "europe" || v === "uk") setView(v);
    } catch {
      // Storage unavailable — keep the defaults.
    }
  }, []);

  useEffect(() => {
    if (cachedPaths) return;
    let cancelled = false;
    fetchMapPaths()
      .then((data) => {
        cachedPaths = data;
        if (!cancelled) setPaths(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byCode = useMemo(() => new Map(counts.map((c) => [c.code, c])), [counts]);
  const max = useMemo(() => Math.max(0, ...counts.filter((c) => c.code !== UNKNOWN_COUNTRY).map((c) => c[metric])), [counts, metric]);
  const total = useMemo(() => counts.reduce((s, c) => s + c[metric], 0), [counts, metric]);
  const unknown = byCode.get(UNKNOWN_COUNTRY);
  const selectedSet = new Set(selected);
  const located = counts.filter((c) => c.code !== UNKNOWN_COUNTRY);
  const withData = located.filter((c) => c[metric] > 0).length;
  const busiest = useMemo(() => {
    const top = [...located].sort((a, b) => b[metric] - a[metric])[0];
    if (!top || top[metric] === 0 || !paths) return null;
    const named = paths.views.world.features.find((f) => f.code === top.code);
    return { name: named?.name ?? top.code, code: top.code };
  }, [located, metric, paths]);

  function remember(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore.
    }
  }

  function toggleCountry(code: string) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    const search = new URLSearchParams(hrefBase);
    search.delete("country");
    if (next.size > 0) search.set("country", [...next].join(","));
    const query = search.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  // Square-root scale: a country with a quarter of the maximum reads as half as strong,
  // which keeps the many small countries visible next to the one big one.
  const intensity = (value: number) => (max === 0 ? 0 : 0.2 + 0.68 * Math.sqrt(value / max));

  const hovered = hover ? (hover.code ? byCode.get(hover.code) : undefined) : undefined;

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <div className={styles.group} role="group" aria-label="Metric">
          <span className={styles.groupLabel}>
            <Icon name="pulse" /> Colour by
          </span>
          <div className={styles.segmented}>
            {(["opens", "clicks"] as Metric[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.segment} ${metric === m ? styles.segmentOn : ""}`}
                aria-pressed={metric === m}
                onClick={() => {
                  setMetric(m);
                  remember(METRIC_STORAGE, m);
                }}
              >
                {m === "opens" ? "Opens" : "Clicks"}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.group} role="group" aria-label="Map view">
          <span className={styles.groupLabel}>
            <Icon name="eye" /> View
          </span>
          <div className={styles.segmented}>
            {(
              [
                ["uk", "UK & Ireland"],
                ["europe", "Europe"],
                ["world", "World"],
              ] as [View, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`${styles.segment} ${view === v ? styles.segmentOn : ""}`}
                aria-pressed={view === v}
                onClick={() => {
                  setView(v);
                  remember(VIEW_STORAGE, v);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.legend} aria-hidden="true">
          <span>0</span>
          <span className={styles.legendBar} />
          <span>{n(max)}</span>
          {selected.length > 0 && <span className={styles.legendSelected}>selected</span>}
        </div>
      </div>

      <div className={styles.mapArea} onMouseLeave={() => setHover(null)}>
        {paths ? (
          <svg
            className={styles.svg}
            viewBox={`0 0 ${paths.views[view].width} ${paths.views[view].height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Map of ${metric} by country`}
            style={{ aspectRatio: `${paths.views[view].width} / ${paths.views[view].height}` }}
          >
            {paths.views[view].sphere ? (
              <path className={styles.sphere} d={paths.views[view].sphere} />
            ) : (
              <rect className={styles.sphere} x={0} y={0} width={paths.views[view].width} height={paths.views[view].height} />
            )}
            <path className={styles.graticule} d={paths.views[view].graticule} />
            {paths.views[view].features.map((f, i) => {
              const count = f.code ? byCode.get(f.code) : undefined;
              const value = count ? count[metric] : 0;
              const isSelected = f.code !== null && selectedSet.has(f.code);
              const isHot = hover?.name === f.name;
              const cls = [
                styles.country,
                value > 0 ? styles.countryWithData : "",
                isSelected ? styles.countrySelected : "",
                isHot ? styles.countryHot : "",
                f.code ? "" : styles.countryNoCode,
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <path
                  key={`${f.code ?? "x"}-${i}`}
                  className={cls}
                  d={f.d}
                  style={value > 0 ? { fillOpacity: intensity(value) } : undefined}
                  data-code={f.code ?? undefined}
                  onMouseMove={(event) => {
                    const rect = event.currentTarget.ownerSVGElement!.parentElement!.getBoundingClientRect();
                    setHover({ code: f.code, name: f.name, x: event.clientX - rect.left, y: event.clientY - rect.top });
                  }}
                  onClick={() => f.code && toggleCountry(f.code)}
                />
              );
            })}
          </svg>
        ) : (
          <div style={{ aspectRatio: view === "world" ? "960 / 470" : view === "europe" ? "960 / 560" : "960 / 540" }}>
            <div className={styles.loading}>{failed ? "The map could not be loaded." : "Loading map…"}</div>
          </div>
        )}

        {hover && (
          <div
            className={styles.tooltip}
            style={{
              left: hover.x,
              top: hover.y,
              transform: `translate(${hover.x > 300 ? "calc(-100% - 14px)" : "14px"}, -50%)`,
            }}
            role="status"
          >
            <span className={styles.tooltipTitle}>{hover.name}</span>
            {hovered ? (
              <>
                <span className={styles.tooltipRow}>
                  <span className={styles.tooltipMuted}>Opens</span>
                  <strong>{n(hovered.opens)}</strong>
                </span>
                <span className={styles.tooltipRow}>
                  <span className={styles.tooltipMuted}>Clicks</span>
                  <strong>{n(hovered.clicks)}</strong>
                </span>
                <span className={styles.tooltipRow}>
                  <span className={styles.tooltipMuted}>Approx. devices</span>
                  <strong>{n(hovered.devices)}</strong>
                </span>
                <span className={styles.tooltipRow}>
                  <span className={styles.tooltipMuted}>Share of {metric}</span>
                  <strong>{total === 0 ? "—" : `${((hovered[metric] / total) * 100).toFixed(1)}%`}</strong>
                </span>
                <span className={styles.tooltipNote}>
                  {hover.code && selectedSet.has(hover.code) ? "Click to remove from the filter." : "Click to filter to this country."}
                </span>
              </>
            ) : (
              <span className={styles.tooltipMuted}>No activity in this view.</span>
            )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span>
          <strong>{n(withData)}</strong> {withData === 1 ? "country" : "countries"} with {metric}
          {max > 0 && (
            <>
              {" · busiest "}
              <strong>{busiest?.name}</strong> ({n(max)})
            </>
          )}
        </span>
        {unknown && unknown[metric] > 0 && (
          <span
            className={styles.unknownChip}
            title="Rows recorded without a country — older data, or requests that carried no location. Not on the map; selectable in the country filter."
          >
            <Icon name="info" size={11} /> {n(unknown[metric])} {metric} with no location
          </span>
        )}
        <span>Hover a country for its figures; click to filter.</span>
      </div>
    </div>
  );
}
