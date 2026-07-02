// dendra — building/road geometry (M6 render source): OSM Overpass → wireframe vectors.
// Zero-key. Footprints + heights + roads, projected to local metres about the anchor.
// A wireframe is the partition-boundary trace: edges carry the categorical state,
// so we render structure (buildings/roads) — no photoreal streets.

export interface Anchor { lat: number; lng: number; zoom: number; }
export interface Building { ring: [number, number][]; height: number; } // [x(east), z(north-)] metres
export interface Road { pts: [number, number][]; kind: string; }
export interface CityData {
  buildings: Building[]; roads: Road[]; radiusM: number;
  count: { buildings: number; roads: number };
}

const OVERPASS = "https://overpass-api.de/api/interpreter";

// local tangent-plane projection: lng/lat → metres east (x) / north-negative (z).
function project(lng: number, lat: number, lng0: number, lat0: number): [number, number] {
  const x = (lng - lng0) * 111320 * Math.cos((lat0 * Math.PI) / 180);
  const z = -(lat - lat0) * 111320; // north → −z, so north points "up" in plan/scene
  return [x, z];
}

function buildingHeight(tags: Record<string, string>): number {
  const h = parseFloat(tags.height);
  if (isFinite(h)) return h;
  const lv = parseFloat(tags["building:levels"]);
  if (isFinite(lv)) return Math.max(3, lv * 3);
  return 8; // default: ~2–3 storeys
}

export async function fetchCity(anchor: Anchor, radiusM = 300): Promise<CityData> {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((anchor.lat * Math.PI) / 180));
  const bbox = `${anchor.lat - dLat},${anchor.lng - dLng},${anchor.lat + dLat},${anchor.lng + dLng}`;
  const q = `[out:json][timeout:25];(way["building"](${bbox});way["highway"](${bbox}););out geom;`;

  const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = await res.json();

  const buildings: Building[] = [];
  const roads: Road[] = [];
  for (const el of json.elements || []) {
    if (el.type !== "way" || !Array.isArray(el.geometry)) continue;
    const tags: Record<string, string> = el.tags || {};
    const pts = el.geometry.map((g: any) => project(g.lon, g.lat, anchor.lng, anchor.lat)) as [number, number][];
    if (tags.building) buildings.push({ ring: pts, height: buildingHeight(tags) });
    else if (tags.highway) roads.push({ pts, kind: tags.highway });
  }
  return { buildings, roads, radiusM, count: { buildings: buildings.length, roads: roads.length } };
}
