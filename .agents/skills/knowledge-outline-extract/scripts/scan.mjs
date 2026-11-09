#!/usr/bin/env node
// knowledge-outline-extract / scan.mjs
// 目录标题级扫描：从 knowledge/ 目录结构生成 topic/subtopic/entry 节点与 belongs-to 边，
// 可选从「关系说明」类小节生成 related-to 边。
// 数据契约见 knowledge/graph/schema.md §3（图 JSON）、§4（E/W 码）、§5.2（本 CLI）。
// 用法:
//   node .agents/skills/knowledge-outline-extract/scripts/scan.mjs scan [--root knowledge] [--out <p>] [--relations]

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_TITLE = 120;
const MAX_NOTE = 80;
const VIRTUAL_ROOT = 'root';
const GENERATED_BY = 'knowledge-outline-extract/scan.mjs';
const KINDS = new Set(['topic', 'subtopic', 'entry', 'section']);
const EDGE_KINDS = new Set(['belongs-to', 'related-to', 'see-also']);
// 「关系说明」类小节：标题里出现这些词就当作关系小节。
const RELATION_HEADING = /(关系|相关主题|关联主题|交叉引用)/;
const MAX_DIR_DEPTH = 3;

const USAGE = `用法: node .agents/skills/knowledge-outline-extract/scripts/scan.mjs scan [--root knowledge] [--out <p>] [--relations]

  scan         扫描目录，输出目录标题图 JSON（默认 stdout）
  --root <p>   知识库根目录，相对仓库根解析，默认 knowledge
  --out <p>    写入文件并输出 {ok,out,nodes,edges,warnings}，相对仓库根解析
  --relations  解析主题 README / knowledge/index.md 的「关系说明」小节，生成 related-to 边`;

const warnings = [];
const fatalErrors = [];

function warn(code, message) {
  warnings.push(`${code}: ${message}`);
}

function usageError(message) {
  const err = new Error(message);
  err.code = 'USAGE';
  return err;
}

// ---------- 仓库根与路径工具 ----------

function isRepoRoot(dir) {
  return existsSync(join(dir, '.agents')) && existsSync(join(dir, 'knowledge'));
}

