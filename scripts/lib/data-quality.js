const { FIRST_YEAR, CURRENT_YEAR, TOP_N, CN_N } = require('./config');

const CJK = /[\u4e00-\u9fa5]/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const SECRET_PATTERNS = [
  { code: 'tmdb_key_literal', re: /TMDB_KEY/i, label: 'TMDB_KEY' },
  { code: 'api_key_literal', re: /api_key\s*=/i, label: 'api_key=' },
  { code: 'local_path', re: /C:\\Users\\/i, label: '本地绝对路径' }
];

function dayString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysOld(date, today = dayString()) {
  if (!DATE.test(String(date || ''))) return null;
  const then = Date.parse(`${date}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return Math.floor((now - then) / DAY_MS);
}

function auditData(data, previousManifest = null, options = {}) {
  const firstYear = Number(options.firstYear) || FIRST_YEAR;
  const currentYear = Number(options.currentYear) || CURRENT_YEAR;
  const today = options.today || dayString();
  const errors = [];
  const warnings = [];
  const notices = [];

  const add = (list, code, message, extra = {}) =>
    list.push({ code, message, ...extra });

  const films = data && data.films;
  if (!films || typeof films !== 'object' || Array.isArray(films)) {
    add(errors, 'films_missing', 'films.json 中没有可用的 films 对象');
    return {
      schemaVersion: 1,
      status: 'failed',
      generatedAt: today,
      dataDate: today,
      yearRange: [firstYear, currentYear],
      currentYear,
      counts: {},
      coverage: {},
      warnings,
      notices,
      errors
    };
  }

  const years = data.years && typeof data.years === 'object' ? data.years : {};
  const filmKeys = Object.keys(films);
  const yearKeys = Object.keys(years)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const counts = {
    films: filmKeys.length,
    top30: 0,
    curated: 0,
    extra: 0,
    cn: 0,
    years: yearKeys.length,
    allTime: Array.isArray(data.allTime) ? data.allTime.length : 0,
    people: data.people && typeof data.people === 'object' ? Object.keys(data.people).length : 0,
    genres: data.genres && typeof data.genres === 'object' ? Object.keys(data.genres).length : 0,
    countries: data.countries && typeof data.countries === 'object' ? Object.keys(data.countries).length : 0,
    detailed: Number(data.stats && data.stats.details) || 0
  };

  const checkRef = (key, where) => {
    if (!key || !films[key]) {
      add(errors, 'broken_reference', `${where} 引用了不存在的影片 ${key || '(空)'}`);
    }
  };

  const missingYears = [];
  for (let y = firstYear; y <= currentYear; y++) {
    if (!years[y]) missingYears.push(y);
  }
  if (missingYears.length) {
    add(errors, 'missing_years', `缺少 ${missingYears.length} 个年份：${missingYears.join('、')}`, {
      years: missingYears
    });
  }

  const outOfRange = yearKeys.filter(y => y < firstYear || y > currentYear);
  if (outOfRange.length) {
    add(warnings, 'out_of_range_years', `存在范围外年份：${outOfRange.join('、')}`, {
      years: outOfRange
    });
  }

  for (const y of yearKeys) {
    const yv = years[y] || {};
    for (const field of ['top30', 'cn', 'curated', 'extra']) {
      const values = yv[field];
      if (!Array.isArray(values)) {
        add(errors, 'year_list_invalid', `${y}.${field} 不是数组`);
        continue;
      }
      if (new Set(values).size !== values.length) {
        add(warnings, 'duplicate_year_entry', `${y}.${field} 有重复条目`);
      }
      for (const key of values) checkRef(key, `${y}.${field}`);
      counts[field] += values.length;
    }

    const top = Array.isArray(yv.top30) ? yv.top30 : [];
    if (top.length === 0) {
      if (y === currentYear) {
        add(warnings, 'current_year_incomplete', `${y} 年 Top 30 尚未生成，等待年度数据`, {
          year: y,
          count: 0,
          expected: TOP_N
        });
      } else {
        add(errors, 'empty_year', `${y} 年没有 Top 30 条目`);
      }
    } else if (top.length < TOP_N) {
      add(warnings, 'short_top30', `${y} 年 Top 30 只有 ${top.length} 部`, {
        year: y,
        count: top.length
      });
    } else if (top.length > TOP_N) {
      add(warnings, 'long_top30', `${y} 年 Top 30 有 ${top.length} 部，超过 ${TOP_N}`, {
        year: y,
        count: top.length
      });
    }

    const cn = Array.isArray(yv.cn) ? yv.cn : [];
    if (y === currentYear && cn.length < CN_N) {
      add(warnings, 'current_year_incomplete', `${y} 年华语片单 ${cn.length}/${CN_N}，年度数据仍在补充`, {
        year: y,
        count: cn.length,
        expected: CN_N
      });
    }
  }

  const allTime = Array.isArray(data.allTime) ? data.allTime : [];
  if (!Array.isArray(data.allTime)) {
    add(errors, 'all_time_invalid', 'allTime 不是数组');
  }
  for (const key of allTime) checkRef(key, 'allTime');

  const people = data.people && typeof data.people === 'object' ? data.people : {};
  for (const [name, person] of Object.entries(people)) {
    for (const key of person.films || []) checkRef(key, `people.${name}.films`);
    for (const key of person.directed || []) checkRef(key, `people.${name}.directed`);
    for (const key of person.acted || []) checkRef(key, `people.${name}.acted`);
  }

  for (const [id, genre] of Object.entries(data.genres || {})) {
    for (const key of genre.films || []) checkRef(key, `genres.${id}.films`);
  }
  for (const [code, country] of Object.entries(data.countries || {})) {
    for (const key of country.films || []) checkRef(key, `countries.${code}.films`);
  }

  const tmdbIds = new Map();
  let emptyTitle = 0;
  let noChinese = 0;
  let noCountry = 0;
  for (const [key, film] of Object.entries(films)) {
    if (!String(film.t || '').trim()) emptyTitle++;
    if (!CJK.test(String(film.t || ''))) noChinese++;
    if (!(film.countries || []).length) noCountry++;
    if (film.tmdb) {
      const id = String(film.tmdb);
      if (tmdbIds.has(id)) {
        add(errors, 'duplicate_tmdb', `TMDB ID ${id} 同时出现在 ${tmdbIds.get(id)} 和 ${key}`);
      } else {
        tmdbIds.set(id, key);
      }
    }
  }

  if (emptyTitle) {
    add(warnings, 'empty_title', `${emptyTitle} 部影片没有片名`, { count: emptyTitle });
  }

  const stats = data.stats || {};
  const expectedStats = {
    films: counts.films,
    top30: counts.top30,
    curated: counts.curated,
    extra: counts.extra,
    cn: counts.cn,
    years: counts.years,
    allTime: counts.allTime
  };
  for (const [key, expected] of Object.entries(expectedStats)) {
    const actual = Number(stats[key]);
    if (!Number.isFinite(actual)) {
      add(warnings, 'stats_missing', `stats.${key} 缺失`);
    } else if (actual !== expected) {
      add(errors, 'stats_mismatch', `stats.${key}=${actual}，实际为 ${expected}`, {
        field: key,
        actual,
        expected
      });
    }
  }
  if (Number.isFinite(Number(stats.noChinese)) && Number(stats.noChinese) !== noChinese) {
    add(warnings, 'stats_stale', `stats.noChinese=${stats.noChinese}，实际为 ${noChinese}`);
  }

  const dataDate = String(data.generatedAt || '');
  if (!DATE.test(dataDate)) {
    add(warnings, 'data_date_missing', 'films.json 缺少合法的 generatedAt 日期');
  } else {
    const age = daysOld(dataDate, today);
    if (age !== null && age > 300) {
      add(warnings, 'stale_data', `数据构建于 ${dataDate}，已经 ${age} 天未更新`, {
        dataDate,
        ageDays: age
      });
    }
  }

  const serialized = JSON.stringify(data);
  if (options.tmdbKey && serialized.includes(options.tmdbKey)) {
    add(errors, 'secret_leak', 'films.json 中出现了 TMDB_KEY 的实际值');
  }
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.re.test(serialized)) {
      add(errors, 'secret_leak', `films.json 中疑似出现 ${pattern.label}`);
    }
  }

  const previousCount = Number(previousManifest && previousManifest.counts && previousManifest.counts.films);
  if (Number.isFinite(previousCount) && previousCount > 0 && counts.films < previousCount * 0.95) {
    add(errors, 'film_count_drop', `影片数从 ${previousCount} 降到 ${counts.films}，超过 5%`, {
      previous: previousCount,
      current: counts.films
    });
  }

  if (noChinese) {
    add(notices, 'missing_chinese_titles', `${noChinese} 部影片暂无中文片名`, { count: noChinese });
  }
  if (counts.detailed < counts.films) {
    add(notices, 'missing_details', `${counts.films - counts.detailed} 部影片缺少完整 TMDB 资料`, {
      count: counts.films - counts.detailed
    });
  }
  if (noCountry) {
    add(notices, 'missing_countries', `${noCountry} 部影片暂无国家/地区`, { count: noCountry });
  }

  const status = errors.length ? 'failed' : warnings.length ? 'warn' : 'ok';
  const coverage = {
    chineseTitles: counts.films - noChinese,
    detailed: counts.detailed,
    withCountries: counts.films - noCountry,
    total: counts.films
  };

  return {
    schemaVersion: 1,
    status,
    generatedAt: today,
    dataDate: DATE.test(dataDate) ? dataDate : today,
    yearRange: [firstYear, currentYear],
    currentYear,
    currentYearIncomplete: warnings.some(w => w.code === 'current_year_incomplete'),
    counts,
    coverage,
    sources: options.sources || {},
    warnings,
    notices,
    errors
  };
}

module.exports = { auditData, daysOld };
