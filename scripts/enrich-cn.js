const fs = require('fs');
require('./_root');
const zlib = require('zlib');
const readline = require('readline');

const TOP = JSON.parse(fs.readFileSync('data/top30.json', 'utf8'));

// 只保留榜单里出现过的 IMDb id
const need = new Set();
for (const y in TOP.years) for (const x of TOP.years[y]) need.add(x[0]);
for (const x of TOP.allTime) need.add(x[1]);
console.log('need ids:', need.size);

const map = new Map(); // id -> {CN, ZH, TW, HK}

const rl = readline.createInterface({
  input: fs.createReadStream('data/title.akas.tsv.gz').pipe(zlib.createGunzip()),
  crlfDelay: Infinity
});

let first = true, rows = 0, hit = 0;

(async () => {
  for await (const line of rl) {
    if (first) { first = false; continue; }
    rows++;
    if (rows % 5000000 === 0) console.log('rows', rows, 'hit', hit);

    const p = line.split('\t');
    if (p.length < 5) continue;
    const id = p[0];
    if (!need.has(id)) continue;
    const title = p[2];
    const region = p[3];
    const lang = p[4];
    if (!title || !/[\u4e00-\u9fa5]/.test(title)) continue;

    const isCN = region === 'CN';
    const isTW = region === 'TW';
    const isHK = region === 'HK';
    const isZH = lang === 'zh' || lang === 'cn' || lang === 'yue' || lang === 'zh-Hans' || lang === 'zh-Hant';
    if (!isCN && !isTW && !isHK && !isZH) continue;

    const rec = map.get(id) || {};
    if (isCN && !rec.CN) rec.CN = title;
    else if (isZH && !rec.ZH) rec.ZH = title;
    else if (isTW && !rec.TW) rec.TW = title;
    else if (isHK && !rec.HK) rec.HK = title;
    map.set(id, rec);
    hit++;
  }

  const out = {};
  for (const [id, r] of map) {
    const t = r.CN || r.ZH || r.TW || r.HK;
    if (t) out[id] = t.replace(/[（(](国语|普通话|粤语|国语版|普通话版|粤语版)[)）]\s*$/g, '').trim();
  }

  fs.writeFileSync('data/cn-titles.json', JSON.stringify(out));
  console.log('rows', rows, 'hits', hit, 'ids with cn', Object.keys(out).length);
  console.log('size KB', (fs.statSync('data/cn-titles.json').size / 1024).toFixed(0));
})();
