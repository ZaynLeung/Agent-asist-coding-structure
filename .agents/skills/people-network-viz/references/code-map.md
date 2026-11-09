# viz 代码地图

配合 `people-network-viz` 的 SKILL.md 使用。契约见 `docs/contracts/viz.md`；本文件帮你在 `viz/` 里"改哪里"。

> `viz/app.js` 由实现方持续演进。下面的职责划分来自契约；动手前先用 grep 确认实际符号名，找不到时按"定位提示"搜同类写法，不要凭文件名猜。

## 1. 文件职责

| 文件 | 职责 | 可改 |
| --- | --- | --- |
| `viz/index.html` | 模板骨架；含 `__TITLE__` 与 `<script id="network-data" type="application/json">__DATA_JSON__</script>` 两个占位符；引 style.css / app.js / vendor/d3 | 改结构、加工具栏 DOM |
| `viz/style.css` | 页面布局、SVG 元素样式、工具栏/浮层/图例外观 | 改视觉样式 |
| `viz/app.js` | 顶部 `CONFIG`；数据读取；力导向仿真；节点/连线渲染；缩放拖拽；高亮；tooltip；搜索；图例；空库提示 | 改行为与参数 |
| `viz/vendor/d3.v7.min.js` | 本地 vendored D3 v7 | 只读，不升级不改 |

`web/` 全是 `render` 产物：`index.html`（数据已内联）、`data.json`、`style.css`、`app.js`、`vendor/`、`img/`。**改 `web/` 下的文件会被下次 render 覆盖**，一律改 `viz/`。

## 2. 数据流

```text
SQLite → people_network/export.py::build_chart_data → {"nodes":[...],"links":[...]}
       → people_network/render.py::render_site 读 viz/ 模板，替换占位符
       → web/index.html（内联 JSON）+ data.json
       → viz/app.js 用 JSON.parse(document.getElementById('network-data').textContent) 渲染
```

- 导出格式见 `docs/contracts/data-model.md` §6：`nodes[]`（id/role_id/name/avatar/group/tags）、`links[]`（source/target 是**数组下标**、relation/category/color/confidence）。
- `avatar` 本地路径由 render 复制到 `web/img/` 并重写为 `img/<basename>`；http(s) 原样保留。
- 因为数据内联，`file://` 直接打开也能看；不要改成 fetch 或 ES module。

## 3. CONFIG 键（契约值，实际以 app.js 为准）

| 键 | 契约默认 | 作用 |
| --- | --- | --- |
| `nodeRadius` | 34 | 节点半径（头像圆/首字圆） |
| `labelFontSize` | 12 | 姓名与关系标签字号 |
| `chargeStrength` | -420 | 斥力，越大越散 |
| `linkDistance` | 170 | 理想边长 |
| `collidePadding` | 18 | 碰撞间距 |
| `alphaDecay` | 0.0228 | 仿真冷却速度 |
| `highlightOpacity` | 0.12 | 非邻居淡化透明度 |
| `showTooltip` | true | 是否显示详情浮层 |
| `showLegend` | true | 是否显示图例 |
| `showSearch` | true | 是否显示搜索框 |
| `palette` | category→hex | 图例与连线配色 |

定位命令：`grep -n "const CONFIG" viz/app.js`（PowerShell：`Select-String -Path viz\app.js -Pattern "CONFIG"`）。

## 4. 功能 → 定位提示

| 要改的功能 | 大致位置 | 定位提示 |
| --- | --- | --- |
| 力导向参数 | 仿真 setup | 搜 `forceSimulation` / `forceLink` / `forceManyBody` / `forceCollide` |
| 节点与头像 | 节点渲染 | 搜 `pattern`、`image`、`circle`、`nodeRadius` |
| 姓名标签 | 节点标签 | 搜 `text`、`labelFontSize`、`dy` |
| 有向箭头 | marker 定义 | 搜 `marker`、`marker-end`、`arrow` |
| 关系文字标签 | 连线标签 | 搜 `linkLabel`、`relation`、白底 `rect` |
| hover 高亮 | 事件绑定 | 搜 `mouseover`、`mouseout`、`highlightOpacity`、`opacity` |
| 点击详情浮层 | tooltip | 搜 `tooltip`、`showTooltip`、`confidence`、`evidence` |
| 拖拽 / 缩放 / 复位 | 交互 | 搜 `drag`、`zoom`、`dblclick`、`viewBox` |
| 搜索框 | 工具栏 | 模板已有 `#search-wrap` / `#search` / `#search-count`；逻辑搜 `showSearch`、`input` |
| 图例 | 工具栏 | 模板已有 `#legend`；逻辑搜 `showLegend`、`palette`、`legend` |
| 空库提示 | 初始化 | 模板已有 `#empty`（默认 `hidden`）；搜 `nodes.length`、`empty` |
| 详情面板 | 右侧浮层 | 模板已有 `#detail` / `#detail-body` / `#detail-close`；搜 `showTooltip`、`confidence`、`evidence` |
| 重置按钮 | 工具栏 | 模板已有 `#reset`；搜 `reset`、`zoom.transform` |
| 标题 / 页面骨架 | index.html | 搜 `__TITLE__`、`__DATA_JSON__` |

## 5. 布局约定

- SVG 用 `viewBox` + 容器自适应；窗口 resize 后重新居中。
- 工具栏（搜索、图例、重置按钮）一般绝对定位在左上/右上，改样式在 `style.css`。
- 工具栏显隐由 `CONFIG.showSearch` / `CONFIG.showLegend` 控制；新增控件要同时处理 DOM 与显隐逻辑。

## 6. 改之前/之后

- 改前：`git diff --stat viz/` 记下基线；需要回滚时 `git checkout -- viz/<file>`（只回退 viz 文件）。
- 改后：`node --check viz\app.js` → `render` → 检查 `web/index.html` 的 `network-data` 与 `web/data.json` → 打开 `file_url` 目测。
- 若实现方仍在改 `viz/app.js`：先读最新内容再改，避免基于旧版本覆盖别人的改动（文件被更新时重新读）。
