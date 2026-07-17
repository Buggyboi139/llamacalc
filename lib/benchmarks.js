(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcBenchmarks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const LOGS_KEY = 'llamacmd_logs_v1';

    function round(value) {
        const number = Number(value);
        return Number.isFinite(number) ? String(Math.round(number * 100) / 100) : String(value);
    }

    function findTiming(value) {
        if (!value || typeof value !== 'object') return null;
        if (value.timings) return value.timings;
        if (Array.isArray(value)) {
            for (const item of value) {
                const result = findTiming(item);
                if (result) return result;
            }
            return null;
        }
        for (const key of Object.keys(value)) {
            const result = findTiming(value[key]);
            if (result) return result;
        }
        return null;
    }

    function parseJSONTiming(text) {
        const source = String(text || '');
        const candidates = [source.trim()];
        const start = source.indexOf('{');
        const end = source.lastIndexOf('}');
        if (start >= 0 && end > start) candidates.push(source.slice(start, end + 1));

        for (const candidate of candidates) {
            try {
                const timing = findTiming(JSON.parse(candidate));
                if (!timing) continue;
                const result = {};
                if (timing.prompt_per_second !== undefined) result.promptTps = round(timing.prompt_per_second);
                if (timing.predicted_per_second !== undefined) result.genTps = round(timing.predicted_per_second);
                if (timing.prompt_n !== undefined) result.promptTokens = timing.prompt_n;
                if (timing.predicted_n !== undefined) result.genTokens = timing.predicted_n;
                if (timing.prompt_ms !== undefined && timing.predicted_ms !== undefined) {
                    result.totalMs = round(Number(timing.prompt_ms) + Number(timing.predicted_ms));
                }
                return result;
            } catch {
                // Try the next candidate.
            }
        }
        return null;
    }

    function parseTiming(text) {
        const result = {};
        const source = String(text || '');
        const json = parseJSONTiming(source);
        if (json) Object.assign(result, json);

        const prompt = source.match(/prompt eval time\s*=\s*([\d.]+)\s*ms\s*\/\s*(\d+)\s*tokens?.*?\(([\d.]+)\s*tokens per second\)/i);
        const generationLine = source
            .split(/\r?\n/)
            .find((line) => /\beval time\s*=/i.test(line) && !/\bprompt eval time\s*=/i.test(line));
        const generation = generationLine?.match(/eval time\s*=\s*([\d.]+)\s*ms\s*\/\s*(\d+)\s*(?:runs?|tokens?).*?\(([\d.]+)\s*tokens per second\)/i);
        const total = source.match(/total time\s*=\s*([\d.]+)\s*ms/i);
        if (prompt) {
            result.promptTokens = prompt[2];
            result.promptTps = prompt[3];
        }
        if (generation) {
            result.genTokens = generation[2];
            result.genTps = generation[3];
        }
        if (total) result.totalMs = total[1];
        return result;
    }

    function loadLogs(storage) {
        try {
            const logs = JSON.parse(storage.getItem(LOGS_KEY));
            return Array.isArray(logs) ? logs : [];
        } catch {
            return [];
        }
    }

    function saveLogs(storage, logs) {
        storage.setItem(LOGS_KEY, JSON.stringify(logs));
    }

    function trimmed(value) {
        return String(value ?? '').trim();
    }

    function guessName(model) {
        if (!model) return 'llama.cpp run';
        return model.split(/[\\/]/).filter(Boolean).pop() || model;
    }

    function createLogEntry(input, dependencies = {}) {
        const values = input.state.values || {};
        const fields = input.fields || {};
        const model = values.modelPath || values.hfRepo || values.modelUrl || values.dockerRepo || '';
        const id = dependencies.id
            ? dependencies.id()
            : (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()));
        const timestamp = dependencies.now ? dependencies.now() : new Date().toISOString();

        return {
            id,
            timestamp,
            mode: input.state.mode,
            name: trimmed(fields.name) || guessName(model),
            model,
            context: values.ctxSize || '',
            promptTps: trimmed(fields.promptTps),
            genTps: trimmed(fields.genTps),
            promptTokens: trimmed(fields.promptTokens),
            genTokens: trimmed(fields.genTokens),
            totalMs: trimmed(fields.totalMs),
            build: trimmed(fields.build),
            notes: trimmed(fields.notes),
            command: input.command
        };
    }

    function markdownValue(value) {
        return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
    }

    function logsMarkdown(logs) {
        const rows = [
            '| Date | Name | Mode | Prompt t/s | Gen t/s | Tokens | Build | Notes | Command |',
            '|---|---|---|---|---|---|---|---|---|'
        ];
        for (const log of logs) {
            rows.push(`| ${markdownValue(log.timestamp)} | ${markdownValue(log.name)} | ${markdownValue(log.mode)} | ${markdownValue(log.promptTps)} | ${markdownValue(log.genTps)} | ${markdownValue([log.promptTokens, log.genTokens].filter(Boolean).join(' / '))} | ${markdownValue(log.build)} | ${markdownValue(log.notes)} | \`${markdownValue(log.command)}\` |`);
        }
        return rows.join('\n');
    }

    function logsCsv(logs) {
        const rows = [[
            'timestamp', 'name', 'mode', 'model', 'context', 'prompt_tps', 'gen_tps',
            'prompt_tokens', 'gen_tokens', 'total_ms', 'build', 'notes', 'command'
        ]];
        for (const log of logs) {
            rows.push([
                log.timestamp, log.name, log.mode, log.model, log.context, log.promptTps,
                log.genTps, log.promptTokens, log.genTokens, log.totalMs, log.build,
                log.notes, log.command
            ]);
        }
        return rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    }

    return {
        LOGS_KEY,
        parseTiming,
        parseJSONTiming,
        findTiming,
        loadLogs,
        saveLogs,
        createLogEntry,
        logsMarkdown,
        logsCsv
    };
});
