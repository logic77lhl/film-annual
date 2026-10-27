const test = require('node:test');
const assert = require('node:assert/strict');
const { auditData } = require('../scripts/lib/data-quality');
const { FIRST_YEAR, CURRENT_YEAR } = require('../scripts/lib/config');

function makeData() {
  const films = {};
  const years = {};
  let top30 = 0;
  let cn = 0;
  for (let year = FIRST_YEAR; year <= CURRENT_YEAR; year++) {
    const key = `tt${String(year).padStart(7, '0')}`;
    films[key] = {
      key,
      imdb: key,
      tmdb: year,
      year,
      t: `影片${year}`,
      o: `Film ${year}`,
      r: 7.5,
      v: 1000,
      tr: 7.4,
      tv: 900,
      countries: ['US'],
      genres: [18],
      overview: '测试简介',
      runtime: 90,
      cast: [{ n: '演员' }]
    };
    years[year] = {
      era: '测试',
      keyword: '',
      intro: '',
      comment: '',
      curated: [],
      extra: [],
      cn: [key],
      top30: [key]
    };
    top30++;
    cn++;
  }
  return {
    schemaVersion: 1,
    generatedAt: '2026-10-27',
    stats: {
      films: Object.keys(films).length,
      top30,
      curated: 0,
      extra: 0,
      cn,
      years: Object.keys(years).length,
      allTime: 0,
      details: Object.keys(films).length
    },
    films,
    years,
    allTime: [],
    people: {},
    genres: {},
    countries: {}
  };
}

test('valid fixture has no hard errors', () => {
  const report = auditData(makeData());
  assert.equal(report.errors.length, 0);
  assert.equal(report.counts.films, 132);
  assert.equal(report.status, 'warn');
  assert.equal(report.currentYearIncomplete, true);
});

test('missing year is a hard error', () => {
  const data = makeData();
  delete data.years[2000];
  data.stats.years--;
  const report = auditData(data);
  assert.ok(report.errors.some(e => e.code === 'missing_years'));
  assert.equal(report.status, 'failed');
});

test('broken year reference is a hard error', () => {
  const data = makeData();
  data.years[1994].top30.push('missing-film');
  data.stats.top30++;
  const report = auditData(data);
  assert.ok(report.errors.some(e => e.code === 'broken_reference'));
});

test('stats mismatch is a hard error', () => {
  const data = makeData();
  data.stats.films++;
  const report = auditData(data);
  assert.ok(report.errors.some(e => e.code === 'stats_mismatch'));
});

test('duplicate TMDB id is a hard error', () => {
  const data = makeData();
  data.films[`tt${String(FIRST_YEAR + 1).padStart(7, '0')}`].tmdb = data.films[`tt${String(FIRST_YEAR).padStart(7, '0')}`].tmdb;
  const report = auditData(data);
  assert.ok(report.errors.some(e => e.code === 'duplicate_tmdb'));
});

test('large film count drop is a hard error', () => {
  const report = auditData(makeData(), { counts: { films: 1000 } });
  assert.ok(report.errors.some(e => e.code === 'film_count_drop'));
});

test('secret-looking content is a hard error', () => {
  const data = makeData();
  data.films[`tt${String(FIRST_YEAR).padStart(7, '0')}`].t = 'api_key=oops';
  const report = auditData(data);
  assert.ok(report.errors.some(e => e.code === 'secret_leak'));
});

test('missing Chinese title is a notice, not a hard error', () => {
  const data = makeData();
  data.films[`tt${String(FIRST_YEAR).padStart(7, '0')}`].t = 'A Film';
  const report = auditData(data);
  assert.equal(report.errors.length, 0);
  assert.ok(report.notices.some(n => n.code === 'missing_chinese_titles'));
});
