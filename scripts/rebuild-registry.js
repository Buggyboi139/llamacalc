#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { parseHelpTable } = require('./audit-flags.js');

const root = path.join(__dirname, '..');
const cliPath = process.argv[2] || '/home/dsmason321/llama.cpp/tools/cli/README.md';
const serverPath = process.argv[3] || '/home/dsmason321/llama.cpp/tools/server/README.md';
const current = JSON.parse(fs.readFileSync(path.join(root, 'flags.json'), 'utf8'));

const rows = [
    ...parseHelpTable(fs.readFileSync(cliPath, 'utf8'), 'cli'),
    ...parseHelpTable(fs.readFileSync(serverPath, 'utf8'), 'server')
];

const groups = [];
const byAlias = new Map();

for (const row of rows) {
    const matches = [...new Set(row.aliases.map(alias => byAlias.get(alias)).filter(Boolean))];
    let group = matches.shift();
    if (!group) {
        group = { aliases: [], modes: new Set(), rows: [], order: groups.length };
        groups.push(group);
    }
    for (const other of matches) {
        for (const alias of other.aliases) {
            if (!group.aliases.includes(alias)) group.aliases.push(alias);
            byAlias.set(alias, group);
        }
        for (const mode of other.modes) group.modes.add(mode);
        group.rows.push(...other.rows);
        const index = groups.indexOf(other);
        if (index >= 0) groups.splice(index, 1);
    }
    for (const alias of row.aliases) {
        if (!group.aliases.includes(alias)) group.aliases.push(alias);
        byAlias.set(alias, group);
    }
    group.modes.add(row.mode);
    group.rows.push(row);
}

const legacyByAlias = new Map();
const legacySources = ['script.js', 'index.html']
    .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
    .join('\n');
