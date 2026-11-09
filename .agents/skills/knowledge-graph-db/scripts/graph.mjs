#!/usr/bin/env node
// knowledge-graph-db · 知识库目录标题图（knowledge/graph/outline.graph.json）数据管理 CLI。
// 契约唯一依据：knowledge/graph/schema.md（§3 数据结构、§4 校验码、§5.1 CLI）。
// 依赖：只用 node 内置模块（node:fs / node:path / node:url）。不依赖 cwd，也不依赖第三方包。
//
// 用法：
//   node .agents/skills/knowledge-graph-db/scripts/graph.mjs init [--file <p>] [--force]
//   node .agents/skills/knowledge-graph-db/scripts/graph.mjs validate [--file <p>]
//   node .agents/skills/knowledge-graph-db/scripts/graph.mjs ingest --input <p> [--file <p>] [--dry-run]
//   node .agents/skills/knowledge-graph-db/scripts/graph.mjs stats [--file <p>]
//   node .agents/skills/knowledge-graph-db/scripts/graph.mjs export [--file <p>] --out <p>
//
// 约定：stdout 只输出一个 JSON 对象（2 空格缩进、UTF-8、无 BOM），排错信息写 stderr。
// 退出码：0 成功 / 2 输入或校验错误 / 1 运行时异常。

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_GRAPH = 'knowledge/graph/outline.graph.json';
const NODE_KINDS = ['topic', 'subtopic', 'entry', 'section'];
const EDGE_KINDS = ['belongs-to', 'related-to', 'see-also'];
const MAX_TITLE_CHARS = 120;
const MAX_NOTE_CHARS = 80; // 契约建议值；§4 无对应校验码，脚本不因此阻断（见 references/db-workflows.md）
const MAX_NODES_WARN = 2000;
const EXIT_OK = 0;
const EXIT_RUNTIME = 1;
const EXIT_INPUT = 2;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = findRepoRoot();

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

class UsageError extends Error {}
class InputError extends Error {}
class RuntimeError extends Error {}

