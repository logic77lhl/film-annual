# 电影年鉴 1895—2026

一个电影元数据库式的年鉴：132 年，每年精选、补看、华语片 Top 20、IMDb 年度 Top 30，外加影史前 10%。可按影片、导演、演员、类型、国家浏览。

- 线上版：https://logic77lhl.github.io/film-annual/
- 仓库：https://github.com/logic77lhl/film-annual

## 两种版本

| 文件 | 用途 |
| --- | --- |
| `dist/index.html` | 线上完整版，数据在 `dist/data/films.json` |
| `dist/offline.html` | 离线单文件版，数据内联，双击即可打开；海报不加载 |

线上版和离线版共用 `app.html`、`app.css`、`app.js`。构建时把 CSS/JS 内联，离线版再把 JSON 数据内联。

## 数据规模

- 4,880 部影片
- 3,960 部 IMDb 年度 Top 30（132 年 × 30）
- 846 部华语片年度榜（65 个年份，每年最多 20 部）
- 513 部人工精选 + 231 部补看
- 396 部影史前 10%
- 1,559 部有 TMDB 完整资料：简介、片长、类型、国家、公司、系列、导演、主演
- 2,438 位影人：776 位导演、1,798 位演员（至少两部作品）
- 49 个国家/地区、19 个类型

4,880 部里有 722 部暂无中文片名，基本是早期默片、印度/土耳其地方片。部分 Top 30 影片只有基础资料，没有主演和片长；精选与华语片优先补全。

## 文件

### 应用

- `app.html` — 页面壳
- `app.css` — 样式
- `app.js` — 路由、渲染、搜索、筛选、片单、CSV 导出
- `data/films.json` — 合并后的完整数据（构建产物）
- `build-v2-data.js` — 把榜单、精选、TMDB 缓存合并成 `data/films.json`
- `build-v2.js` — 生成 `dist/index.html`、`dist/offline.html`、`dist/data/films.json`
- `deploy-v2.js` — 通过 GitHub Git Trees API 发布 `dist/` + README
- `deploy.ps1` — `deploy-v2.js` 的 PowerShell 包装

### 数据与缓存

- `top30.json` — IMDb 年度 Top 30、影史前 10%
- `cn-films.json` — 华语片年度榜（TMDB）
- `cn-titles.json` — IMDb akas + TMDB 中文片名
- `curated.json` — 人工精选、补看、年代关键词与短评
- `curated-map.json` — 精选/补看与 Top 30、华语榜的匹配结果
- `curated-search.json` — 未匹配影片的 TMDB 搜索结果
- `tmdb-find2.json` — 3,960 个 IMDb ID 的 TMDB `/find` 缓存
- `tmdb-details.json` — 1,559 部影片的 TMDB 详情缓存

## 构建

```powershell
# 1. 合并数据（需要上面的缓存文件）
node build-v2-data.js

# 2. 生成线上版 + 离线版
node build-v2.js

# 3. 发布
node deploy-v2.js
```

`data/films.json` 约 5.3 MB，`dist/offline.html` 约 5.3 MB。GitHub Pages 会自动 gzip 文本，线上首次加载通常在 1–2 MB 量级。

## 数据与算法

- **年度 Top 30**：IMDb 官方每日数据集（`title.basics` + `title.ratings` + `title.akas`）。电影 + 短片（1930 年后只收电影），票数门槛按年代从 100 递增到 20,000；按评分排序，同分看票数。
- **影史前 10%**：从 3,960 部里筛出票数 ≥ 5 万的 1,183 部，再按评分取前 396 部。
- **华语片**：TMDB `with_original_language=zh|cn`（普通话 + 粤语），按年取票数最高的 60 部，再按评分排序取前 20，票数门槛 30。
- **完整资料**：TMDB `/movie/{id}?append_to_response=credits&language=zh-CN`，包括中文简介、片长、类型、制片国家、公司、系列、导演、前 8 位主演。
- **中文片名**：精选层人工译名 → TMDB `zh-CN` → IMDb `title.akas` 的 CN/TW/HK 标题。
- **排序**：搜索、类型页、国家页、相关推荐默认用「评分 × log10(票数)」的综合分，避免只有几十票的冷门片压过经典；也可切换为纯评分、年份、票数、片名。

## 环境变量

TMDB 需要 v3 key，只从环境变量读取：

```powershell
[Environment]::SetEnvironmentVariable("TMDB_KEY", "你的 v3 key", "User")
```

脚本不会把 key 写进 `data/films.json`、`dist/` 或提交记录。

`api.themoviedb.org` 在部分网络会被 DNS 污染，所有请求统一走 `https://api.tmdb.org`。

## 发布说明

`github.com` 的 git 连接在当前网络不可用，发布走 `api.github.com`：

- `deploy-v2.js` 读取 `gh auth token`（不打印）
- 创建 5 个 blob：`index.html`、`offline.html`、`data/films.json`、`.nojekyll`、`README.md`
- 用 Git Trees API 生成新 tree 和 commit，再更新 `main`
- 不依赖本地 `dist/.git`，远端仓库是唯一发布源
- 仓库只发布 `dist/` 产物和 README；构建缓存保留在本地

提交后约 1 分钟，GitHub Pages 自动发布。

## 已知限制

- 2026 年尚未结束，年度榜与华语榜会继续补。
- IMDb 没有「制片国家」字段；国家/地区、片长、主演等来自 TMDB，冷门片可能缺失。
- 全部影片里 722 部没有中文片名；部分 Top 30 影片没有简介和主演。
- 离线版不加载海报；线上版海报来自 `image.tmdb.org`，失败时自动切到 `wsrv.nl` 代理。
- 评分与票数为公开数据，仅供参考，不构成观看建议。
