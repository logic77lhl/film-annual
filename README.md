# 电影年鉴 1895—2026

一个可以按年份、影片、导演、类型、国家浏览的静态电影年鉴：132 年，每年精选、补看、华语片 Top 20、IMDb 年度 Top 30，外加影史前 10%。

[在线版](https://logic77lhl.github.io/film-annual/) · [离线单文件版](https://logic77lhl.github.io/film-annual/offline.html) · [设计说明](docs/DESIGN.md) · [数据说明](docs/DATA.md) · [维护说明](docs/MAINTAINER.md)

![电影年鉴首页](docs/screenshot.png)

## 这是什么

这是一个纯静态网站，没有后端、没有登录、没有推荐算法。所有页面由一份 JSON 数据驱动，打开即用；也可以下载单个 HTML 文件离线阅读。

适合：

- 想按年份快速翻片单的人
- 想按导演、演员、类型、国家找片的人
- 想拿一份现成电影数据集做二次开发的人

不适合：

- 需要实时票房、流媒体片源或用户评论的人
- 需要商业级推荐系统的人

## 能做什么

- 132 年，4,880 部影片；每年精选 + 补看 + 华语 20 + Top 30
- 影史前 10%，支持按年代筛选
- 影片、导演、演员、类型、国家互相跳转
- 搜索片名、原名、导演、演员、年份、类型、国家
- 我的片单：看过 / 想看、星级、CSV 导出，保存在浏览器本地
- 数据状态条：显示构建日期、当年补充状态和资料缺口
- 离线单文件版，双击即可打开
- 深色桌面 / 移动端布局

## 快速开始

需要 Node.js 20 或更高版本。

```bash
npm run build
npm run serve
```

打开 `http://localhost:8080`。

`npm run build` 会用仓库里的数据缓存重新生成 `data/films.json`，跑一遍数据体检并写入 `data/manifest.json`，再生成 `dist/`。不需要联网，也不需要 TMDB key。

如果只想改页面：

```bash
npm run build:site
npm run serve
```

只跑数据体检：

```bash
npm run check
```

包含 IMDb、华语榜和 TMDB 的完整刷新需要 `TMDB_KEY`，建议直接使用统一入口：

```bash
npm run update -- --mode full
```

## 目录

```text
app/                 前端页面
  index.html         页面壳
  app.css            样式
  app.js             路由、渲染、搜索、片单
data/                数据和抓取缓存
  curated.json       人工精选、补看、点评
  top30.json         IMDb 年度 Top 30
  cn-films.json      华语片年度榜
  cn-titles.json     中文片名
  tmdb-*.json        TMDB 缓存
  films.json         合并后的完整数据
  manifest.json      数据体检结果与构建日期
scripts/             数据与构建脚本
  lib/               配置、原子写、数据体检
docs/                设计、数据、维护文档
tests/               Node 内置测试
dist/                构建产物（不提交）
.github/workflows/   部署、数据更新、定时心跳
```

## 数据规模

截至 2026-10-27：

- 4,880 部影片
- 3,960 部 IMDb 年度 Top 30（132 年 × 30）
- 846 部华语片年度榜（65 个年份）
- 513 部人工精选 + 231 部补看
- 396 部影史前 10%
- 1,559 部有完整 TMDB 资料
- 2,438 位影人：776 位导演、1,798 位演员
- 49 个国家/地区、19 个类型

## 数据来源

- **IMDb 每日数据集**：年度 Top 30、影史榜、评分、票数
- **TMDB**：华语片年度榜、中文简介、片长、类型、国家、公司、系列、导演、主演
- **人工精选**：`data/curated.json`，包括精选、补看、年代关键词和短评

具体口径、字段和构建顺序见 [数据说明](docs/DATA.md)。

## 数据更新

- `.github/workflows/update.yml` 每年 1 月和 7 月自动刷新，也可手动选择 `full`、`data-only`、`site-only`。
- 更新前先跑测试；数据构建后跑 `check-data`，硬错误会阻止提交和发布。
- 体检结果写入 `data/manifest.json`，页面顶部显示数据日期和需要补充的项。
- `.github/workflows/heartbeat.yml` 每月写入一次心跳，避免 GitHub 在 60 天无活动后停用定时任务。
- `TMDB_KEY` 只放在 GitHub Actions Secrets 或本地环境变量里。

## 已知限制

- 2026 年尚未结束，年度榜与华语榜会继续补。
- 4,880 部里有 722 部暂无中文片名，主要是早期默片和冷门地方片。
- IMDb 没有制片国家字段；国家、片长、主演等来自 TMDB，冷门片可能缺失。
- 离线版不加载海报；线上版海报失败时会切到 `wsrv.nl` 代理。
- 评分与票数为公开数据，仅供参考，不构成观看建议。

## 授权

- 代码：MIT，见 [LICENSE](LICENSE)
- 原创文字与点评：CC BY-NC 4.0
- IMDb / TMDB 数据与海报：归各自权利方，使用需遵守其条款

完整说明见 [NOTICE.md](NOTICE.md)。
