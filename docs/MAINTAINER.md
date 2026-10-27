# 维护说明

这份文档面向要改代码、刷数据或部署的人。数据口径见 [DATA.md](DATA.md)，页面逻辑见 [DESIGN.md](DESIGN.md)。

## 1. 环境

- Node.js 20+
- 可选：TMDB API key（只有刷新数据时需要）
- 可选：GitHub CLI（本地排查 GitHub API 时用）

仓库没有 npm 依赖，`npm install` 不是必需的，但可以正常执行。

## 2. 本地运行

```bash
npm run build
npm run serve
```

打开 `http://localhost:8080`。端口被占用时：

```powershell
$env:PORT=8090; npm run serve
```

只改前端：

```bash
npm run build:site
npm run serve
```

`npm run build:site` 读取 `data/films.json`、`data/manifest.json`、`app/`，生成 `dist/`：

- `dist/index.html`：线上完整版，运行时加载 `data/films.json`
- `dist/offline.html`：离线单文件版，数据直接内联
- `dist/data/films.json`：线上数据
- `dist/data/manifest.json`：数据体检结果，页面状态条也使用它
- `dist/.nojekyll`：GitHub Pages 配置

`dist/` 不提交。

只跑数据体检：

```bash
npm run check
```

体检会检查年份连续性、引用完整性、重复 TMDB ID、统计口径、敏感字符等；硬错误返回非零，`data/manifest.json` 不会被覆盖。软提示（中文片名、TMDB 详情、国家缺口、当年榜单未满）只写入 manifest，不阻止发布。

## 3. 数据刷新

### 3.1 只重建合并数据

```bash
npm run build:data
```

不需要联网。它使用仓库里已提交的 `data/top30.json`、`data/cn-films.json`、`data/tmdb-*.json`、`data/curated*.json` 重新生成 `data/films.json`，然后运行 `check-data` 写入 `data/manifest.json`。

### 3.2 刷新 IMDb 年度 Top 30

先下载三个 IMDb 数据集到 `data/`：

```powershell
curl.exe -L https://datasets.imdbws.com/title.basics.tsv.gz -o data/title.basics.tsv.gz
curl.exe -L https://datasets.imdbws.com/title.ratings.tsv.gz -o data/title.ratings.tsv.gz
curl.exe -L https://datasets.imdbws.com/title.akas.tsv.gz -o data/title.akas.tsv.gz
```

然后：

```bash
npm run build:top30
node scripts/enrich-cn.js
```

`build:top30` 生成 `data/top30.json`；`enrich-cn` 从 akas 提取中文片名，生成 `data/cn-titles.json`。

### 3.3 刷新华语榜

```powershell
$env:TMDB_KEY = "你的 key"
npm run refresh:cn
```

生成 `data/cn-films.json`。key 只放在环境变量里，不要写进任何文件。

### 3.4 刷新 TMDB 映射与详情

```powershell
$env:TMDB_KEY = "你的 key"
$env:REFRESH = "1"
npm run refresh:tmdb
```

这条命令按顺序执行：

```text
fetch-tmdb-find → match-curated → fetch-tmdb-search
→ build-core-ids → fetch-tmdb-details
```

- `REFRESH=1` 会重新请求已有缓存；不设置时只补缺失 ID。
- 首次运行建议先设 `REFRESH=1`，之后日常补数据可以去掉。
- 如果网络无法访问 `api.themoviedb.org`，脚本使用的是 `https://api.tmdb.org`。
- 请求有失败重试和限速等待；中途中断后重跑会从缓存继续。

### 3.5 重新生成数据和站点

```bash
npm run build
```

等价的完整命令是：

```bash
node scripts/build-data.js
node scripts/check-data.js
node scripts/build-site.js
```

检查输出中的统计数字和 `data/manifest.json` 的 `status` / `warnings` 是否合理，再本地打开 `dist/index.html` 和 `dist/offline.html`。

### 3.6 人工层

`data/curated.json` 是唯一需要手工编辑的核心文件：

- `curated` / `extra`：精选和补看
- `eras`：年代说明
- 年度 `keyword` / `intro` / `comment`：年度页文案

改完后重新跑 `npm run build:data && npm run build:site`。如果新增了精选但还没有匹配结果，需要按上面的 TMDB 流程跑一次 `match-curated` / `fetch-tmdb-search`。

