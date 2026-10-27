const fs = require('fs');
require('./_root');

const curated = JSON.parse(fs.readFileSync('data/curated.json', 'utf8'));
const top = JSON.parse(fs.readFileSync('data/top30.json', 'utf8'));
const cn = JSON.parse(fs.readFileSync('data/cn-films.json', 'utf8'));
const find2 = JSON.parse(fs.readFileSync('data/tmdb-find2.json', 'utf8'));
const details = fs.existsSync('data/tmdb-details.json') ? JSON.parse(fs.readFileSync('data/tmdb-details.json', 'utf8')) : {};
const curatedMap = JSON.parse(fs.readFileSync('data/curated-map.json', 'utf8'));
const search = JSON.parse(fs.readFileSync('data/curated-search.json', 'utf8'));
const cnTitles = JSON.parse(fs.readFileSync('data/cn-titles.json', 'utf8'));

const isCJK = s => /[\u4e00-\u9fa5]/.test(String(s || ''));
const uniq = arr => [...new Set((arr || []).filter(x => x !== undefined && x !== null && x !== ''))];
const splitPeople = s => String(s || '').split(/\s*[\/、]\s*/).map(x => x.trim()).filter(Boolean);

const GENRE_NAMES = {
  28: '动作', 12: '冒险', 16: '动画', 35: '喜剧', 80: '犯罪', 99: '纪录',
  18: '剧情', 10751: '家庭', 14: '奇幻', 36: '历史', 27: '恐怖', 10402: '音乐',
  9648: '悬疑', 10749: '爱情', 878: '科幻', 10770: '电视电影', 53: '惊悚',
  10752: '战争', 37: '西部'
};

const COUNTRY_NAMES = {
  US: '美国', CN: '中国', HK: '中国香港', TW: '中国台湾', MO: '中国澳门',
  JP: '日本', KR: '韩国', KP: '朝鲜', FR: '法国', GB: '英国', IE: '爱尔兰',
  IT: '意大利', DE: '德国', AT: '奥地利', CH: '瑞士', ES: '西班牙', PT: '葡萄牙',
  NL: '荷兰', BE: '比利时', LU: '卢森堡', SE: '瑞典', NO: '挪威', DK: '丹麦',
  FI: '芬兰', IS: '冰岛', PL: '波兰', CZ: '捷克', SK: '斯洛伐克', HU: '匈牙利',
  RO: '罗马尼亚', BG: '保加利亚', RS: '塞尔维亚', HR: '克罗地亚', SI: '斯洛文尼亚',
  BA: '波黑', ME: '黑山', MK: '北马其顿', AL: '阿尔巴尼亚', GR: '希腊',
  RU: '俄罗斯', SU: '苏联', UA: '乌克兰', BY: '白俄罗斯', LT: '立陶宛', LV: '拉脱维亚',
  EE: '爱沙尼亚', GE: '格鲁吉亚', AM: '亚美尼亚', AZ: '阿塞拜疆', KZ: '哈萨克斯坦',
  XC: '捷克斯洛伐克', YU: '南斯拉夫', AN: '荷属安的列斯', MN: '蒙古', DD: '东德',
  CS: '塞尔维亚和黑山',
  UZ: '乌兹别克斯坦', TR: '土耳其', IR: '伊朗', IL: '以色列', SA: '沙特阿拉伯',
  AE: '阿联酋', QA: '卡塔尔', EG: '埃及', MA: '摩洛哥', DZ: '阿尔及利亚',
  TN: '突尼斯', ZA: '南非', NG: '尼日利亚', SN: '塞内加尔', ML: '马里',
  BF: '布基纳法索', GH: '加纳', KE: '肯尼亚', ET: '埃塞俄比亚',
  IN: '印度', PK: '巴基斯坦', BD: '孟加拉国', LK: '斯里兰卡', NP: '尼泊尔',
  TH: '泰国', VN: '越南', KH: '柬埔寨', LA: '老挝', MM: '缅甸', MY: '马来西亚',
  SG: '新加坡', ID: '印度尼西亚', PH: '菲律宾', BN: '文莱',
  AU: '澳大利亚', NZ: '新西兰', CA: '加拿大', MX: '墨西哥', BR: '巴西',
  AR: '阿根廷', CL: '智利', CO: '哥伦比亚', PE: '秘鲁', VE: '委内瑞拉',
  UY: '乌拉圭', PY: '巴拉圭', BO: '玻利维亚', EC: '厄瓜多尔', CU: '古巴',
  DO: '多米尼加', PR: '波多黎各', CR: '哥斯达黎加', PA: '巴拿马', GT: '危地马拉'
};

