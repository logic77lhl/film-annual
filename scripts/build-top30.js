const fs = require('fs');
require('./_root');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

const DATA = path.join(process.cwd(), 'data');
const OUT = path.join(process.cwd(), 'data', 'top30.json');

function streamLines(file) {
  return readline.createInterface({
    input: fs.createReadStream(path.join(DATA, file)).pipe(zlib.createGunzip()),
    crlfDelay: Infinity
  });
}

async function loadRatings() {
  const map = new Map();
  let first = true;
  for await (const line of streamLines('title.ratings.tsv.gz')) {
    if (first) { first = false; continue; }
    const i = line.indexOf('\t');
    if (i < 0) continue;
    const j = line.indexOf('\t', i + 1);
    const id = line.slice(0, i);
    const r = parseFloat(line.slice(i + 1, j));
    const v = parseInt(line.slice(j + 1), 10);
    if (Number.isFinite(r) && Number.isFinite(v)) map.set(id, [r, v]);
  }
  return map;
}

(async () => {
  console.time('ratings');
  const ratings = await loadRatings();
  console.timeEnd('ratings');
  console.log('ratings:', ratings.size);

  const byYear = new Map();
  let first = true;
  let scanned = 0, kept = 0;
  console.time('basics');

  for await (const line of streamLines('title.basics.tsv.gz')) {
    if (first) { first = false; continue; }
    scanned++;
    const p = line.split('\t');
    if (p.length < 9) continue;
    const [id, type, primary, original, adult, startY] = p;
    if (type !== 'movie' && type !== 'short') continue;
    if (adult === '1') continue;
    const y = parseInt(startY, 10);
    if (type === 'short' && y >= 1930) continue;
    if (!(y >= 1895 && y <= 2026)) continue;

    const rt = ratings.get(id);
    if (!rt) continue;
    const [r, v] = rt;
    const minVotes = y < 1930 ? 100 : y < 1960 ? 1000 : y < 1990 ? 5000 : y < 2010 ? 20000 : 20000;
    if (v < minVotes) continue;

    const m = y < 1930 ? 300 : y < 1970 ? 2000 : y < 2000 ? 4000 : 8000;
    const C = 6.9;
    const score = (v / (v + m)) * r + (m / (v + m)) * C;

    const rec = [id, primary, original && original !== '\\N' ? original : '', r, v, Math.round(score * 100) / 100, type === 'short' ? 1 : 0];
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(rec);
    kept++;
  }
  console.timeEnd('basics');
  console.log('scanned:', scanned, 'kept:', kept);

  const years = {};
  for (let y = 1895; y <= 2026; y++) {
    const arr = byYear.get(y) || [];
    arr.sort((a, b) => b[3] - a[3] || b[4] - a[4]);
    years[y] = arr.slice(0, 30);
  }

  // 影史：所有年度 Top30 合并，票数 5 万以上的，按评分排序，取前 396（约 10%）
  const annual = [];
  for (const y in years) for (const rec of years[y]) annual.push([parseInt(y, 10), ...rec]);
  const pool = annual.filter(x => x[5] >= 50000);
  pool.sort((a, b) => b[4] - a[4] || b[5] - a[5]);
  const top10 = pool.slice(0, Math.min(396, pool.length));

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'IMDb title.basics + title.ratings (daily dataset)',
    total: annual.length,
    qualified: pool.length,
    years,
    allTime: top10
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('years:', Object.keys(years).length, 'annual:', annual.length, 'qualified:', pool.length, 'allTime:', top10.length);
  console.log('size MB:', (fs.statSync(OUT).size / 1048576).toFixed(2));
  console.log('sample 1994:', years[1994].slice(0, 5).map(x => x[1] + '|' + x[3]).join(', '));
})();
