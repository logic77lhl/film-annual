const fs = require('fs');
require('./_root');
const path = require('path');
const { readJson, writeTextAtomic, writeJsonAtomic } = require('./lib/fs-utils');

const html = fs.readFileSync('app/index.html', 'utf8');
const css = fs.readFileSync('app/app.css', 'utf8');
const js = fs.readFileSync('app/app.js', 'utf8');
const data = JSON.parse(fs.readFileSync('data/films.json', 'utf8'));
const manifest = readJson('data/manifest.json', null);

// The online first load only needs list/search fields. Film-detail fields are
// split into small buckets and fetched when a film page is opened.
const DETAIL_FIELDS = ['overview', 'cast', 'companies', 'rd', 'collection'];
const DETAIL_BUCKETS = 32;
const detailBucket = key => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % DETAIL_BUCKETS;
};

const cssTag = '<link rel="stylesheet" href="app.css">';
const jsTag = '<script src="app.js"></script>';
if (!html.includes(cssTag) || !html.includes(jsTag)) throw new Error('template tags not found');

const inlineCss = `<style>\n${css}\n</style>`;
const inlineJs = `<script>\n${js}\n</script>`;
const manifestScript = `<script>window.__MANIFEST__=${JSON.stringify(manifest).replace(/<\/script/gi, '<\\/script')};</script>`;

const full = html
  .replace(cssTag, () => inlineCss)
  .replace(jsTag, () => `${manifestScript}\n${inlineJs}`);
const dataScript = `<script>window.__FILMS__=${JSON.stringify(data).replace(/<\/script/gi, '<\\/script')};</script>`;

// offline: remove fetch fallback and inline data
let offlineJs = js.replace(
  "DATA = window.__FILMS__ || await (await fetch('data/films.json')).json();",
  () => "DATA = window.__FILMS__;"
);
if (offlineJs === js) throw new Error('data loader not found');
let offline = html
  .replace(cssTag, () => inlineCss)
  .replace(jsTag, () => `${dataScript}\n${manifestScript}\n<script>\n${offlineJs}\n</script>`)
  .replace('<a href="offline.html" id="offlineLink">离线单文件版</a>', () => '<a href="https://logic77lhl.github.io/film-annual/" id="offlineLink" target="_blank" rel="noopener">线上完整版</a>');

const onlineFilms = {};
const detailBuckets = Array.from({ length: DETAIL_BUCKETS }, () => ({}));
for (const [key, film] of Object.entries(data.films || {})) {
  const slim = { ...film };
  const details = {};
  for (const field of DETAIL_FIELDS) {
    if (slim[field] !== undefined) {
      details[field] = slim[field];
      delete slim[field];
    }
  }
  onlineFilms[key] = slim;
  if (Object.keys(details).length) detailBuckets[detailBucket(key)][key] = details;
}
const onlineData = { ...data, films: onlineFilms };
const searchMeta = {};
for (const [key, film] of Object.entries(data.films || {})) {
  const cast = (film.cast || []).map(c => c.n).filter(Boolean);
  const companies = film.companies || [];
  if (cast.length || companies.length) searchMeta[key] = { a: cast, c: companies };
}

fs.rmSync('dist', { recursive: true, force: true });
writeTextAtomic(path.join('dist', 'index.html'), full);
writeTextAtomic(path.join('dist', 'offline.html'), offline);
// Keep the split assets available so a cached pre-inline index.html does not
// turn into a blank page after a deploy.
writeTextAtomic(path.join('dist', 'app.css'), css);
writeTextAtomic(path.join('dist', 'app.js'), js);
writeJsonAtomic(path.join('dist', 'data', 'films.json'), onlineData);
writeJsonAtomic(path.join('dist', 'data', 'search.json'), searchMeta);
writeJsonAtomic(path.join('dist', 'data', 'manifest.json'), manifest);
for (let i = 0; i < detailBuckets.length; i++) {
  writeJsonAtomic(
    path.join('dist', 'data', 'details', String(i).padStart(2, '0') + '.json'),
    detailBuckets[i]
  );
}
writeTextAtomic(path.join('dist', '.nojekyll'), '\n');

const detailBytes = detailBuckets.reduce((sum, bucket) => sum + Buffer.byteLength(JSON.stringify(bucket)), 0);
console.log('dist/index.html', (fs.statSync('dist/index.html').size / 1024).toFixed(0) + 'KB');
console.log('dist/offline.html', (fs.statSync('dist/offline.html').size / 1024 / 1024).toFixed(2) + 'MB');
console.log('dist/data/films.json', (fs.statSync('dist/data/films.json').size / 1024 / 1024).toFixed(2) + 'MB');
console.log('dist/data/search.json', (fs.statSync('dist/data/search.json').size / 1024).toFixed(0) + 'KB');
console.log('dist/data/details', DETAIL_BUCKETS + ' buckets', (detailBytes / 1024 / 1024).toFixed(2) + 'MB');
console.log('status', manifest ? manifest.status : 'unknown', 'date', manifest ? manifest.dataDate : data.generatedAt);
console.log('films', data.stats.films, 'people', Object.keys(data.people).length);
