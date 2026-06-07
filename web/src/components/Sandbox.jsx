// Dendra Sandbox — VS Code-style playground shell (from the provided template).
// The only swap from the template: compileProject() now calls the dendra compiler.
// Browser-only (window / structuredClone / iframe) — import via next/dynamic ssr:false.

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  Files, Search, GitBranch, Play, Blocks, Settings, ChevronRight, ChevronDown,
  X, Circle, FileCode2, FileJson, FileText, Folder, FolderOpen,
  Terminal as TerminalIcon, AlertCircle, Bell, PanelBottomClose, Check,
  Eye, Code2, Trash2, RefreshCw,
} from "lucide-react";

import { compile as dendraCompile } from "../dendra";

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
      "munich.dra": {
        type: "file", lang: "dra",
        content: `# munich.dra — walk a real place, no jumps
anchor   munich  = (48.137, 11.575) zoom 14
field    surface = partition munich
field    sky     = atmosphere surface

observer you = body height 1.7m at spawn surface

walk you to (320m, -110m) depth 20

render passes [terrain, atmosphere, light]
observe you: position, altitude, material`,
      },
    },
  },
  "README.md": {
    type: "file", lang: "md",
    content: `# Dendra sandbox

Edit a .dra scene and press Run.
- Compiled tab: the dendra token stream (M1 lexer).
- Scene tab: rendered passes — arrives at roadmap M6.`,
  },
};

/* ---------- compile: replace-with-your-compiler hook → dendra ---------- */
function placeholderDoc(msg, ok = true) {
  const accent = ok ? "#58E6D9" : "#f48771";
  return `<!doctype html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;height:100vh;display:grid;place-items:center;font:13px/1.6 ui-monospace,monospace;background:#0b1410;color:#9fe8e0">
  <div style="text-align:center">
    <div style="font-size:11px;letter-spacing:.25em;color:${accent}">DENDRA</div>
    <div style="margin-top:10px">${msg}</div>
    <div style="margin-top:8px;font-size:11px;opacity:.5">scene render — roadmap M6</div>
  </div>
</body></html>`;
}

function compileProject(files) {
  const sources = [];
  const walk = (tree) => {
    for (const [name, node] of Object.entries(tree)) {
      if (node.type === "folder") walk(node.children);
      else if (name.endsWith(".dra")) sources.push({ name, content: node.content });
    }
  };
  walk(files);
  const main = sources[0];
  if (!main) return { html: placeholderDoc("no .dra scene"), code: "// add a .dra file under scenes/" };

  const out = dendraCompile(main.content);
  const diag = out.diagnostics.map((d) => `${d.line}:${d.col}  error: ${d.message}`).join("\n");
  const code = (diag ? diag + "\n\n" : "") + out.dump;
  const html = placeholderDoc(
    out.ok
      ? `compiled “${main.name}” — ${out.tokens.length - 1} tokens, 0 diagnostics`
      : `“${main.name}” — ${out.diagnostics.length} diagnostic(s)`,
    out.ok,
  );
  return { html, code };
}

/* ---------- helpers ---------- */
const fileIcon = (name) => {
  if (name.endsWith(".dra")) return { Icon: FileCode2, color: "#a78bfa" };
  if (name.endsWith(".json")) return { Icon: FileJson, color: "#cbcb41" };
  if (name.endsWith(".md")) return { Icon: FileText, color: "#519aba" };
  return { Icon: FileText, color: "#858585" };
};
const langLabel = (lang) =>
  ({ dra: "Dendra", json: "JSON", md: "Markdown" }[lang] || "Plain Text");
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

