const test = require('node:test');
const assert = require('node:assert/strict');
const { quotePosix, quotePowerShell, quoteCommandPrompt, serializeCommand } = require('../lib/serializers.js');

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

    assert.equal(command, "./llama-cli \\\n  -m \\\n  'model one.gguf'");
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

test('PowerShell quotes literal paths, apostrophes, dollars, and ampersands', () => {
    const command = serializeCommand(
        model('.\\llama server.exe', ['-p', "It's $5 & safe"]),
        { platform: 'windows', windowsShell: 'powershell', multiline: false }
    );

    assert.equal(command, "'.\\llama server.exe' -p 'It''s $5 & safe'");
});

test('PowerShell leaves safe Windows paths unquoted', () => {
    assert.equal(quotePowerShell('.\\build\\bin\\llama-cli.exe'), '.\\build\\bin\\llama-cli.exe');
});

test('PowerShell multiline uses a backtick continuation', () => {
    const command = serializeCommand(
        model('llama-cli.exe', ['-m', 'model.gguf']),
        { platform: 'windows', windowsShell: 'powershell', multiline: true }
    );

    assert.equal(command, 'llama-cli.exe `\n  -m `\n  model.gguf');
});

test('raw segments remain verbatim in PowerShell output', () => {
    const command = serializeCommand({
        executable: 'llama-cli.exe',
        segments: [{ kind: 'raw', value: '--custom $env:MODEL' }]
    }, { platform: 'windows', windowsShell: 'powershell', multiline: false });

    assert.equal(command, 'llama-cli.exe --custom $env:MODEL');
});

test('Command Prompt quotes whitespace and command metacharacters', () => {
    const command = serializeCommand(
        model('llama-server.exe', ['-p', '100% ready & echo nope | more']),
        { platform: 'windows', windowsShell: 'cmd', multiline: false }
    );

    assert.equal(command, 'llama-server.exe -p "100% ready & echo nope | more"');
});

test('Command Prompt escapes embedded quotes for the Windows argument parser', () => {
    assert.equal(quoteCommandPrompt('say "hello"'), '"say \\"hello\\""');
});

test('Command Prompt doubles trailing backslashes before a closing quote', () => {
    const command = serializeCommand(
        model('llama-cli.exe', ['-m', 'C:\\Model Folder\\']),
        { platform: 'windows', windowsShell: 'cmd', multiline: false }
    );

    assert.equal(command, 'llama-cli.exe -m "C:\\Model Folder\\\\"');
});

test('Command Prompt preserves empty arguments', () => {
    assert.equal(quoteCommandPrompt(''), '""');
});

test('Command Prompt multiline uses caret continuation', () => {
    const command = serializeCommand(
        model('llama-cli.exe', ['-m', 'model.gguf']),
        { platform: 'windows', windowsShell: 'cmd', multiline: true }
    );

    assert.equal(command, 'llama-cli.exe ^\n  -m ^\n  model.gguf');
});

test('raw segments remain verbatim in Command Prompt output', () => {
    const command = serializeCommand({
        executable: 'llama-cli.exe',
        segments: [{ kind: 'raw', value: '--custom %MODEL%' }]
    }, { platform: 'windows', windowsShell: 'cmd', multiline: false });

    assert.equal(command, 'llama-cli.exe --custom %MODEL%');
});
