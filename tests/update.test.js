const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('../scripts/update');

test('update defaults to full mode', () => {
  assert.equal(parseArgs([]).mode, 'full');
});

test('update accepts both mode forms', () => {
  assert.equal(parseArgs(['--mode', 'data-only']).mode, 'data-only');
  assert.equal(parseArgs(['--mode=site-only']).mode, 'site-only');
});

test('update rejects unknown modes', () => {
  assert.throws(() => parseArgs(['--mode', 'nope']), /mode/);
});

test('update accepts skip-download', () => {
  assert.equal(parseArgs(['--skip-download']).skipDownload, true);
});
