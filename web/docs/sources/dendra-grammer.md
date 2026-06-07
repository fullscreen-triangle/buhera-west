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

- keywords: `anchor field observer walk render observe partition atmosphere body height at spawn to depth passes zoom`
- pass names: `terrain atmosphere weather position light`
- observe fields: `position altitude material speed`
- punctuation: `= ( ) [ ] , :`
- `length` = `number` followed by unit `m` | `km`
- `integer` = digits ; `number` = optional `-`, digits, optional `.`digits, optional exponent
- `ident` = letter `{ letter | digit | _ }`
- `comment` = `#` … end-of-line (stripped)
- whitespace / newlines insignificant except as separators

---

## 3. Syntactic grammar (EBNF, v0)

```ebnf
program    = { decl } ;
decl       = anchor | field | observer | walk | render | observe ;

anchor     = "anchor"   ident "=" "(" number "," number ")" "zoom" integer ;
field      = "field"    ident "=" field_op ;
field_op   = "partition"  ident
           | "atmosphere" ident ;
observer   = "observer" ident "=" "body" "height" length "at" placement ;
placement  = "spawn" ident
           | "(" length "," length ")" ;
walk       = "walk" ident "to" "(" length "," length ")" [ "depth" integer ] ;
render     = "render" "passes" "[" pass { "," pass } "]" ;
pass       = "terrain" | "atmosphere" | "weather" | "position" | "light" ;
observe    = "observe" ident ":" obs_field { "," obs_field } ;
obs_field  = "position" | "altitude" | "material" | "speed" ;

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

*Open: clear the `web/` portfolio placeholder, or nest dendra under it?*

---

## 9. Implementation roadmap (cross out as we go)

### M0 — Scaffolding
- [ ] Decide repo layout (§8) and clear/relocate the `web/` placeholder
- [ ] Create `spec/` and `spec/corpus/`
- [ ] Add `dendra` package skeleton under `web/src/dendra/`

### M1 — Lexer (TS)
- [ ] Token set (§2), comment stripping, units, numbers, idents
- [ ] First corpus script `munich.dra` tokenises

### M2 — Parser + AST (TS)
- [ ] AST node per declaration (§3)
- [ ] Recursive-descent parser, error recovery with positions
- [ ] `munich.dra` parses to expected AST (corpus)

### M3 — Checker (TS)
- [ ] Type table (§4), reference resolution, closed-set name checks
- [ ] Diagnostics with line/col

### M4 — Resolver: anchor + fields (Pass 0)
- [ ] `anchor` → Mapbox DEM + satellite fetch
- [ ] `partition` (Pass 0a) reimplemented from `sentropy.js`
- [ ] `atmosphere` (Pass 0b) reimplemented
- [ ] corpus: partition/atmosphere stats match expected JSON

### M5 — Observer + walk
- [ ] `observer body … at spawn`
- [ ] `walk … to … depth N` = continuous trajectory completion
- [ ] corpus: trajectory samples match

### M6 — Renderer (passes)
- [ ] `terrain` + `atmosphere` + `light` passes (WebGL/WebGPU)
- [ ] frame renders from a `.dra` script

### M7 — Webtool (playground)
- [ ] Editor pane + live scene + diagnostics (Sandcastle-style)
- [ ] COMPILE / RUN controls

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