const COUNTRY_ALIASES = {
  '美国': 'US', '中国': 'CN', '中国大陆': 'CN', '中国香港': 'HK', '香港': 'HK',
  '中国台湾': 'TW', '台湾': 'TW', '中国澳门': 'MO', '澳门': 'MO',
  '日本': 'JP', '韩国': 'KR', '朝鲜': 'KP', '法国': 'FR', '英国': 'GB',
  '爱尔兰': 'IE', '意大利': 'IT', '德国': 'DE', '西德': 'DE', '东德': 'DE',
  '奥地利': 'AT', '瑞士': 'CH', '西班牙': 'ES', '葡萄牙': 'PT', '荷兰': 'NL',
  '比利时': 'BE', '卢森堡': 'LU', '瑞典': 'SE', '挪威': 'NO', '丹麦': 'DK',
  '芬兰': 'FI', '冰岛': 'IS', '波兰': 'PL', '捷克': 'CZ', '捷克斯洛伐克': 'CZ',
  '斯洛伐克': 'SK', '匈牙利': 'HU', '罗马尼亚': 'RO', '保加利亚': 'BG',
  '塞尔维亚': 'RS', '克罗地亚': 'HR', '斯洛文尼亚': 'SI', '波黑': 'BA',
  '黑山': 'ME', '北马其顿': 'MK', '阿尔巴尼亚': 'AL', '希腊': 'GR',
  '苏联': 'RU', '俄罗斯': 'RU', '乌克兰': 'UA', '白俄罗斯': 'BY',
  '立陶宛': 'LT', '拉脱维亚': 'LV', '爱沙尼亚': 'EE', '格鲁吉亚': 'GE',
  '亚美尼亚': 'AM', '阿塞拜疆': 'AZ', '哈萨克斯坦': 'KZ', '乌兹别克斯坦': 'UZ',
  '土耳其': 'TR', '伊朗': 'IR', '以色列': 'IL', '沙特阿拉伯': 'SA',
  '阿联酋': 'AE', '卡塔尔': 'QA', '埃及': 'EG', '摩洛哥': 'MA',
  '阿尔及利亚': 'DZ', '突尼斯': 'TN', '南非': 'ZA', '尼日利亚': 'NG',
  '塞内加尔': 'SN', '马里': 'ML', '布基纳法索': 'BF', '加纳': 'GH',
  '肯尼亚': 'KE', '埃塞俄比亚': 'ET', '印度': 'IN', '巴基斯坦': 'PK',
  '孟加拉国': 'BD', '斯里兰卡': 'LK', '尼泊尔': 'NP', '泰国': 'TH',
  '越南': 'VN', '柬埔寨': 'KH', '老挝': 'LA', '缅甸': 'MM', '马来西亚': 'MY',
  '新加坡': 'SG', '印度尼西亚': 'ID', '菲律宾': 'PH', '文莱': 'BN',
  '澳大利亚': 'AU', '新西兰': 'NZ', '加拿大': 'CA', '墨西哥': 'MX',
  '巴西': 'BR', '阿根廷': 'AR', '智利': 'CL', '哥伦比亚': 'CO', '秘鲁': 'PE',
  '委内瑞拉': 'VE', '乌拉圭': 'UY', '巴拉圭': 'PY', '玻利维亚': 'BO',
  '厄瓜多尔': 'EC', '古巴': 'CU', '多米尼加': 'DO', '波多黎各': 'PR',
  '哥斯达黎加': 'CR', '巴拿马': 'PA', '危地马拉': 'GT'
};

