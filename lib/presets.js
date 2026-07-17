(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcPresets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function presetsForMode(registry, mode) {
        return (registry.presets || []).filter(preset => preset.modes.includes(mode));
    }

    function presetById(registry, id) {
        return registry.presetById?.get(id)
            || (registry.presets || []).find(preset => preset.id === id)
            || null;
    }

    function fieldsForPreset(registry, presetId, mode) {
        const preset = presetById(registry, presetId);
        if (!preset) throw new Error(`Unknown preset: ${presetId}`);
        if (!preset.modes.includes(mode)) throw new Error(`Preset ${presetId} is unavailable in ${mode} mode.`);
        return preset.fieldIds
            .map(id => registry.allById.get(id))
            .filter(field => field && field.modes.includes(mode))
            .map(field => ({
                ...field,
                ...(registry.presetDefaults?.fieldPresentation?.[field.id] || {}),
                ...(preset.fieldPresentation?.[field.id] || {})
            }));
    }

    function emptyValue(field) {
        if (field.value.default !== undefined) return field.value.default;
        return ['boolean', 'action'].includes(field.value.type) ? false : '';
    }

    function applyPreset(registry, state, presetId) {
        const next = presetById(registry, presetId);
        if (!next || !next.modes.includes(state.mode)) {
            throw new Error(`Preset ${presetId} is unavailable in ${state.mode} mode.`);
        }
        const previous = presetById(registry, state.activePreset);
        const clearIds = new Set([
            ...(registry.presetDefaults?.clearOnApplyFieldIds || []),
            ...(previous?.ownedFieldIds || []),
            ...next.ownedFieldIds
        ]);
        for (const id of clearIds) {
            const field = registry.allById.get(id);
            if (field) state.values[id] = emptyValue(field);
        }
        Object.assign(state.values, next.values || {});
        state.activePreset = next.id;
        state.activeCategory = 'essentials';
        return next;
    }

    function ensurePresetForMode(registry, state) {
        const preset = presetById(registry, state.activePreset);
        if (preset?.modes.includes(state.mode)) return preset;
        return applyPreset(registry, state, 'plain');
    }

    return {
        presetsForMode,
        presetById,
        fieldsForPreset,
        applyPreset,
        ensurePresetForMode
    };
});
