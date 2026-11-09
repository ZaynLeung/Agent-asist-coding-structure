#!/usr/bin/env node
// knowledge-graph-viz · 目录标题图渲染器
// 读图 JSON → 生成自包含 HTML（inline CSS/JS/JSON，无外部依赖，file:// 直接可看）。
// 数据契约: knowledge/graph/schema.md §5.3
//
// 用法:
//   node .agents/skills/knowledge-graph-viz/scripts/render.mjs [--file <p>] [--out <p>] [--title <text>]
//
// 退出码: 0 成功 / 2 输入或校验错误 / 1 运行时异常

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ===== [CLI] 默认值与常量 =====
const DEFAULT_FILE = 'knowledge/graph/outline.graph.json';
const DEFAULT_OUT = 'knowledge/graph/outline.html';
const DEFAULT_TITLE = '知识库目录标题图';
const KINDS = ['topic', 'subtopic', 'entry', 'section'];
const EDGE_KINDS = ['belongs-to', 'related-to', 'see-also'];
const MAX_TITLE_LEN = 120; // schema §1：title ≤ 120 字符
const MAX_NOTE_LEN = 80; // schema §1：note ≤ 80 字符
const USAGE = [
  '用法: node .agents/skills/knowledge-graph-viz/scripts/render.mjs [--file <p>] [--out <p>] [--title <text>]',
  '',
  '  --file  图 JSON 路径，默认 ' + DEFAULT_FILE + '（相对仓库根；绝对路径原样使用）',
  '  --out   输出 HTML 路径，默认 ' + DEFAULT_OUT,
  '  --title 页面标题，默认「' + DEFAULT_TITLE + '」',
  '',
  '契约见 knowledge/graph/schema.md §5.3；stdout 只输出一个 JSON 对象，排错信息写 stderr。',
].join('\n');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const warnings = [];

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputError';
  }
}

class HelpRequested extends Error {
  constructor() {
    super('help');
    this.name = 'HelpRequested';
  }
}

// ===== [MAIN] 入口 =====
function main(argv) {
  try {
    const args = parseArgs(argv);
    const root = discoverRepoRoot(SCRIPT_DIR) || discoverRepoRoot(process.cwd());
    if (!root) {
      throw new InputError('找不到仓库根：脚本向上找不到同时包含 .agents/ 与 knowledge/ 的目录');
    }

    const filePath = resolveFromRoot(root, args.file || DEFAULT_FILE);
    const outPath = resolveFromRoot(root, args.out || DEFAULT_OUT);
    const title = normalizeTitle(args.title);

    const graph = loadGraph(filePath);
    const html = buildHtml(graph, title);

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');

    selfCheck(outPath, graph);

    flushWarnings();
    process.stdout.write(JSON.stringify(
      { ok: true, out: displayPath(root, outPath), nodes: graph.nodes.length, edges: graph.edges.length },
      null,
      2,
    ) + '\n');
    process.exitCode = 0;
  } catch (error) {
    flushWarnings();
    if (error instanceof HelpRequested) {
      process.stderr.write(USAGE + '\n');
      process.exitCode = 0;
      return;
    }
    const isInput = error instanceof InputError;
    const message = error && error.message ? error.message : String(error);
    process.stdout.write(JSON.stringify({ ok: false, errors: [message] }, null, 2) + '\n');
    process.stderr.write('error: ' + message + '\n');
    if (!isInput && error && error.stack) process.stderr.write(error.stack + '\n');
    process.exitCode = isInput ? 2 : 1;
  }
}

function flushWarnings() {
  for (const message of warnings) process.stderr.write('warning: ' + message + '\n');
  warnings.length = 0;
}

// ===== [DATA] 参数、仓库根、路径 =====
function parseArgs(argv) {
  const args = { file: null, out: null, title: null };
  const tokens = Array.from(argv);
  if (tokens[0] === 'render') tokens.shift(); // 容忍子命令写法

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--help' || token === '-h') throw new HelpRequested();

    let name = token;
    let value = null;
    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      if (eq > 0) {
        name = token.slice(0, eq);
        value = token.slice(eq + 1);
      }
    }

    if (name === '--file' || name === '--out' || name === '--title') {
      if (value === null) {
        index += 1;
        value = tokens[index];
      }
      if (value === undefined || value === '') throw new InputError(name + ' 缺少参数值\n' + USAGE);
      args[name.slice(2)] = value;
      continue;
    }

    throw new InputError('未知参数: ' + token + '\n' + USAGE);
  }
  return args;
}

function normalizeTitle(value) {
  if (value === null || value === undefined) return DEFAULT_TITLE;
  const title = String(value).trim();
  if (!title) throw new InputError('--title 不能为空');
  return title;
}