function mapCountries(str) {
  return uniq(String(str || '').split(/\s*[\/、]\s*/).map(s => s.trim()).filter(Boolean).map(s => COUNTRY_ALIASES[s] || s));
}

const ERAS = curated.eras || [
  { name: '默片草创', from: 1895, to: 1929 },
  { name: '黄金时代', from: 1930, to: 1959 },
  { name: '新浪潮', from: 1960, to: 1979 },
  { name: '大片时代', from: 1980, to: 1999 },
  { name: '全球化', from: 2000, to: 2009 },
  { name: '流媒体前夜', from: 2010, to: 2019 },
  { name: '分众时代', from: 2020, to: 2026 }
];
const eraOf = y => (ERAS.find(e => y >= e.from && y <= e.to) || ERAS[ERAS.length - 1]).name;

const films = {};
const byTmdb = new Map();
const add = (key, base) => {
  if (!films[key]) films[key] = { key, ...base };
  else Object.assign(films[key], base);
  return films[key];
};
const titleFrom = (...vals) => {
  for (const v of vals) if (v && isCJK(v)) return v;
  for (const v of vals) if (v) return v;
  return '';
};

/* 1. Top 30 */
let topCount = 0;
for (const [year, arr] of Object.entries(top.years)) {
  arr.forEach((x, i) => {
    const imdb = x[0];
    const f2 = find2[imdb] || null;
    const chinese = cnTitles[imdb] || '';
    const t = titleFrom(chinese, f2?.t, x[1]);
    const f = add(imdb, {
      imdb,
      tmdb: f2?.id || null,
      year: Number(year),
      t,
      o: x[2] || x[1] || '',
      r: Number(x[3]) || 0,
      v: Number(x[4]) || 0,
      tr: Number(f2?.r) || 0,
      tv: Number(f2?.v) || 0,
      lang: f2?.l || '',
      genres: f2?.g || [],
      p: f2?.p || '',
      overview: f2?.ov || '',
      rd: f2?.rd || '',
      top30Rank: i + 1
    });
    if (f.tmdb) byTmdb.set(f.tmdb, imdb);
    topCount++;
  });
}

/* 2. 华语片 */
let cnCount = 0;
for (const [year, arr] of Object.entries(cn.years)) {
  arr.forEach((x, i) => {
    const tmdb = x[0];
    const key = byTmdb.get(tmdb) || ('tmdb-' + tmdb);
    const existing = films[key];
    if (existing) {
      existing.cnRank = existing.cnRank || i + 1;
      existing.cnYear = Number(year);
      existing.o = existing.o || x[2] || '';
      if (!isCJK(existing.t) && isCJK(x[1])) existing.t = x[1];
      existing.tr = existing.tr || Number(x[4]) || 0;
      existing.tv = existing.tv || Number(x[5]) || 0;
      existing.lang = existing.lang || x[3] || '';
    } else {
      add(key, {
        tmdb,
        year: Number(year),
        t: x[1] || x[2] || '',
        o: x[2] || '',
        tr: Number(x[4]) || 0,
        tv: Number(x[5]) || 0,
        lang: x[3] || '',
        cnRank: i + 1,
        cnYear: Number(year),
        genres: [],
        countries: []
      });
    }
    byTmdb.set(tmdb, key);
    cnCount++;
  });
}

/* 3. 精选 */
function attachCurated(key, film, year, extra = false) {
  const f = films[key];
  if (!f) return;
  if (extra) {
    f.extra = { director: film.d || '', country: film.c || '', year };
  } else {
    f.curated = { note: film.n || '', director: film.d || '', country: film.c || '', year };
  }
  if (!isCJK(f.t) && isCJK(film.t)) f.t = film.t;
  f.o = f.o || film.o || '';
  if (!f.directors && film.d) f.directors = splitPeople(film.d);
  if ((!f.countries || !f.countries.length) && film.c) f.countries = mapCountries(film.c);
}

