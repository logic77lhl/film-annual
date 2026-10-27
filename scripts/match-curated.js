const fs = require('fs');
require('./_root');
const { writeJsonAtomic } = require('./lib/fs-utils');

const curated = JSON.parse(fs.readFileSync('data/curated.json', 'utf8'));
const top = JSON.parse(fs.readFileSync('data/top30.json', 'utf8'));
const cn = JSON.parse(fs.readFileSync('data/cn-films.json', 'utf8'));
const find2 = JSON.parse(fs.readFileSync('data/tmdb-find2.json', 'utf8'));

const norm = s => String(s || '').toLowerCase().replace(/[《》]/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');

const topMap = new Map();
for (const [year, arr] of Object.entries(top.years)) {
  for (const x of arr) {
    const rec = { type: 'top', imdb: x[0], key: x[0], year: Number(year), title: x[1], original: x[2], tmdb: find2[x[0]]?.id || null };
    for (const t of [x[1], x[2]]) {
      const k = norm(t) + '|' + year;
      if (!topMap.has(k)) topMap.set(k, []);
      topMap.get(k).push(rec);
    }
  }
}

const cnMap = new Map();
for (const [year, arr] of Object.entries(cn.years)) {
  for (const x of arr) {
    const rec = { type: 'cn', tmdb: x[0], key: 'tmdb-' + x[0], year: Number(year), title: x[1], original: x[2] };
    for (const t of [x[1], x[2]]) {
      const k = norm(t) + '|' + year;
      if (!cnMap.has(k)) cnMap.set(k, []);
      cnMap.get(k).push(rec);
    }
  }
}

function pick(list, year, original, title) {
  if (!list || !list.length) return null;
  const no = norm(original), nt = norm(title);
  let best = null, bestScore = -1e9;
  for (const r of list) {
    let score = 0;
    const dy = Math.abs(r.year - year);
    if (dy === 0) score += 8;
    else if (dy === 1) score += 2;
    else score -= 6;
    if (norm(r.original) === no || norm(r.title) === no) score += 6;
    if (norm(r.title) === nt || norm(r.original) === nt) score += 4;
    if (r.type === 'top') score += 1;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return bestScore >= 8 ? best : null;
}

function matchFilm(year, t, o) {
  const nt = norm(t), no = norm(o || t);
  for (const dy of [0, 1, -1]) {
    const y = year + dy;
    const lists = [];
    for (const n of new Set([no, nt])) {
      const kt = topMap.get(n + '|' + y);
      if (kt) lists.push(...kt);
      const kc = cnMap.get(n + '|' + y);
      if (kc) lists.push(...kc);
    }
    const hit = pick(lists, year, o || t, t);
    if (hit) return hit;
  }
  return null;
}

const out = { curated: {}, extra: {}, stats: {} };
const unmatched = [];
let cTop = 0, cCn = 0, cNone = 0, eTop = 0, eCn = 0, eNone = 0;

curated.years.forEach(d => {
  d.films.forEach((f, i) => {
    const hit = matchFilm(d.year, f.t, f.o);
    const id = d.year + '|' + i;
    if (hit) {
      out.curated[id] = { type: hit.type, key: hit.key, tmdb: hit.tmdb, imdb: hit.imdb || null, title: f.t, original: f.o, director: f.d, country: f.c, note: f.n };
      if (hit.type === 'top') cTop++; else cCn++;
    } else {
      cNone++;
      out.curated[id] = { type: 'none', key: null, tmdb: null, title: f.t, original: f.o, director: f.d, country: f.c, note: f.n };
      unmatched.push({ kind: 'curated', year: d.year, index: i, t: f.t, o: f.o, d: f.d, c: f.c, n: f.n });
    }
  });
});

for (const [year, arr] of Object.entries(curated.extra)) {
  arr.forEach((x, i) => {
    const t = String(x[0] || '').replace(/[《》]/g, '');
    const o = x[1] || '';
    const hit = matchFilm(Number(year), t, o);
    const id = year + '|' + i;
    if (hit) {
      out.extra[id] = { type: hit.type, key: hit.key, tmdb: hit.tmdb, imdb: hit.imdb || null, title: t, original: o, director: x[2] || '', country: x[3] || '' };
      if (hit.type === 'top') eTop++; else eCn++;
    } else {
      eNone++;
      out.extra[id] = { type: 'none', key: null, tmdb: null, title: t, original: o, director: x[2] || '', country: x[3] || '' };
      unmatched.push({ kind: 'extra', year: Number(year), index: i, t, o, d: x[2] || '', c: x[3] || '' });
    }
  });
}

out.stats = { curated: { top: cTop, cn: cCn, none: cNone }, extra: { top: eTop, cn: eCn, none: eNone }, unmatched: unmatched.length };
writeJsonAtomic('data/curated-map.json', out, true);
writeJsonAtomic('data/unmatched.json', unmatched, true);

console.log(out.stats);
console.log('unmatched sample:');
console.log(unmatched.slice(0, 40).map(x => `${x.kind} ${x.year} | ${x.t} | ${x.o} | ${x.d}`).join('\n'));

const core = new Set();
for (const v of Object.values(out.curated)) if (v.tmdb) core.add(v.tmdb);
for (const v of Object.values(out.extra)) if (v.tmdb) core.add(v.tmdb);
for (const arr of Object.values(cn.years)) for (const x of arr) core.add(x[0]);
console.log('core tmdb ids (before search)', core.size);
console.log('size KB', (fs.statSync('data/curated-map.json').size / 1024).toFixed(0));
