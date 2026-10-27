const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
require('./_root');
const { writeJsonAtomic } = require('./lib/fs-utils');

const MODES = new Set(['full', 'data-only', 'site-only']);
const IMDB_FILES = [
  ['title.basics.tsv.gz', 'https://datasets.imdbws.com/title.basics.tsv.gz'],
  ['title.ratings.tsv.gz', 'https://datasets.imdbws.com/title.ratings.tsv.gz'],
  ['title.akas.tsv.gz', 'https://datasets.imdbws.com/title.akas.tsv.gz']
];

function parseArgs(argv) {
  const out = { mode: 'full', skipDownload: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--skip-download') out.skipDownload = true;
    else if (arg === '--mode') out.mode = argv[++i];
    else if (arg.startsWith('--mode=')) out.mode = arg.slice('--mode='.length);
    else throw new Error(`未知参数：${arg}`);
  }
  if (!MODES.has(out.mode)) {
    throw new Error(`mode 必须是 full、data-only 或 site-only，收到：${out.mode || '(空)'}`);
  }
  return out;
}

function usage() {
  console.log(`用法：node scripts/update.js [--mode full|data-only|site-only] [--skip-download]

full       下载 IMDb、刷新 TMDB、构建数据与站点（默认）
data-only  下载 IMDb、刷新 TMDB、构建数据，不构建站点
site-only  校验现有数据并重建站点，不重新生成数据、不发网络请求`);
}

async function download(url, dest) {
  const tmp = `${dest}.download-${process.pid}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`下载失败 ${res.status} ${url}`);
  }
  try {
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
    fs.renameSync(tmp, dest);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch (_) {}
    throw err;
  }
}

async function downloadImdb(steps) {
  for (const [name, url] of IMDB_FILES) {
    const dest = path.join('data', name);
    const started = Date.now();
    console.log(`[update] download ${name}`);
    await download(url, dest);
    const size = fs.statSync(dest).size;
    steps.push({ name: `download:${name}`, ok: true, ms: Date.now() - started, bytes: size });
    console.log(`[update] ${name} ${(size / 1024 / 1024).toFixed(1)} MB`);
  }
}

function runNode(script, steps, env = {}) {
  const started = Date.now();
  console.log(`[update] ${script}`);
  const result = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });
  const step = {
    name: script,
    ok: result.status === 0,
    code: result.status,
    ms: Date.now() - started
  };
  steps.push(step);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${script} 退出码 ${result.status}`);
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[update] ${err.message}`);
    usage();
    process.exit(1);
  }
  if (args.help) {
    usage();
    return;
  }

  if (args.mode !== 'site-only' && !process.env.TMDB_KEY) {
    console.error('[update] 缺少 TMDB_KEY；full/data-only 需要 TMDB API key');
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  const steps = [];
  const summary = { mode: args.mode, startedAt, finishedAt: null, ok: false, steps };
  let error = null;

  try {
    if (args.mode === 'full' || args.mode === 'data-only') {
      if (args.skipDownload) {
        console.log('[update] skip IMDb download');
      } else {
        await downloadImdb(steps);
      }
      runNode('scripts/build-top30.js', steps);
      runNode('scripts/enrich-cn.js', steps);
      runNode('scripts/fetch-cn-films.js', steps);
      runNode('scripts/fetch-tmdb-find.js', steps, { REFRESH: '1' });
      runNode('scripts/match-curated.js', steps);
      runNode('scripts/fetch-tmdb-search.js', steps, { REFRESH: '1' });
      runNode('scripts/build-core-ids.js', steps);
      runNode('scripts/fetch-tmdb-details.js', steps, { REFRESH: '1' });
    }

    if (args.mode !== 'site-only') {
      runNode('scripts/build-data.js', steps);
    }
    runNode('scripts/check-data.js', steps);

    if (args.mode !== 'data-only') {
      runNode('scripts/build-site.js', steps);
    }

    summary.ok = true;
  } catch (err) {
    error = err;
    console.error(`[update] failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    summary.finishedAt = new Date().toISOString();
    writeJsonAtomic('data/run-summary.json', summary, true);
    const okSteps = steps.filter(s => s.ok).length;
    console.log(`[update] ${summary.ok ? 'ok' : 'failed'} (${okSteps}/${steps.length} steps)`);
    if (error && !steps.some(s => !s.ok)) {
      console.error('[update] failure happened outside a child process');
    }
  }
}

if (require.main === module) main();
module.exports = { MODES, parseArgs };
