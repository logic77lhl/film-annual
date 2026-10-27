const fs = require('fs');
require('./_root');

const curatedMap = JSON.parse(fs.readFileSync('data/curated-map.json', 'utf8'));
const search = JSON.parse(fs.readFileSync('data/curated-search.json', 'utf8'));
const cn = JSON.parse(fs.readFileSync('data/cn-films.json', 'utf8'));

const ids = new Set();
for (const v of Object.values(curatedMap.curated)) if (v.tmdb) ids.add(v.tmdb);
for (const v of Object.values(curatedMap.extra)) if (v.tmdb) ids.add(v.tmdb);
for (const arr of Object.values(cn.years)) for (const x of arr) ids.add(x[0]);
for (const [k, v] of Object.entries(search)) {
  const [kind, year, index] = k.split('|');
  const rec = kind === 'curated' ? curatedMap.curated[year + '|' + index] : curatedMap.extra[year + '|' + index];
  if (rec && rec.type === 'none' && v.pick?.id) ids.add(v.pick.id);
}

const list = [...ids].sort((a, b) => a - b);
fs.writeFileSync('data/core-ids.json', JSON.stringify(list));
console.log('core ids', list.length);
