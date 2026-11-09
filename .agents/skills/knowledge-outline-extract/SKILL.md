---
name: knowledge-outline-extract
description: 把论文、文章、笔记、链接或已有 knowledge/ 目录整理成可入库的目录标题图提案（topic/subtopic/entry 节点 + belongs-to/related-to 边），只抽主题、子目录与条目标题这一层，不抽正文。用户说"把这篇资料抽成目录结构""生成目录标题图""这个主题该有哪些子目录/条目""结构提案能不能入库""重扫一下知识库目录图"时使用。
whenToUse: 新资料需要判断归属主题并产出结构提案时；已有 knowledge/ 目录需要重扫节点与 belongs-to、补主题间 related-to 时；图 JSON 需要校验或入库时先走本 skill。正文条目用 knowledge-ingest-paper / knowledge-add-entry，索引导航用 knowledge-update-index，内容体检用 knowledge-audit，看图用 knowledge-graph-viz。
---

# 资料 → 目录标题图（标题级）

输入：论文、文章、笔记、项目链接，或已有的 `knowledge/` 目录。输出：符合 `knowledge/graph/schema.md` §3 的目录标题图提案，能通过 `knowledge-graph-db validate`，再由 `knowledge-graph-db ingest` 入库。**只到「主题 / 子目录 / 条目标题」这一层。**

## 何时用 / 何时不用

用：新资料进来要判断归哪个主题、拆哪些子目录与条目；已有知识库要重扫节点与隶属关系、补主题间 `related-to`；图 JSON 要校验或入库。

不用：

- 正文、方法、结论、公式、资源清单的落盘不用本 skill，用 `knowledge-ingest-paper`（论文骨架）与 `knowledge-add-entry`（写条目）。
- 本 skill 不写正文、不做全文索引、不总结论文内容；图里只出现标题、路径与关系短语。
- 只维护主题地图/导航用 `knowledge-update-index`；内容合规体检用 `knowledge-audit`；只渲染看图用 `knowledge-graph-viz`。

## 输入形态

| 形态 | 处理方式 |
| --- | --- |
| 本地文件/目录 | 读第一个 `# ` 作标题；目录按 §5.2 规则映射为 topic/subtopic/entry |
| 粘贴文本 | 取资料自己的 `#`/`##` 标题；无标题就先拟条目标题清单 |
| 链接 | 取页面标题与目录标题；拿不到就问用户要标题清单，不要编标题 |
| 已有 `knowledge/` 目录 | 直接跑 `scan.mjs`，人工只补 `related-to` |

## 步骤

1. **判归属主题**：读 `knowledge/index.md` 主题列表与候选主题 README 的 H1，确定它属于哪个 `topics/NN-xxx`；不属于任何现有主题时先建议新增主题并等用户确认。完成信号：能说出所属主题 id（如 `topics/04-continual-learning`），或明确"新增主题"。

2. **只抽标题层**：从资料里取主题名、子目录名、条目标题；条目内二级标题按需留作 `section`（默认不生成）。去掉编号装饰、markdown 符号与正文句子，标题 ≤120 字符。完成信号：每个节点只有 `title`/`path`/`kind`，没有一个节点来自正文段落或摘要。

3. **生成 / 补 `related-to`**：只从主题 README 或 `knowledge/index.md` 的「关系说明」类小节的列表项取短语，`note` ≤80 字符、不改写；一个条目里点了两个及以上主题才成边，只点到一个主题就记进汇报、不要瞎猜。完成信号：每条 `related-to` 的 `note` 都能在原文逐字找到。

4. **跑 `scan.mjs` 或手写提案**：已有目录直接扫描（`--relations` 增量补关系边）；新资料手写 JSON。产物统一写 `out/`，不要写 `knowledge/graph/`。完成信号：生成 `out/<名字>_outline.json`，顶层含 `version`/`root`/`generated_by`/`nodes`/`edges`。
   ```bash
   node .agents/skills/knowledge-outline-extract/scripts/scan.mjs scan --out out/_scan.json
   node .agents/skills/knowledge-outline-extract/scripts/scan.mjs scan --relations --out out/_scan_rel.json
   ```

5. **校验提案**：用图库 skill 的校验器挡 E 码。完成信号：`ok=true`、`errors=[]`；W 码逐条解释或修掉。
   ```bash
   node .agents/skills/knowledge-graph-db/scripts/graph.mjs validate --file out/_scan_rel.json
   ```