for (const match of legacySources.matchAll(/\['([^']+)','([^']+)','(?:[^']+)',\s*'(-{1,2}[^']+)'/g)) {
    legacyByAlias.set(match[3], { id: match[1], label: match[2] });
}

const currentByAlias = new Map();
for (const flag of current.flags) {
    for (const alias of [flag.canonical, ...flag.aliases]) currentByAlias.set(alias, flag);
}

const special = new Map([
    ['--image', {
        id: 'mediaInput',
        label: 'Media input',
        canonical: '--image',
        category: 'multimodal',
        value: { type: 'string', placeholder: 'image.png, audio.wav, or video.mp4' },
        description: 'Supplies image, audio, or video files to a compatible multimodal model. Use comma-separated paths when the model and selected mode accept multiple media inputs.'
    }]
]);

const manualIds = new Set([
    'offline', 'logColors', 'logPromptsDir', 'mediaInput', 'modelVocoder',
    'uiMcpProxy', 'agent', 'ssePingInterval', 'slotPromptSimilarity', 'poll',
    'cpuStrict', 'cpuStrictBatch', 'pollBatch', 'cacheTypeK', 'cacheTypeV', 'numa',
    'reasoningFormat', 'specDraftTypeK', 'specDraftTypeV', 'specDraftCpuStrict',
    'specDraftPoll', 'specDraftCpuStrictBatch', 'specDraftPollBatch'
]);

const featuredIds = new Set([
    'modelPath', 'hfRepo', 'ctxSize', 'predict', 'batchSize', 'ubatchSize',
    'threads', 'threadsBatch', 'gpuLayers', 'device', 'flashAttn', 'cacheTypeK',
    'cacheTypeV', 'kvOffload', 'host', 'port', 'parallel', 'prompt', 'systemPrompt',
    'chatTemplate', 'reasoning', 'specType', 'specDraftModel'
]);

const numericAliases = new Set([
    '--rope-scale', '--rope-freq-base', '--rope-freq-scale', '--yarn-ext-factor',
    '--yarn-attn-factor', '--yarn-beta-slow', '--yarn-beta-fast', '--temp', '--top-p',
    '--min-p', '--top-n-sigma', '--top-nsigma', '--xtc-probability', '--xtc-threshold',
    '--typical-p', '--typical', '--repeat-penalty', '--presence-penalty',
    '--frequency-penalty', '--dry-multiplier', '--dry-base', '--adaptive-target',
    '--adaptive-decay', '--dynatemp-range', '--dynatemp-exp', '--mirostat-lr',
    '--mirostat-ent', '--spec-draft-p-split', '--spec-draft-p-min',
    '--slot-prompt-similarity'
]);

const categoryHints = [
    ['presets', /(?:^--help$|^--version$|cache-list|completion-bash|default$|default\b)/],
    ['speculative', /(?:spec-|draft|ngram)/],
    ['logging', /(?:^--log|verbose|verbosity|offline)/],
    ['adapters', /(?:lora|control-vector)/],
    ['multimodal', /(?:mmproj|image|audio|video|vocoder|tts|mtmd)/],
    ['sampling', /(?:sampler|sampling|seed|eos|temp|top-|min-p|xtc|typical|repeat|penalty|dry-|adaptive|dynatemp|mirostat|logit-bias|grammar|json-schema|backend-sampling)/],
    ['memory', /(?:cache|mlock|mmap|direct-io|repack|swa-full|context-shift)/],
    ['hardware', /(?:device|offload|gpu|split-mode|tensor-split|main-gpu|fit-|cpu-moe|n-cpu-moe|override-tensor|check-tensors|no-host)/],
    ['prompt', /(?:prompt|chat|conversation|single-turn|multiline-input|reasoning|jinja|special|simple-io)/],
    ['runtime', /(?:threads|cpu-|ctx|context|predict|batch|keep|prio|poll|numa|rope|yarn|warmup|perf|escape|parallel)/],
    ['model', /(?:model|hf-|docker-repo|override-kv)/]
];

const categoryFollowups = {
    model: 'Use it when selecting or configuring the model source for this command.',
    runtime: 'Leave it unset to keep the upstream runtime default, or set it when the workload needs an explicit override.',
    hardware: 'Set it only when device placement or accelerator behavior needs to differ from automatic selection.',
    memory: 'Use it when tuning model loading, cache use, or memory pressure for the target system.',
    sampling: 'Set it when the generation strategy needs to differ from the model or llama.cpp default.',
    prompt: 'Use it when the prompt, chat template, or interactive behavior needs an explicit command-line setting.',
    multimodal: 'Use it only with models and endpoints that support the corresponding media or audio capability.',
    server: 'Use it to configure the long-running HTTP server or one of its exposed capabilities.',
    speculative: 'Tune it only when speculative decoding is enabled and the draft strategy requires an explicit override.',
    adapters: 'Use it when applying an adapter or control vector to the loaded model.',
    logging: 'Leave it unset for normal output, or set it when diagnosing or recording a run.',
    presets: 'This action or preset is intended for deliberate one-command setup or inspection.',
    advanced: 'Leave it unset unless the workload specifically requires this advanced behavior.'
};

function chooseCanonical(aliases) {
    return aliases.find(alias => alias.startsWith('--') && !alias.startsWith('--no-'))
        || aliases.find(alias => alias.startsWith('--'))
        || aliases[0];
}

function toId(alias) {
    const words = alias.replace(/^-+/, '').split(/[.-]/).filter(Boolean);
    return words[0] + words.slice(1).map(word => word[0].toUpperCase() + word.slice(1)).join('');
}

function toLabel(alias) {
    const words = alias.replace(/^-+/, '').split(/[.-]/).filter(Boolean);
    const acronyms = new Map([
        ['api', 'API'], ['cpu', 'CPU'], ['gpu', 'GPU'], ['hf', 'Hugging Face'], ['http', 'HTTP'],
        ['io', 'I/O'], ['json', 'JSON'], ['kv', 'KV'], ['mcp', 'MCP'], ['mmproj', 'Multimodal projector'],
        ['numa', 'NUMA'], ['rpc', 'RPC'], ['sse', 'SSE'], ['ssl', 'SSL'], ['swa', 'SWA'], ['tts', 'TTS'],
        ['ui', 'Web UI'], ['url', 'URL'], ['xtc', 'XTC']
    ]);
    return words.map((word, index) => {
        if (acronyms.has(word)) return acronyms.get(word);
        if (/^qwen$|^gemma$|^gpt$|^oss$|^lora$|^mirostat$|^yarn$|^rope$/i.test(word)) {
            return word[0].toUpperCase() + word.slice(1);
        }
        return index === 0 ? word[0].toUpperCase() + word.slice(1) : word;
    }).join(' ');
}

function categoryFor(canonical, aliases, modes) {
    const haystack = [canonical, ...aliases].join(' ');
    if (/(?:help|usage|version|cache-list|completion-bash|list-devices)/.test(haystack)) return 'presets';
    for (const [category, pattern] of categoryHints) if (pattern.test(haystack)) return category;
    return modes.length === 1 && modes[0] === 'server' ? 'server' : 'advanced';
}

function argumentTail(signature, aliases) {
    let end = 0;
    for (const alias of aliases) {
        const index = signature.indexOf(alias);
        if (index >= 0) end = Math.max(end, index + alias.length);
    }
    return signature.slice(end).replace(/^\s+/, '');
}

function valueFor(signature, aliases, canonical) {
    const tail = argumentTail(signature, aliases);
    const positive = aliases.find(alias => alias.startsWith('--') && !alias.startsWith('--no-'));
    const negative = aliases.find(alias => alias.startsWith('--no-'));
    if (!tail && positive && negative) {
        return {
            value: {
                type: 'choice',
                options: [
                    { value: '', label: 'Unset' },
                    { value: 'on', label: 'On' },
                    { value: 'off', label: 'Off' }
                ]
            },
            serialization: { emit: 'mapped', map: { on: positive, off: negative } }
        };
    }
    if (/\[(?:on\\?\|off|off\\?\|on)/i.test(tail)) {
        const auto = /auto/i.test(tail);
        const values = auto ? ['on', 'off', 'auto'] : ['on', 'off'];
        return {
            value: { type: 'choice', options: [{ value: '', label: 'Unset' }, ...values.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))] },
            serialization: { emit: 'pair', preferredAlias: preferredAlias(aliases, canonical) }
        };
    }
    const braces = tail.match(/\{([^}]+)\}/);
    if (braces) {
        const values = braces[1].split(',');
        return {
            value: { type: 'choice', options: [{ value: '', label: 'Unset' }, ...values.map(value => ({ value, label: value }))] },
            serialization: { emit: 'pair', preferredAlias: preferredAlias(aliases, canonical) }
        };
    }
    if (!tail) {
        const action = /(?:help|usage|version|cache-list|completion-bash|list-devices|default)$/.test(canonical);
        return {
            value: { type: action ? 'action' : 'boolean' },
            serialization: { emit: 'boolean', preferredAlias: preferredAlias(aliases, canonical) }
        };
    }
    if (/(?:PROMPT|GRAMMAR|SCHEMA|JSON|KWARGS)/.test(tail)) {
        return {
            value: { type: 'textarea' },
            serialization: { emit: 'pair', preferredAlias: preferredAlias(aliases, canonical) }
        };
    }
    if (numericAliases.has(canonical)) {
        return {
            value: { type: 'number' },
            serialization: { emit: 'pair', preferredAlias: preferredAlias(aliases, canonical) }
        };
    }
    if (/(?:^|\s)(?:N|INDEX|PORT|SECONDS|SEED|START END)(?:$|\s)/.test(tail)) {
        return {
            value: { type: 'integer' },
            serialization: { emit: 'pair', preferredAlias: preferredAlias(aliases, canonical) }
        };
    }
    if (/(?:SIMILARITY|PROBABILITY|SCALE|THRESHOLD|^P$)/.test(tail)) {
        return {
            value: { type: 'number' },
            serialization: { emit: 'pair', preferredAlias: preferredAlias(aliases, canonical) }
        };
    }
    return {
        value: { type: 'string' },
        serialization: { emit: 'pair', preferredAlias: preferredAlias(aliases, canonical) }
    };
}