let curatedCount = 0, extraCount = 0;
for (const d of curated.years) {
  d.films.forEach((film, i) => {
    const rec = curatedMap.curated[d.year + '|' + i];
    if (!rec) return;
    let key = rec.key;
    if (rec.type === 'none') {
      const pick = search['curated|' + d.year + '|' + i]?.pick;
      if (pick?.id) {
        key = byTmdb.get(pick.id) || ('tmdb-' + pick.id);
        if (!films[key]) {
          add(key, {
            tmdb: pick.id,
            year: d.year,
            t: titleFrom(film.t, pick.t, pick.o),
            o: film.o || pick.o || '',
            tr: Number(pick.r) || 0,
            tv: Number(pick.v) || 0,
            lang: pick.l || '',
            genres: pick.g || [],
            p: pick.p || '',
            overview: pick.ov || '',
            rd: pick.rd || ''
          });
        }
        byTmdb.set(pick.id, key);
      } else {
        key = 'c-' + d.year + '-' + i;
        add(key, {
          year: d.year,
          t: film.t || film.o || '',
          o: film.o || '',
          directors: splitPeople(film.d),
          countries: mapCountries(film.c)
        });
      }
    }
    if (films[key]) {
      attachCurated(key, film, d.year, false);
      curatedCount++;
    }
  });
}

for (const [year, arr] of Object.entries(curated.extra)) {
  arr.forEach((film, i) => {
    const rec = curatedMap.extra[year + '|' + i];
    if (!rec) return;
    const title = String(film[0] || '').replace(/[《》]/g, '');
    const original = film[1] || '';
    const director = film[2] || '';
    const country = film[3] || '';
    let key = rec.key;
    if (rec.type === 'none') {
      const pick = search['extra|' + year + '|' + i]?.pick;
      if (pick?.id) {
        key = byTmdb.get(pick.id) || ('tmdb-' + pick.id);
        if (!films[key]) {
          add(key, {
            tmdb: pick.id,
            year: Number(year),
            t: titleFrom(title, pick.t, pick.o),
            o: original || pick.o || '',
            tr: Number(pick.r) || 0,
            tv: Number(pick.v) || 0,
            lang: pick.l || '',
            genres: pick.g || [],
            p: pick.p || '',
            overview: pick.ov || '',
            rd: pick.rd || ''
          });
        }
        byTmdb.set(pick.id, key);
      } else {
        key = 'e-' + year + '-' + i;
        add(key, {
          year: Number(year),
          t: title || original,
          o: original,
          directors: splitPeople(director),
          countries: mapCountries(country)
        });
      }
    }
    if (films[key]) {
      attachCurated(key, { t: title, o: original, d: director, c: country }, Number(year), true);
      extraCount++;
    }
  });
}

/* 4. 详情合并 */
let detailCount = 0;
for (const f of Object.values(films)) {
  const d = f.tmdb ? details[f.tmdb] : null;
  if (!d) continue;
  detailCount++;
  if (!isCJK(f.t) && isCJK(d.t)) f.t = d.t;
  f.o = f.o || d.o || '';
  if (!isCJK(f.o) && isCJK(d.o)) f.o = d.o;
  f.overview = d.ov || f.overview || '';
  f.rd = d.rd || f.rd || '';
  f.runtime = d.rt || 0;
  f.genres = (d.g && d.g.length) ? d.g : (f.genres || []);
  f.countries = d.cs || f.countries || [];
  f.p = f.p || d.p || '';
  f.lang = d.l || f.lang || '';
  f.tr = Number(d.r) || f.tr || 0;
  f.tv = Number(d.v) || f.tv || 0;
  if (d.ds && d.ds.length) f.directors = d.ds;
  if (d.cast && d.cast.length) f.cast = d.cast;
  if (d.co && d.co.length) f.companies = d.co;
  if (d.col) f.collection = d.col;
}

