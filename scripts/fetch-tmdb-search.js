const fs = require('fs');
require('./_root');

const key = process.env.TMDB_KEY;
if (!key) { console.error('TMDB_KEY missing'); process.exit(1); }

const unmatched = JSON.parse(fs.readFileSync('data/unmatched.json', 'utf8'));
let cache = {};
if (fs.existsSync('data/curated-search.json')) cache = JSON.parse(fs.readFileSync('data/curated-search.json', 'utf8'));

const norm = s => String(s || '').toLowerCase().replace(/[《》]/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const todo = unmatched.filter(x => !((x.kind + '|' + x.year + '|' + x.index) in cache));
console.log('total', unmatched.length, 'cached', Object.keys(cache).length, 'todo', todo.length);

async function search(query, year) {
  const url = `https://api.tmdb.org/3/search/movie?query=${encodeURIComponent(query)}&language=zh-CN&include_adult=false&api_key=${key}` + (year ? `&year=${year}` : '');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 429) { await sleep(1200); continue; }
      if (!r.ok) return [];
      const j = await r.json();
      return j.results || [];
    } catch (e) { await sleep(700); }
  }
  return [];
}

function pick(results, query, year) {
  let best = null, bestScore = -1e9;
  for (const r of results) {
    const ry = Number((r.release_date || '').slice(0, 4)) || 0;
    const dy = ry ? Math.abs(ry - year) : 3;
    let score = 0;
    const nq = norm(query), nr = norm(r.title), no = norm(r.original_title);
    if (nr === nq || no === nq) score += 10;
    else if (nr.startsWith(nq) || no.startsWith(nq)) score += 5;
    else if (nr.includes(nq) || no.includes(nq)) score += 3;
    if (dy === 0) score += 6;
    else if (dy === 1) score += 2;
    else if (dy >= 3) score -= 5;
    if ((r.vote_count || 0) > 10) score += 1;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return bestScore >= 10 ? { ...best, _score: bestScore } : null;
}

async function one(x) {
  const q = x.o || x.t;
  let results = await search(q, '');
  let best = pick(results, q, x.year);
  if (!best) {
    results = await search(q, x.year);
    best = pick(results, q, x.year);
  }
  if (!best && x.t && x.t !== q) {
    results = await search(x.t, '');
    best = pick(results, x.t, x.year);
  }
  return {
    q,
    year: x.year,
    pick: best ? {
      id: best.id,
      t: best.title || '',
      o: best.original_title || '',
      rd: best.release_date || '',
      p: best.poster_path || '',
      ov: (best.overview || '').slice(0, 500),
      g: best.genre_ids || [],
      l: best.original_language || '',
      r: best.vote_average || 0,
      v: best.vote_count || 0,
      score: best._score
    } : null,
    alts: results.slice(0, 3).map(r => ({ id: r.id, t: r.title, o: r.original_title, rd: r.release_date, v: r.vote_count }))
  };
}

(async () => {
  let done = 0;
  async function worker() {
    while (todo.length) {
      const x = todo.shift();
      const id = x.kind + '|' + x.year + '|' + x.index;
      try { cache[id] = await one(x); } catch (e) { cache[id] = { q: x.o || x.t, year: x.year, pick: null, alts: [], error: e.message }; }
      done++;
      if (done % 20 === 0) {
        fs.writeFileSync('data/curated-search.json', JSON.stringify(cache));
        console.log('progress', done, 'left', todo.length);
      }
      await sleep(120);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  fs.writeFileSync('data/curated-search.json', JSON.stringify(cache));
  const found = Object.values(cache).filter(x => x.pick).length;
  console.log('done', done, 'found', found, 'total', Object.keys(cache).length);
  console.log('misses:');
  for (const [k, v] of Object.entries(cache)) if (!v.pick) console.log(k, v.q, v.year);
})();