6. **交给 `knowledge-graph-db ingest`**：先 `--dry-run` 预演，报告 `nodes_created`/`edges_created`/`warnings`；用户确认后再去掉 `--dry-run` 正式入库，不要擅自写库。完成信号：dry-run 无 E 码、数量与预期一致且用户确认。
   ```bash
   node .agents/skills/knowledge-graph-db/scripts/graph.mjs ingest --input out/_scan_rel.json --dry-run
   ```

7. **交接正文**：把"结构已入库、正文待补"的条目列成清单（id → 建议落盘路径），交给 `knowledge-ingest-paper` / `knowledge-add-entry` 落正文。完成信号：用户拿到结构结果与正文待办清单，两边不重复写。

## 失败处理

| 码 | 含义 | 怎么改 |
| --- | --- | --- |
| E001 | `version` 不是 1 | 顶层写 `"version": 1` |
| E010 | `nodes` 缺失或不是数组 | 补 `nodes: []`（空图也要有） |
| E011 | 节点 `id` 非法 | 改成相对 `knowledge/` 的稳定键：不带 `.md`、不以 `/` 开头结尾、不含空格与 `..` |
| E012 | `kind` 非法 | 只允许 `topic`/`subtopic`/`entry`/`section` |
| E013 | `title` 为空或 >120 字符 | 用文件 H1 或文件名回退并截断 |
| E014 | `path` 非法 | 用仓库根相对 `.md` 路径，如 `knowledge/topics/03-reinforcement-learning/on-policy.md` |
| E015 | 节点 `id` 重复 | 同一 id 只留一个节点，合并信息 |
| E020/E021 | `edges` 非数组 / 边缺端点 | 顶层补 `edges`，每条边写全 `from`/`to`/`kind` |
| E022 | 边端点不在 `nodes` 中 | 补建父节点，或顶层主题的 `to` 写虚拟根 `root` |
| E023 | 边 `kind` 非法 | 只用 `belongs-to`/`related-to`/`see-also`；结构边只能是 `belongs-to` |
| E024 | 自环 | 删掉该边，父子关系重新核对 |

`scan --relations` 的警告按语义处理：`W_REL_UNPAIRED`（关系条目只点到一个主题，无法成边）补成两点式措辞或人工补边；`W_REL_UNMATCHED`（对不上主题标题）改措辞或删条目；`W_REL_SELF_ONLY`（只提到本主题）删除或改写；`W_NOTE_TRUNCATED`/`W_TITLE_TRUNCATED` 是 note/title 超长被截断；`W_SCAN_MISSING_README` 表示目录没有 README，先补 README 再重扫。W001（title 与路径不匹配）、W002（孤立节点）、W003（related-to 重复）按提示修，不阻断入库。

## 验证

- `scan.mjs` 自检通过：退出码 0，stdout 是一个 JSON 对象；节点数与 `knowledge/topics/` 实际目录一致（10 个主题目录应有 10 个 `topic` 节点）。
- `validate` 通过：`ok=true`、`errors=[]`、`counts.nodes/kinds` 符合预期。
- 抽查 3 条 `belongs-to`：子节点 `path` 确实位于父节点目录下；父节点存在，顶层主题的 `to` 是 `root`。
- 抽查 `related-to`：`note` 能在 README/index 的「关系说明」里逐字找到，≤80 字符。
- 反向自检：图里有没有正文句子、论文结论、公式、证据片段？有就删掉，这属于内容 skill 的职责。

## 最小示例

```json
{
  "version": 1,
  "root": "knowledge",
  "generated_by": "knowledge-outline-extract/scan.mjs",
  "nodes": [
    { "id": "topics/03-reinforcement-learning", "kind": "topic", "title": "03 强化学习", "path": "knowledge/topics/03-reinforcement-learning/README.md", "order": 3 },
    { "id": "topics/03-reinforcement-learning/on-policy", "kind": "entry", "title": "On-Policy 范式", "path": "knowledge/topics/03-reinforcement-learning/on-policy.md" }
  ],
  "edges": [
    { "from": "topics/03-reinforcement-learning/on-policy", "to": "topics/03-reinforcement-learning", "kind": "belongs-to" },
    { "from": "topics/03-reinforcement-learning", "to": "root", "kind": "belongs-to" }
  ]
}
```

抽取判断细则见 `references/extraction-rules.md`；可直接 validate 的完整样例见 `assets/example_output.json`。
