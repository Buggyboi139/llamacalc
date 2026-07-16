(() => {
    const sourceIds = ['modelPath','hfRepo','modelUrl','dockerRepo'];
    const visibleStarterIds = ['modelPath','hfRepo'];
    const allStarterIds = [...new Set([...sourceIds,...visibleStarterIds])];

    const field = id => document.getElementById(id);
    const filled = id => {
        const el = field(id);
        return !!el && String(el.value || '').trim() !== '';
    };

    const groupFor = id => {
        const el = field(id);
        return el ? el.closest('.input-group') : null;
    };

    const addChip = id => {
        const el = field(id);
        if (!el) return;

        const label = document.querySelector(`label[for="${id}"]`);
        if (!label || label.querySelector('.required-chip')) return;

        const chip = document.createElement('span');
        chip.className = 'required-chip';
        chip.textContent = 'pick one';
        label.appendChild(chip);
    };

    const ensureNote = () => {
        let note = document.getElementById('starterNote');
        if (note) return note;

        const header = document.querySelector('.main-card .main-header');
        if (!header) return null;

        note = document.createElement('div');
        note.id = 'starterNote';
        note.className = 'starter-note';
        header.insertAdjacentElement('afterend', note);
        return note;
    };

    const updateStarterFields = () => {
        const hasSource = sourceIds.some(filled);
        const note = ensureNote();

        allStarterIds.forEach(id => {
            const group = groupFor(id);
            if (!group) return;

            group.classList.remove('starter-field--missing','starter-field--filled');

            if (filled(id)) {
                group.classList.add('starter-field--filled');
                return;
            }

            if (!hasSource && visibleStarterIds.includes(id)) {
                group.classList.add('starter-field--missing');
            }
        });

        if (note) {
            if (hasSource) {
                note.classList.add('starter-note--done');
                note.innerHTML = '<strong>Starter requirement met:</strong> a model source is selected. You can run a basic command now.';
            } else {
                note.classList.remove('starter-note--done');
                note.innerHTML = '<strong>Beginner start:</strong> choose one model source. Use Model path for a local GGUF, or Hugging Face repo for an HF model.';
            }
        }
    };

    const tooltips = {
        serverPath:'Sets the path to the llama-server executable.',
        cliPath:'Sets the path to the llama-cli executable.',
        modelPath:'Sets the path to a local GGUF model file.',
        hfRepo:'Loads a model from a Hugging Face repository.',
        hfFile:'Selects a specific file from a Hugging Face repository.',
        hfToken:'Provides a Hugging Face access token for private or gated repositories.',
        modelUrl:'Loads a model from a direct URL.',
        dockerRepo:'Sets a Docker-style model repository reference.',
        alias:'Sets the model alias exposed by server mode.',
        tags:'Adds metadata tags to the served model.',
        mmproj:'Sets the local multimodal projector path.',
        mmprojUrl:'Sets the multimodal projector URL.',
        mmprojAuto:'Controls automatic multimodal projector selection.',
        mmprojOffload:'Controls multimodal projector offload.',
        talkerModel:'Sets the talker model path for supported server features.',
        code2wavModel:'Sets the Code2WAV model path for supported audio workflows.',
        imageInput:'Supplies an image input file for supported multimodal models.',
        audioInput:'Supplies an audio input file for supported audio-capable models.',
        imageMinTokens:'Sets the minimum token allocation for image input.',
        imageMaxTokens:'Sets the maximum token allocation for image input.',
        ctxSize:'Sets the context size in tokens.',
        predict:'Sets the number of tokens to generate.',
        batchSize:'Sets the batch size for prompt processing.',
        ubatchSize:'Sets the micro-batch size for memory and processing tuning.',
        threads:'Sets the number of CPU threads.',
        threadsBatch:'Sets the number of CPU threads used for batch processing.',
        seed:'Sets the random seed for repeatable output.',
        keep:'Sets how many prompt tokens to preserve during context shifting.',
        prio:'Sets thread priority.',
        numa:'Sets NUMA behavior for supported systems.',
        cpuMask:'Restricts CPU execution to a specific CPU mask.',
        cpuRange:'Restricts CPU execution to a specific CPU range.',
        cpuStrict:'Controls strict CPU affinity behavior.',
        cpuMaskBatch:'Sets the CPU mask for batch processing.',
        cpuRangeBatch:'Sets the CPU range for batch processing.',
        cpuStrictBatch:'Controls strict CPU affinity for batch processing.',
        swaFull:'Enables full sliding window attention cache behavior.',
        noWarmup:'Disables model warmup before generation.',
        escapeMode:'Controls escape sequence processing.',
        perfMode:'Controls internal performance timing output.',
        spmInfill:'Enables SPM infill behavior for supported workflows.',
        poll:'Sets the polling level for latency and CPU scheduling.',
        prioBatch:'Sets batch thread priority.',
        pollBatch:'Sets polling behavior for batch processing.',
        ctxCheckpoints:'Sets the number of context checkpoints.',
        checkpointMinStep:'Sets the minimum step interval for checkpoints.',
        device:'Selects which devices to use.',
        listDevices:'Lists available devices and exits.',
        gpuLayers:'Sets the number of layers to offload to GPU.',
        splitMode:'Sets the GPU split mode.',
        tensorSplit:'Sets tensor split ratios across devices.',
        mainGpu:'Sets the main GPU for multi-device configurations.',
        flashAttn:'Controls flash attention when supported.',
        fit:'Controls model fit mode.',
        fitTarget:'Sets the fit target in MiB.',
        fitCtx:'Sets the minimum context size for fit mode.',
        kvOffload:'Controls KV cache offload.',
        repack:'Controls weight repacking.',
        noHost:'Disables host buffer use where supported.',
        opOffload:'Controls operation offload.',
        cpuMoe:'Keeps all MoE weights on CPU.',
        nCpuMoe:'Sets the number of MoE layers kept on CPU.',
        overrideTensor:'Overrides tensor placement.',
        overrideKv:'Overrides model metadata key/value settings.',
        checkTensors:'Checks tensors during model loading.',
        rpc:'Sets RPC backend servers.',
        fitPrint:'Controls fit mode print output.',
        cacheTypeK:'Sets the KV cache type for keys.',
        cacheTypeV:'Sets the KV cache type for values.',
        defragThold:'Sets the KV cache defragmentation threshold.',
        mlock:'Locks model memory in RAM.',
        mmap:'Controls memory-mapped model loading.',
        directIo:'Controls direct I/O for model file reads.',
        contextShift:'Controls context shifting when the context window fills.',
        promptCache:'Sets a prompt cache file.',
        promptCacheAll:'Enables caching of the full prompt.',
        promptCacheRo:'Opens the prompt cache in read-only mode.',
        cachePrompt:'Controls server prompt caching.',
        cacheReuse:'Sets the server cache reuse chunk size.',
        lookupCacheStatic:'Sets the static lookup cache path.',
        lookupCacheDynamic:'Sets the dynamic lookup cache path.',
        cacheRam:'Sets the cache RAM limit in MiB.',
        kvUnified:'Controls unified KV cache behavior.',
        cacheIdleSlots:'Controls caching for idle server slots.',
        slotSavePath:'Sets the path used to save server slot state.',
        ropeScaling:'Sets the RoPE scaling mode.',
        ropeScale:'Sets the RoPE scale value.',
        ropeFreqBase:'Sets the RoPE frequency base.',
        ropeFreqScale:'Sets the RoPE frequency scale.',
        yarnOrigCtx:'Sets the original context size for YaRN scaling.',
        yarnExtFactor:'Sets the YaRN extension factor.',
        yarnAttnFactor:'Sets the YaRN attention factor.',
        yarnBetaSlow:'Sets the YaRN slow beta value.',
        yarnBetaFast:'Sets the YaRN fast beta value.',
        grpAttnN:'Sets the group attention factor.',
        grpAttnW:'Sets the group attention width.',
        samplers:'Sets the sampler chain.',
        samplerSeq:'Sets the sampler sequence using compact identifiers.',
        ignoreEos:'Ignores end-of-sequence tokens.',
        temp:'Sets sampling temperature.',
        topK:'Limits sampling to the top K candidate tokens.',
        topP:'Enables nucleus sampling by cumulative probability.',
        minP:'Filters tokens below a minimum probability threshold.',
        topNSigma:'Applies sigma-based token filtering.',
        xtcProbability:'Sets the probability of applying XTC sampling.',
        xtcThreshold:'Sets the XTC threshold.',
        typicalP:'Sets typical sampling probability.',
        repeatLastN:'Sets how many previous tokens are checked for repetition.',
        repeatPenalty:'Sets the penalty for repeated tokens.',
        presencePenalty:'Penalizes tokens that have already appeared.',
        frequencyPenalty:'Penalizes tokens based on how often they appear.',
        dryMultiplier:'Sets DRY repetition penalty strength.',
        dryBase:'Sets the DRY base value.',
        dryAllowedLength:'Sets the allowed repeated sequence length before DRY applies.',
        dryPenaltyLastN:'Sets how much recent context DRY evaluates.',
        drySequenceBreaker:'Sets sequence breakers for DRY repetition detection.',
        adaptiveTarget:'Sets the adaptive sampling target.',
        adaptiveDecay:'Sets adaptive sampling decay.',
        dynatempRange:'Sets the dynamic temperature range.',
        dynatempExp:'Sets the dynamic temperature exponent.',
        mirostat:'Selects Mirostat sampling mode.',
        mirostatLr:'Sets the Mirostat learning rate.',
        mirostatEnt:'Sets the Mirostat target entropy.',
        logitBias:'Applies logit bias to specific token IDs.',
        grammar:'Provides an inline grammar.',
        grammarFile:'Loads grammar from a file.',
        jsonSchema:'Provides an inline JSON schema.',
        jsonSchemaFile:'Loads a JSON schema from a file.',
        backendSampling:'Enables backend sampling when supported.',
        prompt:'Sets the prompt text.',
        promptFile:'Loads prompt text from a file.',
        systemPrompt:'Sets the system prompt.',
        conversation:'Enables conversation mode.',
        singleTurn:'Enables single-turn mode.',
        interactive:'Enables interactive mode.',
        reversePrompt:'Sets a reverse prompt marker.',
        special:'Enables special token output.',
        jinja:'Controls Jinja chat template processing.',
        chatTemplate:'Selects a chat template.',
        chatTemplateFile:'Loads a chat template from a file.',
        chatTemplateKwargs:'Supplies additional chat template arguments.',
        skipChatParsing:'Controls server chat parsing.',
        prefillAssistant:'Controls assistant prefill behavior.',
        reasoning:'Sets reasoning mode.',
        reasoningFormat:'Sets the reasoning output format.',
        reasoningBudget:'Sets the reasoning token budget.',
        reasoningBudgetMessage:'Sets the reasoning budget message.',
        systemPromptFile:'Loads the system prompt from a file.',
        binaryFile:'Supplies a binary input file.',
        printTokenCount:'Prints token count information.',
        interactiveFirst:'Starts interactive input before generation.',
        multilineInput:'Enables multiline terminal input.',
        inPrefixBos:'Applies beginning-of-sequence behavior to the input prefix.',
        inPrefix:'Adds a prefix to interactive input.',
        inSuffix:'Adds a suffix to interactive input.',
        host:'Sets the server bind address.',
        port:'Sets the server port.',
        apiKey:'Sets the API key.',
        apiKeyFile:'Loads the API key from a file.',
        apiPrefix:'Sets the API route prefix.',
        timeout:'Sets the request timeout in seconds.',
        threadsHttp:'Sets the number of HTTP server threads.',
        parallel:'Sets the number of parallel slots.',
        contBatching:'Controls continuous batching.',
        ui:'Controls the built-in web UI.',
        uiConfig:'Provides inline UI configuration JSON.',
        uiConfigFile:'Loads UI configuration from a file.',
        embedding:'Enables embedding endpoint behavior.',
        rerank:'Enables reranking endpoint behavior.',
        pooling:'Sets embedding pooling mode.',
        metrics:'Enables the metrics endpoint.',
        props:'Enables the properties endpoint.',
        slots:'Controls the slots endpoint.',
        sslKeyFile:'Sets the SSL private key file.',
        sslCertFile:'Sets the SSL certificate file.',
        mediaPath:'Sets the media file path.',
        modelsDir:'Sets the router models directory.',
        modelsPreset:'Sets the router models preset.',
        modelsMax:'Sets the maximum number of router models.',
        modelsAutoload:'Controls automatic model loading.',
        tools:'Enables built-in tools by name.',
        sleepIdleSeconds:'Sets the idle sleep delay in seconds.',
        reusePort:'Enables port reuse.',
        staticPath:'Sets the static file path.',
        embdNormalize:'Sets embedding normalization behavior.',
        dflashModel:'Sets a DFlash draft model and automatically enables draft-dflash speculative decoding.',
        specType:'Sets the speculative decoding type.',
        specDefault:'Enables default speculative decoding settings.',
        specDraftModel:'Sets the draft model path.',
        specDraftHf:'Sets the draft model Hugging Face repository.',
        specDraftDevice:'Sets the draft model device list.',
        specDraftGpuLayers:'Sets draft model GPU layers.',
        specDraftThreads:'Sets draft model thread count.',
        specDraftThreadsBatch:'Sets draft model batch thread count.',
        specDraftCpuMoe:'Keeps draft MoE weights on CPU.',
        specDraftNCpuMoe:'Sets the number of draft MoE layers kept on CPU.',
        specDraftNMax:'Sets the maximum number of draft tokens.',
        specDraftNMin:'Sets the minimum number of draft tokens.',
        specDraftPSplit:'Sets draft split probability.',
        specDraftPMin:'Sets minimum draft probability.',
        specDraftBackendSampling:'Controls backend sampling for draft speculation.',
        specNgramModNMin:'Sets the minimum ngram modifier size.',
        specNgramModNMax:'Sets the maximum ngram modifier size.',
        specNgramModNMatch:'Sets the ngram modifier match count.',
        specNgramSimpleSizeN:'Sets simple ngram size N.',
        specNgramSimpleSizeM:'Sets simple ngram size M.',
        specNgramSimpleMinHits:'Sets minimum hits for simple ngram speculation.',
        mtpRawFlags:'Adds raw speculative or MTP flags exactly as entered.',
        specDraftCpuMask:'Sets the CPU mask for the draft model.',
        specDraftCpuRange:'Sets the CPU range for the draft model.',
        specDraftCpuStrict:'Controls strict CPU affinity for the draft model.',
        specDraftPrio:'Sets draft model thread priority.',
        specDraftPoll:'Sets draft model polling behavior.',
        specDraftCpuMaskBatch:'Sets the CPU mask for draft batch processing.',
        specDraftCpuRangeBatch:'Sets the CPU range for draft batch processing.',
        specDraftCpuStrictBatch:'Controls strict CPU affinity for draft batch processing.',
        specDraftPrioBatch:'Sets draft batch thread priority.',
        specDraftPollBatch:'Sets draft batch polling behavior.',
        specDraftTypeK:'Sets draft model key cache type.',
        specDraftTypeV:'Sets draft model value cache type.',
        specDraftOverrideTensor:'Overrides draft tensor placement.',
        specNgramMapKSizeN:'Sets map-k ngram size N.',
        specNgramMapKSizeM:'Sets map-k ngram size M.',
        specNgramMapKMinHits:'Sets minimum hits for map-k ngram speculation.',
        specNgramMapK4vSizeN:'Sets map-k4v ngram size N.',
        specNgramMapK4vSizeM:'Sets map-k4v ngram size M.',
        specNgramMapK4vMinHits:'Sets minimum hits for map-k4v ngram speculation.',
        lora:'Loads one or more LoRA adapters.',
        loraScaled:'Loads a LoRA adapter with a scale value.',
        loraInitWithoutApply:'Initializes LoRA without applying it immediately.',
        controlVector:'Loads a control vector.',
        controlVectorScaled:'Loads a control vector with a scale value.',
        controlVectorLayerRange:'Sets the layer range for control vector application.',
        verbose:'Enables verbose output.',
        logDisable:'Disables logging.',
        logFile:'Sets the log file path.',
        noDisplayPrompt:'Hides the prompt in output.',
        showTimings:'Controls timing information output.',
        completionBash:'Prints Bash completion output and exits.',
        version:'Prints version information and exits.',
        extraFlags:'Adds raw extra llama.cpp flags exactly as entered.',
        cacheList:'Lists available cache options and exits.',
        verbosePrompt:'Prints detailed prompt information.',
        color:'Enables colored terminal output.',
        displayPrompt:'Controls whether the prompt is displayed in output.',
        timingPaste:'Accepts llama.cpp timing output or server timing JSON for parsing.',
        logName:'Sets a readable name for the benchmark entry.',
        logBuild:'Records the llama.cpp build, commit, tag, or build notes.',
        logPromptTps:'Records prompt processing speed in tokens per second.',
        logGenTps:'Records generation speed in tokens per second.',
        logPromptTokens:'Records the number of prompt tokens processed.',
        logGenTokens:'Records the number of generated tokens.',
        logTotalMs:'Records total runtime in milliseconds.',
        logNotes:'Stores additional notes for the benchmark entry.',
        multilineCheck:'Controls whether the generated command is displayed across multiple lines.',
        resetBuilderBtn:'Clears saved builder settings and reloads the page. Benchmark logs are not removed.',
        clearLogsBtn:'Deletes all saved benchmark log entries from browser storage.',
        copyCommandBtn:'Copies the generated command to the clipboard.',
        copyMarkdownBtn:'Copies benchmark logs as a Markdown table.',
        copyCsvBtn:'Copies benchmark logs as CSV data.',
        parseTimingBtn:'Parses pasted timing output and fills matching benchmark fields.',
        logRunBtn:'Saves the current command and benchmark details as a new log entry.'
    };

    const sectionTooltips = {
        'Core model source':'Select the model source and related model loading options.',
        'Runtime and context':'Configure context length, token limits, CPU threading, affinity, and runtime behavior.',
        'GPU, devices, and offload':'Configure GPU selection, layer offload, split behavior, and backend placement options.',
        'Memory, cache, and shifting':'Configure KV cache type, prompt caching, memory mapping, context shifting, and server slot cache behavior.',
        'RoPE, YaRN, and long context':'Configure long-context scaling, RoPE settings, YaRN parameters, and grouped attention options.',
        'Sampling and constraints':'Configure sampling methods, penalties, grammar constraints, JSON schema constraints, and generation controls.',
        'Prompt, chat, and reasoning':'Configure prompts, chat templates, interactive CLI behavior, and reasoning-related options.',
        'Server-only API controls':'Configure HTTP server behavior, endpoints, API access, web UI settings, router options, and server features.',
        'Speculative decoding, MTP, and ngram draft':'Configure speculative decoding, draft models, MTP options, and ngram speculation settings.',
        'Adapters and control vectors':'Configure LoRA adapters, scaled adapters, control vectors, and layer ranges.',
        'Output, logging, and raw passthrough':'Configure logging, output behavior, version helpers, shell completion, and raw extra flags.'
    };

    const setTipText = (el, text) => {
        if (!el || !text) return;
        el.dataset.tooltip = text;
        el.setAttribute('aria-label', text);
    };

    const ensureTip = (label, text) => {
        if (!label || !text) return;
        let tip = label.querySelector('.tip');
        if (!tip) {
            tip = document.createElement('span');
            tip.className = 'tip';
            tip.tabIndex = 0;
            tip.textContent = '?';
            label.appendChild(tip);
        }
        setTipText(tip, text);
    };

    const bindTooltipNode = el => {
        if (!el || el.dataset.tooltipBound === 'true') return;
        el.dataset.tooltipBound = 'true';
        const tooltip = document.getElementById('tooltip');
        if (!tooltip) return;

        const hide = () => {
            tooltip.classList.remove('visible');
            tooltip.textContent = '';
        };

        const show = () => {
            const text = el.dataset.tooltip || el.getAttribute('aria-label');
            if (!text) return;
            tooltip.textContent = text;
            tooltip.classList.add('visible');
            const margin = 12;
            const trigger = el.getBoundingClientRect();
            const box = tooltip.getBoundingClientRect();
            let left = trigger.left + trigger.width / 2 - box.width / 2;
            left = Math.max(margin, Math.min(left, window.innerWidth - box.width - margin));
            let top = trigger.top - box.height - 10;
            if (top < margin) top = trigger.bottom + 10;
            if (top + box.height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - box.height - margin);
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        };

        el.addEventListener('mouseenter', show);
        el.addEventListener('mouseleave', hide);
        el.addEventListener('focus', show);
        el.addEventListener('blur', hide);
        el.addEventListener('touchstart', event => {
            event.stopPropagation();
            show();
        }, {passive:true});
    };

    const applyTooltipText = () => {
        Object.entries(tooltips).forEach(([id, text]) => {
            ensureTip(document.querySelector(`label[for="${id}"]`), text);
            const el = document.getElementById(id);
            if (el && el.matches('button')) setTipText(el, text);
        });

        const multilineLabel = document.getElementById('multilineCheck')?.closest('label');
        setTipText(multilineLabel, tooltips.multilineCheck);

        setTipText(document.querySelector('.command-card .tooltip-heading'), 'Displays the command generated from the selected mode, model source, and configured options.');
        setTipText(document.querySelector('.main-card .tooltip-heading'), 'Shows the most commonly used options for a basic llama.cpp server or CLI run.');
        setTipText(document.querySelector('.advanced-panel > summary'), 'Opens the full set of advanced llama.cpp options available in this builder.');
        setTipText(document.querySelector('.log-card .tooltip-heading'), 'Stores benchmark results and command details for later comparison.');

        document.querySelectorAll('.mode-option').forEach(option => {
            const input = option.querySelector('input');
            setTipText(option, input?.value === 'server' ? 'Runs llama.cpp as an HTTP/API server for API access, web UI access, parallel requests, metrics, and long-running model serving.' : 'Runs llama.cpp from the terminal for direct prompts, interactive sessions, scripted runs, and local testing.');
        });

        document.querySelectorAll('.flag-section summary').forEach(summary => {
            const title = summary.textContent.trim();
            setTipText(summary, sectionTooltips[title]);
        });

        document.querySelectorAll('[data-tooltip], .tip[aria-label]').forEach(bindTooltipNode);
    };

    const bindStarterFields = () => {
        allStarterIds.forEach(id => {
            addChip(id);

            const el = field(id);
            if (!el) return;

            el.addEventListener('input', updateStarterFields);
            el.addEventListener('change', updateStarterFields);
        });

        document.querySelectorAll('input[name="mode"]').forEach(el => {
            el.addEventListener('change', updateStarterFields);
        });

        updateStarterFields();
        applyTooltipText();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindStarterFields);
    } else {
        bindStarterFields();
    }
})();
