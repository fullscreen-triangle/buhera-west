// Dendra Sandbox — full-page VS Code-style playground.
// Two phases (like Tempus): COMPILE (lex/check, freeze) and RUN (resolve/render).
// Output tabs: Scene (3D wireframe) · Plan (top-down wireframe) · Satellite · Charts (elevation) · Console · Compiled.

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Files, Search, GitBranch, Play, Blocks, Settings, ChevronRight, ChevronDown,
  X, Circle, FileCode2, FileJson, FileText, Folder, FolderOpen,
  Terminal as TerminalIcon, AlertCircle, Bell, Check,
  Map as MapIcon, Image as ImageIcon, Building2, BarChart3, Code2, Trash2,
} from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { compile as dendraCompile } from "../dendra";
import { sampleElevationProfile } from "../dendra/terrain";
import { fetchCity } from "../dendra/buildings";

// Mapbox token (NEXT_PUBLIC_ → inlined into the client bundle). Set in web/.env.local.
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/* ---------- theme ---------- */
const theme = {
  titlebar: "#11201c", activitybar: "#0c1714", activitybarFg: "#5d736d",
  activitybarFgActive: "#d7faf5", sidebar: "#0d1714", sidebarFg: "#b3c6c1",
  sidebarHeader: "#6f8a84", editor: "#070d0b", editorFg: "#d4e6e2",
  tabBar: "#0d1714", tabActive: "#070d0b", tabInactive: "#101c18",
  tabFg: "#7a948e", tabFgActive: "#eafaf8", border: "#1a2924",
  accent: "#0e6b62", accentBright: "#58E6D9", statusBar: "#0b2e2a",
  statusFg: "#a9ece5", panel: "#070d0b", gutter: "#46615b",
  lineActive: "#11201c", selection: "#15392f",
};

/* ---------- in-memory file system (dendra scenes) ---------- */
const initialFiles = {
  scenes: {
    type: "folder",
    children: {
      "scene.dra": {
        type: "file", lang: "dra",
        content: `# scene.dra — a basic, detailed scene (street-level zoom)
anchor   place   = (48.1374, 11.5755) zoom 17
field    surface = partition place
observer you     = body height 1.7m at spawn surface`,
      },
    },
  },
  "README.md": {
    type: "file", lang: "md",
    content: `# Dendra sandbox

Press COMPILE to lex/check (freezes the registry).
Press RUN to resolve the scene.

Output:
- Map — real satellite at the scene's anchor.
- Charts — real elevation transect at the anchor (Mapbox terrain).
- Console — the compile/run log.
- Compiled — the dendra token stream (M1 lexer).

Terrain + atmosphere rendering arrives at roadmap M6.`,
  },
};

/* ---------- compile + anchor scan ---------- */
function extractAnchor(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (!(tokens[i].kind === "kw" && tokens[i].text === "anchor")) continue;
    let j = i;
    while (j < tokens.length && tokens[j].kind !== "lparen") j++;
    const lat = tokens[j + 1], lng = tokens[j + 3];
    if (lat?.kind === "number" && lng?.kind === "number") {
      let z = j + 4, zoom = 14;
      while (z < tokens.length && !(tokens[z].kind === "kw" && tokens[z].text === "zoom")) z++;
      if (tokens[z + 1]?.kind === "number") zoom = tokens[z + 1].value;
      return { lat: lat.value, lng: lng.value, zoom };
    }
  }
  return null;
}

function compile(files) {
  const sources = [];
  const walk = (tree) => {
    for (const [name, node] of Object.entries(tree)) {
      if (node.type === "folder") walk(node.children);
      else if (name.endsWith(".dra")) sources.push({ name, content: node.content });
    }
  };
  walk(files);
  const main = sources[0];
  if (!main) return { name: null, ok: false, code: "// add a .dra file under scenes/", anchor: null, diagnostics: [], tokenCount: 0 };
  const out = dendraCompile(main.content);
  return {
    name: main.name, ok: out.ok, code: out.dump,
    anchor: extractAnchor(out.tokens),
    diagnostics: out.diagnostics,
    tokenCount: out.tokens.length - 1,
  };
}