function discoverRepoRoot(startDir) {
  let dir = resolve(startDir);
  for (;;) {
    if (existsSync(join(dir, '.agents')) && existsSync(join(dir, 'knowledge'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function resolveFromRoot(root, target) {
  return isAbsolute(target) ? resolve(target) : resolve(root, target);
}

function displayPath(root, absolutePath) {
  const rel = relative(root, absolutePath);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return absolutePath;
  return rel.split(sep).join('/');
}

function loadGraph(filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new InputError('找不到图数据文件: ' + filePath
      + '（先用 knowledge-outline-extract 生成目录提案，再用 knowledge-graph-db ingest 入库）');
  }
  const text = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new InputError('图数据不是合法 JSON: ' + error.message);
  }
  return normalizeGraph(raw);
}

function normalizeGraph(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new InputError('图数据必须是 JSON 对象');
  }
  if (raw.version !== 1) {
    warnings.push('version 不是 1（实际 ' + JSON.stringify(raw.version) + '），按 v1 渲染');
  }
  if (!Array.isArray(raw.nodes)) throw new InputError('E010: nodes 缺失或不是数组');
  if (raw.edges !== undefined && !Array.isArray(raw.edges)) throw new InputError('E020: edges 存在但不是数组');
  const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];

  const nodes = [];
  const ids = new Set();
  raw.nodes.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      warnings.push('跳过非法节点 #' + index + '（不是对象）');
      return;
    }
    const id = normalizeId(item.id);
    if (!id) {
      warnings.push('跳过 id 非法的节点 #' + index + '（' + JSON.stringify(item.id) + '）');
      return;
    }
    if (ids.has(id)) {
      warnings.push('跳过重复 id 的节点: ' + id);
      return;
    }
    if (/\s/.test(id)) warnings.push('节点 id 含空格（不符合 schema §3）: ' + id);

    let kind = item.kind;
    if (!KINDS.includes(kind)) {
      warnings.push('节点 ' + id + ' 的 kind 非法（' + JSON.stringify(item.kind) + '），按 entry 渲染');
      kind = 'entry';
    }

    const path = typeof item.path === 'string' ? item.path.trim() : '';
    let title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) {
      title = fallbackTitle(id, path);
      warnings.push('节点 ' + id + ' 缺少 title，用「' + title + '」兜底');
    }
    if (!path) warnings.push('节点 ' + id + ' 缺少 path（tooltip 只能显示 id）');
    if (title.length > MAX_TITLE_LEN) {
      warnings.push('节点 ' + id + ' 的 title 超过 ' + MAX_TITLE_LEN + ' 字符，页面按宽度截断显示');
    }

    const node = { id, kind, title, path };
    if (typeof item.order === 'number' && Number.isFinite(item.order)) node.order = item.order;
    ids.add(id);
    nodes.push(node);
  });

  const edges = [];
  const relatedPairs = new Set();
  const belongsFrom = new Set();
  rawEdges.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      warnings.push('跳过非法边 #' + index + '（不是对象）');
      return;
    }
    const from = typeof item.from === 'string' ? item.from.trim() : '';
    const to = typeof item.to === 'string' ? item.to.trim() : '';
    if (!from || !to) {
      warnings.push('跳过缺少 from/to 的边 #' + index);
      return;
    }
    if (!ids.has(from) || (to !== 'root' && !ids.has(to))) {
      warnings.push('跳过端点不在节点集合中的边 #' + index + '（' + from + ' → ' + to + '）');
      return;
    }
    if (from === to) {
      warnings.push('跳过自环边 #' + index + '（' + from + '）');
      return;
    }
    let kind = item.kind;
    if (!EDGE_KINDS.includes(kind)) {
      warnings.push('边 #' + index + ' 的 kind 非法（' + JSON.stringify(item.kind) + '），按 belongs-to 处理');
      kind = 'belongs-to';
    }
    if (kind === 'belongs-to') {
      if (belongsFrom.has(from)) {
        warnings.push('节点 ' + from + ' 有多条 belongs-to，只保留第一条');
        return;
      }
      belongsFrom.add(from);
    }
    if (kind === 'related-to') {
      const pair = [from, to].sort().join('\u0000');
      if (relatedPairs.has(pair)) {
        warnings.push('重复的 related-to 边: ' + from + ' ↔ ' + to);
        return;
      }
      relatedPairs.add(pair);
    }

    const edge = { from, to, kind };
    if (typeof item.note === 'string' && item.note.trim()) {
      const note = item.note.trim();
      edge.note = note.length > MAX_NOTE_LEN ? note.slice(0, MAX_NOTE_LEN) : note;
      if (note.length > MAX_NOTE_LEN) {
        warnings.push('边 #' + index + ' 的 note 超过 ' + MAX_NOTE_LEN + ' 字符，已截断');
      }
    }
    edges.push(edge);
  });

  const root = typeof raw.root === 'string' && raw.root.trim() ? raw.root.trim() : 'knowledge';
  const graph = { version: 1, root, nodes, edges };
  if (typeof raw.generated_by === 'string' && raw.generated_by) graph.generated_by = raw.generated_by;
  return graph;
}

function normalizeId(value) {
  if (typeof value !== 'string') return '';
  const id = value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!id || id.includes('..')) return '';
  return id;
}

function fallbackTitle(id, path) {
  const source = path || id;
  const base = source.split(/[\\/]/).pop() || id;
  const title = base.replace(/\.md$/i, '').trim();
  return title || id;
}

// ===== [HTML] 生成自包含页面 =====
function buildHtml(graph, title) {
  const safeTitle = escapeHtml(title);
  const payload = serializeGraph(graph);
  const parts = [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="generator" content="knowledge-graph-viz/render.mjs" />',
    '<title>' + safeTitle + '</title>',
    '<style>',
    CSS,
    '</style>',
    '</head>',
    '<body>',
    '<header id="toolbar">',
    '<div class="brand">',
    '<h1 id="page-title">' + safeTitle + '</h1>',
    '<p id="meta">正在读取图数据…</p>',
    '</div>',
    '<label class="searchbox" for="search"><span>搜索标题</span>',
    '<input id="search" type="search" placeholder="输入标题关键字，即时过滤" autocomplete="off" spellcheck="false" />',
    '</label>',
    '<div id="legend" aria-label="图例"></div>',
    '<div class="actions">',
    '<button id="fit" type="button" title="缩放到全部可见节点">适应窗口</button>',
    '<button id="collapse-all" type="button" title="收起所有有子级的节点">全部收起</button>',
    '<button id="expand-all" type="button" title="展开所有节点">全部展开</button>',
    '</div>',
    '</header>',
    '<main id="stage">',
    '<svg id="graph" role="img" aria-label="知识库目录标题图"></svg>',
    '<div id="empty" hidden>',
    '<strong>图中还没有节点（Empty）</strong>',
    '<span>这份图数据是空的。先运行 knowledge-outline-extract 生成目录提案，再用 knowledge-graph-db ingest 入库，然后重新 render；也可以检查 --file 是否指向正确的图 JSON。</span>',
    '</div>',
    '<div id="no-match" hidden>',
    '<strong>没有匹配的标题</strong>',
    '<span id="no-match-text">换一个关键字试试，按 Esc 清空搜索。</span>',
    '</div>',
    '<div id="hint">拖拽平移 · 滚轮缩放 · 点击节点固定高亮 · 点节点右上角的 +/− 折叠子级</div>',
    '</main>',
    '<div id="tooltip" role="tooltip" hidden></div>',
    '<script id="graph-data" type="application/json">' + payload + '</script>',
    '<script id="graph-app">' + CLIENT_JS + '</script>',
    '</body>',
    '</html>',
    '',
  ];
  return parts.join('\n');
}