/* ---------- output column ---------- */
function OutputColumn({ srcDoc, compiled, logs, runKey, onRun, onClear }) {
  const [tab, setTab] = useState("scene");
  const tabs = [
    { id: "scene", label: "Scene", Icon: Eye },
    { id: "console", label: "Console", Icon: TerminalIcon },
    { id: "compiled", label: "Compiled", Icon: Code2 },
  ];
  const levelColor = { log: "#d4d4d4", info: "#9cdcfe", warn: "#dcdcaa", error: "#f48771" };
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
                {id === "console" && logs.length > 0 && (
                  <span className="rounded-full px-1.5 text-[10px]" style={{ background: theme.accent, color: "#fff" }}>{logs.length}</span>
                )}
                {active && <span className="absolute left-0 top-0 h-0.5 w-full" style={{ background: theme.accentBright }} />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          {tab === "console" && (
            <button onClick={onClear} title="Clear console" className="flex h-6 w-6 items-center justify-center rounded" style={{ color: theme.tabFg }}><Trash2 size={14} /></button>
          )}
          <button onClick={onRun} title="Re-run" className="flex h-6 items-center gap-1 rounded px-2 text-[12px]" style={{ background: theme.accent, color: "#fff" }}>
            <RefreshCw size={12} /> Run
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "scene" && (
          <iframe key={runKey} title="scene" srcDoc={srcDoc} sandbox="allow-scripts"
            className="h-full w-full border-0" style={{ background: "#0b1410" }} />
        )}
        {tab === "console" && (
          <div className="h-full overflow-y-auto p-2 font-mono text-[12px] leading-relaxed">
            {logs.length === 0
              ? <div className="px-1 pt-1" style={{ color: "#5a5a5a" }}>Console output appears here.</div>
              : logs.map((l, i) => (
                <div key={i} className="border-b px-1 py-1" style={{ color: levelColor[l.level] || "#d4d4d4", borderColor: "#2a2a2a" }}>
                  <span className="mr-2 opacity-50">{l.level}</span>{l.message}
                </div>
              ))}
          </div>
        )}
        {tab === "compiled" && (
          <pre className="h-full overflow-auto p-3 font-mono text-[12px] leading-[1.5]" style={{ color: theme.editorFg }}>{compiled}</pre>
        )}
      </div>
    </div>
  );
}

/* ---------- main shell ---------- */
export default function Sandbox() {
  const [files, setFiles] = useState(initialFiles);
  const [expanded, setExpanded] = useState(new Set(["scenes"]));
  const [openTabs, setOpenTabs] = useState([["scenes", "munich.dra"]]);
  const [activeTab, setActiveTab] = useState("scenes/munich.dra");
  const [dirty, setDirty] = useState(new Set());
  const [cursor, setCursor] = useState({ ln: 1, col: 1 });

  const [srcDoc, setSrcDoc] = useState("");
  const [compiled, setCompiled] = useState("");
  const [logs, setLogs] = useState([]);
  const [runKey, setRunKey] = useState(0);

  const run = useCallback(() => {
    const { html, code } = compileProject(files);
    setSrcDoc(html); setCompiled(code); setLogs([]); setRunKey((k) => k + 1);
  }, [files]);

  useEffect(() => { const t = setTimeout(run, 400); return () => clearTimeout(t); }, [files, run]);

  useEffect(() => {
    const handler = (e) => { if (e.data && e.data.__sandbox) setLogs((l) => [...l, { level: e.data.level, message: e.data.message }]); };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

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
  const [activity, setActivity] = useState("files");
  const [sidebar, setSidebar] = useState(true);

  return (
    <div className="flex h-[680px] w-full flex-col overflow-hidden rounded-lg text-sm shadow-2xl"
      style={{ background: theme.editor, color: theme.editorFg, border: `1px solid ${theme.border}` }}>
      {/* title bar */}
      <div className="flex h-9 shrink-0 items-center justify-between px-3" style={{ background: theme.titlebar }}>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: "#ff5f56" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "#ffbd2e" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "#27c93f" }} />
        </div>
        <span className="text-xs" style={{ color: "#cccccc" }}>dendra — buhera-west</span>
        <div className="w-12" />
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
          <div className="flex min-w-0 flex-col" style={{ width: "52%" }}>
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

          <OutputColumn srcDoc={srcDoc} compiled={compiled} logs={logs} runKey={runKey} onRun={run} onClear={() => setLogs([])} />
        </div>
      </div>

      {/* status bar */}
      <div className="flex h-6 shrink-0 items-center justify-between px-3 text-[12px]" style={{ background: theme.statusBar, color: theme.statusFg }}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><GitBranch size={13} /> main</span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1"><X size={13} /> 0</span>
            <span className="flex items-center gap-1"><AlertCircle size={13} /> 0</span>
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