function isDir(target) {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

/** 从脚本所在目录向上查找同时含 .agents 与 knowledge 的仓库根；失败再从 cwd 向上找。 */
function findRepoRoot() {
  const starts = [SCRIPT_DIR];
  try {
    starts.push(process.cwd());
  } catch {
    /* cwd 不可用时忽略 */
  }
  for (const start of starts) {
    let dir = resolve(start);
    for (;;) {
      if (isDir(join(dir, '.agents')) && isDir(join(dir, 'knowledge'))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

/** 仓库根相对路径（posix 风格）；仓库外路径原样（统一正斜杠）。 */
function displayPath(absolutePath) {
  const rel = relative(REPO_ROOT, absolutePath);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return absolutePath.split(sep).join('/');
  return rel.split(sep).join('/');
}

/** 用户给的路径：绝对路径原样，相对路径按仓库根解析。 */
function resolveUserPath(rawPath) {
  return isAbsolute(rawPath) ? resolve(rawPath) : resolve(REPO_ROOT, rawPath);
}

function defaultGraphPath() {
  return resolveUserPath(DEFAULT_GRAPH);
}

function describeValue(value) {
  if (value === undefined) return 'undefined';
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text;
  } catch {
    return String(value);
  }
}

function serialize(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function emptyKinds() {
  return { topic: 0, subtopic: 0, entry: 0, section: 0 };
}

function emptyCounts() {
  return { nodes: 0, edges: 0, kinds: emptyKinds() };
}

function readTextFile(absolutePath, label) {
  let raw;
  try {
    raw = readFileSync(absolutePath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') throw new InputError(`${label}不存在: ${displayPath(absolutePath)}`);
    throw new RuntimeError(`${label}读取失败 ${displayPath(absolutePath)}: ${err?.code ?? err?.message ?? err}`);
  }
  return raw.replace(/^\uFEFF/, '');
}

function parseJsonText(text, absolutePath) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new InputError(`JSON 解析失败 ${displayPath(absolutePath)}: ${err.message}`);
  }
}

function readJsonFile(absolutePath, label) {
  const raw = readTextFile(absolutePath, label);
  return { data: parseJsonText(raw, absolutePath), raw };
}

function loadGraph(absolutePath) {
  if (!existsSync(absolutePath)) {
    throw new InputError(`图数据文件不存在: ${displayPath(absolutePath)}（先运行 init）`);
  }
  return readJsonFile(absolutePath, '图数据文件');
}

function writeTextFile(absolutePath, text) {
  const tmpPath = `${absolutePath}.tmp-${process.pid}`;
  try {
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(tmpPath, text, 'utf8');
    renameSync(tmpPath, absolutePath);
  } catch (err) {
    try {
      rmSync(tmpPath, { force: true });
    } catch {
      /* 清理临时文件失败不覆盖原始错误 */
    }
    throw new RuntimeError(`写入失败 ${displayPath(absolutePath)}: ${err?.code ?? err?.message ?? err}`);
  }
}

// ---------------------------------------------------------------------------
// 校验（knowledge/graph/schema.md §4）
// ---------------------------------------------------------------------------

function checkNodeId(id) {
  if (typeof id !== 'string' || id.length === 0) return '缺失或不是字符串';
  if (/[\s\\]/.test(id)) return '含空白或反斜杠';
  if (id.startsWith('/') || id.endsWith('/')) return '以 / 开头或结尾';
  if (id.includes('..')) return '含 ..';
  if (id.toLowerCase().endsWith('.md')) return '不应带 .md 后缀';
  return null;
}

function checkNodePath(nodePath) {
  if (typeof nodePath !== 'string' || nodePath.trim() === '') return '为空或不是字符串';
  const posix = nodePath.replace(/\\/g, '/').trim();
  if (isAbsolute(nodePath) || /^[A-Za-z]:/.test(posix) || posix.startsWith('/')) {
    return '不能是绝对路径';
  }
  if (posix.includes('..')) return '不能含 ..';
  if (!posix.toLowerCase().endsWith('.md')) return '必须是 .md 文件';
  if (!posix.startsWith('knowledge/')) return '必须位于 knowledge/ 下';
  return null;
}

function normalizeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/^\s*\d+\s*[-_.]?\s*/, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

function asciiWords(value) {
  return String(value).toLowerCase().match(/[a-z]{2,}/g) ?? [];
}

function nodeStem(filePath) {
  const base = filePath.split('/').pop() ?? '';
  return base.replace(/\.md$/i, '');
}

/** W001 用的“期望命名”：topic/subtopic 取目录名，entry 取文件名。 */
function expectedNameFor(node) {
  if (typeof node.title !== 'string' || typeof node.path !== 'string') return null;
  const posix = node.path.replace(/\\/g, '/');
  if (node.kind === 'topic' || node.kind === 'subtopic') {
    const parts = posix.split('/');
    if (parts[parts.length - 1].toLowerCase() === 'readme.md' && parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return nodeStem(posix);
  }
  if (node.kind === 'entry') return nodeStem(posix);
  return null;
}

/**
 * W001：title 与路径最后一段/目录名“明显不匹配”。
 * 判定刻意保守：只比较英文词，任一侧没有英文词（如中文标题对英文目录）时跳过，避免全库误报。
 */
function titleMismatch(node) {
  const expected = expectedNameFor(node);
  if (!expected) return null;
  const a = normalizeName(node.title);
  const b = normalizeName(expected);
  if (!a || !b) return null;
  if (a === b || a.includes(b) || b.includes(a)) return null;
  const titleWords = asciiWords(node.title);
  const expectedWords = asciiWords(expected);
  if (titleWords.length === 0 || expectedWords.length === 0) return null;
  if (titleWords.some((word) => expectedWords.includes(word))) return null;
  return `W001: title 与路径命名明显不一致: "${node.title}" ≈ "${expected}"（节点 ${node.id}）`;
}

/**
 * 校验图数据（也用于校验 ingest 输入）。纯函数，不写库。
 * @returns {{errors: string[], warnings: string[], nodes: any[], edges: any[], counts: object}}
 */
function validateGraph(data) {
  const errors = [];
  const warnings = [];
  const nodes = [];
  const edges = [];

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    errors.push(`E001: 顶层必须是 JSON 对象且 version 为 1（实际: ${describeValue(data)}）`);
    errors.push('E010: nodes 缺失或不是数组');
    return { errors, warnings, nodes, edges, counts: emptyCounts() };
  }

  if (data.version !== 1) errors.push(`E001: version 必须为 1（实际: ${describeValue(data.version)}）`);

  if (!Array.isArray(data.nodes)) {
    errors.push('E010: nodes 缺失或不是数组');
  } else {
    nodes.push(...data.nodes);
  }
  if (data.edges === undefined) {
    // 允许缺省，等价于空数组。
  } else if (!Array.isArray(data.edges)) {
    errors.push('E020: edges 存在但不是数组');
  } else {
    edges.push(...data.edges);
  }

  const ids = new Set();
  const kinds = emptyKinds();

  nodes.forEach((node, index) => {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      errors.push(`E011: nodes[${index}] 不是对象`);
      return;
    }
    const idProblem = checkNodeId(node.id);
    if (idProblem) {
      errors.push(`E011: nodes[${index}].id ${idProblem}: ${describeValue(node.id)}`);
    } else if (ids.has(node.id)) {
      errors.push(`E015: 节点 id 重复: ${node.id}`);
    } else {
      ids.add(node.id);
    }

    if (!NODE_KINDS.includes(node.kind)) {
      errors.push(`E012: nodes[${index}].kind 非法: ${describeValue(node.kind)}（允许 ${NODE_KINDS.join(' | ')}）`);
    } else {
      kinds[node.kind] += 1;
    }

    if (typeof node.title !== 'string' || node.title.trim() === '') {
      errors.push(`E013: nodes[${index}].title 为空或不是字符串`);
    } else if ([...node.title].length > MAX_TITLE_CHARS) {
      errors.push(`E013: nodes[${index}].title 超过 ${MAX_TITLE_CHARS} 字符（${[...node.title].length}）`);
    }

    const pathProblem = checkNodePath(node.path);
    if (pathProblem) errors.push(`E014: nodes[${index}].path ${pathProblem}: ${describeValue(node.path)}`);
  });

  edges.forEach((edge, index) => {
    if (edge === null || typeof edge !== 'object' || Array.isArray(edge)) {
      errors.push(`E021: edges[${index}] 不是对象或缺少 from/to`);
      return;
    }
    const fromOk = typeof edge.from === 'string' && edge.from.trim() !== '';
    const toOk = typeof edge.to === 'string' && edge.to.trim() !== '';
    if (!fromOk || !toOk) {
      errors.push(`E021: edges[${index}] 缺少 from 或 to: ${describeValue(edge)}`);
      return;
    }
    if (!ids.has(edge.from)) errors.push(`E022: edges[${index}].from 不在 nodes 中: ${edge.from}`);
    if (edge.to !== 'root' && !ids.has(edge.to)) {
      errors.push(`E022: edges[${index}].to 不在 nodes 中: ${edge.to}（只允许 root 作为虚拟根）`);
    }
    if (!EDGE_KINDS.includes(edge.kind)) {
      errors.push(`E023: edges[${index}].kind 非法: ${describeValue(edge.kind)}（允许 ${EDGE_KINDS.join(' | ')}）`);
    }
    if (edge.from === edge.to) errors.push(`E024: edges[${index}] 自环: ${edge.from}`);
    if (typeof edge.note === 'string' && [...edge.note].length > MAX_NOTE_CHARS) {
      // 契约有 ≤80 字符建议但 §4 未定义错误码：只进 stderr 提示，不进 warnings 以免污染错误码序列。
      process.stderr.write(
        `提示: edges[${index}].note 超过 ${MAX_NOTE_CHARS} 字符（${[...edge.note].length}），建议拆分关系短语\n`,
      );
    }
  });

  // W001：标题与文件名/目录名明显不匹配。
  nodes.forEach((node) => {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return;
    if (checkNodeId(node.id)) return;
    const warning = titleMismatch(node);
    if (warning) warnings.push(warning);
  });

  // W002：孤立节点（既不是 topic 也没有 belongs-to）。
  const belongsToFrom = new Set();
  edges.forEach((edge) => {
    if (edge && typeof edge === 'object' && edge.kind === 'belongs-to' && typeof edge.from === 'string') {
      belongsToFrom.add(edge.from);
    }
  });
  nodes.forEach((node) => {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return;
    if (checkNodeId(node.id)) return;
    if (node.kind !== 'topic' && !belongsToFrom.has(node.id)) {
      warnings.push(`W002: 孤立节点 ${node.id}（既不是 topic 也没有 belongs-to 边）`);
    }
  });

  // W003：同一对节点的 related-to 重复（方向不敏感）。
  const relatedPairs = new Set();
  edges.forEach((edge) => {
    if (!edge || typeof edge !== 'object' || edge.kind !== 'related-to') return;
    if (typeof edge.from !== 'string' || typeof edge.to !== 'string') return;
    const pair = [edge.from, edge.to].sort(cmp).join(' <> ');
    if (relatedPairs.has(pair)) {
      warnings.push(`W003: 同一对节点的 related-to 重复: ${pair}`);
    } else {
      relatedPairs.add(pair);
    }
  });

  // W004：节点数超过 2000，建议按主题分片。
  if (nodes.length > MAX_NODES_WARN) {
    warnings.push(`W004: 节点数 ${nodes.length} > ${MAX_NODES_WARN}，建议按主题分片`);
  }

  return { errors, warnings, nodes, edges, counts: { nodes: nodes.length, edges: edges.length, kinds } };
}

// ---------------------------------------------------------------------------
// 节点/边规范化与合并
// ---------------------------------------------------------------------------

function normalizeNode(node) {
  const result = {
    id: node.id,
    kind: node.kind,
    title: node.title,
    path: node.path,
  };
  if (typeof node.order === 'number' && Number.isFinite(node.order)) result.order = node.order;
  return result;
}

function normalizeEdge(edge) {
  const result = { from: edge.from, to: edge.to, kind: edge.kind };
  if (typeof edge.note === 'string' && edge.note.trim() !== '') result.note = edge.note;
  return result;
}

function edgeKey(edge) {
  return `${edge.from}\u0000${edge.to}\u0000${edge.kind}`;
}

function sortNodes(nodes) {
  return [...nodes].sort((a, b) => cmp(a.id, b.id));
}

function sortEdges(edges) {
  return [...edges].sort(
    (a, b) => cmp(a.from, b.from) || cmp(a.to, b.to) || cmp(a.kind, b.kind),
  );
}

// ---------------------------------------------------------------------------
// 子命令
// ---------------------------------------------------------------------------

function graphPathFrom(opts) {
  return opts.file === null ? defaultGraphPath() : resolveUserPath(opts.file);
}

function cmdInit(opts) {
  const absolutePath = graphPathFrom(opts);
  const existed = existsSync(absolutePath);
  if (existed && !opts.force) {
    return { output: { ok: true, created: false, file: displayPath(absolutePath) }, code: EXIT_OK };
  }
  writeTextFile(
    absolutePath,
    serialize({
      version: 1,
      root: 'knowledge',
      generated_by: 'knowledge-graph-db/init',
      nodes: [],
      edges: [],
    }),
  );
  return { output: { ok: true, created: true, file: displayPath(absolutePath) }, code: EXIT_OK };
}

function cmdValidate(opts) {
  const absolutePath = graphPathFrom(opts);
  try {
    const { data } = loadGraph(absolutePath);
    const result = validateGraph(data);
    return {
      output: {
        ok: result.errors.length === 0,
        errors: result.errors,
        warnings: result.warnings,
        counts: result.counts,
      },
      code: result.errors.length === 0 ? EXIT_OK : EXIT_INPUT,
    };
  } catch (err) {
    if (err instanceof InputError) {
      return {
        output: { ok: false, errors: [err.message], warnings: [], counts: emptyCounts() },
        code: EXIT_INPUT,
      };
    }
    throw err;
  }
}

function cmdIngest(opts) {
  const zeroResult = {
    ok: false,
    nodes_created: 0,
    nodes_updated: 0,
    nodes_skipped: 0,
    edges_created: 0,
    edges_skipped: 0,
    dry_run: Boolean(opts.dryRun),
    errors: [],
    warnings: [],
  };
  try {
    if (!opts.input) throw new InputError('ingest 需要 --input <抽取提案 JSON 路径>');
    const graphAbsolute = graphPathFrom(opts);
    const inputAbsolute = resolveUserPath(opts.input);

    const loaded = loadGraph(graphAbsolute);
    const storedCheck = validateGraph(loaded.data);
    if (storedCheck.errors.length > 0) {
      return {
        output: { ...zeroResult, errors: storedCheck.errors, warnings: storedCheck.warnings },
        code: EXIT_INPUT,
      };
    }
    if (!existsSync(inputAbsolute)) {
      throw new InputError(`输入文件不存在: ${displayPath(inputAbsolute)}`);
    }
    const inputFile = readJsonFile(inputAbsolute, '输入文件');
    const inputCheck = validateGraph(inputFile.data);
    if (inputCheck.errors.length > 0) {
      return {
        output: { ...zeroResult, errors: inputCheck.errors, warnings: inputCheck.warnings },
        code: EXIT_INPUT,
      };
    }

    const nodeById = new Map(storedCheck.nodes.map((node) => [node.id, normalizeNode(node)]));
    let nodesCreated = 0;
    let nodesUpdated = 0;
    let nodesSkipped = 0;
    const warnings = [...inputCheck.warnings];

    for (const rawNode of inputCheck.nodes) {
      const incoming = normalizeNode(rawNode);
      const current = nodeById.get(incoming.id);
      if (!current) {
        nodeById.set(incoming.id, incoming);
        nodesCreated += 1;
        continue;
      }
      const conflicts = [];
      if (current.title !== incoming.title) conflicts.push(`title 既有 "${current.title}" / 输入 "${incoming.title}"`);
      if (current.path !== incoming.path) conflicts.push(`path 既有 "${current.path}" / 输入 "${incoming.path}"`);
      if (conflicts.length > 0) {
        nodesSkipped += 1;
        warnings.push(`W005: 节点 ${incoming.id} 冲突（${conflicts.join('；')}），保留既有值`);
        continue;
      }
      const merged = { ...current, ...incoming };
      if (JSON.stringify(merged) === JSON.stringify(current)) {
        nodesSkipped += 1;
      } else {
        nodeById.set(incoming.id, merged);
        nodesUpdated += 1;
      }
    }

    const existingEdges = storedCheck.edges.map(normalizeEdge);
    const knownEdgeKeys = new Set(existingEdges.map(edgeKey));
    const addedEdges = [];
    let edgesCreated = 0;
    let edgesSkipped = 0;
    for (const rawEdge of inputCheck.edges) {
      const incoming = normalizeEdge(rawEdge);
      const key = edgeKey(incoming);
      if (knownEdgeKeys.has(key)) {
        edgesSkipped += 1;
        continue;
      }
      knownEdgeKeys.add(key);
      addedEdges.push(incoming);
      edgesCreated += 1;
    }

    if (!opts.dryRun && (nodesCreated + nodesUpdated + edgesCreated > 0)) {
      const stored = loaded.data;
      const nextGraph = {
        version: 1,
        root: typeof stored.root === 'string' && stored.root.trim() !== '' ? stored.root : 'knowledge',
        generated_by:
          typeof stored.generated_by === 'string' && stored.generated_by.trim() !== ''
            ? stored.generated_by
            : typeof inputFile.data.generated_by === 'string' && inputFile.data.generated_by.trim() !== ''
              ? inputFile.data.generated_by
              : 'knowledge-graph-db/ingest',
        nodes: sortNodes([...nodeById.values()]),
        edges: sortEdges([...existingEdges, ...addedEdges]),
      };
      writeTextFile(graphAbsolute, serialize(nextGraph));
    }

    return {
      output: {
        ok: true,
        nodes_created: nodesCreated,
        nodes_updated: nodesUpdated,
        nodes_skipped: nodesSkipped,
        edges_created: edgesCreated,
        edges_skipped: edgesSkipped,
        dry_run: Boolean(opts.dryRun),
        errors: [],
        warnings,
      },
      code: EXIT_OK,
    };
  } catch (err) {
    if (err instanceof InputError) {
      return { output: { ...zeroResult, errors: [err.message] }, code: EXIT_INPUT };
    }
    throw err;
  }
}

function cmdStats(opts) {
  const zeroResult = {
    ok: false,
    nodes: 0,
    edges: 0,
    kinds: emptyKinds(),
    top_degree: [],
    orphans: [],
    errors: [],
  };
  const absolutePath = graphPathFrom(opts);
  try {
    const { data } = loadGraph(absolutePath);
    const check = validateGraph(data);
    if (check.errors.length > 0) {
      return {
        output: { ...zeroResult, errors: check.errors, warnings: check.warnings },
        code: EXIT_INPUT,
      };
    }

    const nodes = check.nodes.map(normalizeNode);
    const edges = check.edges.map(normalizeEdge);
    const degree = new Map(nodes.map((node) => [node.id, 0]));
    for (const edge of edges) {
      if (degree.has(edge.from)) degree.set(edge.from, degree.get(edge.from) + 1);
      if (edge.to !== 'root' && degree.has(edge.to)) degree.set(edge.to, degree.get(edge.to) + 1);
    }
    const titleById = new Map(nodes.map((node) => [node.id, node.title]));
    const topDegree = [...degree.entries()]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))
      .slice(0, 5)
      .map(([id, value]) => ({ id, title: titleById.get(id), degree: value }));

    const belongsToFrom = new Set(
      edges.filter((edge) => edge.kind === 'belongs-to').map((edge) => edge.from),
    );
    const orphans = nodes
      .filter((node) => node.kind !== 'topic' && !belongsToFrom.has(node.id))
      .map((node) => node.id)
      .sort(cmp);

    return {
      output: {
        ok: true,
        nodes: nodes.length,
        edges: edges.length,
        kinds: check.counts.kinds,
        top_degree: topDegree,
        orphans,
      },
      code: EXIT_OK,
    };
  } catch (err) {
    if (err instanceof InputError) {
      return { output: { ...zeroResult, errors: [err.message] }, code: EXIT_INPUT };
    }
    throw err;
  }
}

function cmdExport(opts) {
  const absolutePath = graphPathFrom(opts);
  let outAbsolute = null;
  try {
    if (!opts.out) throw new InputError('export 需要 --out <输出路径>');
    outAbsolute = resolveUserPath(opts.out);
    const { data } = loadGraph(absolutePath);
    const check = validateGraph(data);
    if (check.errors.length > 0) {
      return {
        output: {
          ok: false,
          out: displayPath(outAbsolute),
          nodes: 0,
          edges: 0,
          errors: check.errors,
          warnings: check.warnings,
        },
        code: EXIT_INPUT,
      };
    }
    const exported = {
      version: 1,
      root: typeof data.root === 'string' && data.root.trim() !== '' ? data.root : 'knowledge',
      generated_by:
        typeof data.generated_by === 'string' && data.generated_by.trim() !== ''
          ? data.generated_by
          : 'knowledge-graph-db/export',
      nodes: sortNodes(check.nodes.map(normalizeNode)),
      edges: sortEdges(check.edges.map(normalizeEdge)),
    };
    writeTextFile(outAbsolute, serialize(exported));
    return {
      output: {
        ok: true,
        out: displayPath(outAbsolute),
        nodes: exported.nodes.length,
        edges: exported.edges.length,
      },
      code: EXIT_OK,
    };
  } catch (err) {
    if (err instanceof InputError) {
      return {
        output: { ok: false, out: outAbsolute ? displayPath(outAbsolute) : null, nodes: 0, edges: 0, errors: [err.message] },
        code: EXIT_INPUT,
      };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 入口与参数解析
// ---------------------------------------------------------------------------

const COMMANDS = {
  init: cmdInit,
  validate: cmdValidate,
  ingest: cmdIngest,
  stats: cmdStats,
  export: cmdExport,
};

const VALUE_FLAGS = { '--file': 'file', '--input': 'input', '--out': 'out' };
const BOOL_FLAGS = { '--dry-run': 'dryRun', '--force': 'force' };

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command, file: null, input: null, out: null, dryRun: false, force: false };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    let key = arg;
    let inlineValue;
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq > 0) {
        key = arg.slice(0, eq);
        inlineValue = arg.slice(eq + 1);
      }
    }
    if (Object.hasOwn(BOOL_FLAGS, key)) {
      if (inlineValue !== undefined) throw new UsageError(`参数 ${key} 不接受取值`);
      opts[BOOL_FLAGS[key]] = true;
      continue;
    }
    if (!Object.hasOwn(VALUE_FLAGS, key)) throw new UsageError(`未知参数: ${arg}`);
    let value = inlineValue;
    if (value === undefined) {
      index += 1;
      value = rest[index];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`参数 ${key} 缺少取值`);
    }
    if (value.trim() === '') throw new UsageError(`参数 ${key} 的取值为空`);
    opts[VALUE_FLAGS[key]] = value;
  }
  return opts;
}

