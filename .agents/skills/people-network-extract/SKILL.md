---
name: people-network-extract
description: 把文章、聊天记录、笔记等自然语言资料抽取成人际网可入库 JSON（version/persons/relations，格式见 docs/contracts/data-model.md §5），并处理关系方向、别名、置信度、证据片段与同人判定。用户说"把这段资料整理成人物关系""抽取人物关系""生成能入库的 JSON""这两个人是什么关系"时使用。
whenToUse: 用于从新资料产出抽取 JSON。已有数据库的查询、入库、统计用 people-network-db；改图形样式用 people-network-viz；需要先计划分工时先走 people-network-lead。
---

# 从自然语言资料抽取人际网 JSON

输入：一段文章、聊天记录或笔记。输出：符合 `docs/contracts/data-model.md` §5 的单个 JSON 文件，能直接通过 `people_network validate`，再交给 `people-network-db` 入库。

## 步骤

1. **锁定输入与输出**：确认资料位置（文件或用户粘贴文本）和输出路径（用户指定，默认建议 `out/<主题>_extract.json`）。不写 `docs/`、`examples/`、`README.md`，不覆盖已有文件除非用户同意。完成信号：输入可读、输出路径确定。
2. **通读并建人物清单**：给每个出现的人物建一条 `persons`。`name` 用资料里的正式写法；`aliases` 收全名、称呼、代号、昵称；`gender` 只有资料能判断才填，否则留 `""`；`tags` 放身份/组织；`notes` 放无法结构化但有用的信息。完成信号：后面每条关系的 source/target 都能在本批 `persons` 或库里解析到。
3. **抽关系并定方向**：`source` 是主体，`target` 是对象。把句子读成"A 对 B 是 relation"再落笔；"A 是 B 的母亲" → A→B「母亲」，"A 被 B 保护" → B→A「保护」，"A 与 B 是同事" → 选主要一方录一条，不要双向重复。一句话含多层关系就拆成多条。完成信号：每条都能顺畅读成"source 对 target 是 relation"。
4. **补全字段**：`category` 用枚举（亲属/朋友/同事/师生/恋人/敌对/合作/其他）；`relation` 文本要短（≤50 字符）；`confidence` 按证据强度给 0.6–1.0（原文直述 ≥0.9，可推断 0.6–0.8）；`evidence` 必须是原文片段（≤500 字符），不要改写或翻译。完成信号：每条关系都有 `evidence` 和 `confidence`。
5. **处理未知与矛盾**：只写资料支持的关系；推测写进 `notes` 并降低 `confidence`；两份资料矛盾时保留高置信度一条，另一条记入 `notes`，不编造人物；同名不同人靠 `aliases`/`notes` 区分（已知限制）。细则见 `references/extraction-rules.md`。
6. **写文件**：UTF-8 无 BOM，顶层键 `version`（=1）、`material`、`persons`、`relations`；`material.content` 保留原文全文（可分批发）。完整可复制样例见 `assets/example_output.json`。
7. **校验并修正**：在项目根目录（本 skill 目录的 `../../..`）执行 `.venv\Scripts\python.exe -m people_network validate --input <输出文件>`。要求退出码 0 且 `ok=true`、`errors=[]`。有 E 码按错误码修正后重跑；W 码在汇报里逐条说明（W001 缺原文、W002 别名冲突、W003 关系重复、W004 未知 category、W006 疑似同人）。
8. **交付**：汇报 persons/relations 计数、validate 输出、未决歧义清单。用户确认后才按 `people-network-db` 入库，不要擅自 `ingest`。

## 失败处理

- `E010`/`E011`（persons 空、name 空或超长）：补人物或改用正式名；name ≤100 字符。
- `E022`（source/target 找不到）：先在**本批 persons** 中解析；只有称呼就补 alias 或补建人物；跨批资料先把人物补齐再合并。
- `E024`（confidence 越界）：改成 `(0, 1]` 内的值，缺省写 `1.0`。
- 关系重复（W003）：把重复条目从 JSON 删掉，把两条 evidence 合并进保留条。
- 人物 >100 或原文过长：按章节/批次拆成多个 JSON，各自 validate 通过后再由 db/Lead 合并。
- 关系方向读不通：回到原句找谓语和宾语，必要时拆句或标"关系不明"归「其他」。

## 验证

- `.venv\Scripts\python.exe -m people_network validate --input <输出文件>` → `ok=true`、`errors=[]`。
- 抽查 3 条关系：方向能读通、`evidence` 能在原文中逐字找到、`confidence` 与证据强度相符。
- 文件能被 Python 解析：`.venv\Scripts\python.exe -c "import json;json.load(open(r'<输出文件>',encoding='utf-8'))"` 无报错。
- 四问自检：有没有把"被 X"录反方向？有没有把一个人拆成两个？有没有把推断写成事实？有没有漏掉原文明确说的关系？