function osmUrl({ lat, lng, zoom }) {
  const span = Math.max(0.004, 0.6 / Math.pow(2, Math.max(0, zoom - 9)));
  const bbox = `${lng - span},${lat - span},${lng + span},${lat + span}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;
}

/* ---------- helpers ---------- */
const fileIcon = (name) => {
  if (name.endsWith(".dra")) return { Icon: FileCode2, color: "#a78bfa" };
  if (name.endsWith(".json")) return { Icon: FileJson, color: "#cbcb41" };
  if (name.endsWith(".md")) return { Icon: FileText, color: "#519aba" };
  return { Icon: FileText, color: "#858585" };
};
const langLabel = (lang) => ({ dra: "Dendra", json: "JSON", md: "Markdown" }[lang] || "Plain Text");
const getNode = (tree, path) => {
  let n = { children: tree };
  for (const p of path) { n = n.children[p]; if (!n) return null; }
  return n;
};

/* ---------- file tree ---------- */
function Tree({ tree, path = [], depth = 0, expanded, toggle, activePath, openFile }) {
  const entries = Object.entries(tree).sort((a, b) =>
    a[1].type !== b[1].type ? (a[1].type === "folder" ? -1 : 1) : a[0].localeCompare(b[0]));
  return (
    <>
      {entries.map(([name, node]) => {
        const fullPath = [...path, name];
        const key = fullPath.join("/");
        const isFolder = node.type === "folder";
        const isOpen = expanded.has(key);
        const isActive = activePath === key;
        const { Icon, color } = isFolder
          ? { Icon: isOpen ? FolderOpen : Folder, color: "#5d9e95" }
          : fileIcon(name);
        return (
          <div key={key}>
            <button
              onClick={() => (isFolder ? toggle(key) : openFile(fullPath))}
              className="flex w-full items-center gap-1 py-0.5 pr-2 text-left text-[13px] leading-relaxed transition-colors"
              style={{ paddingLeft: 8 + depth * 12, color: theme.sidebarFg, background: isActive ? theme.lineActive : "transparent" }}>
              {isFolder
                ? (isOpen ? <ChevronDown size={14} className="shrink-0 opacity-70" /> : <ChevronRight size={14} className="shrink-0 opacity-70" />)
                : <span className="w-[14px] shrink-0" />}
              <Icon size={15} className="shrink-0" style={{ color }} />
              <span className="truncate">{name}</span>
            </button>
            {isFolder && isOpen && (
              <Tree tree={node.children} path={fullPath} depth={depth + 1} expanded={expanded} toggle={toggle} activePath={activePath} openFile={openFile} />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------- editor ---------- */
function Editor({ value, onChange, onCursor }) {
  const gutterRef = useRef(null);
  const lines = value.split("\n");
  const syncScroll = (e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop; };
  const handleCursor = (e) => {
    const upto = e.target.value.slice(0, e.target.selectionStart);
    onCursor({ ln: upto.split("\n").length, col: upto.length - upto.lastIndexOf("\n") });
  };
  return (
    <div className="flex min-h-0 flex-1" style={{ background: theme.editor }}>
      <div ref={gutterRef} className="select-none overflow-hidden py-3 text-right font-mono text-[13px] leading-[1.5]" style={{ color: theme.gutter, minWidth: 52, paddingRight: 16 }}>
        {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)} onScroll={syncScroll}
        onKeyUp={handleCursor} onClick={handleCursor} spellCheck={false}
        className="min-h-0 flex-1 resize-none border-0 bg-transparent py-3 pr-4 font-mono text-[13px] leading-[1.5] outline-none"
        style={{ color: theme.editorFg, tabSize: 2, caretColor: theme.accentBright }} />
    </div>
  );
}

/* ---------- output views ---------- */
function Placeholder({ text }) {
  return <div className="flex h-full items-center justify-center px-6 text-center font-mono text-[11px] italic" style={{ color: "rgba(255,255,255,0.22)" }}>{text}</div>;
}

function MapView({ anchor }) {
  if (!anchor) return <Placeholder text="COMPILE a scene with an `anchor … = (lat, lng) zoom N`" />;
  const label = (
    <div className="pointer-events-none absolute left-2 top-2 rounded px-2 py-1 font-mono text-[10px]"
      style={{ background: "rgba(0,0,0,.6)", color: theme.accentBright }}>
      {anchor.lat.toFixed(4)}, {anchor.lng.toFixed(4)} · zoom {anchor.zoom} · {MAPBOX_TOKEN ? "mapbox satellite" : "osm"}
    </div>
  );
  if (MAPBOX_TOKEN) {
    const z = Math.max(0, Math.min(20, Math.round(anchor.zoom)));
    const src = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${anchor.lng},${anchor.lat},${z},0/1280x1280@2x?access_token=${MAPBOX_TOKEN}`;
    return (
      <div className="relative h-full w-full" style={{ background: "#0b1410" }}>
        <img key={src} src={src} alt="satellite" className="h-full w-full" style={{ objectFit: "cover" }} />
        {label}
      </div>
    );
  }
  return (
    <div className="relative h-full w-full">
      <iframe key={`${anchor.lat},${anchor.lng}`} title="map" src={osmUrl(anchor)} className="h-full w-full border-0" />
      {label}
    </div>
  );
}

