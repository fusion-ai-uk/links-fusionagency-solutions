"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { niceMax, type Grain, type TimelineBucket, type TimelineData, type TimelineSeries } from "@/lib/timeline";
import styles from "./Timeline.module.css";

export interface TimelineOption {
  id: string;
  label: string;
  href: string;
}

type TimelineProps = {
  data: TimelineData | null;
  options: TimelineOption[];
  selectedId: string | null;
};

const HEIGHT = 300;
const MARGIN = { top: 34, right: 52, bottom: 36, left: 52 };
const GRAIN_STORAGE = "dashboard:timeline:grain";
const n = (value: number) => value.toLocaleString("en-GB");

/**
 * Opens (bars, left axis) and clicks (line, right axis) for one email, by UK
 * day or by hour, with the send moment and any later bursts marked.
 *
 * Drawn as plain SVG sized to the container, so text stays crisp at any width
 * and there is no chart library to load. Switching email is a navigation (the
 * server prepares the series); switching grain is instant.
 */
export default function Timeline({ data, options, selectedId }: TimelineProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [grain, setGrain] = useState<Grain>("day");
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(960);
  const areaRef = useRef<HTMLDivElement>(null);

  // Remembered grain, applied after hydration so server and client agree.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GRAIN_STORAGE);
      if (stored === "day" || stored === "hour") setGrain(stored);
    } catch {
      // Storage unavailable — keep the default.
    }
  }, []);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(320, Math.floor(el.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (pending) root.setAttribute("data-loading", "true");
    else root.removeAttribute("data-loading");
    return () => root.removeAttribute("data-loading");
  }, [pending]);

  function chooseGrain(next: Grain) {
    setGrain(next);
    setHover(null);
    try {
      window.localStorage.setItem(GRAIN_STORAGE, next);
    } catch {
      // Ignore.
    }
  }

  function chooseEmail(id: string) {
    const option = options.find((o) => o.id === id);
    if (!option) return;
    startTransition(() => router.push(option.href, { scroll: false }));
  }

  const series: TimelineSeries | null = data ? (grain === "day" ? data.day : data.hour) : null;
  const geometry = useMemo(() => (series ? layout(series, width) : null), [series, width]);

  function bucketAt(clientX: number): number | null {
    if (!geometry || !areaRef.current || geometry.buckets.length === 0) return null;
    const rect = areaRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * width;
    if (x < MARGIN.left || x > width - MARGIN.right) return null;
    const i = Math.floor((x - MARGIN.left) / geometry.step);
    return Math.min(geometry.buckets.length - 1, Math.max(0, i));
  }

  const hovered = hover !== null && geometry ? geometry.buckets[hover] : null;

  return (
    <div className={styles.wrap} aria-busy={pending}>
      <div className={styles.controls}>
        <div className={styles.group}>
          <label className={styles.groupLabel} htmlFor="timeline-email">
            <Icon name="mail" /> Email
          </label>
          <select
            id="timeline-email"
            className={styles.select}
            value={selectedId ?? ""}
            onChange={(event) => chooseEmail(event.target.value)}
            disabled={options.length === 0}
            aria-label="Email shown on the timeline"
          >
            {options.length === 0 && <option value="">No emails in this view</option>}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.group} role="group" aria-label="Time grain">
          <span className={styles.groupLabel}>
            <Icon name="calendar" /> By
          </span>
          <div className={styles.segmented}>
            {(["day", "hour"] as Grain[]).map((g) => (
              <button
                key={g}
                type="button"
                className={`${styles.segment} ${grain === g ? styles.segmentOn : ""}`}
                aria-pressed={grain === g}
                onClick={() => chooseGrain(g)}
                title={g === "day" ? "Every UK calendar day the email has been live" : "The 72 hours around the send"}
              >
                {g === "day" ? "Day" : "Hour"}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.legend} aria-label="Legend">
          <span className={styles.legendItem}>
            <span className={styles.swatchBar} /> Opens · left axis
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatchLine} /> Clicks · right axis
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatchSend} /> Send
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatchFlag}>
              <Icon name="flag" size={11} />
            </span>{" "}
            Burst
          </span>
        </div>
      </div>

      <div
        ref={areaRef}
        className={styles.chartArea}
        onMouseMove={(event) => setHover(bucketAt(event.clientX))}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(event) => setHover(bucketAt(event.touches[0].clientX))}
        onTouchMove={(event) => setHover(bucketAt(event.touches[0].clientX))}
      >
        {geometry && series && series.buckets.length > 0 ? (
          <Chart series={series} geometry={geometry} width={width} hover={hover} data={data!} />
        ) : (
          <div className={styles.empty}>
            {data ? (
              <>
                <strong>No activity recorded yet for {data.label}.</strong>
                <span>The timeline appears as soon as opens or clicks arrive, or when a chip that includes existing events is switched on.</span>
              </>
            ) : (
              <strong>Pick an email to see its timeline.</strong>
            )}
          </div>
        )}

        {hovered && geometry && (
          <div
            className={styles.tooltip}
            style={{
              left: `${Math.min(Math.max(((geometry.x(hover!) + geometry.step / 2) / width) * 100, 0), 100)}%`,
              transform: `translateX(${hover! > geometry.buckets.length / 2 ? "calc(-100% - 12px)" : "12px"})`,
            }}
            role="status"
          >
            <span className={styles.tooltipTitle}>{hovered.title}</span>
            <span className={styles.tooltipRow}>
              <span className={styles.tooltipOpens}>Opens</span>
              <strong>{n(hovered.opens)}</strong>
            </span>
            <span className={styles.tooltipRow}>
              <span className={styles.tooltipClicks}>Clicks</span>
              <strong>{n(hovered.clicks)}</strong>
            </span>
            {hovered.isSend && data?.send && (
              <span className={styles.tooltipNote}>
                <Icon name="send" size={11} /> {data.send.source === "config" ? "Send" : "Send detected"} — {data.send.text}
              </span>
            )}
            {hovered.burst !== null && (
              <span className={styles.tooltipNote}>
                <Icon name="flag" size={11} /> Burst: {n(hovered.burst)} opens this day (threshold {data?.threshold}). A resend, a reminder, or
                a mail provider pre-fetching images.
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {data?.send ? (
          <span className={`${styles.sendChip} ${data.send.source === "detected" ? styles.sendChipDetected : ""}`}>
            <Icon name="send" size={11} />
            {data.send.source === "config" ? "Sent" : "Send detected"} {data.send.text}
            {data.send.opensThatDay !== null && ` · ${n(data.send.opensThatDay)} opens that day`}
          </span>
        ) : (
          data && (
            <span className={styles.sendChip}>
              <Icon name="clock" size={11} /> No send yet — the line appears once {n(data.threshold)} opens land in a day
            </span>
          )
        )}
        {data && data.bursts.length > 0 && (
          <span>
            <strong>{data.bursts.length}</strong> later burst{data.bursts.length === 1 ? "" : "s"}:{" "}
            {data.bursts.map((b) => `${b.label} (${n(b.opens)} opens)`).join(", ")}
          </span>
        )}
        {series && series.buckets.length > 0 && (
          <span>
            {series.rangeText}
            {series.outsideRange > 0 && ` · ${n(series.outsideRange)} event${series.outsideRange === 1 ? "" : "s"} outside this range`}
          </span>
        )}
        {data && (
          <span>
            <strong>{n(data.totals.opens)}</strong> opens · <strong>{n(data.totals.clicks)}</strong> clicks counted
          </span>
        )}
        {series && series.buckets.length > 0 && (
          <button type="button" className={styles.tableToggle} onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
            <Icon name="table" size={11} /> {showTable ? "Hide table" : "Show as table"}
          </button>
        )}
      </div>

      {showTable && series && series.buckets.length > 0 && (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{grain === "day" ? "Day (UK)" : "Hour (UK)"}</th>
                <th className={styles.numeric}>Opens</th>
                <th className={styles.numeric}>Clicks</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {series.buckets.map((b) => (
                <tr key={b.key} className={b.isSend ? styles.rowSend : undefined}>
                  <td>{b.title}</td>
                  <td className={styles.numeric}>{n(b.opens)}</td>
                  <td className={styles.numeric}>{n(b.clicks)}</td>
                  <td>
                    {b.isSend && (data?.send?.source === "config" ? "Send" : "Send detected")}
                    {b.burst !== null && `Burst · ${n(b.burst)} opens`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---- Geometry ------------------------------------------------------------ */

interface Geometry {
  buckets: TimelineBucket[];
  step: number;
  barWidth: number;
  plotTop: number;
  plotBottom: number;
  plotHeight: number;
  maxOpens: number;
  maxClicks: number;
  x: (i: number) => number;
  yOpens: (v: number) => number;
  yClicks: (v: number) => number;
}

function layout(series: TimelineSeries, width: number): Geometry {
  const plotWidth = Math.max(10, width - MARGIN.left - MARGIN.right);
  const count = Math.max(1, series.buckets.length);
  const step = plotWidth / count;
  const plotTop = MARGIN.top;
  const plotBottom = HEIGHT - MARGIN.bottom;
  const plotHeight = plotBottom - plotTop;
  const maxOpens = niceMax(series.maxOpens);
  const maxClicks = niceMax(series.maxClicks);
  return {
    buckets: series.buckets,
    step,
    barWidth: Math.max(2, Math.min(step * 0.64, 42)),
    plotTop,
    plotBottom,
    plotHeight,
    maxOpens,
    maxClicks,
    x: (i) => MARGIN.left + i * step,
    yOpens: (v) => plotBottom - (v / maxOpens) * plotHeight,
    yClicks: (v) => plotBottom - (v / maxClicks) * plotHeight,
  };
}

function Chart({
  series,
  geometry: g,
  width,
  hover,
  data,
}: {
  series: TimelineSeries;
  geometry: Geometry;
  width: number;
  hover: number | null;
  data: TimelineData;
}) {
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const count = g.buckets.length;
  // Label density: never more than ~12 labels, and in hour view prefer 6-hour marks.
  const every = series.grain === "hour" ? 6 : Math.max(1, Math.ceil(count / 12));
  const sendIndex = g.buckets.findIndex((b) => b.isSend);
  let sendX: number | null = null;
  if (sendIndex >= 0 && data.send) {
    const bucket = g.buckets[sendIndex];
    const start = new Date(bucket.start).getTime();
    const span = series.grain === "hour" ? 3_600_000 : 86_400_000;
    const at = new Date(data.send.at).getTime();
    // Day buckets are anchored at noon; place the marker at the bucket centre.
    const fraction = series.grain === "hour" ? Math.min(1, Math.max(0, (at - start) / span)) : 0.5;
    sendX = g.x(sendIndex) + fraction * g.step;
  }
  const sendLabel = data.send
    ? `${data.send.source === "config" ? "Sent" : "Detected"} ${series.grain === "hour" ? data.send.clockText : data.send.dayText}`
    : "";
  const clickPoints = g.buckets.map((b, i) => `${g.x(i) + g.step / 2},${g.yClicks(b.clicks)}`).join(" ");
  const anyClicks = g.buckets.some((b) => b.clicks > 0);

  return (
    <svg className={styles.svg} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={`Opens and clicks by ${series.grain} for ${data.label}`}>
      {/* Pre-send shading */}
      {sendX !== null && sendX > MARGIN.left && (
        <rect className={styles.presend} x={MARGIN.left} y={g.plotTop} width={sendX - MARGIN.left} height={g.plotHeight} />
      )}

      {/* Grid and axes */}
      {ticks.map((t) => {
        const y = g.plotBottom - t * g.plotHeight;
        return (
          <g key={t}>
            <line className={styles.grid} x1={MARGIN.left} x2={width - MARGIN.right} y1={y} y2={y} />
            <text className={`${styles.axis} ${styles.axisLeft}`} x={MARGIN.left - 8} y={y + 4} textAnchor="end">
              {n(Math.round(t * g.maxOpens))}
            </text>
            <text className={`${styles.axis} ${styles.axisRight}`} x={width - MARGIN.right + 8} y={y + 4} textAnchor="start">
              {n(Math.round(t * g.maxClicks))}
            </text>
          </g>
        );
      })}

      {/* Hover band */}
      {hover !== null && <rect className={styles.hover} x={g.x(hover)} y={g.plotTop} width={g.step} height={g.plotHeight} />}

      {/* Opens bars */}
      {g.buckets.map((b, i) => {
        const h = g.plotBottom - g.yOpens(b.opens);
        if (h <= 0) return null;
        const cls = hover === null ? styles.bar : hover === i ? `${styles.bar} ${styles.barHot}` : `${styles.bar} ${styles.barDim}`;
        return <rect key={b.key} className={cls} x={g.x(i) + (g.step - g.barWidth) / 2} y={g.yOpens(b.opens)} width={g.barWidth} height={h} />;
      })}

      {/* Clicks line */}
      {anyClicks && <polyline className={styles.line} points={clickPoints} />}
      {anyClicks &&
        g.buckets.map((b, i) =>
          b.clicks > 0 || hover === i ? (
            <circle key={b.key} className={styles.dot} cx={g.x(i) + g.step / 2} cy={g.yClicks(b.clicks)} r={hover === i ? 4.5 : 3} />
          ) : null
        )}

      {/* Later bursts */}
      {g.buckets.map((b, i) => {
        if (b.burst === null) return null;
        const cx = g.x(i) + g.step / 2;
        const y = Math.min(g.yOpens(b.opens), g.plotBottom) - 14;
        return (
          <g key={`flag-${b.key}`} transform={`translate(${cx - 5}, ${y - 10})`}>
            <path className={styles.flag} d="M1 12V1h7l-1.5 2.5L8 6H1" />
            <line x1={1} x2={1} y1={1} y2={12} stroke="currentColor" strokeWidth={1} className={styles.flagText} />
          </g>
        );
      })}

      {/* Send marker */}
      {sendX !== null && (
        <g>
          <line className={styles.sendLine} x1={sendX} x2={sendX} y1={g.plotTop - 6} y2={g.plotBottom} />
          <g transform={`translate(${Math.min(Math.max(sendX - 56, MARGIN.left), width - MARGIN.right - 112)}, ${g.plotTop - 30})`}>
            <rect className={styles.sendLabelBg} x={0} y={0} width={112} height={18} />
            <text className={styles.sendLabel} x={56} y={12.5} textAnchor="middle">
              {sendLabel}
            </text>
          </g>
        </g>
      )}

      {/* X axis */}
      <line className={styles.grid} x1={MARGIN.left} x2={width - MARGIN.right} y1={g.plotBottom} y2={g.plotBottom} />
      {g.buckets.map((b, i) => {
        const show = i % every === 0 || (series.grain === "hour" && b.label === "00:00");
        if (!show) return null;
        const x = g.x(i) + g.step / 2;
        const midnight = series.grain === "hour" && b.label === "00:00";
        return (
          <g key={`x-${b.key}`}>
            <text className={styles.axis} x={x} y={g.plotBottom + 15} textAnchor="middle">
              {b.label}
            </text>
            {midnight && (
              <text className={styles.axis} x={x} y={g.plotBottom + 28} textAnchor="middle">
                {b.title.split(" · ")[0]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
