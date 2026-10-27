const fs = require('fs');
require('./_root');
const { writeJsonAtomic } = require('./lib/fs-utils');

const key = process.env.TMDB_KEY;
if (!key) { console.error('TMDB_KEY missing'); process.exit(1); }

const ids = JSON.parse(fs.readFileSync('data/core-ids.json', 'utf8'));
let cache = {};
if (fs.existsSync('data/tmdb-details.json')) cache = JSON.parse(fs.readFileSync('data/tmdb-details.json', 'utf8'));

const refresh = process.env.REFRESH === '1';
const todo = refresh ? [...ids] : ids.filter(id => !(id in cache));
console.log('ids', ids.length, 'cached', Object.keys(cache).length, 'todo', todo.length);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let done = 0, ok = 0;

async function one(id) {
  const url = `https://api.tmdb.org/3/movie/${id}?append_to_response=credits&language=zh-CN&api_key=${key}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
      if (r.status === 404) return null;
      if (!r.ok) { if (r.status >= 500) { await sleep(1000); continue; } return null; }
      const j = await r.json();
      const crew = (j.credits?.crew || []).filter(c => c.job === 'Director');
      const cast = (j.credits?.cast || []).slice(0, 8).map(c => ({ n: c.name, c: c.character || '' }));
      return {
        id: j.id,
        t: j.title || '',
        o: j.original_title || '',
        ov: (j.overview || '').slice(0, 800),
        rd: j.release_date || '',
        rt: j.runtime || 0,
        g: (j.genres || []).map(g => g.id),
        gn: (j.genres || []).map(g => g.name),
        p: j.poster_path || '',
        l: j.original_language || '',
        r: j.vote_average || 0,
        v: j.vote_count || 0,
        cs: (j.production_countries || []).map(c => c.iso_3166_1),
        co: (j.production_companies || []).slice(0, 4).map(c => c.name),
        col: j.belongs_to_collection ? { id: j.belongs_to_collection.id, name: j.belongs_to_collection.name } : null,
        ds: crew.map(c => c.name),
        cast
      };
    } catch (e) { await sleep(800); }
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
      writeJsonAtomic('data/tmdb-details.json', cache);
      console.log('progress', done, 'ok', ok, 'left', todo.length);
    }
    await sleep(60);
  }
}

(async () => {
  await Promise.all(Array.from({ length: 5 }, worker));
  writeJsonAtomic('data/tmdb-details.json', cache);
  console.log('done', done, 'ok', ok, 'total', Object.keys(cache).length);
  console.log('size KB', (fs.statSync('data/tmdb-details.json').size / 1024).toFixed(0));
})();
