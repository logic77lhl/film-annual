const fs = require('fs');
require('./_root');

const key = process.env.TMDB_KEY;
if (!key) { console.error('TMDB_KEY missing'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const years = {};
let total = 0;

async function getYear(y) {
  const map = new Map();
  for (let page = 1; page <= 3; page++) {
    const url = `https://api.tmdb.org/3/discover/movie?with_original_language=zh%7Ccn&primary_release_year=${y}` +
      `&sort_by=vote_count.desc&language=zh-CN&page=${page}&api_key=${key}`;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const r = await fetch(url);
        if (r.status === 429) { await sleep(1200 * (attempt + 1)); continue; }
        if (!r.ok) break;
        const j = await r.json();
        for (const m of (j.results || [])) {
          if (!m.id || map.has(m.id)) continue;
          if ((m.vote_count || 0) < 30) continue;
          if ((m.vote_average || 0) < 6) continue;
          map.set(m.id, [m.id, m.title, m.original_title, m.original_language, m.vote_average, m.vote_count]);
        }
        break;
      } catch (e) {
        await sleep(800);
      }
    }
    await sleep(120);
  }
  const arr = [...map.values()].sort((a, b) => b[4] - a[4] || b[5] - a[5]);
  return arr.slice(0, 20);
}

(async () => {
  for (let y = 1895; y <= 2026; y++) {
    try {
      const arr = await getYear(y);
      if (arr.length) { years[y] = arr; total += arr.length; }
      if (y % 10 === 0) console.log('year', y, 'count', arr.length, 'total', total);
    } catch (e) {
      console.log('year', y, 'ERR', e.message);
    }
  }
  fs.writeFileSync('data/cn-films.json', JSON.stringify({ years, total }));
  console.log('years with cn films', Object.keys(years).length, 'total', total);
  console.log('size KB', (fs.statSync('data/cn-films.json').size / 1024).toFixed(0));
  for (const y of [1994, 2000, 2010, 2024]) {
    console.log(y, (years[y] || []).map(x => `${x[1]}|${x[4]}`).join(' / '));
  }
})();
