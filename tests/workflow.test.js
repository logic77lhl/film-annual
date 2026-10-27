const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readWorkflow(name) {
  return fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', name), 'utf8');
}

function assertNoConflictMarkers(text, name) {
  assert.ok(!/^(<{7}|={7}|>{7})/m.test(text), `${name} contains merge conflict markers`);
}

test('update workflow has schedule, manual mode, permissions, secret and deploy trigger', () => {
  const text = readWorkflow('update.yml');
  assertNoConflictMarkers(text, 'update.yml');
  assert.match(text, /^name:\s*Update data/m);
  assert.match(text, /workflow_dispatch:/);
  assert.match(text, /schedule:/);
  assert.match(text, /contents:\s*write/);
  assert.match(text, /actions:\s*write/);
  assert.match(text, /TMDB_KEY:\s*\$\{\{\s*secrets\.TMDB_KEY\s*\}\}/);
  assert.match(text, /npm run update/);
  assert.match(text, /git add .*data/);
  assert.match(text, /gh workflow run deploy\.yml/);
});

test('deploy workflow builds and checks before publishing', () => {
  const text = readWorkflow('deploy.yml');
  assertNoConflictMarkers(text, 'deploy.yml');
  assert.match(text, /workflow_dispatch:/);
  assert.match(text, /paths-ignore:/);
  assert.match(text, /npm test/);
  assert.match(text, /npm run build/);
});

test('heartbeat workflow keeps schedules active without deploying', () => {
  const text = readWorkflow('heartbeat.yml');
  assertNoConflictMarkers(text, 'heartbeat.yml');
  assert.match(text, /schedule:/);
  assert.match(text, /\.github\/heartbeat/);
  assert.match(text, /git commit/);
});
