(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcRegistry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function validateRegistry(data) {
        const errors = [];
        const ids = new Set();
        const aliases = new Map();
        const categories = new Set((data.categories || []).map(category => category.id));
        const optionSets = data.optionSets || {};
        const validationSets = data.validationSets || {};

        if (!data.executables) errors.push('Missing executable defaults');

        for (const flag of data.flags || []) {
            if (!flag.id || ids.has(flag.id)) errors.push(`Duplicate or missing id: ${flag.id || '<empty>'}`);
            ids.add(flag.id);

            if (!categories.has(flag.category)) errors.push(`${flag.id}: unknown category ${flag.category}`);
            if (!Array.isArray(flag.modes) || !flag.modes.length) errors.push(`${flag.id}: missing modes`);
            if (!flag.value || !flag.value.type) errors.push(`${flag.id}: missing value type`);
            if (flag.value?.type === 'choice') {
                const options = flag.value.options || optionSets[flag.value.optionsRef];
                if (!Array.isArray(options) || !options.length) errors.push(`${flag.id}: missing choice options`);
            }

            const sentences = String(flag.description || '')
                .trim()
                .split(/(?<=[.!?])\s+/)
                .filter(Boolean);
            if (sentences.length < 2 || sentences.length > 3) {
                errors.push(`${flag.id}: description must contain 2-3 sentences`);
            }

            for (const alias of [flag.canonical, ...(flag.aliases || [])]) {
                if (!alias || !alias.startsWith('-')) errors.push(`${flag.id}: invalid alias ${alias}`);
                if (aliases.has(alias)) errors.push(`${flag.id}: duplicate alias ${alias}`);
                aliases.set(alias, flag.id);
            }
        }

        const allDefinitions = new Map((data.flags || []).map(flag => [flag.id, flag]));
        for (const field of data.fields || []) {
            if (!field.id || ids.has(field.id)) errors.push(`Duplicate or missing id: ${field.id || '<empty>'}`);
            ids.add(field.id);
            allDefinitions.set(field.id, field);
            if (!Array.isArray(field.modes) || !field.modes.length) errors.push(`${field.id}: missing modes`);
            if (!field.value || !field.value.type) errors.push(`${field.id}: missing value type`);
        }

        const presetIds = new Set();
        for (const preset of data.presets || []) {
            if (!preset.id || presetIds.has(preset.id)) {
                errors.push(`Duplicate or missing preset id: ${preset.id || '<empty>'}`);
            }
            presetIds.add(preset.id);
            if (!preset.label || !preset.group) errors.push(`${preset.id}: missing preset label or group`);
            if (!Array.isArray(preset.modes) || !preset.modes.length) errors.push(`${preset.id}: missing preset modes`);
            if (!Array.isArray(preset.fieldIds)) errors.push(`${preset.id}: missing preset fieldIds`);
            if (!Array.isArray(preset.ownedFieldIds)) errors.push(`${preset.id}: missing preset ownedFieldIds`);
            if (!Array.isArray(preset.appliedArguments)) errors.push(`${preset.id}: missing appliedArguments`);
            const sentences = String(preset.description || '')
                .trim()
                .split(/(?<=[.!?])\s+/)
                .filter(Boolean);
            if (sentences.length < 2 || sentences.length > 3) {
                errors.push(`${preset.id}: preset description must contain 2-3 sentences`);
            }
            const references = [
                ...(preset.fieldIds || []),
                ...(preset.ownedFieldIds || []),
                ...Object.keys(preset.values || {}),
                ...Object.keys(preset.fieldPresentation || {})
            ];
            for (const id of references) {
                if (!allDefinitions.has(id)) errors.push(`${preset.id}: unknown preset field ${id}`);
            }
            for (const [id, value] of Object.entries(preset.values || {})) {
                const field = allDefinitions.get(id);
                if (!field || field.value?.type !== 'choice') continue;
                const options = field.value.options || optionSets[field.value.optionsRef] || [];
                const allowed = options.map(option => typeof option === 'object' ? option.value : option);
                if (!allowed.includes(value)) errors.push(`${preset.id}: invalid preset value for ${id}`);
            }
        }
        if ((data.presets || []).length && !presetIds.has('plain')) errors.push('Missing plain preset');

        for (const id of data.presetDefaults?.clearOnApplyFieldIds || []) {
            if (!allDefinitions.has(id)) errors.push(`unknown preset default field ${id}`);
        }
        for (const id of Object.keys(data.presetDefaults?.fieldPresentation || {})) {
            if (!allDefinitions.has(id)) errors.push(`unknown preset presentation field ${id}`);
        }

        const ruleIds = new Set();
        const allowedOperators = new Set(['filled', 'notFilled', 'equals', 'notEquals', 'in', 'inSet']);
        function validateCondition(condition, ruleId) {
            if (!condition || typeof condition !== 'object') {
                errors.push(`${ruleId}: missing compatibility condition`);
                return;
            }
            if (condition.all || condition.any) {
                const children = condition.all || condition.any;
                if (!Array.isArray(children) || !children.length) {
                    errors.push(`${ruleId}: compatibility condition group must not be empty`);
                    return;
                }
                for (const child of children) validateCondition(child, ruleId);
                return;
            }
            if (condition.filledCount) {
                const ids = condition.filledCount.fieldIds;
                if (!Array.isArray(ids) || ids.length < 2 || condition.filledCount.minimum < 2) {
                    errors.push(`${ruleId}: invalid compatibility filledCount`);
                    return;
                }
                for (const id of ids) {
                    if (!allDefinitions.has(id)) errors.push(`${ruleId}: unknown compatibility field ${id}`);
                }
                return;
            }
            if (!allDefinitions.has(condition.fieldId)) {
                errors.push(`${ruleId}: unknown compatibility field ${condition.fieldId}`);
            }
            if (!allowedOperators.has(condition.operator)) {
                errors.push(`${ruleId}: unknown compatibility operator ${condition.operator}`);
            }
            if (condition.operator === 'in' && !Array.isArray(condition.values)) {
                errors.push(`${ruleId}: compatibility in condition requires values`);
            }
            if (condition.operator === 'inSet' && !Array.isArray(validationSets[condition.setRef])) {
                errors.push(`${ruleId}: unknown validation set ${condition.setRef}`);
            }
        }

        for (const rule of data.compatibilityRules || []) {
            if (!rule.id || ruleIds.has(rule.id)) errors.push(`Duplicate or missing compatibility rule id: ${rule.id || '<empty>'}`);
            ruleIds.add(rule.id);
            if (!['danger', 'warning', 'info'].includes(rule.severity)) errors.push(`${rule.id}: invalid compatibility severity`);
            if (!allDefinitions.has(rule.fieldId)) errors.push(`${rule.id}: unknown compatibility field ${rule.fieldId}`);
            for (const id of rule.focusFieldIds || []) {
                if (!allDefinitions.has(id)) errors.push(`${rule.id}: unknown compatibility field ${id}`);
            }
            if (!rule.message) errors.push(`${rule.id}: missing compatibility message`);
            if (rule.modes && (!Array.isArray(rule.modes) || rule.modes.some(mode => !['cli', 'server'].includes(mode)))) {
                errors.push(`${rule.id}: invalid compatibility modes`);
            }
            validateCondition(rule.when, rule.id);
        }

        return errors;
    }

    function createRegistry(data) {
        const errors = validateRegistry(data);
        if (errors.length) throw new Error(`Invalid flag registry:\n${errors.join('\n')}`);

        const optionSets = data.optionSets || {};
        const flags = data.flags.map(flag => {
            if (!flag.value?.optionsRef) return flag;
            return {
                ...flag,
                value: {
                    ...flag.value,
                    options: optionSets[flag.value.optionsRef]
                }
            };
        });
        const byId = new Map(flags.map(flag => [flag.id, Object.freeze(flag)]));
        const fields = Object.freeze(data.fields || []);
        const allById = new Map([
            ...fields.map(field => [field.id, field]),
            ...byId
        ]);
        const presets = Object.freeze((data.presets || []).map(preset => Object.freeze(preset)));
        const presetById = new Map(presets.map(preset => [preset.id, preset]));
        const byAlias = new Map();
        for (const flag of byId.values()) {
            for (const alias of [flag.canonical, ...flag.aliases]) byAlias.set(alias, flag);
        }

        return Object.freeze({
            meta: Object.freeze(data.meta),
            executables: Object.freeze(data.executables),
            optionSets: Object.freeze(optionSets),
            validationSets: Object.freeze(data.validationSets || {}),
            presetDefaults: Object.freeze(data.presetDefaults || {}),
            compatibilityRules: Object.freeze((data.compatibilityRules || []).map(rule => Object.freeze(rule))),
            fields,
            categories: Object.freeze(data.categories),
            flags: Object.freeze([...byId.values()]),
            presets,
            presetById,
            allById,
            byId,
            byAlias,
            forMode: mode => [...byId.values()].filter(flag => flag.modes.includes(mode)),
            forCategory: (categoryId, mode) => [...byId.values()].filter(
                flag => flag.category === categoryId && flag.modes.includes(mode)
            )
        });
    }

    async function loadRegistry(url = 'flags.json', fetchImpl = fetch) {
        const response = await fetchImpl(url);
        if (!response.ok) throw new Error(`Unable to load flag registry (${response.status})`);
        return createRegistry(await response.json());
    }

    return { validateRegistry, createRegistry, loadRegistry };
});
