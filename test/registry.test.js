const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateRegistry, createRegistry } = require('../lib/registry.js');
const { auditRegistry, parseHelpTable } = require('../scripts/audit-flags.js');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'flags.json'), 'utf8'));

test('registry has unique IDs and complete searchable metadata', () => {
    assert.deepEqual(validateRegistry(data), []);
    assert.equal(new Set(data.flags.map(flag => flag.id)).size, data.flags.length);

    for (const flag of data.flags) {
        assert.ok(flag.canonical.startsWith('-'), flag.id);
        assert.ok(['cli', 'server'].some(mode => flag.modes.includes(mode)), flag.id);
        assert.ok(data.categories.some(category => category.id === flag.category), flag.id);
        assert.ok(
            ['boolean', 'choice', 'integer', 'number', 'string', 'textarea', 'action'].includes(flag.value.type),
            flag.id
        );
        const sentences = flag.description.trim().split(/(?<=[.!?])\s+/);
        assert.ok(sentences.length >= 2 && sentences.length <= 3, `${flag.id}: ${flag.description}`);
    }
});

test('aliases resolve to exactly one option', () => {
    const registry = createRegistry(data);

    for (const flag of data.flags) {
        for (const alias of [flag.canonical, ...flag.aliases]) {
            assert.equal(registry.byAlias.get(alias).id, flag.id, alias);
        }
    }
});

test('removed and stale options are absent', () => {
    const aliases = new Set(data.flags.flatMap(flag => [flag.canonical, ...flag.aliases]));

    for (const stale of [
        '--prompt-cache',
        '--rpc',
        '-fitp',
        '-gan',
        '-gaw',
        '--interactive-first',
        '--in-prefix',
        '--in-suffix'
    ]) {
        assert.equal(aliases.has(stale), false, stale);
    }
});

test('current newly audited families are present', () => {
    const registry = createRegistry(data);

    for (const alias of [
        '--offline',
        '--log-colors',
        '--log-prompts-dir',
        '--video',
        '--model-vocoder',
        '--ui-mcp-proxy',
        '--agent',
        '--sse-ping-interval',
        '--slot-prompt-similarity'
    ]) {
        assert.ok(registry.byAlias.has(alias), alias);
    }
});

test('registry exposes executable defaults for all supported targets', () => {
    const registry = createRegistry(data);

    assert.match(registry.executables.linux.server, /llama-server$/);
    assert.match(registry.executables.macos.cli, /llama-cli$/);
    assert.match(registry.executables.windows.server, /llama-server\.exe$/);
});

test('registry includes non-flag builder fields without mixing them into the option audit', () => {
    const ids = new Set(data.fields.map(field => field.id));

    assert.deepEqual([...ids].sort(), ['cliPath', 'dflashModel', 'extraFlags', 'serverPath']);
    assert.equal(data.fields.find(field => field.id === 'extraFlags').value.type, 'textarea');
    const dflash = data.fields.find(field => field.id === 'dflashModel');
    assert.equal(dflash.category, 'speculative');
    assert.equal(dflash.featured, true);
    assert.match(dflash.description, /draft-dflash/);
});

test('registry exposes the complete current command preset catalogue', () => {
    const registry = createRegistry(data);
    assert.deepEqual(registry.presets.map(preset => preset.id), [
        'plain', 'multiGpu', 'defaultSpeculative', 'mtp', 'dflash',
        'draftModel', 'eagle3', 'ngram', 'chatApi', 'embeddings', 'reranking'
    ]);
    assert.equal(registry.presetById.get('reranking').modes.join(','), 'server');
    assert.equal(registry.allById.get('dflashModel').category, 'speculative');
});

test('registry exposes and validates the JSON compatibility catalogue', () => {
    const registry = createRegistry(data);
    const ruleIds = registry.compatibilityRules.map(rule => rule.id);

    for (const id of [
        'flash-off-quantized-main-v',
        'flash-off-quantized-draft-v',
        'tensor-requires-flash',
        'tensor-quantized-cache',
        'source-conflict',
        'draft-source-conflict',
        'output-constraint-conflict',
        'prompt-source-conflict',
        'chat-template-conflict',
        'tensor-split-ignored',
        'main-gpu-ignored',
        'fit-settings-ignored'
    ]) {
        assert.ok(ruleIds.includes(id), id);
    }

    const invalid = JSON.parse(JSON.stringify(data));
    invalid.compatibilityRules[0].when.all[0].fieldId = 'missingField';
    assert.match(validateRegistry(invalid).join('\n'), /unknown compatibility field missingField/);
});

