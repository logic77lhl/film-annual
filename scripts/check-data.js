require('./_root');
const { readJson, writeJsonAtomic } = require('./lib/fs-utils');
const { auditData } = require('./lib/data-quality');

const data = readJson('data/films.json');
if (!data) {
  console.error('[check] data/films.json is missing; run npm run build:data first');
  process.exit(1);
}

const previous = readJson('data/manifest.json', null);
const top30 = readJson('data/top30.json', {});
const manifest = auditData(data, previous, {
  tmdbKey: process.env.TMDB_KEY || '',
  sources: {
    films: data.generatedAt || null,
    imdbTop30: top30.generatedAt || null
  }
});

const print = (label, items) => {
  for (const item of items) console.log(`  ${label} ${item.code}: ${item.message}`);
};

console.log(`[check] films=${manifest.counts.films} years=${manifest.counts.years} status=${manifest.status}`);
print('WARN', manifest.warnings);
print('NOTE', manifest.notices);
print('ERROR', manifest.errors);

if (manifest.errors.length) {
  console.error('[check] failed; data/manifest.json was not replaced');
  process.exit(1);
}

writeJsonAtomic('data/manifest.json', manifest);
const summary = [
  `status=${manifest.status}`,
  `dataDate=${manifest.dataDate}`,
  `warnings=${manifest.warnings.length}`,
  `notices=${manifest.notices.length}`
].join(' ');
console.log(`[check] wrote data/manifest.json (${summary})`);
