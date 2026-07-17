(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcSerializers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const POSIX_SAFE = /^[A-Za-z0-9_@%+=:,./\\-]+$/;

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

    function serializeCommand(model, target) {
        if (target.platform === 'linux' || target.platform === 'macos') {
            return serializePosix(model, Boolean(target.multiline));
        }
        throw new Error(`Unsupported command target: ${target.platform}`);
    }

    return { quotePosix, serializePosix, serializeCommand };
});
