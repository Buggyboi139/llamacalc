const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { applyDflash } = require('../command-rules.js');

const filled = value => value != null && String(value).trim() !== '';
const pair = (parts, flag, value) => parts.push(`${flag} '${String(value).trim()}'`);

test('empty DFlash path preserves generic speculative fields', () => {
    const parts = [];
    const warnings = [];

    assert.deepEqual([...applyDflash(parts, { dflashModel: '' }, pair, filled, warnings)], []);
    assert.deepEqual(parts, []);
    assert.deepEqual(warnings, []);
});

test('DFlash path emits draft model and draft-dflash type', () => {
    const parts = [];
    const warnings = [];

    const skipped = applyDflash(
        parts,
        { dflashModel: '/models/DFlash model.gguf' },
        pair,
        filled,
        warnings
    );

    assert.deepEqual(parts, ["-md '/models/DFlash model.gguf'", '--spec-type draft-dflash']);
    assert.deepEqual([...skipped], ['dflashModel', 'specDraftModel', 'specType']);
});

test('DFlash path overrides conflicting generic speculative values with a warning', () => {
    const parts = [];
    const warnings = [];

    applyDflash(
        parts,
        {
            dflashModel: '/dflash.gguf',
            specDraftModel: '/other.gguf',
            specType: 'draft-mtp'
        },
        pair,
        filled,
        warnings
    );

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /overrides/i);
});

test('DFlash model path is promoted to Main Controls', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const mainIds = html.match(/const mainIds = \[(.*?)\];/s)?.[1] || '';

    assert.match(mainIds, /'dflashModel'/);
});