test('DFlash shortcut tracks the current accepted speculative type', () => {
    const documentation = fs.readFileSync('/home/dsmason321/llama.cpp/docs/speculative.md', 'utf8');
    assert.match(documentation, /--spec-type draft-dflash/);
    assert.match(documentation, /\| `draft-dflash` \|/);
});

test('essentials and model-source precedence are metadata driven', () => {
    const registry = createRegistry(data);
    for (const id of ['modelPath', 'ctxSize', 'gpuLayers', 'cacheTypeK', 'cacheTypeV']) {
        assert.equal(registry.byId.get(id).featured, true, id);
    }

    assert.equal(registry.byId.get('modelPath').sourcePriority, 1);
    assert.equal(registry.byId.get('hfRepo').sourcePriority, 2);
    assert.equal(registry.byId.get('modelUrl').sourcePriority, 3);
    assert.equal(registry.byId.get('dockerRepo').sourcePriority, 4);
});

test('choice and numeric metadata is ready for generic rendering and validation', () => {
    const registry = createRegistry(data);
    assert.equal(registry.byId.get('temp').value.type, 'number');
    assert.deepEqual(registry.byId.get('port').validation, { integer: true, min: 1, max: 65535 });

    for (const flag of registry.flags.filter(flag => flag.value.type === 'choice')) {
        assert.ok(flag.value.options.length >= 2, flag.id);
        for (const option of flag.value.options) {
            assert.equal(typeof option.value, 'string', flag.id);
            assert.equal(typeof option.label, 'string', flag.id);
        }
    }
});

test('every current finite single-choice parameter is a dropdown', () => {
    const registry = createRegistry(data);
    const optionValues = id => registry.byId.get(id).value.options.map(option => option.value);
    const cacheTypes = ['', 'f32', 'f16', 'bf16', 'q8_0', 'q4_0', 'q4_1', 'iq4_nl', 'q5_0', 'q5_1'];

    for (const id of ['cacheTypeK', 'cacheTypeV', 'specDraftTypeK', 'specDraftTypeV']) {
        assert.equal(registry.byId.get(id).value.type, 'choice', id);
        assert.deepEqual(optionValues(id), cacheTypes, id);
    }
    for (const id of [
        'cpuStrict', 'cpuStrictBatch', 'pollBatch', 'specDraftCpuStrict',
        'specDraftPoll', 'specDraftCpuStrictBatch', 'specDraftPollBatch'
    ]) {
        assert.equal(registry.byId.get(id).value.type, 'choice', id);
        assert.deepEqual(optionValues(id), ['', '0', '1'], id);
    }

    assert.deepEqual(optionValues('numa'), ['', 'distribute', 'isolate', 'numactl']);
    assert.deepEqual(optionValues('reasoningFormat'), ['', 'auto', 'none', 'deepseek', 'deepseek-legacy']);
});

test('combination and ordered-list parameters remain editable text', () => {
    const registry = createRegistry(data);
    for (const id of ['specType', 'tools', 'samplers', 'samplerSeq', 'chatTemplate']) {
        assert.equal(registry.byId.get(id).value.type, 'string', id);
    }
});

test('help-table parser excludes rows that only document removed arguments', () => {
    const rows = parseHelpTable([
        '| `--active N` | active option |',
        '| `--old N` | the argument has been removed. use --active |'
    ].join('\n'), 'cli');

    assert.deepEqual(rows.map(row => row.aliases), [['--active']]);
});

test('registry matches every current CLI and server option group and alias', () => {
    const cli = fs.readFileSync('/home/dsmason321/llama.cpp/tools/cli/README.md', 'utf8');
    const server = fs.readFileSync('/home/dsmason321/llama.cpp/tools/server/README.md', 'utf8');
    const result = auditRegistry(createRegistry(data), [
        ...parseHelpTable(cli, 'cli'),
        ...parseHelpTable(server, 'server')
    ]);

    assert.deepEqual(result.missingRows, []);
    assert.deepEqual(result.unknownAliases, []);
    assert.deepEqual(result.modeMismatches, []);
});
