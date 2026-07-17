(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function normalizeSearchText(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/^\s*-+/, '')
            .replace(/[_-]+/g, ' ')
            .replace(/[^a-z0-9.]+/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function fieldScore(query, value, exact, prefix, contains) {
        const normalized = normalizeSearchText(value);
        const compact = normalized.replace(/\s+/g, '');
        const queryCompact = query.replace(/\s+/g, '');
        if (normalized === query || compact === queryCompact) return exact;
        if (normalized.startsWith(query) || compact.startsWith(queryCompact)) return prefix;
        if (normalized.includes(query) || compact.includes(queryCompact)) return contains;
        const tokens = query.split(' ');
        return tokens.every(token => normalized.includes(token)) ? contains : 0;
    }

    function searchFlags(registry, queryValue, mode) {
        const query = normalizeSearchText(queryValue);
        if (!query) return [];
        const categoryLabels = new Map(registry.categories.map(category => [category.id, category.label]));

        return registry.flags
            .map((flag, order) => {
                if (!flag.modes.includes(mode)) return null;
                const aliasScore = Math.max(...[flag.canonical, ...flag.aliases]
                    .map(alias => fieldScore(query, alias, 100, 80, 60)));
                const labelScore = fieldScore(query, flag.label, 70, 65, 50);
                const categoryScore = fieldScore(query, categoryLabels.get(flag.category) || flag.category, 50, 45, 35);
                const descriptionScore = fieldScore(query, flag.description, 45, 40, 20);
                const modeScore = fieldScore(query, flag.modes.join(' '), 30, 25, 15);
                const score = Math.max(aliasScore, labelScore, categoryScore, descriptionScore, modeScore);
                if (!score) return null;
                const matchedBy = score === aliasScore ? 'alias'
                    : score === labelScore ? 'label'
                        : score === categoryScore ? 'category'
                            : score === descriptionScore ? 'description'
                                : 'mode';
                return { flag, score, matchedBy, order };
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score || a.order - b.order)
            .map(({ order, ...result }) => result);
    }

    return { normalizeSearchText, searchFlags };
});