function serializeGraph(graph) {
  // `<` 必须转义，否则数据里的 </script> / <script 会提前闭合 script 标签。
  return JSON.stringify(graph)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== [CHECK] 生成后自检 =====
function selfCheck(outPath, graph) {
  if (!existsSync(outPath) || !statSync(outPath).isFile()) {
    throw new InputError('自检失败: 产物文件不存在: ' + outPath);
  }
  const html = readFileSync(outPath, 'utf8');

  const dataMatch = html.match(/<script id="graph-data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!dataMatch) {
    throw new InputError('自检失败: HTML 中缺少 <script id="graph-data" type="application/json">');
  }
  let parsed;
  try {
    parsed = JSON.parse(dataMatch[1]);
  } catch (error) {
    throw new InputError('自检失败: 内联 JSON 无法 JSON.parse: ' + error.message);
  }
  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new InputError('自检失败: 内联 JSON 的 nodes/edges 不是数组');
  }
  if (parsed.nodes.length !== graph.nodes.length || parsed.edges.length !== graph.edges.length) {
    throw new InputError('自检失败: 内联数据节点/边数量与图数据不一致');
  }

  const appMatch = html.match(/<script id="graph-app">([\s\S]*?)<\/script>/);
  if (!appMatch) throw new InputError('自检失败: HTML 中缺少内联渲染脚本');
  try {
    new Function(appMatch[1]); // 只编译不执行，用来兜住语法错误
  } catch (error) {
    throw new InputError('自检失败: 内联 JS 语法错误: ' + error.message);
  }
}

// ===== [HTML:CSS] 页面样式（无外链、无字体下载） =====
const CSS = `
:root {
  --bg: #f6f7fb;
  --panel: #ffffff;
  --ink: #1f2937;
  --muted: #64748b;
  --line: #e5e7eb;
  --accent: #2563eb;
  --label-font-size: 13px;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; height: 100%; }
body {
  font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif;
  color: var(--ink);
  background: var(--bg);
  overflow: hidden;
}
#toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 20px;
  padding: 10px 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  position: relative;
  z-index: 3;
}
.brand { min-width: 180px; margin-right: auto; }
.brand h1 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: 0.2px; }
.brand p { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
.searchbox { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.searchbox input {
  width: 240px;
  max-width: 60vw;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  color: var(--ink);
  background: #fff;
  outline: none;
}
.searchbox input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12); }
#legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 12px; color: var(--muted); }
.chip { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.edge-sample { width: 22px; height: 0; border-top: 2px solid #b8c4d4; display: inline-block; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; }
.actions button {
  font: inherit;
  font-size: 12px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
}
.actions button:hover { border-color: #cbd5e1; background: #f8fafc; }
#stage { position: relative; flex: 1; min-height: 0; overflow: hidden; }
body { display: flex; flex-direction: column; height: 100vh; }
#graph { width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
#graph.panning { cursor: grabbing; }
#empty, #no-match {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  text-align: center;
  color: var(--muted);
  background: radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.92), rgba(246, 247, 251, 0.97));
  z-index: 2;
}
#empty strong, #no-match strong { font-size: 15px; color: var(--ink); }
#empty span, #no-match span { font-size: 12.5px; max-width: 500px; line-height: 1.7; }
#hint {
  position: absolute;
  left: 14px;
  bottom: 12px;
  z-index: 2;
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  color: #94a3b8;
  font-size: 11.5px;
  pointer-events: none;
}
#tooltip {
  position: fixed;
  z-index: 9;
  max-width: 340px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #111827;
  color: #f8fafc;
  font-size: 12px;
  line-height: 1.55;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
  pointer-events: none;
}
#tooltip .t-title { font-weight: 600; font-size: 12.5px; word-break: break-word; }
#tooltip .t-path {
  margin-top: 3px;
  font-family: ui-monospace, Consolas, "Cascadia Code", monospace;
  font-size: 11px;
  color: #cbd5e1;
  word-break: break-all;
}
.node { cursor: pointer; }
.node-box { stroke-width: 1.4; transition: opacity 0.12s ease; }
.node-label {
  font-size: var(--label-font-size, 13px);
  fill: #1f2937;
  dominant-baseline: central;
  pointer-events: none;
  user-select: none;
}
.node.k-topic .node-label { font-weight: 600; }
.node.hl .node-box, .node.focus .node-box { stroke-width: 2.4; }
.node.focus .node-box { stroke-width: 2.8; filter: drop-shadow(0 2px 6px rgba(15, 23, 42, 0.18)); }
.node.match .node-box { filter: drop-shadow(0 0 6px rgba(37, 99, 235, 0.35)); }
.node.dim { opacity: 0.16; }
.node.dim .node-label { fill: #94a3b8; }
.fold { pointer-events: all; cursor: pointer; opacity: 0.85; }
.fold:hover { opacity: 1; }
.fold circle { fill: #fff; stroke: #94a3b8; stroke-width: 1; }
.fold text { font-size: 9px; fill: #64748b; text-anchor: middle; dominant-baseline: central; pointer-events: none; user-select: none; }
.edge { fill: none; stroke-linecap: round; stroke-width: 1.5; opacity: 0.9; }
.edge.belongs-to { stroke-width: 1.4; }
.edge.related-to, .edge.see-also { stroke-width: 1.6; }
.edge.dim { opacity: 0.1; }
.edge.hl { stroke-width: 2.6; opacity: 1; }
.edge-note {
  font-size: 10.5px;
  fill: #64748b;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 3px;
  stroke-linejoin: round;
  pointer-events: none;
  user-select: none;
}
#graph.zoomed-out .edge-note { display: none; }
`;

