(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function filled(value) {
        return value !== undefined && value !== null && (typeof value === 'boolean' ? value : String(value).trim() !== '');
    }

    function warning(id, fieldId, message, severity = 'warning') {
        return { id, fieldId, severity, message };
    }

    function evaluateCondition(condition, values, validationSets) {
        if (condition.all) return condition.all.every(child => evaluateCondition(child, values, validationSets));
        if (condition.any) return condition.any.some(child => evaluateCondition(child, values, validationSets));
        if (condition.filledCount) {
            const count = condition.filledCount.fieldIds.filter(id => filled(values[id])).length;
            return count >= condition.filledCount.minimum;
        }

        const value = values[condition.fieldId];
        switch (condition.operator) {
            case 'filled': return filled(value);
            case 'notFilled': return !filled(value);
            case 'equals': return value === condition.value;
            case 'notEquals': return value !== condition.value;
            case 'in': return condition.values.includes(value);
            case 'inSet': return (validationSets[condition.setRef] || []).includes(value);
            default: return false;
        }
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

        for (const rule of registry.compatibilityRules || []) {
            if (rule.modes && !rule.modes.includes(state.mode)) continue;
            if (evaluateCondition(rule.when, state.values, registry.validationSets || {})) {
                const focusFieldId = rule.focusFieldIds?.find(id => filled(state.values[id])) || rule.fieldId;
                warnings.push(warning(rule.id, focusFieldId, rule.message, rule.severity));
            }
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

    return { filled, evaluateCondition, validateValue, validateState };
});
