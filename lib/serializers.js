(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcSerializers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const POSIX_SAFE = /^[A-Za-z0-9_@%+=:,./\\-]+$/;
    const POWERSHELL_SAFE = /^[A-Za-z0-9_./\\:-]+$/;
    const COMMAND_PROMPT_SAFE = /^[A-Za-z0-9_./\\:-]+$/;

    function quotePosix(value) {
        const text = String(value);
        if (text && POSIX_SAFE.test(text)) return text;
        return `'${text.replace(/'/g, `'\\''`)}'`;
    }

    function serializePosix(model, multiline) {
        const parts = [quotePosix(model.executable)];
        for (const segment of model.segments) {
            parts.push(segment.kind === 'raw' ? segment.value : quotePosix(segment.value));
        }
        return parts.join(multiline && parts.length > 1 ? ' \\\n+  ' : ' ');
    }

    function quotePowerShell(value) {
        const text = String(value);
        if (text && POWERSHELL_SAFE.test(text)) return text;
        return `'${text.replace(/'/g, "''")}'`;
    }

    function serializePowerShell(model, multiline) {
        const parts = [quotePowerShell(model.executable)];
        for (const segment of model.segments) {
            parts.push(segment.kind === 'raw' ? segment.value : quotePowerShell(segment.value));
        }
        return parts.join(multiline && parts.length > 1 ? ' `\n  ' : ' ');
    }

    function quoteCommandPrompt(value) {
        const text = String(value);
        if (text && COMMAND_PROMPT_SAFE.test(text)) return text;

        let result = '"';
        let backslashes = 0;
        for (const character of text) {
            if (character === '\\') {
                backslashes += 1;
                continue;
            }
            if (character === '"') {
                result += '\\'.repeat(backslashes * 2 + 1) + '"';
                backslashes = 0;
                continue;
            }
            result += '\\'.repeat(backslashes) + character;
            backslashes = 0;
        }
        result += '\\'.repeat(backslashes * 2) + '"';
        return result;
    }

    function serializeCommandPrompt(model, multiline) {
        const parts = [quoteCommandPrompt(model.executable)];
        for (const segment of model.segments) {
            parts.push(segment.kind === 'raw' ? segment.value : quoteCommandPrompt(segment.value));
        }
        return parts.join(multiline && parts.length > 1 ? ' ^\n  ' : ' ');
    }

    function serializeCommand(model, target) {
        if (target.platform === 'linux' || target.platform === 'macos') {
            return serializePosix(model, Boolean(target.multiline));
        }
        if (target.platform === 'windows' && target.windowsShell === 'powershell') {
            return serializePowerShell(model, Boolean(target.multiline));
        }
        if (target.platform === 'windows' && target.windowsShell === 'cmd') {
            return serializeCommandPrompt(model, Boolean(target.multiline));
        }
        throw new Error(`Unsupported command target: ${target.platform}`);
    }

    return {
        quotePosix,
        quotePowerShell,
        quoteCommandPrompt,
        serializePosix,
        serializePowerShell,
        serializeCommandPrompt,
        serializeCommand
    };
});
