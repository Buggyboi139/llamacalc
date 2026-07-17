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

        if (!data.executables) errors.push('Missing executable defaults');

        for (const flag of data.flags || []) {
            if (!flag.id || ids.has(flag.id)) errors.push(`Duplicate or missing id: ${flag.id || '<empty>'}`);
            ids.add(flag.id);

            if (!categories.has(flag.category)) errors.push(`${flag.id}: unknown category ${flag.category}`);
            if (!Array.isArray(flag.modes) || !flag.modes.length) errors.push(`${flag.id}: missing modes`);
            if (!flag.value || !flag.value.type) errors.push(`${flag.id}: missing value type`);

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

        return errors;
    }

    function createRegistry(data) {
        const errors = validateRegistry(data);
        if (errors.length) throw new Error(`Invalid flag registry:\n${errors.join('\n')}`);

        const byId = new Map(data.flags.map(flag => [flag.id, Object.freeze(flag)]));
        const byAlias = new Map();
        for (const flag of byId.values()) {
            for (const alias of [flag.canonical, ...flag.aliases]) byAlias.set(alias, flag);
        }

        return Object.freeze({
            meta: Object.freeze(data.meta),
            executables: Object.freeze(data.executables),
            fields: Object.freeze(data.fields || []),
            categories: Object.freeze(data.categories),
            flags: Object.freeze([...byId.values()]),
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
