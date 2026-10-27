const fs = require('fs');
const path = require('path');

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

function writeTextAtomic(file, text, encoding = 'utf8') {
  const target = path.resolve(file);
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(
    dir,
    `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`
  );
  try {
    fs.writeFileSync(tmp, text, encoding);
    fs.renameSync(tmp, target);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch (_) {}
    throw err;
  }
}

function writeJsonAtomic(file, value, pretty = false) {
  writeTextAtomic(file, JSON.stringify(value, null, pretty ? 1 : 0));
}

module.exports = { readJson, writeTextAtomic, writeJsonAtomic };