function findRepoRoot(startDirs) {
  for (const start of startDirs) {
    let dir = resolve(start);
    for (;;) {
      if (isRepoRoot(dir)) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot([process.cwd(), scriptDir]);

function toPosix(p) {
  return p.split(/[\\/]+/).join('/');
}

function repoRel(absPath) {
  return toPosix(relative(repoRoot, absPath));
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

function listEntries(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  } catch {
    return [];
  }
}

function codePointLength(s) {
  return [...s].length;
}

function truncateByCodePoint(s, max) {
  const chars = [...s];
  return chars.length <= max ? s : chars.slice(0, max).join('');
}

// ---------- 标题与文本归一化 ----------

function isFenceLine(line) {
  return /^\s*(```|~~~)/.test(line);
}

function normalizeTitle(raw) {
  let title = String(raw)
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  title = title.replace(/^#+\s*/, '').replace(/\s*#+\s*$/, '').trim();
  if (codePointLength(title) > MAX_TITLE) {
    const shortened = truncateByCodePoint(title, MAX_TITLE);
    warn('W_TITLE_TRUNCATED', `标题超过 ${MAX_TITLE} 字符，已截断: ${shortened}`);
    title = shortened;
  }
  return title;
}

// 取文件第一个 H1（跳过 ``` / ~~~ 代码块）。
function firstH1(file) {
  const text = readText(file);
  if (text === null) return null;
  let inFence = false;
  let fenceMark = '';
  for (const line of text.split(/\r?\n/)) {
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMark = fence[1];
      } else if (fence[1] === fenceMark) {
        inFence = false;
        fenceMark = '';
      }
      continue;
    }
    if (inFence) continue;
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      const title = normalizeTitle(h1[1]);
      if (title) return title;
    }
  }
  return null;
}

// 目录名去掉 `NN-` 前缀，作为 title 回退。
function dirNameWithoutOrder(name) {
  return name.replace(/^\d+[\s._-]+/, '').trim() || name;
}

function orderOf(name) {
  const match = String(name).match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

// 去掉标题里的 `NN ` / `NN-` 顺序前缀，用于关系匹配。
function titleBase(title) {
  return String(title).replace(/^\d+[\s._-]+/, '').trim();
}

// 关系匹配归一化：小写、去空白与标点，保留中英文与数字。
function fold(text) {
  return String(text)
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/["'`*_~!@#$%^&*+=|\\/<>{}[\]()]/g, '')
    .replace(/[（），。、；：！？【】「」《》·—–…\-]/g, '');
}

function normalizeItemText(raw) {
  return String(raw)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // markdown 链接只留文字
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 轻量归一化：fold 之后再去掉常见虚词/连词，让「遥操作与运动重定向」能对上「遥操作与重定向」。
function foldLoose(text) {
  return fold(text).replace(/[与和的之为是在及等其也都把被从到对将并而]/g, '');
}

function bigrams(text) {
  const chars = [...text];
  const out = [];
  for (let i = 0; i + 1 < chars.length; i += 1) out.push(chars[i] + chars[i + 1]);
  return out;
}

// Dice 系数：2*交集/(|A|+|B|)，用来判断两条标题是否在说同一件事。
function bigramDice(a, b) {
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.length === 0 || gb.length === 0) return { dice: 0, common: 0, first: null };
  const counts = new Map();
  for (const gram of gb) counts.set(gram, (counts.get(gram) ?? 0) + 1);
  let common = 0;
  let first = null;
  for (const gram of ga) {
    const left = counts.get(gram) ?? 0;
    if (left > 0) {
      counts.set(gram, left - 1);
      common += 1;
      if (first === null) first = gram;
    }
  }
  return { dice: (2 * common) / (ga.length + gb.length), common, first };
}

// ---------- 图构建 ----------

function createGraph(rootRel) {
  return {
    version: 1,
    root: rootRel,
    generated_by: GENERATED_BY,
    nodes: [],
    edges: [],
  };
}

function addNode(graph, node, seenIds) {
  if (seenIds.has(node.id)) {
    fatalErrors.push(`E015: 节点 id 重复 ${node.id}`);
    return;
  }
  seenIds.add(node.id);
  const clean = { id: node.id, kind: node.kind, title: node.title, path: node.path };
  if (node.order !== undefined && Number.isFinite(node.order)) clean.order = node.order;
  graph.nodes.push(clean);
}

function addEdge(graph, edge) {
  const clean = { from: edge.from, to: edge.to, kind: edge.kind };
  if (edge.note !== undefined && edge.note !== '') clean.note = edge.note;
  graph.edges.push(clean);
}

function scanTopics(graph, rootDir, seenIds) {
  const topicsDir = join(rootDir, 'topics');
  if (!existsSync(topicsDir) || !statSync(topicsDir).isDirectory()) {
    warn('W_SCAN_NO_TOPICS', `找不到 ${repoRel(topicsDir)}/，输出空图`);
    return [];
  }
  const topicNodes = [];
  const topicDirs = listEntries(topicsDir)
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const oa = orderOf(a);
      const ob = orderOf(b);
      if (oa !== undefined && ob !== undefined && oa !== ob) return oa - ob;
      return a.localeCompare(b, 'en');
    });

  for (const name of topicDirs) {
    const absDir = join(topicsDir, name);
    const relId = `topics/${name}`;
    const readmeAbs = join(absDir, 'README.md');
    const hasReadme = existsSync(readmeAbs);
    if (!hasReadme) warn('W_SCAN_MISSING_README', `${relId} 缺少 README.md，title 回退为目录名`);
    const title = (hasReadme && firstH1(readmeAbs)) || dirNameWithoutOrder(name);
    const node = {
      id: relId,
      kind: 'topic',
      title,
      path: repoRel(hasReadme ? readmeAbs : join(absDir, 'README.md')),
    };
    const order = orderOf(name);
    if (order !== undefined) node.order = order;
    addNode(graph, node, seenIds);
    topicNodes.push(node);
    addEdge(graph, { from: relId, to: VIRTUAL_ROOT, kind: 'belongs-to' });
    scanChildren(graph, absDir, relId, seenIds, 0);
  }
  return topicNodes;
}

// 目录下：子目录 -> subtopic，非 README 的 .md -> entry。
function scanChildren(graph, dirAbs, parentId, seenIds, depth) {
  for (const entry of listEntries(dirAbs)) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const abs = join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      if (depth >= MAX_DIR_DEPTH) {
        warn('W_SCAN_DEPTH', `${repoRel(abs)}/ 超过 ${MAX_DIR_DEPTH} 层目录，已跳过`);
        continue;
      }
      const relId = `${parentId}/${entry.name}`;
      const readmeAbs = join(abs, 'README.md');
      const hasReadme = existsSync(readmeAbs);
      if (!hasReadme) warn('W_SCAN_MISSING_README', `${relId} 缺少 README.md，title 回退为目录名`);
      const node = {
        id: relId,
        kind: 'subtopic',
        title: (hasReadme && firstH1(readmeAbs)) || dirNameWithoutOrder(entry.name),
        path: repoRel(hasReadme ? readmeAbs : join(abs, 'README.md')),
      };
      const order = orderOf(entry.name);
      if (order !== undefined) node.order = order;
      addNode(graph, node, seenIds);
      addEdge(graph, { from: relId, to: parentId, kind: 'belongs-to' });
      scanChildren(graph, abs, relId, seenIds, depth + 1);
      continue;
    }
    if (!entry.isFile() || !/\.md$/i.test(entry.name) || /^readme\.md$/i.test(entry.name)) continue;
    const relId = `${parentId}/${entry.name.replace(/\.md$/i, '')}`;
    const title = firstH1(abs) || entry.name.replace(/\.md$/i, '');
    addNode(graph, { id: relId, kind: 'entry', title, path: repoRel(abs) }, seenIds);
    addEdge(graph, { from: relId, to: parentId, kind: 'belongs-to' });
  }
}

