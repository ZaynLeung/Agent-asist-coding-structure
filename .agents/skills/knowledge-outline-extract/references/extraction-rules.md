# 目录标题级抽取细则

配合 `knowledge-outline-extract/SKILL.md` 使用。字段与 CLI 契约以 `knowledge/graph/schema.md` §3–§5.2 为准，本文件只讲**怎么判断**。

## 1. 三档结构：什么算什么

| 层级 | 判定 | 例子 |
| --- | --- | --- |
| `topic` | `knowledge/topics/` 下的一级主题目录 | `knowledge/topics/03-reinforcement-learning/` |
| `subtopic` | 主题目录下的子目录（可再嵌套，默认最深 3 层） | `knowledge/topics/07-engineering-capabilities/sim/` |
| `entry` | 主题/子目录下的 `.md` 文件，**README.md 除外** | `knowledge/topics/03-reinforcement-learning/on-policy.md` |
| `section` | 条目内的二级标题（`##`），**`scan.mjs` 不生成**，需要时人工补 | `knowledge/topics/09-control-foundations/mpc.md` 的 `## 核心概念` |

判据只看**文件位置与第一个 H1**，不看内容写了什么。一个目录只有一个 README，README 只承载目录节点，绝不当作 entry。

边界外的内容（正文段落、论文方法/结论、公式、代码、资源清单、个人笔记）一律不进图。要落正文走 `knowledge-ingest-paper` / `knowledge-add-entry`。

## 2. 标题从哪来、怎么规范化

- `topic`：取该目录 `README.md` 第一个 `# ` 标题；没有 README 或没 H1 时用目录名去掉 `NN-` 前缀（`07-engineering-capabilities` → `engineering-capabilities`），并记 `W_SCAN_MISSING_README`。
- `subtopic`：同上，优先子目录 README 的 H1，回退目录名。
- `entry`：取文件第一个 `# ` 标题；没有 H1 用文件名去扩展名。
- 规范化：跳过 ```` ``` ```` / `~~~` 代码块里的 `#`；去掉行尾 `#`、加粗 `**`、行内反引号；压缩空白；标题 ≤120 字符（按 Unicode 字符计，超长截断并记 `W_TITLE_TRUNCATED`）。
- 标题保持资料原文说法，不改写成句子、不补副标题、不翻译。H1 与文件名明显不一致时先改 H1，别在 JSON 里硬编。

## 3. id / path / order

- `id`：相对 `knowledge/` 的稳定键，目录去尾斜杠、文件去 `.md`。`topics/03-reinforcement-learning`、`topics/07-engineering-capabilities/sim`、`topics/03-reinforcement-learning/on-policy`。不带 `.md`、不以 `/` 开头或结尾、不含空格与 `..`。
- `path`：**仓库根相对**的 `.md` 路径，如 `knowledge/topics/03-reinforcement-learning/README.md`。topic/subtopic 指向其 README；entry 指向文件本身。
- `order`：目录名的 `NN` 数字前缀（`00`–`09` → 0–9）。没有数字前缀的目录/文件省略该字段，不要自己编序号。
- `root`：知识库根，默认 `"knowledge"`。`--root` 换成别的目录时，`id` 仍相对该根，`path` 仍仓库根相对。
- 顶层 `topic` 的父是虚拟节点 `root`：写 `belongs-to` 边且 `to: "root"`，`root` 不出现在 `nodes` 里。

## 4. 结构边：belongs-to

- 每个非 `topic` 节点**有且只有一条** `belongs-to`，方向是 `子 → 父`：entry → 所属 topic 或 subtopic；subtopic → 父 topic/subtopic；topic → `root`。
- 不生成 `topic` 之间的 `belongs-to`，不生成 cross-link 式结构边；跨主题引用只能做成 `see-also`（手工补，`scan.mjs` 不生成）。
- 父节点必须先存在：手写提案时先补父 topic，否则 E022。

## 5. related-to：来源、措辞、匹配口径

**来源**只有两处：主题 README 的「关系说明」类小节，或 `knowledge/index.md` 的同类小节。`note` 用列表项原文（≤80 字符，超长截断 79+`…` 并记 `W_NOTE_TRUNCATED`），不改写、不概括、不抄正文。

`scan.mjs --relations` 的匹配口径（确定性，不猜）：

1. 小节判定：`##`–`####` 标题含「关系 / 相关主题 / 关联主题 / 交叉引用」之一，只取该小节下的列表项；跳过代码块。
2. 主题标题匹配，按优先级：完整标题命中 → 去掉 `NN ` 前缀的标题命中 → 标题与条目去掉虚词（与/和/的/之/为…）后二元组 Dice ≥ 0.3 且至少共享 2 个二元组。
3. 主题 README 内：当前主题是既定一端，条目只要能对上**另一个**主题就生成 `related-to`；只提到自己记 `W_REL_SELF_ONLY`，谁都对不上记 `W_REL_UNMATCHED`。
4. `knowledge/index.md` 内：条目必须对上**两个及以上**主题才生成边；只对一个记 `W_REL_UNPAIRED`（无法成边），谁都不对记 `W_REL_UNMATCHED`。
5. 同一对主题只留一条 `related-to`（方向不敏感）；note 撞车时保留第一条。

想让关系被自动抽出来，就把 `index.md` 的「关系说明」写成**两点式**，例如「灵巧手与移动操作是主要应用场景」，而不是单主题感叹句「强化学习很重要」。

## 6. 禁止事项

- ❌ 从正文抽句子当 `title` 或 `note`；`note` 不得来自正文。
- ❌ 把论文方法/结论/公式/证据片段、访谈原文、置信度等写进图。
- ❌ 生成 `section` 节点后当成正文索引；`scan.mjs` 默认不生成，人工补时也只放 H2 文本。
- ❌ 自创字段（`summary`、`abstract`、`confidence`、`score` 等）或自创边 kind。
- ❌ 猜主题归属、猜关系方向/措辞；对不上就进 warnings / 留给人工。
- ❌ 同一个 id 两个节点、给同一节点两条 `belongs-to`、`related-to` 双向重复。
- ❌ 把临时提案写进 `knowledge/graph/`；提案放 `out/`。

## 7. 与内容类 skill 的分工

| 要做的事 | 用哪个 skill |
| --- | --- |
| 判主题归属、产目录标题结构提案、重扫图 | 本 skill |
| 图 JSON 校验 / 入库 / 导出 / 统计 | `knowledge-graph-db` |
| 读论文提炼背景/方法/结论/局限，生成条目骨架 | `knowledge-ingest-paper` |
| 条目正文落盘、补模板字段、更新主题 README | `knowledge-add-entry` |
| 主题地图与导航、`index.md` 一致性 | `knowledge-update-index` |
| 内容合规、链接与重复条目体检 | `knowledge-audit` |
| 渲染目录标题图 | `knowledge-graph-viz` |

同一件事不要两边做：结构入图，正文入条目。

## 8. 交付前自检

1. `nodes` 中 `topic` 数量 = `knowledge/topics/` 下主题目录数；每个主题目录一个 README 节点，不重复。
2. 每个非 `topic` 节点恰好一条 `belongs-to`，父节点存在；顶层 `topic` 的 `to` 是 `root`。
3. `title` ≤120、`note` ≤80；`id` 不带 `.md`、不含空格与 `..`。
4. `scan.mjs` 退出码 0；`graph.mjs validate` 返回 `ok=true`、`errors=[]`。
5. 反问：这张图里有没有任何"正文内容"？有就删，交给内容 skill。
