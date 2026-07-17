(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcCommand = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const SOURCE_SUPPLEMENTS = new Set(['hfFile', 'hfToken']);

    function filled(value) {
        return value !== undefined && value !== null && (typeof value === 'boolean' ? value : String(value).trim() !== '');
    }

    function argument(value) {
        return { kind: 'argument', value: String(value) };
    }

    function preferredFlag(flag) {
        return flag.serialization.preferredAlias || flag.canonical;
    }

    function appendRegistered(segments, flag, value) {
        switch (flag.serialization.emit) {
            case 'boolean':
                if (value) segments.push(argument(preferredFlag(flag)));
                break;
            case 'mapped':
                if (flag.serialization.map[value]) segments.push(argument(flag.serialization.map[value]));
                break;
            case 'pair':
                if (filled(value)) {
                    segments.push(argument(preferredFlag(flag)), argument(String(value).trim()));
                }
                break;
            case 'raw-lines':
                appendRawLines(segments, value);
                break;
            default:
                throw new Error(`Unknown serialization mode for ${flag.id}: ${flag.serialization.emit}`);
        }
    }

    function appendRawLines(segments, value) {
        if (!filled(value)) return;
        for (const line of String(value).split(/\r?\n/)) {
            const trimmed = line.trim();
            if (trimmed) segments.push({ kind: 'raw', value: trimmed });
        }
    }

    function buildArguments(registry, state, validation = { errorsById: new Map(), warnings: [] }) {
        const values = state.values || {};
        const executableId = state.mode === 'server' ? 'serverPath' : 'cliPath';
        const executable = filled(values[executableId])
            ? String(values[executableId]).trim()
            : registry.executables[state.platform]?.[state.mode] || registry.executables.linux[state.mode];
        const segments = [];
        const warnings = [...(validation.warnings || [])];

        const sources = registry.flags
            .filter(flag => flag.sourcePriority && filled(values[flag.id]))
            .sort((a, b) => a.sourcePriority - b.sourcePriority);
        const source = sources[0];
        if (source) {
            appendRegistered(segments, source, values[source.id]);
            if (source.id === 'hfRepo') {
                for (const id of ['hfFile', 'hfToken']) {
                    const supplement = registry.byId.get(id);
                    if (supplement && !validation.errorsById?.has(id)) appendRegistered(segments, supplement, values[id]);
                }
            }
        }

        const skip = new Set([
            ...registry.flags.filter(flag => flag.sourcePriority).map(flag => flag.id),
            ...SOURCE_SUPPLEMENTS
        ]);
        for (const flag of registry.flags) {
            if (skip.has(flag.id) || !flag.modes.includes(state.mode) || validation.errorsById?.has(flag.id)) continue;
            appendRegistered(segments, flag, values[flag.id]);
        }

        appendRawLines(segments, values.extraFlags);

        const intentionalNoModel = ['help', 'version', 'cacheList', 'completionBash', 'listDevices']
            .some(id => Boolean(values[id]));
        if (!source && !intentionalNoModel) {
            warnings.push({
                id: 'missing-source',
                fieldId: 'modelPath',
                severity: 'warning',
                message: 'No model source selected. Add -m, -hf, -mu, or -dr unless this is intentional router-mode server usage.'
            });
        }

        return { executable, segments, warnings };
    }

    return { buildArguments, appendRegistered, appendRawLines };
});