function preferredAlias(aliases, canonical) {
    return aliases.find(alias => /^-[^-]/.test(alias)) || canonical;
}

function summaryFromUpstream(explanation, label) {
    let summary = String(explanation || '')
        .split(/<br\s*\/?\s*>/i)[0]
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s*\(default[^)]*\)/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.!?]+/g, '')
        .replace(/^whether to\s+/i, 'Controls whether to ')
        .replace(/^number of\s+/i, 'Sets the number of ')
        .replace(/^path to\s+/i, 'Sets the path to ')
        .replace(/^print\s+/i, 'Prints ')
        .replace(/^show\s+/i, 'Shows ')
        .replace(/^set\s+/i, 'Sets ')
        .replace(/^use\s+/i, 'Uses ')
        .replace(/^enable\s+/i, 'Enables ');
    if (!summary || summary.length < 20) summary = `Controls ${label.toLowerCase()} for llama.cpp`;
    if (summary.length > 190) summary = `${summary.slice(0, 187).replace(/\s+\S*$/, '')}`;
    return summary[0].toUpperCase() + summary.slice(1) + '.';
}

function isSecret(canonical) {
    return /(?:api-key$|hf-token$)/.test(canonical);
}

const usedIds = new Set();
const flags = groups.sort((a, b) => a.order - b.order).map(group => {
    const existing = group.aliases.map(alias => currentByAlias.get(alias)).find(Boolean);
    const legacy = group.aliases.map(alias => legacyByAlias.get(alias)).find(Boolean);
    const provisionalCanonical = chooseCanonical(group.aliases);
    const custom = special.get(provisionalCanonical);
    const manual = existing && manualIds.has(existing.id) ? existing : null;
    const canonical = custom?.canonical || (existing && group.aliases.includes(existing.canonical) ? existing.canonical : provisionalCanonical);
    let id = custom?.id || existing?.id || legacy?.id || toId(canonical);
    if (usedIds.has(id)) {
        let suffix = 2;
        while (usedIds.has(`${id}${suffix}`)) suffix += 1;
        id = `${id}${suffix}`;
    }
    usedIds.add(id);

    const modes = [...group.modes].sort((a, b) => ['cli', 'server'].indexOf(a) - ['cli', 'server'].indexOf(b));
    const label = custom?.label || existing?.label || legacy?.label || toLabel(canonical);
    const category = custom?.category || existing?.category || categoryFor(canonical, group.aliases, modes);
    const inferred = custom?.value
        ? { value: custom.value, serialization: { emit: 'pair', preferredAlias: canonical } }
        : valueFor(group.rows[0].signature, group.aliases, canonical);
    const record = {
        id,
        label,
        category,
        modes,
        canonical,
        aliases: group.aliases.filter(alias => alias !== canonical),
        value: manual?.value || inferred.value,
        description: custom?.description || manual?.description || `${summaryFromUpstream(group.rows[0].explanation, label)} ${categoryFollowups[category]}`,
        serialization: manual?.serialization || inferred.serialization
    };
    if (record.value.type === 'choice') {
        record.value.options = record.value.options.map(option => typeof option === 'string'
            ? { value: option, label: option ? option[0].toUpperCase() + option.slice(1) : 'Unset' }
            : option);
    }
    if (featuredIds.has(id)) record.featured = true;
    const sourcePriority = new Map([
        ['--model', 1], ['--hf-repo', 2], ['--model-url', 3], ['--docker-repo', 4]
    ]).get(canonical);
    if (sourcePriority) record.sourcePriority = sourcePriority;
    if (canonical === '--port') record.validation = { integer: true, min: 1, max: 65535 };
    if (manual?.validation) record.validation = manual.validation;
    if (isSecret(canonical)) record.secret = true;
    if (group.rows.some(row => /DEPRECATED/i.test(row.explanation))) record.deprecated = true;
    if (group.rows.some(row => /experimental/i.test(row.explanation))) record.experimental = true;
    return record;
});

const output = {
    ...current,
    fields: current.fields,
    flags
};

fs.writeFileSync(path.join(root, 'flags.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${flags.length} current option groups to flags.json.`);