function describeUsage() {
  return [
    'node .agents/skills/knowledge-graph-db/scripts/graph.mjs <子命令> [参数]',
    '  init     [--file <p>] [--force]',
    '  validate [--file <p>]',
    '  ingest   --input <p> [--file <p>] [--dry-run]',
    '  stats    [--file <p>]',
    '  export   [--file <p>] --out <p>',
  ].join('\n');
}

function writeStdout(result) {
  process.stdout.write(serialize(result.output));
  process.exitCode = result.code;
}

function main(argv) {
  let result;
  try {
    if (!REPO_ROOT) {
      throw new RuntimeError('未找到仓库根：需要向上存在同时包含 .agents 与 knowledge 的目录');
    }
    if (argv.length === 0) {
      throw new UsageError(`缺少子命令\n${describeUsage()}`);
    }
    const opts = parseArgs(argv);
    if (!Object.hasOwn(COMMANDS, opts.command)) {
      throw new UsageError(`未知子命令: ${opts.command}\n${describeUsage()}`);
    }
    result = COMMANDS[opts.command](opts);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`错误: ${err.message}\n`);
      result = { output: { ok: false, errors: [err.message] }, code: EXIT_INPUT };
    } else if (err instanceof InputError) {
      process.stderr.write(`错误: ${err.message}\n`);
      result = { output: { ok: false, errors: [err.message] }, code: EXIT_INPUT };
    } else {
      const message = err instanceof RuntimeError ? err.message : `运行时异常: ${err?.message ?? err}`;
      process.stderr.write(`${err?.stack ?? message}\n`);
      result = { output: { ok: false, errors: [message] }, code: EXIT_RUNTIME };
    }
  }
  writeStdout(result);
}

main(process.argv.slice(2));