## 4. 部署

当前部署方式：**GitHub Actions → GitHub Pages**。

```text
push main
  → .github/workflows/deploy.yml
  → npm test
  → npm run build（build-data + check-data + build-site）
  → 上传 dist/ 作为 Pages artifact
  → GitHub Pages 发布
```

第一次启用时，在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。仓库里的 workflow 已经按这个模式写好。

不要手动把 `dist/` 提交到 main；它会被 `.gitignore` 忽略。线上地址：

- https://logic77lhl.github.io/film-annual/
- https://logic77lhl.github.io/film-annual/offline.html

### 部署排查

- **404**：确认 Pages Source 是 GitHub Actions，且最近一次 `Deploy site` 成功。
- **页面空白**：打开开发者工具看 `data/films.json` 是否 404；线上版依赖这个文件。
- **离线版空白**：确认 `dist/offline.html` 内联了 `window.__FILMS__`，并且构建时 `data/films.json` 可解析。
- **海报不显示**：TMDB 图片被墙时，线上版会尝试 `wsrv.nl` 代理；离线版不保证海报。
- **workflow 没有触发**：确认改动在 `main` 分支，或手动运行 `Deploy site`。

## 5. 自动更新

仓库使用三个 workflow：

| 文件 | 作用 | 触发 |
| --- | --- | --- |
| `deploy.yml` | 测试、构建、发布 Pages | push main / 手动 |
| `update.yml` | 下载 IMDb、刷新 TMDB、构建、体检、提交 `data/`、触发部署 | 1 月 / 7 月 / 手动 |
| `heartbeat.yml` | 每月写一次 `.github/heartbeat`，避免 60 天无活动停用 schedule | 每月 / 手动 |

`update.yml` 的完整流程：

```text
npm test
  → npm run update -- --mode full
      → 下载 IMDb 三个数据集
      → build-top30 + enrich-cn + refresh:cn
      → refresh:tmdb（使用 secrets.TMDB_KEY）
      → build-data + check-data + build-site
  → 只提交 data/ 变化
  → gh workflow run deploy.yml
```

手动运行时 `mode` 可选：

- `full`：抓取 + 构建数据 + 构建站点
- `data-only`：抓取 + 构建数据，不构建站点
- `site-only`：校验现有数据并重建站点，不重新生成数据、不发网络请求

注意：

- `TMDB_KEY` 放在 **Settings → Secrets and variables → Actions**，不要放进 workflow 的明文。
- IMDb 原始 `.tsv.gz` 不要提交，体积大且每日变化。
- 硬校验失败时不会提交数据，也不会触发部署；软提示会写入 `data/manifest.json` 并显示在页面顶部。
- `data/run-summary.json` 是本次运行的步骤摘要，不提交，作为 Actions artifact 保留 14 天。
- 如果 GitHub 仍停用了 schedule，手动运行一次 workflow 即可恢复。

## 6. 仓库约定

- 根目录只放文档、配置和 workflow。
- 前端只改 `app/`。
- 数据只放 `data/`；生成物 `data/films-pretty.json` 不提交。
- 抓取和构建逻辑只放 `scripts/`。
- 设计、数据、维护说明只放 `docs/`。
- 不提交 `dist/`、`node_modules/`、IMDb 原始数据、日志和临时截图。

## 7. 常见问题

### 2027 年数据不出现

数据脚本已经从 `scripts/lib/config.js` 读取当前年份（可用 `FILM_YEAR=2027` 临时覆盖），所以 `build-top30`、`fetch-cn-films`、`build-data` 会自动覆盖新年份。还需要手动处理：

- `app/` 和 README 里的静态年份文案（1895—2026、132 年）
- 如需固定测试年份，可在本地设置 `FILM_YEAR`，但不要把它写进生产 workflow

### 某些影片没有国家、片长、主演

这些字段来自 TMDB 详情。IMDb Top 30 里的冷门片可能没有 TMDB 条目，或 TMDB 没有完整信息；页面会留空，不用假数据填。

### 精选没有出现在页面上

检查 `data/curated-map.json` 和 `data/unmatched.json`。没有匹配到榜单的精选会以 `c-...` 存在；如果连 TMDB 也搜不到，会保留为 curated-only。

### TMDB 返回 429

脚本会自动等待重试。频繁刷新时降低并发或分批跑；缓存会保留已完成的部分。
