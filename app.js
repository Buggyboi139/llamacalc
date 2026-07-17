document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('flagSearch');
    const loadError = document.getElementById('loadError');
    const benchmarks = LlamaCalcBenchmarks;
    let registry = null;
    let state = null;
    let searchQuery = '';
    let command = '';
    let logs = benchmarks.loadLogs(localStorage);

    const renderer = LlamaCalcRender.createRenderer(document, {
        onFieldChange(fieldId, value) {
            if (!state) return;
            state.values[fieldId] = value;
            update();
        },
        onCategoryChange(categoryId) {
            if (!state) return;
            state.activeCategory = categoryId;
            searchQuery = '';
            searchInput.value = '';
            update();
        },
        onWarningFocus: focusField,
        onCopyLog(log) {
            copyText(log.command, 'Logged command copied.');
        },
        onDeleteLog(id) {
            logs = logs.filter(log => log.id !== id);
            benchmarks.saveLogs(localStorage, logs);
            renderer.renderLogs(logs);
            renderer.announce('Benchmark log deleted.');
        }
    });

    renderer.renderLogs(logs);
    bindBenchmarkControls();
    bindShellControls();

    try {
        registry = await LlamaCalcRegistry.loadRegistry('flags.json');
        state = LlamaCalcState.loadState(localStorage, registry);
        ensureActiveCategory();
        update();
    } catch (error) {
        loadError.textContent = `LlamaCalc could not load its flag registry. ${error.message}`;
        loadError.hidden = false;
        document.getElementById('logRunBtn').disabled = true;
    }

    function ensureActiveCategory() {
        if (!state || state.activeCategory === 'essentials') return;
        const categoryExists = registry.categories.some(category => category.id === state.activeCategory);
        const categoryHasFlags = registry.forCategory(state.activeCategory, state.mode).length > 0;
        if (!categoryExists || !categoryHasFlags) state.activeCategory = 'essentials';
    }

    function update() {
        if (!registry || !state) return;
        const validation = LlamaCalcValidation.validateState(registry, state);
        const model = LlamaCalcCommand.buildArguments(registry, state, validation);
        command = LlamaCalcSerializers.serializeCommand(model, state);
        const searchResults = LlamaCalcSearch.searchFlags(registry, searchQuery, state.mode);
        renderer.render({
            registry,
            state,
            validation,
            model,
            command,
            searchQuery,
            searchResults,
            logs
        });
        LlamaCalcState.saveState(localStorage, state, registry);
    }

    function focusField(fieldId) {
        if (!registry || !state || !fieldId) return;
        const flag = registry.byId.get(fieldId);
        const utility = registry.fields.find(field => field.id === fieldId);
        searchQuery = '';
        searchInput.value = '';
        state.activeCategory = flag?.category || (utility?.id === 'extraFlags' ? 'advanced' : 'essentials');
        update();
        requestAnimationFrame(() => document.getElementById(`field-${fieldId}`)?.focus());
    }

    function bindShellControls() {
        for (const input of document.querySelectorAll('input[name="mode"]')) {
            input.addEventListener('change', event => {
                if (!state || !event.currentTarget.checked) return;
                state.mode = event.currentTarget.value;
                ensureActiveCategory();
                update();
            });
        }
        for (const input of document.querySelectorAll('input[name="platform"]')) {
            input.addEventListener('change', event => {
                if (!state || !event.currentTarget.checked) return;
                state.platform = event.currentTarget.value;
                update();
            });
        }
        for (const input of document.querySelectorAll('input[name="windowsShell"]')) {
            input.addEventListener('change', event => {
                if (!state || !event.currentTarget.checked) return;
                state.windowsShell = event.currentTarget.value;
                update();
            });
        }

        document.getElementById('multilineCheck').addEventListener('change', event => {
            if (!state) return;
            state.multiline = event.currentTarget.checked;
            update();
        });

        searchInput.addEventListener('input', event => {
            searchQuery = event.currentTarget.value;
            update();
        });
        searchInput.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || !searchQuery) return;
            event.preventDefault();
            searchQuery = '';
            searchInput.value = '';
            update();
        });
        document.getElementById('clearSearchBtn').addEventListener('click', () => {
            searchQuery = '';
            searchInput.value = '';
            update();
            searchInput.focus();
        });
        document.addEventListener('keydown', event => {
            if (event.key !== '/' || event.altKey || event.ctrlKey || event.metaKey) return;
            const target = event.target;
            if (target.closest?.('input, textarea, select, button, [contenteditable="true"]')) return;
            event.preventDefault();
            searchInput.focus();
        });

        document.getElementById('copyCommandBtn').addEventListener('click', () => {
            if (command) copyText(command, 'Command copied.');
        });
        document.getElementById('resetBuilderBtn').addEventListener('click', () => {
            if (!registry || !state || !window.confirm('Reset every builder field and target setting?')) return;
            state = LlamaCalcState.defaultState(registry);
            searchQuery = '';
            searchInput.value = '';
            update();
            renderer.announce('Builder reset.');
        });
        document.getElementById('jumpToBenchmarksBtn').addEventListener('click', () => {
            document.getElementById('benchmarkLog').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    function benchmarkFields() {
        return {
            name: document.getElementById('logName').value,
            build: document.getElementById('logBuild').value,
            promptTps: document.getElementById('logPromptTps').value,
            genTps: document.getElementById('logGenTps').value,
            promptTokens: document.getElementById('logPromptTokens').value,
            genTokens: document.getElementById('logGenTokens').value,
            totalMs: document.getElementById('logTotalMs').value,
            notes: document.getElementById('logNotes').value
        };
    }

    function bindBenchmarkControls() {
        document.getElementById('parseTimingBtn').addEventListener('click', () => {
            const parsed = benchmarks.parseTiming(document.getElementById('timingPaste').value);
            if (!Object.keys(parsed).length) {
                renderer.announce('No timing values found.');
                return;
            }
            const targets = {
                promptTps: 'logPromptTps',
                genTps: 'logGenTps',
                promptTokens: 'logPromptTokens',
                genTokens: 'logGenTokens',
                totalMs: 'logTotalMs'
            };
            for (const [key, id] of Object.entries(targets)) {
                if (parsed[key] !== undefined) document.getElementById(id).value = parsed[key];
            }
            renderer.announce('Timing output parsed.');
        });

        document.getElementById('logRunBtn').addEventListener('click', () => {
            if (!state) return;
            logs.unshift(benchmarks.createLogEntry({ state, fields: benchmarkFields(), command }));
            benchmarks.saveLogs(localStorage, logs);
            renderer.renderLogs(logs);
            renderer.announce('Current command logged.');
        });
        document.getElementById('copyMarkdownBtn').addEventListener('click', () => {
            copyText(benchmarks.logsMarkdown(logs), 'Benchmark Markdown copied.');
        });
        document.getElementById('copyCsvBtn').addEventListener('click', () => {
            copyText(benchmarks.logsCsv(logs), 'Benchmark CSV copied.');
        });
        document.getElementById('clearLogsBtn').addEventListener('click', () => {
            if (!logs.length || !window.confirm('Clear every saved benchmark log?')) return;
            logs = [];
            benchmarks.saveLogs(localStorage, logs);
            renderer.renderLogs(logs);
            renderer.announce('Benchmark logs cleared.');
        });
    }

    async function copyText(text, successMessage) {
        try {
            await navigator.clipboard.writeText(text);
            renderer.announce(successMessage);
        } catch {
            const fallback = document.createElement('textarea');
            fallback.value = text;
            fallback.setAttribute('readonly', '');
            fallback.className = 'clipboard-fallback';
            document.body.appendChild(fallback);
            fallback.select();
            const copied = document.execCommand('copy');
            fallback.remove();
            renderer.announce(copied ? successMessage : 'Copy failed. Select the text and copy it manually.');
        }
    }
});