/* ---------- wireframe: buildings as partition-boundary edges ---------- */
// push the 12 edge-segments of an extruded footprint (base ring + top ring + verticals)
function pushBuildingEdges(arr, ring, h) {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x, z] = ring[i];
    const [x2, z2] = ring[(i + 1) % n];
    arr.push(x, 0, z, x2, 0, z2);   // base edge
    arr.push(x, h, z, x2, h, z2);   // roof edge
    arr.push(x, 0, z, x, h, z);     // vertical at vertex
  }
}

function WireframeScene({ city }) {
  const mountRef = useRef(null);
  useEffect(() => {
    if (!city || !mountRef.current) return;
    const el = mountRef.current;
    const W = el.clientWidth || 800, H = el.clientHeight || 500;
    const R = city.radiusM;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070d0b);
    scene.fog = new THREE.Fog(0x070d0b, R * 1.2, R * 3.2);

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 8000);
    camera.position.set(R * 0.7, R * 0.55, R * 0.7);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // stay above ground
    controls.enableDamping = true;
    controls.update();

    scene.add(new THREE.GridHelper(2 * R, Math.max(10, Math.min(80, Math.round(R / 20))), 0x1a2924, 0x111c18));

    const bPos = [];
    for (const b of city.buildings) pushBuildingEdges(bPos, b.ring, b.height);
    if (bPos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(bPos, 3));
      scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x58e6d9 })));
    }

    const rPos = [];
    for (const r of city.roads)
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [x, z] = r.pts[i], [x2, z2] = r.pts[i + 1];
        rPos.push(x, 0.3, z, x2, 0.3, z2);
      }
    if (rPos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(rPos, 3));
      scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x5d736d })));
    }

    // observer — a 1.7 m marker at the anchor (the walking model's origin)
    const obs = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 1.7, 0], 3)),
      new THREE.LineBasicMaterial({ color: 0xf59e0b }));
    scene.add(obs);

    let raf;
    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose(); renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [city]);

  if (!city) return <Placeholder text="RUN to build the 3D wireframe from OSM buildings" />;
  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-2 top-2 rounded px-2 py-1 font-mono text-[10px]"
        style={{ background: "rgba(0,0,0,.6)", color: theme.accentBright }}>
        {city.count.buildings} buildings · drag to orbit · scroll to zoom
      </div>
    </div>
  );
}

