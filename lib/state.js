(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const STATE_KEY = 'llamacmd_state_v1';
    const MODES = new Set(['cli', 'server']);
    const PLATFORMS = new Set(['linux', 'macos', 'windows']);
    const WINDOWS_SHELLS = new Set(['powershell', 'cmd']);

    function allFields(registry) {
        return [...registry.fields, ...registry.flags];
    }

    function emptyValue(field) {
        if (field.value.default !== undefined) return field.value.default;
        return ['boolean', 'action'].includes(field.value.type) ? false : '';
    }

    function defaultState(registry) {
        return {
            mode: 'server',
            platform: 'linux',
            windowsShell: 'powershell',
            multiline: true,
            activeCategory: 'essentials',
            values: Object.fromEntries(allFields(registry).map(field => [field.id, emptyValue(field)]))
        };
    }

    function loadState(storage, registry) {
        const state = defaultState(registry);
        let saved;
        try {
            saved = JSON.parse(storage.getItem(STATE_KEY)) || {};
        } catch {
            return state;
        }

        if (MODES.has(saved.mode)) state.mode = saved.mode;
        if (PLATFORMS.has(saved.platform)) state.platform = saved.platform;
        if (WINDOWS_SHELLS.has(saved.windowsShell)) state.windowsShell = saved.windowsShell;
        if (typeof saved.multiline === 'boolean') state.multiline = saved.multiline;
        if (typeof saved.activeCategory === 'string' && saved.activeCategory) {
            state.activeCategory = saved.activeCategory;
        }

        for (const field of allFields(registry)) {
            if (field.secret || saved[field.id] === undefined) continue;
            state.values[field.id] = ['boolean', 'action'].includes(field.value.type)
                ? Boolean(saved[field.id])
                : String(saved[field.id]);
        }
        return state;
    }

    function saveState(storage, state, registry) {
        const saved = {
            mode: MODES.has(state.mode) ? state.mode : 'server',
            platform: PLATFORMS.has(state.platform) ? state.platform : 'linux',
            windowsShell: WINDOWS_SHELLS.has(state.windowsShell) ? state.windowsShell : 'powershell',
            multiline: Boolean(state.multiline),
            activeCategory: state.activeCategory || 'essentials'
        };

        for (const field of allFields(registry)) {
            if (!field.secret) saved[field.id] = state.values[field.id] ?? emptyValue(field);
        }
        storage.setItem(STATE_KEY, JSON.stringify(saved));
    }

    return { STATE_KEY, defaultState, loadState, saveState };
});
