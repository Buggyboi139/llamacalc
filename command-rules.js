(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function applyDflash(parts, state, pair, filled, warnings) {
        if (!filled(state.dflashModel)) return new Set();

        pair(parts, '-md', state.dflashModel);
        parts.push('--spec-type draft-dflash');

        if (filled(state.specDraftModel) || filled(state.specType)) {
            warnings.push('DFlash model path overrides the generic draft model path and speculative type.');
        }

        return new Set(['dflashModel', 'specDraftModel', 'specType']);
    }

    return { applyDflash };
});
