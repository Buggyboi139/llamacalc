const test = require('node:test');
const assert = require('node:assert/strict');
const { quotePosix, serializeCommand } = require('../lib/serializers.js');

function model(executable, values) {
    return {
        executable,
        segments: values.map(value => ({ kind: 'argument', value }))
    };
}

test('POSIX serializer safely quotes spaces and apostrophes', () => {
    const command = serializeCommand(
        model('./llama server', ['-m', "/models/O'Brien.gguf"]),
        { platform: 'linux', multiline: false }
    );

    assert.equal(command, "'./llama server' -m '/models/O'\\''Brien.gguf'");
});

test('POSIX serializer leaves safe tokens unquoted', () => {
    assert.equal(quotePosix('./build/bin/llama-cli'), './build/bin/llama-cli');
    assert.equal(quotePosix('--top-p'), '--top-p');
    assert.equal(quotePosix('0.95'), '0.95');
});

test('macOS uses POSIX quoting and backslash continuation', () => {
    const command = serializeCommand(
        model('./llama-cli', ['-m', 'model one.gguf']),
        { platform: 'macos', multiline: true }
    );

    assert.equal(command, "./llama-cli \\\n+  -m \\\n+  'model one.gguf'");
});

test('raw segments remain verbatim in POSIX output', () => {
    const command = serializeCommand({
        executable: './llama-cli',
        segments: [
            { kind: 'argument', value: '-m' },
            { kind: 'argument', value: 'model.gguf' },
            { kind: 'raw', value: '--custom "$HOME"' }
        ]
    }, { platform: 'linux', multiline: false });

    assert.equal(command, './llama-cli -m model.gguf --custom "$HOME"');
});
