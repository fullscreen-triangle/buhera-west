# Dendra — Language & Compiler Spec (living document)

`dendra` · file extension `.dra` · the scripting language of the buhera-west scene framework.

This is the **map**: the language grammar and the compiler structure, plus a roadmap we
**cross out as we implement**. It is the single source of truth; both compilers obey it.

> **Status legend** — `- [ ]` not started · `- [~]` in progress · `- [x] ~~done~~ → path`
> When something is implemented, check it, strike it, and note the file.
> The *syntax is the author's*; this v0 is a draft to redline.

---

## 0. Principles (fixed)

- **Independent stack.** Dendra is its own language; **not** an extension of Tempus (learn the ideas, depend on nothing).
- **One language, two compilers.** TypeScript compiler = the **web playground** (fast, disposable). Rust compiler = the **final** tool. Nothing enters Rust until proven on the playground.
- **Spec-first.** `spec/` (grammar + semantics + conformance corpus) is canonical; the corpus is how a playground idea graduates to a final Rust implementation.
- **compile = resolve = render = measure.** Evaluating a script *is* the rendering *is* the measurement. No forward simulation.
- **The walk is a result.** A walk is a continuous trajectory resolved (backward-completed) from anchors, not a piloted game object. No jumps because the trajectory is continuous.
- **Anchor on the observable.** Real map data (DEM, satellite, street view) is the observed final state; the script resolves it, never simulates it into being.

---

## 1. What a `.dra` program is

A program is a list of **declarations**. Each binds a name to a value resolved against the
partition pipeline. Resolution is a DAG: `anchor → field(partition) → field(atmosphere) →
observer → walk → render → observe`.

```
# munich.dra — walk a real place, no jumps
anchor   munich  = (48.137, 11.575) zoom 14     # observed final state: DEM + satellite
field    surface = partition munich             # Pass 0a → (n, l, m, s)
field    sky     = atmosphere surface           # Pass 0b → (Sk, St, Se, n_ref)

observer you = body height 1.7m at spawn surface

walk you to (320m, -110m) depth 20              # continuous trajectory — a result

render passes [terrain, atmosphere, light]
observe you: position, altitude, material
```

---

## 2. Lexical grammar (tokens)

- keywords: `import anchor field observer walk render observe partition atmosphere vegetation surface traffic activity body height at spawn include to depth passes zoom`
- field kinds: `partition atmosphere vegetation surface traffic activity` — faces of the same partition state at the anchor (why they compose; see §0)
- pass names: `terrain atmosphere weather position light`
- observe fields: `position altitude material speed`
- punctuation: `= ( ) [ ] , :`
- `string` = `"` … `"` (import paths; no escapes in v0)
- `length` = `number` followed by unit `m` | `km`
- `integer` = digits ; `number` = optional `-`, digits, optional `.`digits, optional exponent
- `ident` = letter `{ letter | digit | _ }`
- `comment` = `#` … end-of-line (stripped)
- whitespace / newlines insignificant except as separators

---

## 3. Syntactic grammar (EBNF, v0)

```ebnf
program    = { import } { decl } ;
import     = "import" string ;                     (* splice another module's decls *)
decl       = anchor | field | observer | walk | render | observe | include ;

anchor     = "anchor"   ident "=" "(" number "," number ")" "zoom" integer ;
field      = "field"    ident "=" field_op ;
field_op   = field_kind ident ;
field_kind = "partition" | "atmosphere" | "vegetation" | "surface" | "traffic" | "activity" ;
observer   = "observer" ident "=" "body" "height" length "at" placement ;
placement  = "spawn" ident
           | "(" length "," length ")" ;
walk       = "walk" ident "to" "(" length "," length ")" [ "depth" integer ] ;
include    = "include" "[" ident { "," ident } "]" ;   (* fields the walker measures against *)
render     = "render" "passes" "[" pass { "," pass } "]" ;
pass       = "terrain" | "atmosphere" | "weather" | "position" | "light" ;
observe    = "observe" ident ":" obs_field { "," obs_field } ;
obs_field  = "position" | "altitude" | "material" | "speed" ;

string     = '"' { char - '"' } '"' ;

length     = number ( "m" | "km" ) ;
integer    = digit { digit } ;
number     = [ "-" ] digit { digit } [ "." digit { digit } ] ;
ident      = letter { letter | digit | "_" } ;
```

