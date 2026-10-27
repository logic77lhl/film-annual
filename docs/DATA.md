# 数据说明

这份文档说明数据从哪里来、怎么合并、字段是什么意思。页面结构见 [DESIGN.md](DESIGN.md)，运行方式见 [MAINTAINER.md](MAINTAINER.md)。

## 1. 数据分层

```text
权威源（IMDb）      元数据（TMDB）       人工层（curated）
     ↓                    ↓                    ↓
  top30.json          cn-films.json       curated.json
  cn-titles.json      tmdb-*.json         curated-map.json
     └────────────────────┴────────────────────┘
                          ↓ build-data
                    data/films.json
                          ↓ check-data
                  data/manifest.json
                          ↓ build-site
              dist/index.html + offline.html
```

- **IMDb** 决定年度榜、影史榜、IMDb 评分和票数。
- **TMDB** 提供华语片候选、中文简介、片长、类型、国家、公司、系列、导演、主演。
- **人工层** 决定精选、补看、年代关键词和短评；人工层不覆盖 IMDb 评分。
- `data/films.json` 是合并后的唯一运行数据，前端不直接读原始缓存。

## 2. 数据来源

| 数据 | 来源 | 用途 |
| --- | --- | --- |
| `title.basics.tsv.gz` | [IMDb Datasets](https://datasets.imdbws.com/) | 片名、年份、类型、是否短片 |
| `title.ratings.tsv.gz` | IMDb Datasets | 评分、票数 |
| `title.akas.tsv.gz` | IMDb Datasets | 中文片名（地区/语言为 zh 的别名） |
| TMDB `discover/movie` | [TMDB API](https://developer.themoviedb.org/) | 华语片年度候选，中文标题、简介、评分 |
| TMDB `find/{imdb_id}` | TMDB API | IMDb ID → TMDB ID，合并榜单与精选 |
| TMDB `movie/{id}` | TMDB API | 片长、类型、国家、公司、系列、导演、主演 |
| `curated.json` | 人工维护 | 精选、补看、短评、年代说明 |

TMDB 请求统一走 `https://api.tmdb.org`。key 只从环境变量 `TMDB_KEY` 读取，不写入仓库、日志或构建产物。

## 3. 榜单口径

### 年度 Top 30

- 年份范围：1895—2026，共 132 年。
- 类型：`movie`；1930 年以前允许 `short`，1930 年起排除短片。
- 排除成人片和无评分影片。
- 最低票数按年代递增：

| 年份 | 最低票数 |
| --- | ---: |
| < 1930 | 100 |
| 1930—1959 | 1,000 |
| 1960—1989 | 5,000 |
| 1990—2009 | 20,000 |
| ≥ 2010 | 20,000 |

- 排序按 IMDb 评分降序；评分相同看票数。
- 票数门槛负责过滤样本太少的影片，不再额外做贝叶斯加权。

### 华语片年度榜

- 用 TMDB `with_original_language=zh|cn` 按年份发现影片。
- 先按票数取候选池（最多 60 部），再过滤票数 `< 30` 或评分 `< 6` 的影片。
- 候选池按评分降序、票数降序排列，每年最多保留 20 部。
- 这是“有足够样本的华语片年度榜”，不是全部华语电影目录。
- 2021 年榜单包含《时代革命》；如用于特定地区发布，请自行评估合规性。

### 影史前 10%

- 从全部年度 Top 30 中取票数 ≥ 50,000 的影片。
- 按 IMDb 评分降序、票数降序排序。
- 取前约 10%（当前为 396 部）。
- 这是“年度 Top 30 的影史子集”，不是 IMDb Top 250 的复制。

### 综合分

搜索、类型、国家、相关推荐使用：

```text
score = rating × log10(votes + 10)
```

评分优先 IMDb；没有 IMDb 评分时使用 TMDB。`+10` 防止零票取对数。

## 4. `data/films.json` 结构

顶层：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `schemaVersion` | number | 数据结构版本，当前为 `1` |
| `generatedAt` | string | 构建日期，`YYYY-MM-DD` |
| `stats` | object | 影片、榜单、影人、类型、国家等计数 |
| `films` | object | `key → 影片` 映射 |
| `years` | object | `年份 → 年度页数据` |
| `allTime` | array | 影史榜的影片 key，按排名 |
| `people` | object | `姓名 → 影人索引` |
| `genres` | object | `genre id → 类型索引` |
| `countries` | object | `ISO code → 国家索引` |

### 影片字段

| 字段 | 说明 |
| --- | --- |
| `key` | 稳定主键，`tt...` / `tmdb-...` / `c-...` / `e-...` |
| `imdb` | IMDb ID，可能为空 |
| `tmdb` | TMDB ID，可能为空 |
| `year` | 年份；优先上映年，其次从 `rd` 截取 |
| `t` / `o` | 中文标题 / 原名 |
| `r` / `v` | IMDb 评分 / 票数 |
| `tr` / `tv` | TMDB 评分 / 票数 |
| `lang` | 原始语言 |
| `genres` | TMDB genre id 数组 |
| `p` | TMDB 海报路径，不含域名 |
| `overview` | 中文简介，截断到约 700—800 字 |
| `rd` | 上映日期 `YYYY-MM-DD` 或空 |
| `top30Rank` | 该片在本年度 Top 30 中的排名 |
| `cnRank` / `cnYear` | 华语榜排名 / 华语榜年份 |
| `allTimeRank` | 影史榜排名 |
| `curated` | 人工精选对象：`note`、`director`、`country`、`year` |
| `extra` | 标记为人工补看 |
| `directors` | 导演名数组 |
| `cast` | `{ n: 演员名, c: 角色名 }` 数组，最多 8 人 |
| `countries` | ISO 3166-1 国家/地区代码数组 |
| `runtime` | 片长（分钟） |
| `companies` | 制片公司名数组，最多 4 个 |
| `collection` | TMDB 系列对象 `{ id, name }` |

### 年份页字段

| 字段 | 说明 |
| --- | --- |
| `era` | 年代分组名 |
| `keyword` | 年度关键词 |
| `intro` | 年度导语 |
| `comment` | 年度点评 |
| `curated` | 精选 key 数组 |
| `extra` | 补看 key 数组 |
| `cn` | 华语榜 key 数组，按排名 |
| `top30` | IMDb Top 30 key 数组，按排名 |

### 影人 / 类型 / 国家

- `people[name]`：`name`、`directed[]`、`acted[]`、`films[]`、`count`、`avg`、`from`、`to`、`role`。
- `genres[id]`：`id`、`name`、`count`、`avg`、`films[]`。
- `countries[code]`：`code`、`name`、`count`、`avg`、`films[]`。

索引里的 `films` 是影片 key 数组，前端按 key 回查 `films`，不再复制一份影片对象。

### `data/manifest.json`

构建后由 `check-data` 生成，是“数据体检报告”，不是数据源：

| 字段 | 说明 |
| --- | --- |
| `status` | `ok` / `warn` / `failed` |
| `dataDate` | 数据构建日期 |
| `yearRange` | 覆盖的年份范围 |
| `currentYearIncomplete` | 当年榜单是否仍在补充 |
| `counts` / `coverage` | 影片、榜单、资料完整度计数 |
| `warnings` | 需要关注的数据问题 |
| `notices` | 已知的资料缺口，不阻止发布 |
| `errors` | 硬错误；非空时不会覆盖旧 manifest |

页面顶部的状态条读取这份文件：显示构建日期、当年补充状态；`warn` 时显示黄色提示。硬错误会阻止提交和部署，旧站点保持不变。

## 5. 缓存与构建顺序

完整刷新：

```text
data/title.basics.tsv.gz
data/title.ratings.tsv.gz
data/title.akas.tsv.gz
        ↓ npm run build:top30
data/top30.json
        ↓ node scripts/enrich-cn.js
data/cn-titles.json
        ↓ npm run refresh:cn            # 需要 TMDB_KEY
data/cn-films.json
        ↓ npm run refresh:tmdb          # 需要 TMDB_KEY
data/tmdb-find2.json
data/curated-map.json
data/unmatched.json
data/curated-search.json
data/core-ids.json
data/tmdb-details.json
        ↓ node scripts/build-data.js
data/films.json
        ↓ npm run check
data/manifest.json
        ↓ npm run build:site
dist/
```

`update.yml` 使用 `npm run update -- --mode full` 把上面整条链路串起来；硬校验失败会停在 `check-data`，不会提交半成品。

各文件作用：

| 文件 | 是否提交 | 说明 |
| --- | --- | --- |
| `data/title.*.tsv.gz` | 否 | IMDb 原始数据，体积大，按需下载 |
| `data/top30.json` | 是 | 年度 Top 30 + 影史榜 |
| `data/cn-titles.json` | 是 | IMDb 中文别名缓存 |
| `data/cn-films.json` | 是 | 华语片年度榜缓存 |
| `data/tmdb-find2.json` | 是 | IMDb → TMDB 映射缓存 |
| `data/tmdb-details.json` | 是 | 核心影片 TMDB 详情缓存 |
| `data/curated.json` | 是 | 人工精选、补看、点评 |
| `data/curated-map.json` | 是 | 精选 → 榜单 key 的匹配结果 |
| `data/unmatched.json` | 是 | 未匹配到 TMDB 的精选/补看 |
| `data/curated-search.json` | 是 | 人工搜索匹配缓存 |
| `data/core-ids.json` | 是 | 需要拉取详情的 TMDB ID |
| `data/films.json` | 是 | 合并后的运行数据，约 5.3 MB |
| `data/manifest.json` | 是 | 数据体检结果，页面状态条使用 |
| `data/films-pretty.json` | 否 | 调试用格式化输出 |
| `data/run-summary.json` | 否 | 更新流程的步骤摘要，Actions artifact |
| `dist/` | 否 | 构建产物 |

缓存提交进仓库的目的是让构建不依赖网络，并避免 TMDB 限流；不是数据源本身。

## 6. 更新节奏

仓库的 `update.yml` 已经按下面的节奏运行：

- **每年 1 月和 7 月**：刷新 IMDb 数据、Top 30、华语榜、TMDB 详情。
- **每年一次**：人工调整精选、补看和年度点评。
- **每月一次心跳**：`heartbeat.yml` 写入提交，防止 GitHub 在 60 天无活动后停用定时 workflow。

2026 年数据尚未完结。脚本从 `scripts/lib/config.js` 读取当前年份，2027 年会自动覆盖新年份；README 和前端里的静态年份文案仍需人工更新。

## 7. 已知缺口

- 4,880 部影片中 722 部没有中文片名。
- 1,559 部有完整 TMDB 详情；其余只有榜单基础字段，国家、片长、主演可能为空。
- IMDb 没有制片国家字段，国家信息依赖 TMDB。
- 四部人工精选/补看没有合适 TMDB 匹配：`Tearing Down the Spanish Flag`、`Niagara Falls`、`Queen Elizabeth`、`可能的爱情`，以 `c-...` / `e-...` 保留。
- 2026 年榜单会随数据更新变化。

## 8. 授权与归属

- IMDb 数据来自 IMDb Datasets，使用需遵守 IMDb 的条款。
- This product uses the TMDB API but is not endorsed or certified by TMDB.
- 海报、剧照和影片信息版权归各自权利人，本项目仅用于信息展示。
- 代码 MIT；原创文字与点评 CC BY-NC 4.0。完整说明见 [NOTICE.md](../NOTICE.md)。