function PlanView({ city }) {
  if (!city) return <Placeholder text="RUN to fetch buildings (OSM) — top-down plan" />;
  const R = city.radiusM;
  return (
    <div className="relative h-full w-full" style={{ background: "#070d0b" }}>
      <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        {city.roads.map((r, i) => (
          <polyline key={"r" + i} points={r.pts.map((p) => `${p[0]},${p[1]}`).join(" ")}
            fill="none" stroke="rgba(150,175,168,0.4)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        ))}
        {city.buildings.map((b, i) => (
          <polygon key={"b" + i} points={b.ring.map((p) => `${p[0]},${p[1]}`).join(" ")}
            fill="rgba(88,230,217,0.05)" stroke="#58E6D9" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <circle cx={0} cy={0} r={R * 0.012} fill="#f59e0b" />
      </svg>
      <div className="pointer-events-none absolute left-2 top-2 rounded px-2 py-1 font-mono text-[10px]"
        style={{ background: "rgba(0,0,0,.6)", color: theme.accentBright }}>
        {city.count.buildings} buildings · {city.count.roads} roads · {R} m radius
      </div>
    </div>
  );
}

function ChartsView({ elev, running }) {
  if (running) return <Placeholder text="sampling terrain…" />;
  if (!elev) return <Placeholder text="press RUN to sample real elevation at the anchor" />;
  const { profile, min, max, mean, z } = elev;
  const W = 100, H = 100, span = Math.max(1, max - min);
  const pts = profile.map((e, i) => `${(i / (profile.length - 1)) * W},${(H - ((e - min) / span) * H).toFixed(2)}`).join(" ");
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-2 font-mono text-[10px]" style={{ letterSpacing: ".12em", color: theme.sidebarHeader }}>
        ELEVATION — E–W transect through anchor · Mapbox terrain-RGB z{z}
      </div>
      <div className="relative min-h-0 flex-1" style={{ border: `1px solid ${theme.border}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" style={{ background: "rgba(255,255,255,0.02)" }}>
          <polyline points={`0,${H} ${pts} ${W},${H}`} fill="rgba(88,230,217,0.12)" stroke="none" />
          <polyline points={pts} fill="none" stroke={theme.accentBright} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
        {[["MIN", `${Math.round(min)} m`], ["MEAN", `${Math.round(mean)} m`], ["MAX", `${Math.round(max)} m`]].map(([k, v]) => (
          <div key={k} className="px-2 py-1.5 text-center" style={{ border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 8, letterSpacing: ".1em", color: theme.tabFg }}>{k}</div>
            <div style={{ marginTop: 2, color: theme.accentBright }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 font-mono text-[9px] italic" style={{ color: theme.tabFg }}>
        real elevation at the scene anchor. trajectory / partition charts (S-entropy, composition) follow the resolver — M5–M6.
      </div>
    </div>
  );
}

function ConsoleView({ log, onClear }) {
  return (
    <div className="relative h-full">
      {log.length > 0 && (
        <button onClick={onClear} title="clear" className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded" style={{ color: theme.tabFg }}>
          <Trash2 size={13} />
        </button>
      )}
      <div className="h-full overflow-y-auto p-3 font-mono text-[12px] leading-relaxed">
        {log.length === 0
          ? <div style={{ color: "#5a5a5a" }}>press COMPILE or RUN.</div>
          : log.map((l, i) => {
            const color = l.startsWith("$") ? "#9cdcfe" : /error|fail|✕/.test(l) ? "#f48771" : l.startsWith("✓") ? "#34d399" : theme.editorFg;
            return <div key={i} style={{ color, whiteSpace: "pre-wrap" }}>{l}</div>;
          })}
      </div>
    </div>
  );
}

function OutputColumn({ tab, setTab, result, scene, log, running, onCompile, onRun, onClearLog }) {
  const tabs = [
    { id: "scene", label: "Scene", Icon: Building2 },
    { id: "plan", label: "Plan", Icon: MapIcon },
    { id: "satellite", label: "Satellite", Icon: ImageIcon },
    { id: "charts", label: "Charts", Icon: BarChart3 },
    { id: "console", label: "Console", Icon: TerminalIcon },
    { id: "compiled", label: "Compiled", Icon: Code2 },
  ];
  return (
    <div className="flex min-w-0 flex-1 flex-col" style={{ background: theme.editor, borderLeft: `1px solid ${theme.border}` }}>
      <div className="flex h-9 shrink-0 items-center justify-between pr-2" style={{ background: theme.tabInactive }}>
        <div className="flex h-full">
          {tabs.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                className="relative flex items-center gap-1.5 px-3 text-[12px] transition-colors"
                style={{ color: active ? theme.tabFgActive : theme.tabFg, background: active ? theme.tabActive : "transparent" }}>
                <Icon size={13} /> {label}
                {active && <span className="absolute left-0 top-0 h-0.5 w-full" style={{ background: theme.accentBright }} />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onCompile} title="Lex / check / freeze registry" className="flex h-6 items-center gap-1 rounded px-2.5 text-[11px]" style={{ border: `1px solid ${theme.accentBright}55`, color: theme.accentBright }}>
            <Check size={12} /> COMPILE
          </button>
          <button onClick={onRun} disabled={running} title="Resolve / render the scene" className="flex h-6 items-center gap-1 rounded px-2.5 text-[11px] font-bold"
            style={{ background: running ? "#1a2a26" : theme.accentBright, color: running ? "#557" : "#03100e" }}>
            <Play size={12} /> {running ? "RUNNING" : "RUN"}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "scene" && <WireframeScene city={scene?.city} />}
        {tab === "plan" && <PlanView city={scene?.city} />}
        {tab === "satellite" && <MapView anchor={result?.anchor} />}
        {tab === "charts" && <ChartsView elev={scene?.elev} running={running} />}
        {tab === "console" && <ConsoleView log={log} onClear={onClearLog} />}
        {tab === "compiled" && (
          <pre className="h-full overflow-auto p-3 font-mono text-[12px] leading-[1.5]" style={{ color: theme.editorFg }}>
            {result?.code || "press COMPILE."}
          </pre>
        )}
      </div>
    </div>
  );
}

/* ---------- main shell (full page) ---------- */
export default function Sandbox() {
  const [files, setFiles] = useState(initialFiles);
  const [expanded, setExpanded] = useState(new Set(["scenes"]));
  const [openTabs, setOpenTabs] = useState([["scenes", "scene.dra"]]);
  const [activeTab, setActiveTab] = useState("scenes/scene.dra");
  const [dirty, setDirty] = useState(new Set());
  const [cursor, setCursor] = useState({ ln: 1, col: 1 });

  const [compiled, setCompiled] = useState(null);
  const [scene, setScene] = useState(null);
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [outTab, setOutTab] = useState("console");

  const [activity, setActivity] = useState("files");
  const [sidebar, setSidebar] = useState(true);

  const pushLog = useCallback((...lines) => setLog((l) => [...l, ...lines]), []);

  const doCompile = useCallback(() => {
    const r = compile(files);
    setCompiled(r);
    setScene(null);
    setOutTab("console");
    pushLog(`$ dendra compile ${r.name ?? "(none)"}`);
    if (r.ok) pushLog(`✓ lexed ${r.tokenCount} tokens · 0 diagnostics · registry Γ frozen`);
    else { pushLog(`✕ ${r.diagnostics.length} diagnostic(s):`); r.diagnostics.forEach((d) => pushLog(`  ${d.line}:${d.col}  ${d.message}`)); }
  }, [files, pushLog]);

  const doRun = useCallback(async () => {
    const r = compile(files);
    setCompiled(r);
    pushLog(`$ dendra run ${r.name ?? "(none)"}`);
    if (!r.ok) { setOutTab("console"); pushLog(`✕ compile failed — ${r.diagnostics.length} diagnostic(s)`); r.diagnostics.forEach((d) => pushLog(`  ${d.line}:${d.col}  ${d.message}`)); return; }
    pushLog(`  lexed ${r.tokenCount} tokens · registry frozen`);
    if (!r.anchor) { setOutTab("console"); pushLog(`  no anchor declared — nothing to resolve`); return; }
    pushLog(`  anchor → ${r.anchor.lat}, ${r.anchor.lng} (zoom ${r.anchor.zoom})`);
    setRunning(true);
    setOutTab("console");
    try {
      // buildings (OSM Overpass — no key) + elevation (Mapbox — needs key), in parallel
      pushLog(`  fetching OSM buildings + terrain…`);
      const [cityRes, elevRes] = await Promise.allSettled([
        fetchCity(r.anchor),
        MAPBOX_TOKEN ? sampleElevationProfile(r.anchor, MAPBOX_TOKEN) : Promise.reject(new Error("no NEXT_PUBLIC_MAPBOX_TOKEN")),
      ]);
      const city = cityRes.status === "fulfilled" ? cityRes.value : null;
      const elev = elevRes.status === "fulfilled" ? elevRes.value : null;

      if (city) pushLog(`  OSM → ${city.count.buildings} buildings · ${city.count.roads} roads (${city.radiusM} m radius)`);
      else pushLog(`  ✕ buildings: ${cityRes.reason?.message || "failed"}`);
      if (elev) pushLog(`  elevation ${Math.round(elev.min)}–${Math.round(elev.max)} m (mean ${Math.round(elev.mean)}) · tile ${elev.z}/${elev.x}/${elev.y}`);
      else pushLog(`  · elevation: ${elevRes.reason?.message || "skipped"}`);

      setScene({ elev, city });
      pushLog(`✓ scene resolved. wireframe = partition-edge trace · terrain/atmosphere → M6`);
      setOutTab(city ? "scene" : elev ? "charts" : "console");
    } catch (e) {
      setOutTab("console");
      pushLog(`  ✕ error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }, [files, pushLog]);

  const toggleFolder = useCallback((key) => {
    setExpanded((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);
  const openFile = useCallback((pathArr) => {
    const key = pathArr.join("/");
    setOpenTabs((prev) => (prev.some((t) => t.join("/") === key) ? prev : [...prev, pathArr]));
    setActiveTab(key);
  }, []);
  const closeTab = useCallback((key, e) => {
    e.stopPropagation();
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.join("/") !== key);
      if (activeTab === key) setActiveTab(next.length ? next[next.length - 1].join("/") : null);
      return next;
    });
    setDirty((prev) => { const n = new Set(prev); n.delete(key); return n; });
  }, [activeTab]);

  const activePathArr = useMemo(() => openTabs.find((t) => t.join("/") === activeTab) || null, [openTabs, activeTab]);
  const activeNode = activePathArr ? getNode(files, activePathArr) : null;

  const updateContent = useCallback((val) => {
    if (!activePathArr) return;
    setFiles((prev) => { const next = structuredClone(prev); getNode(next, activePathArr).content = val; return next; });
    setDirty((prev) => new Set(prev).add(activeTab));
  }, [activePathArr, activeTab]);

  const activities = [
    { id: "files", Icon: Files, label: "Explorer" },
    { id: "search", Icon: Search, label: "Search" },
    { id: "git", Icon: GitBranch, label: "Source Control" },
    { id: "run", Icon: Play, label: "Run and Debug" },
    { id: "ext", Icon: Blocks, label: "Extensions" },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden text-sm" style={{ background: theme.editor, color: theme.editorFg }}>
      {/* title bar */}
      <div className="flex h-9 shrink-0 items-center justify-between px-3" style={{ background: theme.titlebar }}>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: "#ff5f56" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "#ffbd2e" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "#27c93f" }} />
        </div>
        <span className="text-xs" style={{ color: "#cccccc" }}>dendra — buhera-west</span>
        <a href="/" className="text-xs" style={{ color: theme.tabFg }}>← home</a>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* activity bar */}
        <div className="flex w-12 shrink-0 flex-col items-center justify-between py-2" style={{ background: theme.activitybar }}>
          <div className="flex flex-col items-center gap-1">
            {activities.map(({ id, Icon, label }) => {
              const active = activity === id;
              return (
                <button key={id} title={label}
                  onClick={() => { if (active) setSidebar((s) => !s); else { setActivity(id); setSidebar(true); } }}
                  className="relative flex h-11 w-12 items-center justify-center transition-colors"
                  style={{ color: active ? theme.activitybarFgActive : theme.activitybarFg }}>
                  {active && <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2" style={{ background: "#fff" }} />}
                  <Icon size={24} strokeWidth={1.5} />
                </button>
              );
            })}
          </div>
          <button title="Settings" className="flex h-11 w-12 items-center justify-center" style={{ color: theme.activitybarFg }}>
            <Settings size={24} strokeWidth={1.5} />
          </button>
        </div>

        {/* sidebar */}
        {sidebar && (
          <div className="flex w-60 shrink-0 flex-col overflow-hidden" style={{ background: theme.sidebar, borderRight: `1px solid ${theme.border}` }}>
            <div className="flex h-9 shrink-0 items-center px-4 text-[11px] font-medium uppercase tracking-wider" style={{ color: theme.sidebarHeader }}>
              {activities.find((a) => a.id === activity)?.label}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {activity === "files"
                ? <Tree tree={files} expanded={expanded} toggle={toggleFolder} activePath={activeTab} openFile={openFile} />
                : <div className="px-4 py-6 text-[13px]" style={{ color: theme.tabFg }}>{activities.find((a) => a.id === activity)?.label} panel</div>}
            </div>
          </div>
        )}

        {/* editor + output */}
        <div className="flex min-w-0 flex-1">
          <div className="flex min-w-0 flex-col" style={{ width: "48%" }}>
            <div className="flex h-9 shrink-0 items-stretch overflow-x-auto" style={{ background: theme.tabInactive }}>
              {openTabs.map((pathArr) => {
                const key = pathArr.join("/");
                const name = pathArr[pathArr.length - 1];
                const active = key === activeTab;
                const isDirty = dirty.has(key);
                const { Icon, color } = fileIcon(name);
                return (
                  <div key={key} onClick={() => setActiveTab(key)}
                    className="group flex cursor-pointer items-center gap-2 border-r px-3 text-[13px]"
                    style={{ background: active ? theme.tabActive : theme.tabInactive, color: active ? theme.tabFgActive : theme.tabFg, borderColor: theme.border, borderTop: active ? `1px solid ${theme.accentBright}` : "1px solid transparent" }}>
                    <Icon size={15} style={{ color }} />
                    <span className="whitespace-nowrap">{name}</span>
                    <button onClick={(e) => closeTab(key, e)} className="flex h-5 w-5 items-center justify-center rounded" style={{ color: active ? theme.tabFgActive : theme.tabFg }}>
                      {isDirty ? <Circle size={9} fill="currentColor" className="group-hover:hidden" /> : null}
                      <X size={15} className={isDirty ? "hidden group-hover:block" : "opacity-0 group-hover:opacity-100"} />
                    </button>
                  </div>
                );
              })}
            </div>

            {activeNode
              ? <Editor value={activeNode.content} onChange={updateContent} onCursor={setCursor} />
              : <div className="flex min-h-0 flex-1 items-center justify-center text-sm" style={{ background: theme.editor, color: "#5a5a5a" }}>Select a file to start editing</div>}
          </div>

          <div className="w-1 shrink-0" style={{ background: theme.border }} />

          <OutputColumn
            tab={outTab} setTab={setOutTab}
            result={compiled} scene={scene} log={log} running={running}
            onCompile={doCompile} onRun={doRun} onClearLog={() => setLog([])}
          />
        </div>
      </div>

      {/* status bar */}
      <div className="flex h-6 shrink-0 items-center justify-between px-3 text-[12px]" style={{ background: theme.statusBar, color: theme.statusFg }}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><GitBranch size={13} /> main</span>
          <span className="flex items-center gap-1">
            {compiled ? (compiled.ok ? <Check size={13} /> : <AlertCircle size={13} />) : <Circle size={11} />}
            {compiled ? `${compiled.diagnostics.length} diag · ${compiled.tokenCount} tokens` : "not compiled"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Ln {cursor.ln}, Col {cursor.col}</span>
          <span>Spaces: 2</span><span>UTF-8</span>
          <span>{activeNode ? langLabel(activeNode.lang) : "—"}</span>
          <Bell size={13} />
        </div>
      </div>
    </div>
  );
}