---

## 4. Types & semantics

| type | produced by | content |
|---|---|---|
| `Location` | `anchor` | lat, lng, zoom → fetched DEM + satellite (the observable) |
| `Field<Partition>` | `partition <Location>` | `(n,l,m,s)` per cell — Pass 0a |
| `Field<Atmosphere>` | `atmosphere <Field<Partition>>` | `(Sk,St,Se,n_ref)` per voxel — Pass 0b |
| `Observer` | `body … at …` | human-scale instrument (eye height, camera) |
| `Trajectory` | `walk … to … depth N` | continuous backward-completed path; `depth` = partition precision |
| `Scene` | `render passes [...]` | resolved frames |
| (readout) | `observe …` | scalar/vector measurements emitted |

Checker rules: `partition` requires a `Location`; `atmosphere` requires a `Field<Partition>`;
`observer at spawn` requires a `Field`; `walk`/`observe` require an `Observer`; pass and
observe-field names are closed sets; every referenced `ident` must be declared before use.

---

## 5. Evaluation model (two phases)

- **COMPILE** — lex → parse → typecheck → build & freeze the resolution DAG. Errors here block resolution. (Mirrors Tempus's "freeze registry Γ", but the registry is the declaration graph.)
- **RESOLVE / RENDER** — topologically evaluate the DAG: fetch anchor tiles → Pass 0 partition → atmosphere → place observer → complete trajectory → run render passes → emit observes. This evaluation **is** the render **is** the measurement.

---

## 6. Compiler architecture (shared design, two implementations)

Stages are identical across TS and Rust; only the host/runtime differs.

```
source.dra
   │  ① Lexer        → tokens
   │  ② Parser       → AST
   │  ③ Checker      → typed AST + diagnostics   (COMPILE ends here; DAG frozen)
   │  ④ Resolver     → resolved values (calls the pipeline)
   │  ⑤ Renderer     → frames / readouts          (RESOLVE = RENDER = MEASURE)
   └  ⑥ Host         → editor+canvas (TS) | CLI/native+wasm (Rust)
```

- **Shared:** `spec/` (this doc as it firms up) + **conformance corpus** = `.dra` scripts paired with expected resolved outputs (partition stats, trajectory samples, observables) as JSON. Both compilers must pass it byte-for-byte where deterministic.
- **TS (playground, `web/`):** stages ①–⑤ in TS; renderer on WebGL/WebGPU; host = Next.js Sandcastle-style editor + live scene.
- **Rust (final, `engine/`):** stages ①–⑤ in Rust; renderer on `wgpu`; targets native + wasm. Implements only what the corpus has frozen.

---

## 7. Runtime / renderer — the passes

Port the proven physics from `couloir/sentropy.js` (reference, reimplement clean):

- **Pass 0a `partition`** — DEM+satellite → `(n,l,m,s)` (material classify + partition coords).
- **Pass 0b `atmosphere`** — `(n,l,m,s)` → `(Sk,St,Se,n_ref)` via M1–M4.
- **`weather`** — evolve `(Sk,St,Se)` (later).
- **`position`** — categorical position (later).
- **`light`** — ray-march scattering/extinction over the atmosphere volume → pixels.
- **`terrain`** — surface render from the partition field + satellite.

---

## 8. Repository layout (plan)

```
buhera-west/
├─ spec/                  # canonical grammar + conformance corpus (shared)
│   ├─ dendra-grammer.md  # ← this doc (or a copy kept in sync)
│   └─ corpus/            # *.dra + *.expected.json
├─ web/                   # TS playground compiler + renderer (Next 13)
│   └─ src/dendra/        # ① lexer ② parser ③ checker ④ resolver ⑤ render ⑥ host
└─ engine/                # Rust final compiler (cargo crate; native + wasm)
```

**Decided:** reuse the portfolio template in `web/` (don't start from scratch). `_app.js` renders Navbar/Footer globally; the landing page stays (gets a CTA); add a `/sandbox` page + a Navbar link. The sandbox UI is the provided VS Code-style shell (`Sandbox.jsx`) with its `compileProject(files) → { html, code }` stub swapped for dendra's `compile()` (Compiled tab = token/AST/diagnostics; Scene tab = rendered passes, later).

---

## 9. Implementation roadmap (cross out as we go)

### M0 — Scaffolding
- [x] ~~Repo layout (§8): **reuse the portfolio template** in `web/` (don't delete) — `_app.js` already gives global Navbar/Footer; add landing CTA + nav → `/sandbox`~~
- [x] ~~Create `spec/` and `spec/corpus/`~~ → `spec/corpus/munich.dra`
- [x] ~~`dendra` package skeleton under `web/src/dendra/`~~ → `token.ts`, `lexer.ts`, `index.ts`
- [x] ~~Add deps to `web/package.json`: `lucide-react`, `typescript`, `@types/*`~~ → run `npm install` in `web/` before `npm run dev`
- [x] ~~Save the VS Code sandbox template as `web/src/components/Sandbox.jsx`, `compileProject → dendra.compile()`~~
- [x] ~~`web/src/pages/sandbox.js` renders `<Sandbox/>`; `/sandbox` nav link (desktop + mobile)~~
- [x] ~~Minimal landing: static GLB via `model-viewer` (no rotation) + global navbar only~~ → `web/src/pages/index.js` (model: `/peirene_fountain_corinth_greece.glb`)
- [x] ~~Full-page sandbox: `_app.js` hides site chrome on `/sandbox`; Sandbox root is `h-screen` (no panel)~~
- [x] ~~Output tabs (Tempus-style): **Map** (real OSM map of the parsed `anchor`), **Charts** (token breakdown), **Console**, **Compiled**~~ — Map switches to the partition/terrain render at M6; anchor read by a temporary token-scan until the M2 parser lands

### M1 — Lexer (TS)
- [x] ~~Token set (§2), comment stripping, units, numbers, idents~~ → `web/src/dendra/{token,lexer}.ts`
- [x] ~~string literals + `import`/`include`/field-kind keywords~~ (enables the layered corpus)
- [x] ~~First corpus script `munich.dra` tokenises~~ → `spec/corpus/munich.dra` via `web/src/dendra/index.ts` `compile()`

**Layered corpus (playground design).** `scenes/01-terrain … 07-walker.dra`: each `import`s the previous and adds ONE field to the same anchor; RUN resolves the *union* (lazy — a field loads only when its decl is reached). The playground implements `import` as textual inclusion (`resolveImports` in `Sandbox.jsx`); the real module system is M2. Order: terrain → weather → vegetation → surface → traffic → activity → walker.

### M2 — Parser + AST (TS)
- [ ] AST node per declaration (§3)
- [ ] Recursive-descent parser, error recovery with positions
- [ ] `munich.dra` parses to expected AST (corpus)

### M3 — Checker (TS)
- [ ] Type table (§4), reference resolution, closed-set name checks
- [ ] Diagnostics with line/col

### M4 — Resolver: anchor + fields (Pass 0)
> Map providers in `web/.env.local` (gitignored): `NEXT_PUBLIC_MAPBOX_TOKEN` (terrain-RGB DEM + satellite — Pass 0 source), `NEXT_PUBLIC_CESIUM_TOKEN` (future 3D terrain/tiles), `OPENWEATHERMAP_API_KEY` (server: real weather → atmosphere/weather pass), `TOMTOM_API_KEY` (server: traffic). Map tab already previews Mapbox satellite.
- [x] ~~Mapbox DEM (terrain-RGB): `sampleElevationProfile` (1-tile transect → Charts) **and** `fetchHeightField` (3×3 stitch → real relief) + `sampleHeight` (bilinear)~~ → `web/src/dendra/terrain.ts`
- [x] ~~`field … = partition` (terrain, script 01) resolves to a walkable **displaced ground**; buildings/roads drape onto it; the walker stands on real relief~~
- [ ] the other field kinds: `atmosphere` (OWM), `vegetation`, `surface`, `traffic` (TomTom), `activity` — scripts 02–06
- [ ] `partition`/`atmosphere` numeric state reimplemented from `sentropy.js`; corpus stats match expected JSON

### M5 — Observer + walk
- [ ] `observer body … at spawn`
- [ ] `walk … to … depth N` = continuous trajectory completion
- [ ] corpus: trajectory samples match

### M6 — Renderer (passes)
- **Render style = wireframe (partition-edge trace), not photoreal.** Edges of buildings/roads *are* the categorical/partition boundaries; tracing them preserves information (photoreal streets is the physical face we skip for now). Real-time weather (OpenWeatherMap) → the `atmosphere`/`light` face; traffic (TomTom) → dynamics. Geometry accuracy comes from **vector data**, not real-time feeds.
- [~] Scene geometry source → `web/src/dendra/buildings.ts` `fetchCity` (OSM Overpass, zero-key): building footprints + heights + roads, projected to local metres. TODO: multipolygon relations.
- [x] ~~**Scene** (3D walkable wireframe on **real displaced terrain**; buildings/roads drape onto relief)~~ · ~~**Plan** (top-down SVG wireframe)~~ — both in `Sandbox.jsx`
- [x] ~~walkable character: `xbot_multiple_animations.glb` (GLTFLoader), WASD move · Shift run · Space jump · **V** first/third-person; idle/walk/run/jump crossfade; walker follows terrain height; continuous — no jumps~~
- [ ] continuous walk **resolved from a `.dra` `walk` trajectory** (backward-completion) instead of free WASD; building collision
- [ ] `terrain` + `atmosphere` + `light` passes (WebGL/WebGPU) — real-time weather feeds atmosphere
- [ ] frame renders from a `.dra` script

### M7 — Webtool (playground)
- [x] ~~Editor pane + file tree + diagnostics (Sandcastle-style), full page~~
- [x] ~~COMPILE / RUN controls (two phases; no auto-run)~~ — COMPILE lexes/freezes, RUN resolves
- [x] ~~Console tab = real build/run log~~ · ~~Charts tab = real elevation transect (Mapbox terrain)~~ · ~~Satellite tab = real satellite~~
- [x] ~~**Scene** tab = 3D wireframe (OSM buildings)~~ · ~~**Plan** tab = top-down wireframe~~ (see M6)

### M8 — Conformance corpus + harness
- [ ] Harness runs all `spec/corpus/*.dra`, diffs against `*.expected.json`
- [ ] CI-style pass/fail report

### M9 — Rust compiler: front end (final)
- [ ] Lexer/parser/checker in `engine/`, passing the same corpus

### M10 — Rust compiler: resolver + renderer (final)
- [ ] Pass 0 + passes on `wgpu`; native + wasm
- [ ] Corpus parity with TS

### M11 — Seamless tile streaming (walk reality, no edges)
- [ ] Stream/stitch adjacent tiles around the moving observer (partition/tile hierarchy)

### M12 — Faces & substates (later)
- [ ] Field/Time/Frequency re-projection of a resolved scene
- [ ] Virtual-substate fusion (mean-recovery) across anchors/sensors

---

*Next action: ratify §3 grammar + choose §8 layout, then begin M0→M1.*
