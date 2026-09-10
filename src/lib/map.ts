import { geoEqualEarth, geoGraticule, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import { numericToAlpha2 } from "i18n-iso-countries";
import world110m from "@/data/countries-110m.json";
import world50m from "@/data/countries-50m.json";
import { countryName } from "@/lib/geo-names";

/**
 * The world map, projected once on the server.
 *
 * Geometry is Natural Earth via world-atlas, vendored in src/data so the app
 * has no runtime dependency on a CDN (the CSP forbids one anyway). Each view
 * — World, Europe, UK & Ireland — is projected separately with Equal Earth (an
 * equal-area projection, so a country's visual size is not lying about it),
 * fitted to its own region and clipped to the frame, then turned into SVG path
 * strings. The client receives the strings and draws them.
 *
 * Views are projected separately rather than zoomed with a viewBox on purpose:
 * Chrome grinds to a halt re-laying out an SVG whose geometry extends tens of
 * thousands of pixels outside the frame, which is what a 30× viewBox zoom on a
 * world map produces. Clipping keeps every path inside the frame.
 */

export type MapView = "world" | "europe" | "uk";

export interface MapFeature {
  /** ISO alpha-2 code, or null for territories without one (Kosovo, N. Cyprus, Somaliland). */
  code: string | null;
  name: string;
  d: string;
}

export interface MapViewPaths {
  width: number;
  height: number;
  features: MapFeature[];
  /** Faint meridians and parallels. */
  graticule: string;
  /** The globe's outline where it falls inside the frame (world view only). */
  sphere: string | null;
}

export interface WorldMapPaths {
  views: Record<MapView, MapViewPaths>;
}

interface ViewSpec {
  resolution: "110m" | "50m";
  /** [west, east, south, north] in degrees. */
  box: [number, number, number, number];
  width: number;
  height: number;
  graticuleStep: number;
}

/**
 * Every frame is landscape, so the map sits comfortably in a dashboard panel
 * rather than towering over it. The region is fitted inside its frame and the
 * spare width fills with real neighbouring geography (clipped at the edge),
 * which is more useful than empty sea.
 */
const VIEW_SPECS: Record<MapView, ViewSpec> = {
  world: { resolution: "110m", box: [-180, 180, -90, 90], width: 960, height: 470, graticuleStep: 20 },
  europe: { resolution: "50m", box: [-11, 32, 35, 61], width: 960, height: 560, graticuleStep: 10 },
  uk: { resolution: "50m", box: [-11, 2, 49.8, 59.5], width: 960, height: 540, graticuleStep: 5 },
};

let cached: WorldMapPaths | null = null;

function countries(resolution: "110m" | "50m") {
  const topo = (resolution === "50m" ? world50m : world110m) as unknown as Topology<{ countries: GeometryCollection }>;
  return feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
}

function project(spec: ViewSpec, isWorld: boolean): MapViewPaths {
  const [west, east, south, north] = spec.box;
  const frame: [[number, number], [number, number]] = [
    [0, 0],
    [spec.width, spec.height],
  ];
  const projection = geoEqualEarth();
  if (isWorld) {
    projection.fitExtent(
      [
        [8, 8],
        [spec.width - 8, spec.height - 8],
      ],
      { type: "Sphere" }
    );
  } else {
    // d3 reads exterior rings clockwise; anticlockwise means "everything but this box".
    const region = {
      type: "Polygon" as const,
      coordinates: [
        [
          [west, south],
          [west, north],
          [east, north],
          [east, south],
          [west, south],
        ],
      ],
    };
    projection.fitExtent(frame, region).clipExtent(frame);
  }
  const path = geoPath(projection);

  const features: MapFeature[] = countries(spec.resolution)
    .features.map((f) => {
      const numeric = f.id === undefined ? null : String(f.id).padStart(3, "0");
      const code = numeric ? numericToAlpha2(numeric) ?? null : null;
      return {
        code,
        name: code ? countryName(code) : f.properties.name,
        d: path(f) ?? "",
      };
    })
    .filter((f) => f.d.length > 0);

  return {
    width: spec.width,
    height: spec.height,
    features,
    graticule: path(geoGraticule().step([spec.graticuleStep, spec.graticuleStep])()) ?? "",
    sphere: isWorld ? path({ type: "Sphere" }) ?? null : null,
  };
}

export function getWorldMapPaths(): WorldMapPaths {
  if (cached) return cached;
  cached = {
    views: {
      world: project(VIEW_SPECS.world, true),
      europe: project(VIEW_SPECS.europe, false),
      uk: project(VIEW_SPECS.uk, false),
    },
  };
  return cached;
}