// ---------- 关系说明 ----------

// 解析「关系说明」类小节里的列表项，跳过代码块与非列表正文。
function parseRelationItems(text) {
  const lines = text.split(/\r?\n/);
  const items = [];
  let inFence = false;
  let fenceMark = '';
  let inSection = false;
  let current = null;

  for (const line of lines) {
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMark = fence[1];
      } else if (fence[1] === fenceMark) {
        inFence = false;
        fenceMark = '';
      }
      continue;
    }
    if (inFence) continue;

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      inSection = level >= 2 && level <= 4 && RELATION_HEADING.test(text);
      current = null;
      continue;
    }
    if (!inSection) continue;
    if (line.trim() === '') continue;

    const bullet = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      const indent = bullet[1].replace(/\t/g, '    ').length;
      const itemText = normalizeItemText(bullet[2]);
      if (!itemText) continue;
      if (current !== null && indent > 0) {
        items[current] = `${items[current]} ${itemText}`.trim();
      } else {
        items.push(itemText);
        current = items.length - 1;
      }
      continue;
    }
    // 非列表的普通正文：结束当前条目，避免把段落接进 note。
    current = null;
  }
  return items.filter((item) => item.length > 0);
}

function matchTopics(itemText, topicNodes, excludeId) {
  const hay = fold(itemText);
  const looseHay = foldLoose(itemText);
  const hits = [];
  for (const node of topicNodes) {
    if (node.id === excludeId) continue;
    const full = fold(node.title);
    const base = fold(titleBase(node.title));
    const looseBase = foldLoose(titleBase(node.title));
    let score = 0;
    let pos = -1;
    let matched = '';
    if (full && hay.includes(full)) {
      score = 1;
      pos = hay.indexOf(full);
      matched = full;
    } else if (base && hay.includes(base)) {
      score = 0.9;
      pos = hay.indexOf(base);
      matched = base;
    } else if (looseBase) {
      // 标题与条目在去掉虚词后高度重合（Dice ≥ 0.3 且至少共享 2 个二元组）才算对上，避免瞎猜。
      const { dice, common, first } = bigramDice(looseBase, looseHay);
      if (dice >= 0.3 && common >= 2 && first) {
        score = 0.5;
        pos = looseHay.indexOf(first);
        matched = first;
      }
    }
    if (score > 0) hits.push({ node, score, pos, matched });
  }
  hits.sort((a, b) => a.pos - b.pos || b.score - a.score);
  return hits;
}

