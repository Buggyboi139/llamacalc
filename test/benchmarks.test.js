const test = require('node:test');
const assert = require('node:assert/strict');
const {
    LOGS_KEY,
    parseTiming,
    loadLogs,
    saveLogs,
    createLogEntry,
    logsMarkdown,
    logsCsv
} = require('../lib/benchmarks.js');

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value))
    };
}

function fixtureLog(overrides = {}) {
    return {
        id: 'run-1',
        timestamp: '2026-07-16T12:00:00.000Z',
        mode: 'cli',
        name: 'Model run',
        model: '/models/one.gguf',
        context: '4096',
        promptTps: '200.00',
        genTps: '20.00',
        promptTokens: '20',
        genTokens: '10',
        totalMs: '600.00',
        build: 'b1234',
        notes: 'baseline',
        command: "./llama-cli -m '/models/one.gguf'",
        ...overrides
    };
}

test('parses llama.cpp text timings', () => {
    const result = parseTiming(`
llama_perf_context_print: prompt eval time = 100.00 ms / 20 tokens (200.00 tokens per second)
llama_perf_context_print: eval time = 500.00 ms / 10 runs (20.00 tokens per second)
llama_perf_context_print: total time = 600.00 ms
    `);

    assert.deepEqual(result, {
        promptTokens: '20',
        promptTps: '200.00',
        genTokens: '10',
        genTps: '20.00',
        totalMs: '600.00'
    });
});

test('parses nested server timing JSON', () => {
    const result = parseTiming(JSON.stringify({
        response: {
            timings: {
                prompt_n: 12,
                predicted_n: 4,
                prompt_per_second: 88.888,
                predicted_per_second: 22.222,
                prompt_ms: 100,
                predicted_ms: 200
            }
        }
    }));

    assert.deepEqual(result, {
        promptTps: '88.89',
        genTps: '22.22',
        promptTokens: 12,
        genTokens: 4,
        totalMs: '300'
    });
});

test('extracts JSON embedded in surrounding server output', () => {
    const result = parseTiming('prefix\n{"timings":{"prompt_n":2,"predicted_n":3}}\nsuffix');
    assert.equal(result.promptTokens, 2);
    assert.equal(result.genTokens, 3);
});

test('returns an empty object when no timing values exist', () => {
    assert.deepEqual(parseTiming('nothing useful here'), {});
});

test('loads and saves the existing log storage shape', () => {
    const storage = memoryStorage();
    const logs = [fixtureLog()];
    saveLogs(storage, logs);

    assert.equal(LOGS_KEY, 'llamacmd_logs_v1');
    assert.deepEqual(loadLogs(storage), logs);
    assert.deepEqual(loadLogs(memoryStorage({ [LOGS_KEY]: '{broken' })), []);
});

test('creates an exact command-capturing log entry', () => {
    const entry = createLogEntry({
        state: { mode: 'server', values: { modelPath: '/m.gguf', ctxSize: '8192' } },
        command: 'llama-server.exe -m C:\\m.gguf',
        fields: { name: '', build: 'b9', promptTps: '44', genTps: '9', notes: 'Windows' }
    }, { id: () => 'fixed-id', now: () => '2026-07-16T18:00:00.000Z' });

    assert.deepEqual(entry, {
        id: 'fixed-id',
        timestamp: '2026-07-16T18:00:00.000Z',
        mode: 'server',
        name: 'm.gguf',
        model: '/m.gguf',
        context: '8192',
        promptTps: '44',
        genTps: '9',
        promptTokens: '',
        genTokens: '',
        totalMs: '',
        build: 'b9',
        notes: 'Windows',
        command: 'llama-server.exe -m C:\\m.gguf'
    });
});

test('Markdown and CSV escape pipes, newlines, quotes, and commands', () => {
    const log = fixtureLog({ notes: 'a|b\nsecond', command: 'llama-cli -p "hi"' });

    assert.match(logsMarkdown([log]), /a\\\|b<br>second/);
    assert.match(logsCsv([log]), /"llama-cli -p ""hi"""/);
});

module.exports = { fixtureLog, memoryStorage };