/* 5. 收尾 */
for (const f of Object.values(films)) {
  f.year = Number(f.year) || Number((f.rd || '').slice(0, 4)) || 0;
  f.t = f.t || f.o || '未命名';
  f.o = f.o || f.t;
  f.r = Number(f.r) || 0;
  f.v = Number(f.v) || 0;
  f.tr = Number(f.tr) || 0;
  f.tv = Number(f.tv) || 0;
  f.genres = uniq((f.genres || []).map(Number));
  f.countries = uniq(f.countries || []);
  f.directors = uniq(f.directors || (f.curated?.director ? splitPeople(f.curated.director) : []));
  f.cast = (f.cast || []).filter(c => c && c.n);
  f.companies = uniq(f.companies || []);
  f.overview = String(f.overview || '');
  f.p = String(f.p || '');
  if (!f.countries.length && f.curated?.country) f.countries = mapCountries(f.curated.country);
  if (!f.countries.length && f.extra?.country) f.countries = mapCountries(f.extra.country);
  if (!f.directors.length && f.extra?.director) f.directors = splitPeople(f.extra.director);
}

/* 6. 影史榜 */
const allTime = [];
top.allTime.forEach((x, i) => {
  const imdb = x[1];
  if (!films[imdb]) {
    add(imdb, { imdb, year: Number(x[0]) || 0, t: cnTitles[imdb] || x[2] || x[3] || '', o: x[3] || x[2] || '', r: Number(x[4]) || 0, v: Number(x[5]) || 0 });
  }
  films[imdb].allTimeRank = i + 1;
  allTime.push(imdb);
});

/* 7. 年份 */
const years = {};
for (let y = 1895; y <= 2026; y++) {
  years[y] = { era: eraOf(y), keyword: '', intro: '', comment: '', curated: [], extra: [], cn: [], top30: [] };
}
for (const d of curated.years) {
  const y = years[d.year] || (years[d.year] = { era: eraOf(d.year), keyword: '', intro: '', comment: '', curated: [], extra: [], cn: [], top30: [] });
  y.era = d.era || y.era;
  y.keyword = d.keyword || '';
  y.intro = d.intro || '';
  y.comment = d.comment || '';
  d.films.forEach((_, i) => {
    const rec = curatedMap.curated[d.year + '|' + i];
    if (!rec) return;
    const pick = rec.type === 'none' ? search['curated|' + d.year + '|' + i]?.pick : null;
    let key = rec.key;
    if (rec.type === 'none') key = pick?.id ? (byTmdb.get(pick.id) || 'tmdb-' + pick.id) : 'c-' + d.year + '-' + i;
    if (films[key]) y.curated.push(key);
  });
}
for (const [year, arr] of Object.entries(curated.extra)) {
  const y = years[year] || (years[year] = { era: eraOf(Number(year)), keyword: '', intro: '', comment: '', curated: [], extra: [], cn: [], top30: [] });
  arr.forEach((_, i) => {
    const rec = curatedMap.extra[year + '|' + i];
    if (!rec) return;
    const pick = rec.type === 'none' ? search['extra|' + year + '|' + i]?.pick : null;
    let key = rec.key;
    if (rec.type === 'none') key = pick?.id ? (byTmdb.get(pick.id) || 'tmdb-' + pick.id) : 'e-' + year + '-' + i;
    if (films[key]) y.extra.push(key);
  });
}
for (const [year, arr] of Object.entries(cn.years)) {
  const y = years[year];
  arr.forEach(x => {
    const key = byTmdb.get(x[0]);
    if (key && films[key]) y.cn.push(key);
  });
  y.cn = uniq(y.cn).sort((a, b) => (films[a].cnRank || 999) - (films[b].cnRank || 999));
}
for (const [year, arr] of Object.entries(top.years)) {
  const y = years[year];
  arr.forEach(x => { if (films[x[0]]) y.top30.push(x[0]); });
  y.top30 = uniq(y.top30).sort((a, b) => (films[a].top30Rank || 999) - (films[b].top30Rank || 999));
}
for (const y of Object.values(years)) {
  y.curated = uniq(y.curated);
  y.extra = uniq(y.extra);
}