function addRelated(graph, from, to, note, relatedPairs, sourceLabel) {
  if (!from || !to || from === to) return;
  const key = [from, to].sort().join(' | ');
  if (relatedPairs.has(key)) return;
  relatedPairs.add(key);
  let finalNote = note;
  if (codePointLength(finalNote) > MAX_NOTE) {
    finalNote = `${truncateByCodePoint(finalNote, MAX_NOTE - 1)}…`;
    warn('W_NOTE_TRUNCATED', `${sourceLabel}: 关系说明超过 ${MAX_NOTE} 字符，note 已截断`);
  }
  addEdge(graph, { from, to, kind: 'related-to', note: finalNote });
}

function extractRelations(graph, rootDir, topicNodes) {
  const relatedPairs = new Set();
  const sources = [];
  for (const node of topicNodes) {
    sources.push({ owner: node.id, abs: resolve(repoRoot, node.path), label: node.path });
  }
  const indexAbs = join(rootDir, 'index.md');
  if (existsSync(indexAbs)) {
    sources.push({ owner: null, abs: indexAbs, label: repoRel(indexAbs) });
  } else {
    warn('W_SCAN_NO_INDEX', `${repoRel(indexAbs)} 不存在，只从主题 README 解析关系说明`);
  }

  for (const source of sources) {
    const text = readText(source.abs);
    if (text === null) continue;
    for (const item of parseRelationItems(text)) {
      const hits = matchTopics(item, topicNodes, source.owner);
      const excerpt = codePointLength(item) > 40 ? `${truncateByCodePoint(item, 40)}…` : item;
      if (source.owner) {
        // 主题 README 的关系说明：主人一方是当前主题，另一个端点必须匹配到其他主题。
        if (hits.length === 0) {
          const selfHit = matchTopics(item, topicNodes, null).some((hit) => hit.node.id === source.owner);
          if (selfHit) {
            warn('W_REL_SELF_ONLY', `${source.label}: 关系条目只提到本主题，无法成边: ${excerpt}`);
          } else {
            warn('W_REL_UNMATCHED', `${source.label}: 关系条目对不上任何主题标题: ${excerpt}`);
          }
          continue;
        }
        for (const hit of hits) {
          addRelated(graph, source.owner, hit.node.id, item, relatedPairs, source.label);
        }
      } else if (hits.length === 0) {
        warn('W_REL_UNMATCHED', `${source.label}: 关系条目对不上任何主题标题: ${excerpt}`);
      } else if (hits.length === 1) {
        warn(
          'W_REL_UNPAIRED',
          `${source.label}: 关系条目只匹配到 1 个主题「${hits[0].node.title}」，无法形成 related-to: ${excerpt}`,
        );
      } else {
        for (let i = 0; i < hits.length; i += 1) {
          for (let j = i + 1; j < hits.length; j += 1) {
            addRelated(graph, hits[i].node.id, hits[j].node.id, item, relatedPairs, source.label);
          }
        }
      }
    }
  }
}

// ---------- 自检（对应 schema §4 的 E 码，写入前拦一遍） ----------

function selfCheck(graph) {
  const errors = [...fatalErrors];
  if (graph.version !== 1) errors.push('E001: version 必须为 1');
  if (!Array.isArray(graph.nodes)) errors.push('E010: nodes 必须是数组');
  if (!Array.isArray(graph.edges)) errors.push('E020: edges 必须是数组');
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return errors;
  const ids = new Set();
  for (const node of graph.nodes) {
    if (typeof node.id !== 'string' || node.id === '' || node.id !== node.id.trim()) {
      errors.push(`E011: 节点 id 非法 ${JSON.stringify(node.id)}`);
    } else if (node.id.startsWith('/') || node.id.endsWith('/') || node.id.includes('..') || /\s/.test(node.id)) {
      errors.push(`E011: 节点 id 非法 ${node.id}`);
    } else if (/\.md$/i.test(node.id)) {
      errors.push(`E011: 节点 id 不应带 .md 后缀 ${node.id}`);
    }
    if (!KINDS.has(node.kind)) errors.push(`E012: 节点 kind 非法 ${node.kind}（id=${node.id}）`);
    if (typeof node.title !== 'string' || node.title === '' || codePointLength(node.title) > MAX_TITLE) {
      errors.push(`E013: title 为空或超过 ${MAX_TITLE} 字符（id=${node.id}）`);
    }
    if (typeof node.path !== 'string' || !/\.md$/i.test(node.path)) {
      errors.push(`E014: path 不是 .md（id=${node.id}）`);
    } else if (!node.path.startsWith(`${graph.root}/`)) {
      errors.push(`E014: path 不在 ${graph.root}/ 下（id=${node.id}，path=${node.path}）`);
    }
    if (ids.has(node.id)) errors.push(`E015: 节点 id 重复 ${node.id}`);
    ids.add(node.id);
  }
  const belongsCount = new Map();
  for (const edge of graph.edges) {
    if (!edge.from || !edge.to) {
      errors.push('E021: 边缺 from 或 to');
      continue;
    }
    if (!EDGE_KINDS.has(edge.kind)) errors.push(`E023: 边 kind 非法 ${edge.kind}`);
    if (edge.from === edge.to) errors.push(`E024: 自环 ${edge.from}`);
    if (!ids.has(edge.from)) errors.push(`E022: 边 from 不在 nodes 中 ${edge.from}`);
    if (edge.to !== VIRTUAL_ROOT && !ids.has(edge.to)) errors.push(`E022: 边 to 不在 nodes 中 ${edge.to}`);
    if (edge.kind === 'belongs-to') {
      const count = (belongsCount.get(edge.from) ?? 0) + 1;
      belongsCount.set(edge.from, count);
      if (count > 1) errors.push(`self-check: ${edge.from} 有多条 belongs-to（每个节点最多一条）`);
    }
    if (edge.note !== undefined && codePointLength(edge.note) > MAX_NOTE) {
      errors.push(`self-check: note 超过 ${MAX_NOTE} 字符 ${edge.note}`);
    }
  }
  return errors;
}

