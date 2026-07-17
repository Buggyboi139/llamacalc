(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function filled(value) {
        return value !== undefined && value !== null && (typeof value === 'boolean' ? value : String(value).trim() !== '');
    }

    function warning(id, fieldId, message) {
        return { id, fieldId, severity: 'warning', message };
    }

    function validateValue(flag, value) {
        if (!filled(value) || typeof value === 'boolean') return '';
        const text = String(value).trim();
        const rules = flag.validation || {};

        if (flag.value.type === 'choice') {
            const options = (flag.value.options || []).map(option => String(
                typeof option === 'object' ? option.value : option
            ));
            if (!options.includes(text)) return `${flag.label} must use a current option from the dropdown.`;
        }

        if (flag.value.type === 'integer' || rules.integer) {
            const number = Number(text);
            if (!Number.isFinite(number) || !Number.isInteger(number)) return `${flag.label} must be an integer.`;
        } else if (flag.value.type === 'number') {
            if (!Number.isFinite(Number(text))) return `${flag.label} must be a number.`;
        }

        if (rules.min !== undefined && Number(text) < rules.min) {
            if (rules.max !== undefined) return `${flag.label} must be between ${rules.min} and ${rules.max}.`;
            return `${flag.label} must be at least ${rules.min}.`;
        }
        if (rules.max !== undefined && Number(text) > rules.max) {
            if (rules.min !== undefined) return `${flag.label} must be between ${rules.min} and ${rules.max}.`;
            return `${flag.label} must be at most ${rules.max}.`;
        }
        if (rules.pattern && !(new RegExp(rules.pattern)).test(text)) return rules.message || `${flag.label} has an invalid format.`;
        return '';
    }

    function validateState(registry, state) {
        const errorsById = new Map();
        const warnings = [];

        for (const flag of registry.forMode(state.mode)) {
            const value = state.values[flag.id];
            const error = validateValue(flag, value);
            if (error) errorsById.set(flag.id, error);

            if (filled(value) && flag.deprecated) {
                warnings.push(warning(`deprecated-${flag.id}`, flag.id, `${flag.label} is deprecated by current llama.cpp help.`));
            }
            if (filled(value) && flag.requires) {
                for (const requiredId of flag.requires) {
                    if (!filled(state.values[requiredId])) {
                        warnings.push(warning(`requires-${flag.id}-${requiredId}`, flag.id, `${flag.label} requires ${registry.byId.get(requiredId)?.label || requiredId}.`));
                    }
                }
            }
            if (filled(value) && flag.conflicts) {
                for (const conflictId of flag.conflicts) {
                    if (filled(state.values[conflictId])) {
                        warnings.push(warning(`conflict-${flag.id}-${conflictId}`, flag.id, `${flag.label} conflicts with ${registry.byId.get(conflictId)?.label || conflictId}.`));
                    }
                }
            }
        }

        const sources = [...registry.flags]
            .filter(flag => flag.sourcePriority && filled(state.values[flag.id]))
            .sort((a, b) => a.sourcePriority - b.sourcePriority);
        if (sources.length > 1) {
            warnings.push(warning(
                'source-conflict',
                sources[0].id,
                'Multiple model sources are filled. Priority is local path, HF repo, model URL, Docker repo.'
            ));
        }

        if (state.mode === 'server'
            && String(state.values.host || '').trim() === '0.0.0.0'
            && !filled(state.values.apiKey)
            && !filled(state.values.apiKeyFile)) {
            warnings.push(warning('public-server', 'host', 'Server is bound to 0.0.0.0 without an API key or API key file.'));
        }

        if (filled(state.values.tensorSplit) && !/^[0-9.,\s]+$/.test(String(state.values.tensorSplit))) {
            warnings.push(warning('tensor-split-format', 'tensorSplit', 'Tensor split contains unusual characters; it should usually look like 1,1 or 3,1.'));
        }

        if (filled(state.values.extraFlags)) {
            warnings.push(warning('raw-flags', 'extraFlags', 'Extra flags are appended verbatim and are not validated.'));
            if (state.platform === 'windows') {
                warnings.push(warning('raw-cross-shell', 'extraFlags', 'Raw flags keep their original shell syntax when switching operating systems.'));
            }
        }

        if (state.platform === 'windows' && state.windowsShell === 'cmd') {
            const expanded = registry.forMode(state.mode).find(flag =>
                typeof state.values[flag.id] === 'string' && /%[^%\r\n]+%/.test(state.values[flag.id]));
            if (expanded) {
                warnings.push(warning(
                    'cmd-percent-expansion',
                    expanded.id,
                    'Command Prompt expands percent-delimited text as an environment variable even inside quotes; use PowerShell when this text must remain literal.'
                ));
            }
        }

        const secretFields = registry.flags.filter(flag => flag.secret && filled(state.values[flag.id]));
        if (secretFields.length) {
            warnings.push(warning('secret-values', secretFields[0].id, 'Secret fields are used in the command but are not saved to browser storage.'));
        }

        return { errorsById, warnings };
    }

    return { filled, validateValue, validateState };
});
