# 常见改造配方

配合 `people-network-viz` 的 SKILL.md 使用。先确认 `viz/app.js` 顶部的键名存在；键名以实际代码为准，契约见 `docs/contracts/viz.md` §4。每条配方改完都要 `node --check viz\app.js` + `render` + 打开 `file_url` 目测。

## 1. 调整松紧（图太挤 / 太空）

```js
// CONFIG 中
chargeStrength: -620,   // 更负 = 斥力更大 = 更散；-300 更紧凑
linkDistance: 210,      // 边长
collidePadding: 26,     // 防重叠
```

一次只动 1–2 个值，重新 render 对比；同时改多个会分不清是哪个起作用。

## 2. 换配色

```js
palette: {
  亲属: '#e07a5f', 朋友: '#6a994e', 同事: '#4a7fb5', 师生: '#9b5de5',
  恋人: '#d64f8a', 敌对: '#c0392b', 合作: '#2a9d8f', 其他: '#8d99ae'
}
```

- 只改 `palette` 就能同时影响连线颜色与图例；不要在两处硬编码颜色。
- 背景是浅色时避免高饱和+高明度同色系；确认图例文字仍可读。
- 导出层（Python）也有 category→hex 映射；只改前端时 `web/data.json` 里的 `color` 仍来自后端，若发现连线颜色不变，检查 app.js 是否优先用了 `link.color`。需要改导出配色时属于 Python 侧，报告 Lead。

## 3. 节点大小与头像

```js
nodeRadius: 28,   // 变小可缓解拥挤；头像裁剪半径跟随该值
```

- 头像为空时前端用姓名首字/末字兜底；改 `nodeRadius` 后检查首字圆与下方姓名是否重叠。
- 头像来自 `avatar` 字段：本地图片需存在于项目内，由 render 复制到 `web/img/`；http(s) URL 直接生效。

## 4. 标签更清楚

```js
labelFontSize: 14,
```

- 字号变大后同步加大 `collidePadding` 或 `nodeRadius`，否则姓名互相压。
- 若姓名过长，在节点标签处截断（前 N 字 + `…`），或 hover 时再显示全名；不要靠 CSS 强行省略 SVG 文本。

## 5. 高亮弱化程度

```js
highlightOpacity: 0.06,   // 更暗 = 对比更强；0.2 更柔和
```

- 邻居与连线保持不透明，其余元素统一用该透明度；改完确认移出后能恢复。

## 6. 关闭/开启工具栏

```js
showSearch: false,
showLegend: true,
showTooltip: true,
```

- 关闭后要同时隐藏对应 DOM 容器（搜索 `#search-wrap`、图例 `#legend`、详情 `#detail`），否则留白占位。

## 7. 改 tooltip 内容

在 tooltip 渲染处追加字段（人物：tags/notes；关系：relation/evidence/confidence）：

```js
// 示意：实际变量名以 app.js 为准
const html = `<b>${d.name}</b><br>${(d.tags || []).join(' · ')}`;
```

- 插入用户文本前做转义（至少替换 `& < >`），避免把 HTML 注入页面。
- evidence 可能很长，加 `max-width` 或截断。

## 8. 改标题 / 空库提示

- 标题：`render --title "我的关系网"` 或直接改 `viz/index.html` 的 `__TITLE__` 上下文；不要在 app.js 里写死。
- 空库提示：找到 `nodes.length === 0` 分支，显示「数据库里还没有人物，先运行 ingest」，并隐藏图例/搜索。

## 9. 加深搜索

搜索框已存在时，改匹配逻辑：姓名 + 别名（前端只有 `name`，别名需后端导出）→ 目前导出无 aliases 字段，需要扩展 `build_chart_data`（Python 侧，报告 Lead）。前端可先按 `name` 与 `tags` 匹配，命中并淡化其余节点。

## 10. 反模式

- 改 `viz/vendor/d3.v7.min.js` 或升级 D3：破坏离线与稳定性。
- 引入 npm/webpack/babel/CDN/ES module：违反"无构建链、`file://` 可看"契约。
- 改 `web/` 下的产物：下次 render 会被覆盖。
- 在 app.js 里硬编码数据：数据必须来自内联 `network-data`。
- 用 `innerHTML` 直接拼接未转义的用户文本：XSS 风险。