// ---------- 主流程 ----------

function parseArgs(argv) {
  const opts = { command: 'scan', root: 'knowledge', out: null, relations: false, help: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root' || arg === '--out') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) throw usageError(`${arg} 需要参数值`);
      opts[arg.slice(2)] = value;
      i += 1;
    } else if (arg.startsWith('--root=')) {
      opts.root = arg.slice('--root='.length);
    } else if (arg.startsWith('--out=')) {
      opts.out = arg.slice('--out='.length);
    } else if (arg === '--relations') {
      opts.relations = true;
    } else if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg.startsWith('-')) {
      throw usageError(`未知选项 ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (opts.help) return opts;
  if (positional.length > 1) throw usageError(`多余的参数: ${positional.slice(1).join(' ')}`);
  if (positional.length === 1) opts.command = positional[0];
  if (opts.command !== 'scan') throw usageError(`未知子命令 ${opts.command}`);
  if (!opts.root) throw usageError('--root 不能为空');
  return opts;
}

function resolveInsideRepo(target, flagName) {
  const abs = isAbsolute(target) ? resolve(target) : resolve(repoRoot, target);
  const rel = relative(repoRoot, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw usageError(`${flagName} 必须位于仓库根内: ${target}`);
  }
  return abs;
}

function main() {
  if (!repoRoot) {
    console.error('scan.mjs: 找不到仓库根（需要包含 .agents/ 与 knowledge/ 的目录）');
    process.exit(1);
  }
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const rootDir = resolveInsideRepo(opts.root, '--root');
  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
    throw usageError(`--root 目录不存在: ${opts.root}`);
  }
  const rootRel = repoRel(rootDir) || '.';
  const graph = createGraph(rootRel);
  const seenIds = new Set();
  const topicNodes = scanTopics(graph, rootDir, seenIds);
  if (topicNodes.length === 0) warn('W_SCAN_NO_TOPICS', '没有扫描到任何主题节点');
  if (opts.relations) extractRelations(graph, rootDir, topicNodes);

  const errors = selfCheck(graph);
  if (errors.length > 0) {
    for (const message of errors) console.error(message);
    console.error(`scan.mjs: 自检失败（${errors.length} 个错误），未写出图数据`);
    process.exit(2);
  }

  const outArg = opts.out;
  if (outArg) {
    const outAbs = resolveInsideRepo(outArg, '--out');
    mkdirSync(dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
    const summary = {
      ok: true,
      out: repoRel(outAbs),
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      warnings,
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  for (const message of warnings) console.error(`warning: ${message}`);
  process.stdout.write(`${JSON.stringify(graph, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  if (err && err.code === 'USAGE') {
    console.error(`scan.mjs: ${err.message}`);
    console.error(USAGE);
    process.exit(2);
  }
  console.error(`scan.mjs: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
}