// ===== [HTML:CLIENT] 内联渲染脚本（纯 ES5 风格，无外部依赖） =====
const CLIENT_JS = String.raw`(function () {
  'use strict';

  /* ===== [CLIENT:CFG] 视觉与布局参数（定制优先改这里） ===== */
  var CFG = {
    nodeHeight: 32,
    topicHeight: 40,
    rowGap: 12,
    columnGap: 96,
    minNodeWidth: 96,
    maxNodeWidth: 260,
    labelPadding: 26,
    fontSize: 13,
    fitPadding: 56,
    maxFitScale: 1.4,
    minScale: 0.1,
    maxScale: 3,
    wheelStep: 1.12,
    autoCollapseAt: 600,
    defaultQuery: ''
  };

  /* ===== [CLIENT:COLORS] 节点 kind 与边 kind 的配色/线型 ===== */
  var KIND_COLORS = { topic: '#2f6fed', subtopic: '#0e9384', entry: '#d97706', section: '#7c3aed' };
  var KIND_LABELS = { topic: '主题', subtopic: '子目录', entry: '条目', section: '小节' };
  var KIND_RANK = { topic: 1, subtopic: 2, entry: 3, section: 4 };
  var EDGE_STYLES = {
    'belongs-to': { color: '#b8c4d4', dash: '', label: '隶属' },
    'related-to': { color: '#f59e0b', dash: '6 5', label: '相关' },
    'see-also': { color: '#8b5cf6', dash: '2 4', label: '参见' }
  };
  var EDGE_KINDS = ['belongs-to', 'related-to', 'see-also'];
  var NODE_KINDS = ['topic', 'subtopic', 'entry', 'section'];
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var DATA = {};
  try {
    DATA = JSON.parse(document.getElementById('graph-data').textContent || '{}');
  } catch (parseError) {
    DATA = {};
  }
  var ALL_NODES = Array.isArray(DATA.nodes) ? DATA.nodes : [];
  var ALL_EDGES = Array.isArray(DATA.edges) ? DATA.edges : [];

  var byId = Object.create(null);
  var children = Object.create(null);
  var parentOf = Object.create(null);
  var depthOf = Object.create(null);
  var adjacency = Object.create(null);
  var visible = Object.create(null);
  var positions = Object.create(null);
  var collapsed = Object.create(null);
  var edgeRecords = [];
  var els = { node: Object.create(null), edge: [] };
  var bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  var state = { query: '', hovered: null, pinned: null, tx: 0, ty: 0, scale: 1, dragged: false };
  var autoCollapsed = false;
  var measureCtx = null;
  var viewportEl = null;

  var stageEl = document.getElementById('stage');
  var svgEl = document.getElementById('graph');
  var tooltipEl = document.getElementById('tooltip');
  var searchEl = document.getElementById('search');
  var metaEl = document.getElementById('meta');
  var emptyEl = document.getElementById('empty');
  var noMatchEl = document.getElementById('no-match');
  var noMatchTextEl = document.getElementById('no-match-text');
  var legendEl = document.getElementById('legend');

  /* ===== [CLIENT:LAYOUT] 数据结构、过滤与分层布局 ===== */
  function prepare() {
    var i;
    for (i = 0; i < ALL_NODES.length; i += 1) byId[ALL_NODES[i].id] = ALL_NODES[i];

    for (i = 0; i < ALL_EDGES.length; i += 1) {
      var edge = ALL_EDGES[i];
      var record = { id: 'e' + i, from: edge.from, to: edge.to, kind: edge.kind, note: edge.note || '' };
      edgeRecords.push(record);
      (adjacency[record.from] = adjacency[record.from] || []).push(record);
      (adjacency[record.to] = adjacency[record.to] || []).push(record);
      if (edge.kind === 'belongs-to' && edge.to !== 'root' && byId[edge.to] && !parentOf[edge.from]) {
        parentOf[edge.from] = edge.to;
        (children[edge.to] = children[edge.to] || []).push(edge.from);
      }
    }

    depthOf.root = 0;
    var queue = ['root'];
    var visited = Object.create(null);
    visited.root = true;
    var head = 0;
    while (head < queue.length) {
      var current = queue[head];
      head += 1;
      var kids = children[current] || [];
      for (i = 0; i < kids.length; i += 1) {
        if (visited[kids[i]]) continue;
        visited[kids[i]] = true;
        depthOf[kids[i]] = (depthOf[current] || 0) + 1;
        queue.push(kids[i]);
      }
    }
    for (i = 0; i < ALL_NODES.length; i += 1) {
      var node = ALL_NODES[i];
      if (typeof depthOf[node.id] !== 'number') depthOf[node.id] = KIND_RANK[node.kind] || 3;
      adjacency[node.id] = adjacency[node.id] || [];
    }
  }

  function compareNodes(a, b) {
    var nodeA = byId[a];
    var nodeB = byId[b];
    var orderA = typeof nodeA.order === 'number' ? nodeA.order : Number.MAX_SAFE_INTEGER;
    var orderB = typeof nodeB.order === 'number' ? nodeB.order : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    var titleA = String(nodeA.title || '');
    var titleB = String(nodeB.title || '');
    var byTitle = titleA.localeCompare(titleB, 'zh-Hans-CN');
    if (byTitle !== 0) return byTitle;
    return a < b ? -1 : (a > b ? 1 : 0);
  }

  function sortChildren() {
    var key;
    for (key in children) {
      if (!Object.prototype.hasOwnProperty.call(children, key)) continue;
      children[key].sort(compareNodes);
    }
  }

  function initCollapse() {
    if (ALL_NODES.length <= CFG.autoCollapseAt) return;
    for (var i = 0; i < ALL_NODES.length; i += 1) {
      var node = ALL_NODES[i];
      if (node.kind === 'topic' && (children[node.id] || []).length) {
        collapsed[node.id] = true;
        autoCollapsed = true;
      }
    }
  }

  function descendantsHidden(id, sink) {
    var kids = children[id] || [];
    for (var i = 0; i < kids.length; i += 1) {
      if (sink[kids[i]]) continue;
      sink[kids[i]] = true;
      descendantsHidden(kids[i], sink);
    }
  }

  function computeVisible() {
    visible = Object.create(null);
    var i;
    var matched = [];
    if (!state.query) {
      for (i = 0; i < ALL_NODES.length; i += 1) visible[ALL_NODES[i].id] = true;
    } else {
      for (i = 0; i < ALL_NODES.length; i += 1) {
        var node = ALL_NODES[i];
        if (String(node.title || '').toLowerCase().indexOf(state.query) >= 0) {
          visible[node.id] = true;
          matched.push(node.id);
        }
      }
      for (i = 0; i < matched.length; i += 1) {
        var parent = parentOf[matched[i]];
        var guard = 0;
        while (parent && parent !== 'root' && guard < 64) {
          visible[parent] = true;
          parent = parentOf[parent];
          guard += 1;
        }
      }
    }
    if (!state.query) {
      var hidden = Object.create(null);
      var key;
      for (key in collapsed) {
        if (!collapsed[key] || !visible[key]) continue;
        descendantsHidden(key, hidden);
      }
      for (key in hidden) delete visible[key];
    }
    return matched.length;
  }

  function visibleChildren(id) {
    var list = children[id] || [];
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      if (visible[list[i]]) out.push(list[i]);
    }
    return out;
  }

  function initMeasure() {
    var canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
    measureCtx.font = CFG.fontSize + 'px "Segoe UI","Microsoft YaHei","PingFang SC",sans-serif';
  }

  function textWidth(text) {
    if (!measureCtx) return String(text).length * CFG.fontSize;
    return measureCtx.measureText(String(text)).width;
  }

  function fitTitle(node) {
    var full = String(node.title || node.id || '');
    var maxText = CFG.maxNodeWidth - CFG.labelPadding * 2;
    if (textWidth(full) <= maxText) return full;
    var low = 1;
    var high = full.length - 1;
    while (low < high) {
      var mid = Math.ceil((low + high) / 2);
      if (textWidth(full.slice(0, mid) + '…') <= maxText) low = mid;
      else high = mid - 1;
    }
    return full.slice(0, low) + '…';
  }

  function nodeWidth(label) {
    var width = textWidth(label) + CFG.labelPadding * 2;
    if (width < CFG.minNodeWidth) width = CFG.minNodeWidth;
    if (width > CFG.maxNodeWidth) width = CFG.maxNodeWidth;
    return width;
  }

  function layout() {
    positions = Object.create(null);
    var i;
    var roots = [];
    for (i = 0; i < ALL_NODES.length; i += 1) {
      var node = ALL_NODES[i];
      if (!visible[node.id]) continue;
      var parent = parentOf[node.id];
      if (!parent || parent === 'root' || !visible[parent]) roots.push(node.id);
    }
    roots.sort(compareNodes);

    var cursorY = 0;
    var placed = Object.create(null);

    function place(id) {
      if (placed[id]) return;
      placed[id] = true;
      var current = byId[id];
      var height = current.kind === 'topic' ? CFG.topicHeight : CFG.nodeHeight;
      var info = { height: height, depth: depthOf[id], label: fitTitle(current) };
      info.width = nodeWidth(info.label);
      positions[id] = info;
      var kids = visibleChildren(id);
      if (!kids.length) {
        info.y = cursorY + height / 2;
        cursorY += height + CFG.rowGap;
        return;
      }
      var sum = 0;
      for (var k = 0; k < kids.length; k += 1) {
        place(kids[k]);
        sum += positions[kids[k]].y;
      }
      info.y = sum / kids.length;
    }

    for (i = 0; i < roots.length; i += 1) place(roots[i]);
    for (i = 0; i < ALL_NODES.length; i += 1) {
      if (visible[ALL_NODES[i].id] && !positions[ALL_NODES[i].id]) place(ALL_NODES[i].id);
    }

    var widthByDepth = Object.create(null);
    for (i = 0; i < ALL_NODES.length; i += 1) {
      var item = ALL_NODES[i];
      if (!visible[item.id]) continue;
      var position = positions[item.id];
      if (!widthByDepth[position.depth] || widthByDepth[position.depth] < position.width) {
        widthByDepth[position.depth] = position.width;
      }
    }
    var depthKeys = Object.keys(widthByDepth).map(Number).sort(function (a, b) { return a - b; });
    var xByDepth = Object.create(null);
    var xCursor = 0;
    for (i = 0; i < depthKeys.length; i += 1) {
      var depth = depthKeys[i];
      xByDepth[depth] = xCursor + widthByDepth[depth] / 2;
      xCursor += widthByDepth[depth] + CFG.columnGap;
    }

    var minY = Infinity;
    for (i = 0; i < ALL_NODES.length; i += 1) {
      var entry = ALL_NODES[i];
      if (!visible[entry.id]) continue;
      var geometry = positions[entry.id];
      geometry.x = xByDepth[geometry.depth];
      if (geometry.y < minY) minY = geometry.y;
    }
    if (minY === Infinity) {
      bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
      return;
    }

    var shift = CFG.fitPadding - minY;
    var minX = Infinity;
    var maxX = -Infinity;
    var top = Infinity;
    var bottom = -Infinity;
    for (i = 0; i < ALL_NODES.length; i += 1) {
      var current2 = ALL_NODES[i];
      if (!visible[current2.id]) continue;
      var box = positions[current2.id];
      box.y += shift;
      var left = box.x - box.width / 2;
      var right = box.x + box.width / 2;
      var boxTop = box.y - box.height / 2;
      var boxBottom = box.y + box.height / 2;
      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (boxTop < top) top = boxTop;
      if (boxBottom > bottom) bottom = boxBottom;
    }
    bounds = { minX: minX, minY: top, maxX: maxX, maxY: bottom, width: maxX - minX, height: bottom - top };
  }

  /* ===== [CLIENT:RENDER] 画 SVG ===== */
  function makeSvg(tag, attrs, text) {
    var element = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (var key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) element.setAttribute(key, attrs[key]);
      }
    }
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function tint(hex, alpha) {
    var value = String(hex).replace('#', '');
    if (value.length === 3) value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    var red = parseInt(value.slice(0, 2), 16);
    var green = parseInt(value.slice(2, 4), 16);
    var blue = parseInt(value.slice(4, 6), 16);
    return 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')';
  }

  function shortNote(note) {
    var text = String(note);
    return text.length > 40 ? text.slice(0, 40) + '…' : text;
  }

  function edgeGeometry(record, fromPos, toPos) {
    if (record.kind === 'belongs-to') {
      var startX = fromPos.x + fromPos.width / 2;
      var endX = toPos.x - toPos.width / 2;
      var mid = (startX + endX) / 2;
      return {
        d: 'M' + startX + ' ' + fromPos.y + ' C' + mid + ' ' + fromPos.y + ' ' + mid + ' ' + toPos.y + ' ' + endX + ' ' + toPos.y,
        labelX: mid,
        labelY: (fromPos.y + toPos.y) / 2
      };
    }
    var controlX = (fromPos.x + toPos.x) / 2;
    var controlY = (fromPos.y + toPos.y) / 2 - 14;
    return {
      d: 'M' + fromPos.x + ' ' + fromPos.y + ' Q' + controlX + ' ' + controlY + ' ' + toPos.x + ' ' + toPos.y,
      labelX: 0.25 * fromPos.x + 0.5 * controlX + 0.25 * toPos.x,
      labelY: 0.25 * fromPos.y + 0.5 * controlY + 0.25 * toPos.y
    };
  }

  function render() {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    els = { node: Object.create(null), edge: [] };
    viewportEl = null;

    var ids = [];
    var i;
    for (i = 0; i < ALL_NODES.length; i += 1) {
      if (visible[ALL_NODES[i].id]) ids.push(ALL_NODES[i].id);
    }
    if (!ids.length) return;

    viewportEl = makeSvg('g', { id: 'viewport' });
    svgEl.appendChild(viewportEl);
    var edgeLayer = makeSvg('g', { id: 'edge-layer' });
    var nodeLayer = makeSvg('g', { id: 'node-layer' });
    viewportEl.appendChild(edgeLayer);
    viewportEl.appendChild(nodeLayer);

    for (i = 0; i < edgeRecords.length; i += 1) {
      var record = edgeRecords[i];
      var fromPos = positions[record.from];
      var toPos = positions[record.to];
      if (!fromPos || !toPos) continue;
      var style = EDGE_STYLES[record.kind] || EDGE_STYLES['belongs-to'];
      var geometry = edgeGeometry(record, fromPos, toPos);
      var path = makeSvg('path', { 'class': 'edge ' + record.kind, d: geometry.d, stroke: style.color });
      if (style.dash) path.setAttribute('stroke-dasharray', style.dash);
      edgeLayer.appendChild(path);
      els.edge.push({ id: record.id, el: path });
      if (record.kind !== 'belongs-to' && record.note) {
        edgeLayer.appendChild(makeSvg('text', {
          'class': 'edge-note',
          x: geometry.labelX,
          y: geometry.labelY,
          'text-anchor': 'middle'
        }, shortNote(record.note)));
      }
    }

    for (i = 0; i < ids.length; i += 1) {
      var id = ids[i];
      var node = byId[id];
      var pos = positions[id];
      var color = KIND_COLORS[node.kind] || '#64748b';
      var classes = 'node k-' + node.kind;
      if (state.query && String(node.title || '').toLowerCase().indexOf(state.query) >= 0) {
        classes += ' match';
      }
      var group = makeSvg('g', { 'class': classes, 'data-id': id, transform: 'translate(' + pos.x + ' ' + pos.y + ')' });
      group.appendChild(makeSvg('rect', {
        'class': 'node-box',
        x: -pos.width / 2,
        y: -pos.height / 2,
        width: pos.width,
        height: pos.height,
        rx: node.kind === 'topic' ? 10 : 8,
        ry: node.kind === 'topic' ? 10 : 8,
        fill: tint(color, node.kind === 'topic' ? 0.16 : 0.09),
        stroke: color
      }));
      group.appendChild(makeSvg('text', { 'class': 'node-label', 'text-anchor': 'middle', x: 0, y: 0 }, pos.label));
      if (!state.query && (children[id] || []).length) {
        var badge = makeSvg('g', {
          'class': 'fold',
          transform: 'translate(' + (pos.width / 2 - 1) + ' ' + (-pos.height / 2 + 1) + ')'
        });
        badge.appendChild(makeSvg('circle', { r: 7 }));
        badge.appendChild(makeSvg('text', { x: 0, y: 0 }, collapsed[id] ? '+' : '-'));
        group.appendChild(badge);
        bindFold(badge, id);
      }
      bindNode(group, id);
      nodeLayer.appendChild(group);
      els.node[id] = group;
    }
  }

  /* ===== [CLIENT:INTERACT] 高亮、tooltip、搜索、折叠、平移缩放 ===== */
  function applyHighlight() {
    var focus = state.hovered || state.pinned;
    var activeNodes = Object.create(null);
    var activeEdges = Object.create(null);
    var key;
    var i;
    if (focus && byId[focus]) {
      activeNodes[focus] = true;
      var list = adjacency[focus] || [];
      for (i = 0; i < list.length; i += 1) {
        activeEdges[list[i].id] = true;
        activeNodes[list[i].from] = true;
        activeNodes[list[i].to] = true;
      }
    }
    for (key in els.node) {
      var nodeEl = els.node[key];
      var on = !focus || !!activeNodes[key];
      nodeEl.classList.toggle('dim', !!focus && !on);
      nodeEl.classList.toggle('hl', !!focus && on && key !== focus);
      nodeEl.classList.toggle('focus', key === focus);
    }
    for (i = 0; i < els.edge.length; i += 1) {
      var item = els.edge[i];
      var onEdge = !focus || !!activeEdges[item.id];
      item.el.classList.toggle('dim', !!focus && !onEdge);
      item.el.classList.toggle('hl', !!focus && onEdge);
    }
  }

  function showTooltip(node, event) {
    tooltipEl.textContent = '';
    var title = document.createElement('div');
    title.className = 't-title';
    title.textContent = String(node.title || node.id || '');
    var path = document.createElement('div');
    path.className = 't-path';
    path.textContent = String(node.path || node.id || '');
    tooltipEl.appendChild(title);
    tooltipEl.appendChild(path);
    tooltipEl.hidden = false;
    positionTooltip(event);
  }

  function positionTooltip(event) {
    if (tooltipEl.hidden) return;
    var pad = 14;
    var rect = tooltipEl.getBoundingClientRect();
    var left = event.clientX + pad;
    var top = event.clientY + pad;
    if (left + rect.width > window.innerWidth - 8) left = event.clientX - rect.width - pad;
    if (top + rect.height > window.innerHeight - 8) top = event.clientY - rect.height - pad;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
  }

  function hideTooltip() {
    tooltipEl.hidden = true;
  }

  function bindNode(group, id) {
    group.addEventListener('mouseenter', function (event) {
      state.hovered = id;
      applyHighlight();
      showTooltip(byId[id], event);
    });
    group.addEventListener('mousemove', function (event) {
      positionTooltip(event);
    });
    group.addEventListener('mouseleave', function () {
      state.hovered = null;
      applyHighlight();
      hideTooltip();
    });
    group.addEventListener('click', function (event) {
      event.stopPropagation();
      if (state.dragged) return;
      state.pinned = state.pinned === id ? null : id;
      applyHighlight();
    });
  }

  function bindFold(badge, id) {
    badge.addEventListener('pointerdown', function (event) {
      event.stopPropagation();
    });
    badge.addEventListener('click', function (event) {
      event.stopPropagation();
      if (state.dragged) return;
      if (collapsed[id]) delete collapsed[id];
      else collapsed[id] = true;
      refresh();
    });
  }

  function applyTransform() {
    if (!viewportEl) return;
    viewportEl.setAttribute('transform', 'translate(' + state.tx + ' ' + state.ty + ') scale(' + state.scale + ')');
    if (state.scale < 0.7) svgEl.classList.add('zoomed-out');
    else svgEl.classList.remove('zoomed-out');
  }

  function zoomAt(mx, my, factor) {
    var next = state.scale * factor;
    if (next < CFG.minScale) next = CFG.minScale;
    if (next > CFG.maxScale) next = CFG.maxScale;
    var ratio = next / state.scale;
    state.tx = mx - (mx - state.tx) * ratio;
    state.ty = my - (my - state.ty) * ratio;
    state.scale = next;
    applyTransform();
  }

  function fitView() {
    if (!viewportEl || !bounds.width || !bounds.height) return;
    var width = stageEl.clientWidth || 800;
    var height = stageEl.clientHeight || 600;
    var scale = Math.min(
      (width - CFG.fitPadding * 2) / bounds.width,
      (height - CFG.fitPadding * 2) / bounds.height,
      CFG.maxFitScale
    );
    if (!isFinite(scale) || scale <= 0) scale = 1;
    if (scale < CFG.minScale) scale = CFG.minScale;
    state.scale = scale;
    state.tx = width / 2 - (bounds.minX + bounds.width / 2) * scale;
    state.ty = height / 2 - (bounds.minY + bounds.height / 2) * scale;
    applyTransform();
  }

  function bindPanZoom() {
    var dragging = false;
    var moved = false;
    var startX = 0;
    var startY = 0;
    var baseX = 0;
    var baseY = 0;

    svgEl.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      if (event.target && event.target.closest && event.target.closest('.fold')) return;
      dragging = true;
      moved = false;
      state.dragged = false;
      startX = event.clientX;
      startY = event.clientY;
      baseX = state.tx;
      baseY = state.ty;
      svgEl.classList.add('panning');
      if (svgEl.setPointerCapture) {
        try {
          svgEl.setPointerCapture(event.pointerId);
        } catch (ignore) {
          /* 某些环境不支持 pointer capture，忽略 */
        }
      }
    });

    svgEl.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        moved = true;
        state.dragged = true;
      }
      state.tx = baseX + dx;
      state.ty = baseY + dy;
      applyTransform();
    });

    svgEl.addEventListener('pointerup', function (event) {
      if (!dragging) return;
      dragging = false;
      svgEl.classList.remove('panning');
      if (!moved && !(event.target && event.target.closest && event.target.closest('.node'))) {
        state.pinned = null;
        applyHighlight();
      }
      window.setTimeout(function () {
        state.dragged = false;
      }, 0);
    });

    svgEl.addEventListener('pointercancel', function () {
      dragging = false;
      svgEl.classList.remove('panning');
      state.dragged = false;
    });

    svgEl.addEventListener('wheel', function (event) {
      event.preventDefault();
      if (!viewportEl) return;
      var rect = svgEl.getBoundingClientRect();
      var mx = event.clientX - rect.left;
      var my = event.clientY - rect.top;
      var factor = event.deltaY > 0 ? 1 / CFG.wheelStep : CFG.wheelStep;
      zoomAt(mx, my, factor);
    }, { passive: false });

    svgEl.addEventListener('dblclick', function () {
      state.pinned = null;
      state.hovered = null;
      applyHighlight();
      fitView();
    });
  }

  function updateOverlays() {
    var isEmpty = ALL_NODES.length === 0;
    emptyEl.hidden = !isEmpty;
    var noMatch = !isEmpty && state.query !== '' && Object.keys(visible).length === 0;
    noMatchEl.hidden = !noMatch;
    if (noMatch) {
      noMatchTextEl.textContent = '没有标题包含「' + searchEl.value.trim() + '」。按 Esc 清空搜索，或换一个关键字。';
    }
    svgEl.style.display = isEmpty ? 'none' : '';
  }

  function updateChrome(matched) {
    var total = ALL_NODES.length;
    var edgeTotal = ALL_EDGES.length;
    var visibleCount = Object.keys(visible).length;
    if (total === 0) {
      metaEl.textContent = '0 个标题节点 · 0 条关系边 · 空图（Empty）';
      return;
    }
    if (state.query) {
      metaEl.textContent = '匹配 ' + matched + ' 个标题，显示 ' + visibleCount + ' 个节点 · ' + edgeTotal + ' 条边';
      return;
    }
    var suffix = autoCollapsed ? ' · 节点较多，已默认收起主题' : '';
    metaEl.textContent = total + ' 个标题节点 · ' + edgeTotal + ' 条关系边' + suffix;
  }

  function buildLegend() {
    var kindCounts = Object.create(null);
    var edgeCounts = Object.create(null);
    var i;
    for (i = 0; i < ALL_NODES.length; i += 1) {
      var kind = ALL_NODES[i].kind;
      kindCounts[kind] = (kindCounts[kind] || 0) + 1;
    }
    for (i = 0; i < ALL_EDGES.length; i += 1) {
      var edgeKind = ALL_EDGES[i].kind;
      edgeCounts[edgeKind] = (edgeCounts[edgeKind] || 0) + 1;
    }
    while (legendEl.firstChild) legendEl.removeChild(legendEl.firstChild);
    for (i = 0; i < NODE_KINDS.length; i += 1) {
      var nodeKind = NODE_KINDS[i];
      var chip = document.createElement('span');
      chip.className = 'chip';
      var dot = document.createElement('i');
      dot.className = 'dot';
      dot.style.background = KIND_COLORS[nodeKind];
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode(KIND_LABELS[nodeKind] + ' ' + (kindCounts[nodeKind] || 0)));
      legendEl.appendChild(chip);
    }
    for (i = 0; i < EDGE_KINDS.length; i += 1) {
      var currentKind = EDGE_KINDS[i];
      var style = EDGE_STYLES[currentKind];
      var edgeChip = document.createElement('span');
      edgeChip.className = 'chip';
      var sample = document.createElement('i');
      sample.className = 'edge-sample';
      sample.style.borderTopColor = style.color;
      if (style.dash) sample.style.borderTopStyle = 'dashed';
      edgeChip.appendChild(sample);
      edgeChip.appendChild(document.createTextNode(style.label + ' ' + (edgeCounts[currentKind] || 0)));
      legendEl.appendChild(edgeChip);
    }
  }

  function refresh() {
    var matched = computeVisible();
    if (state.pinned && !visible[state.pinned]) state.pinned = null;
    if (state.hovered && !visible[state.hovered]) {
      state.hovered = null;
      hideTooltip();
    }
    layout();
    render();
    updateOverlays();
    updateChrome(matched);
    fitView();
    applyHighlight();
  }

  function collapseAll() {
    collapsed = Object.create(null);
    for (var i = 0; i < ALL_NODES.length; i += 1) {
      if ((children[ALL_NODES[i].id] || []).length) collapsed[ALL_NODES[i].id] = true;
    }
    if (state.query) {
      state.query = '';
      searchEl.value = '';
    }
    refresh();
  }

  function expandAll() {
    collapsed = Object.create(null);
    refresh();
  }

  function init() {
    document.documentElement.style.setProperty('--label-font-size', CFG.fontSize + 'px');
    initMeasure();
    prepare();
    sortChildren();
    initCollapse();
    buildLegend();
    bindPanZoom();

    if (CFG.defaultQuery) {
      searchEl.value = CFG.defaultQuery;
      state.query = String(CFG.defaultQuery).toLowerCase();
    }

    var timer = null;
    searchEl.addEventListener('input', function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        state.query = String(searchEl.value || '').trim().toLowerCase();
        refresh();
      }, 120);
    });
    searchEl.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        searchEl.value = '';
        state.query = '';
        refresh();
      }
    });

    document.getElementById('fit').addEventListener('click', fitView);
    document.getElementById('collapse-all').addEventListener('click', collapseAll);
    document.getElementById('expand-all').addEventListener('click', expandAll);

    window.addEventListener('resize', function () {
      fitView();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      state.pinned = null;
      state.hovered = null;
      applyHighlight();
      hideTooltip();
    });

    refresh();
  }

  init();
})();`;

// 供 ESLint/阅读时确认页面脚本里没有闭合标签残留（无外链、无 fetch）。
void CLIENT_JS;

// 入口放到文件末尾：CSS / CLIENT_JS 是 const，必须等它们初始化后再执行 main。
main(process.argv.slice(2));
