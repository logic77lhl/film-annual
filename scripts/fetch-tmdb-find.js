const fs = require('fs');
require('./_root');
const { writeJsonAtomic } = require('./lib/fs-utils');

const key = process.env.TMDB_KEY;
if (!key) { console.error('TMDB_KEY missing'); process.exit(1); }

const top = JSON.parse(fs.readFileSync('data/top30.json', 'utf8'));
const ids = [...new Set(Object.values(top.years).flat().map(x => x[0]))];

let cache = {};
if (fs.existsSync('data/tmdb-find2.json')) cache = JSON.parse(fs.readFileSync('data/tmdb-find2.json', 'utf8'));

const refresh = process.env.REFRESH === '1';
const todo = refresh ? [...ids] : ids.filter(id => !(id in cache));
console.log('ids', ids.length, 'cached', Object.keys(cache).length, 'todo', todo.length);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let done = 0, ok = 0;

async function one(id) {
  const url = `https://api.tmdb.org/3/find/${id}?external_source=imdb_id&language=zh-CN&api_key=${key}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
      if (!r.ok) {
        if (r.status >= 500) { await sleep(1000); continue; }
        return null;
      }
      const j = await r.json();
      const m = (j.movie_results || [])[0];
      if (!m) return null;
      return {
        id: m.id,
        t: m.title || '',
        o: m.original_title || '',
        ov: (m.overview || '').slice(0, 700),
        rd: m.release_date || '',
        g: m.genre_ids || [],
        p: m.poster_path || '',
        l: m.original_language || '',
        r: m.vote_average || 0,
        v: m.vote_count || 0
      };
    } catch (e) {
      await sleep(800);
    }
  }
  return null;
}

async function worker() {
  while (todo.length) {
    const id = todo.shift();
    const res = await one(id);
    if (res || !(id in cache)) cache[id] = res;
    done++;
    if (res) ok++;
    if (done % 100 === 0) {
      writeJsonAtomic('data/tmdb-find2.json', cache);
      console.log('progress', done, 'ok', ok, 'left', todo.length);
    }
    await sleep(50);
  }
}

(async () => {
  await Promise.all(Array.from({ length: 8 }, worker));
  writeJsonAtomic('data/tmdb-find2.json', cache);
  console.log('done', done, 'ok', ok, 'total', Object.keys(cache).length);
  console.log('size KB', (fs.statSync('data/tmdb-find2.json').size / 1024).toFixed(0));
})();