/* 8. 影人 */
const people = {};
function person(name) {
  if (!name) return null;
  if (!people[name]) people[name] = { name, directed: [], acted: [], films: [], count: 0, avg: 0, from: 0, to: 0, role: '' };
  return people[name];
}
for (const [key, f] of Object.entries(films)) {
  for (const d of f.directors || []) {
    const p = person(d);
    if (p && !p.directed.includes(key)) p.directed.push(key);
  }
  for (const c of f.cast || []) {
    const p = person(c.n);
    if (p && !p.acted.includes(key)) p.acted.push(key);
  }
}
for (const p of Object.values(people)) {
  p.films = uniq([...p.directed, ...p.acted]);
  p.count = p.films.length;
  const rated = p.films.map(k => films[k]).filter(Boolean).map(f => f.r || f.tr || 0).filter(Boolean);
  p.avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
  const ys = p.films.map(k => films[k]?.year).filter(Boolean);
  p.from = ys.length ? Math.min(...ys) : 0;
  p.to = ys.length ? Math.max(...ys) : 0;
  p.role = p.directed.length && p.acted.length ? '导演 / 演员' : p.directed.length ? '导演' : '演员';
}
// 只保留导演和至少两部作品的演员，单部演员不进索引
for (const [name, p] of Object.entries(people)) {
  if (!p.directed.length && p.acted.length < 2) delete people[name];
}

/* 9. 类型 */
const genres = {};
for (const [key, f] of Object.entries(films)) {
  for (const id of f.genres || []) {
    if (!genres[id]) genres[id] = { id, name: GENRE_NAMES[id] || '类型 ' + id, count: 0, avg: 0, films: [] };
    if (!genres[id].films.includes(key)) genres[id].films.push(key);
  }
}
for (const g of Object.values(genres)) {
  g.count = g.films.length;
  const rated = g.films.map(k => films[k]).filter(Boolean).map(f => f.r || f.tr || 0).filter(Boolean);
  g.avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
}

/* 10. 国家 */
const countries = {};
for (const [key, f] of Object.entries(films)) {
  for (const code of f.countries || []) {
    if (!countries[code]) countries[code] = { code, name: COUNTRY_NAMES[code] || code, count: 0, avg: 0, films: [] };
    if (!countries[code].films.includes(key)) countries[code].films.push(key);
  }
}
for (const c of Object.values(countries)) {
  c.count = c.films.length;
  const rated = c.films.map(k => films[k]).filter(Boolean).map(f => f.r || f.tr || 0).filter(Boolean);
  c.avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
}

/* 11. 输出 */
const stats = {
  films: Object.keys(films).length,
  top30: topCount,
  curated: curatedCount,
  extra: extraCount,
  cn: cnCount,
  years: 132,
  directors: Object.values(people).filter(p => p.directed.length).length,
  actors: Object.values(people).filter(p => p.acted.length).length,
  countries: Object.keys(countries).length,
  genres: Object.keys(genres).length,
  allTime: allTime.length,
  qualified: top.qualified || 0,
  noChinese: Object.values(films).filter(f => !isCJK(f.t)).length,
  details: detailCount
};

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  stats,
  films,
  years,
  allTime,
  people,
  genres,
  countries
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/films.json', JSON.stringify(out));
fs.writeFileSync('data/films-pretty.json', JSON.stringify(out, null, 1));

console.log(stats);
console.log('films size MB', (fs.statSync('data/films.json').size / 1024 / 1024).toFixed(2));
console.log('people', Object.keys(people).length, 'genres', Object.keys(genres).length, 'countries', Object.keys(countries).length);
console.log('sample', JSON.stringify(films['tt0111161']).slice(0, 800));
