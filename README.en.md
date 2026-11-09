[中文](README.md) | **English**

# Film Annual 1895–2026

A static film yearbook you can browse by year, film, director, genre, and country: 132 years of annual picks, "also worth watching" lists, a Top 20 of Chinese-language films, IMDb's annual Top 30, plus the top 10% of film history.

[Live](https://logic77lhl.github.io/film-annual/) · [Offline single file](https://logic77lhl.github.io/film-annual/offline.html) · [Design notes](docs/DESIGN.md) · [Data notes](docs/DATA.md) · [Maintainer notes](docs/MAINTAINER.md)

![Film Annual home](docs/screenshot.png)

## What this is

A purely static site: no backend, no login, no recommendation algorithm. Every page is driven by one JSON file and works the moment you open it; you can also download a single HTML file and read it offline.

Good for:

- flipping through a year's films quickly
- finding films by director, actor, genre, or country
- taking an existing film dataset and building something else with it

Not good for:

- live box office, streaming availability, or user reviews
- anything resembling a commercial recommender

## What it does

- 132 years, 4,880 films: annual picks + also-watching + Chinese Top 20 + Top 30
- Top 10% of film history, filterable by decade
- Films, directors, actors, genres, and countries link to each other
- Search across title, original title, director, actor, year, genre, country
- My list: seen / want to see, star ratings, CSV export, stored in the browser
- Data status bar: build date, how complete the current year is, known gaps
- Offline single-file build — double-click to open
- Dark layouts for desktop and mobile

## Quick start

Node.js 20 or newer.

```bash
npm run build
npm run serve
```

Open `http://localhost:8080`.

`npm run build` rebuilds `data/films.json` from the cached data in the repo, runs a data health check into `data/manifest.json`, then generates `dist/`. No network access and no TMDB key required.

To change only the site:

```bash
npm run build:site
npm run serve
```

Data health check only:

```bash
npm run check
```

A full refresh (IMDb + Chinese charts + TMDB) needs `TMDB_KEY`. Use the single entry point:

```bash
npm run update -- --mode full
```

## Layout

```text
app/                  front end
  index.html          page shell
  app.css             styles
  app.js              routing, rendering, search, lists
data/                 data and fetch caches
  curated.json        hand-picked films, also-watching, notes
  top30.json          IMDb annual Top 30
  cn-films.json       Chinese-language annual charts
  cn-titles.json      Chinese titles
  tmdb-*.json         TMDB caches
  films.json          merged dataset
  manifest.json       health-check results and build date
scripts/              data and build scripts
  lib/                config, atomic writes, data checks
docs/                 design, data, maintainer docs
tests/                Node's built-in test runner
dist/                 build output (not committed)
.github/workflows/    deploy, data update, monthly heartbeat
```

## Data scale

As of 2026-10-27:

- 4,880 films
- 3,960 from IMDb's annual Top 30 (132 years × 30)
- 846 from Chinese-language annual charts (65 years)
- 513 hand-picked + 231 also-watching
- 396 in the top 10% of film history
- 1,559 with full TMDB records
- 2,438 people: 776 directors, 1,798 actors
- 49 countries/regions, 19 genres

## Sources

- **IMDb daily datasets**: annual Top 30, all-time list, ratings, vote counts
- **TMDB**: Chinese-language charts, synopses, runtime, genres, countries, companies, collections, directors, cast
- **Hand curation**: `data/curated.json` — picks, also-watching, decade keywords, short notes

Field-level details and build order are in [docs/DATA.md](docs/DATA.md).

## Data updates

- `.github/workflows/update.yml` refreshes every January and July, or manually with `full`, `data-only`, or `site-only`.
- Tests run before any update; after building, `check-data` blocks hard errors from being committed or deployed.
- Results go into `data/manifest.json`; the page shows the data date and what's still missing.
- `.github/workflows/heartbeat.yml` commits once a month so GitHub doesn't disable the schedule after 60 days of inactivity.
- `TMDB_KEY` lives only in GitHub Actions secrets or a local environment variable.

## Known limits

- 2026 isn't over, so the annual and Chinese charts will keep growing.
- 722 of the 4,880 films have no Chinese title yet — mostly early silents and obscure regional films.
- IMDb has no country field; country, runtime, and cast come from TMDB and may be missing for obscure titles.
- The offline build skips posters; the online build falls back to the `wsrv.nl` proxy when a poster fails.
- Ratings and vote counts are public data for reference only, not viewing advice.

## License

- Code: MIT, see [LICENSE](LICENSE)
- Original writing and notes: CC BY-NC 4.0
- IMDb / TMDB data and posters belong to their respective owners; follow their terms

Full details in [NOTICE.md](NOTICE.md).
