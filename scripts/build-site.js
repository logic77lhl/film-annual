const fs = require('fs');
require('./_root');
const path = require('path');
const { readJson, writeTextAtomic, writeJsonAtomic } = require('./lib/fs-utils');

const html = fs.readFileSync('app/index.html', 'utf8');
const css = fs.readFileSync('app/app.css', 'utf8');
const js = fs.readFileSync('app/app.js', 'utf8');
const data = JSON.parse(fs.readFileSync('data/films.json', 'utf8'));
const manifest = readJson('data/manifest.json', null);

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

fs.rmSync('dist', { recursive: true, force: true });
writeTextAtomic(path.join('dist', 'index.html'), full);
writeTextAtomic(path.join('dist', 'offline.html'), offline);
writeJsonAtomic(path.join('dist', 'data', 'films.json'), data);
writeJsonAtomic(path.join('dist', 'data', 'manifest.json'), manifest);
writeTextAtomic(path.join('dist', '.nojekyll'), '\n');

console.log('dist/index.html', (fs.statSync('dist/index.html').size / 1024).toFixed(0) + 'KB');
console.log('dist/offline.html', (fs.statSync('dist/offline.html').size / 1024 / 1024).toFixed(2) + 'MB');
console.log('dist/data/films.json', (fs.statSync('dist/data/films.json').size / 1024 / 1024).toFixed(2) + 'MB');
console.log('status', manifest ? manifest.status : 'unknown', 'date', manifest ? manifest.dataDate : data.generatedAt);
console.log('films', data.stats.films, 'people', Object.keys(data.people).length);
