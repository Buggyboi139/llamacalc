(function (root, factory) {
    const presets = typeof module === 'object' && module.exports
        ? require('./presets.js')
        : root.LlamaCalcPresets;
    const api = factory(presets);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.LlamaCalcRender = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (presets) {
    function filled(value) {
        return value !== undefined
            && value !== null
            && (typeof value === 'boolean' ? value : String(value).trim() !== '');
    }

    function countConfigured(flags, values) {
        return flags.reduce((count, flag) => count + (filled(values[flag.id]) ? 1 : 0), 0);
    }

    function fieldsForCategory(registry, mode, activeCategory) {
        const fields = (registry.fields || []).filter(field => field.modes.includes(mode));
        if (activeCategory === 'essentials') {
            return fields.filter(field => field.featured || (!field.category && field.id !== 'extraFlags'));
        }
        if (activeCategory === 'advanced') {
            return fields.filter(field => field.id === 'extraFlags' || field.category === 'advanced');
        }
        return fields.filter(field => field.category === activeCategory);
    }

    function itemsForCategory(registry, state) {
        if (state.activeCategory === 'essentials') {
            return presets.fieldsForPreset(registry, state.activePreset, state.mode);
        }
        return [
            ...fieldsForCategory(registry, state.mode, state.activeCategory),
            ...registry.forCategory(state.activeCategory, state.mode)
        ];
    }

    function presetGroups(registry, mode) {
        const groups = new Map();
        for (const preset of presets.presetsForMode(registry, mode)) {
            if (!groups.has(preset.group)) groups.set(preset.group, []);
            groups.get(preset.group).push(preset);
        }
        return [...groups].map(([label, items]) => ({ label, items }));
    }

    function scrollToFlagWorkspace(document) {
        document.getElementById('flagWorkspace')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    function captureFieldFocus(document) {
        const active = document.activeElement;
        const fieldId = active?.dataset?.flagId;
        if (!fieldId) return null;
        let selectionStart = null;
        let selectionEnd = null;
        let selectionDirection = 'none';
        try {
            selectionStart = active.selectionStart;
            selectionEnd = active.selectionEnd;
            selectionDirection = active.selectionDirection || 'none';
        } catch {
            // Numeric and other non-text controls do not expose a selection range.
        }
        return { fieldId, selectionStart, selectionEnd, selectionDirection };
    }

    function restoreFieldFocus(document, snapshot) {
        if (!snapshot) return;
        const control = document.getElementById(`field-${snapshot.fieldId}`);
        if (!control) return;
        control.focus({ preventScroll: true });
        if (snapshot.selectionStart === null || snapshot.selectionEnd === null) return;
        try {
            control.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd, snapshot.selectionDirection);
        } catch {
            // Focus is still restored for controls that reject text selection APIs.
        }
    }

    function element(document, tagName, className, text) {
        const node = document.createElement(tagName);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function createInput(document, flag, value) {
        const type = flag.value.type;
        let control;

        if (type === 'textarea') {
            control = document.createElement('textarea');
            control.rows = 3;
        } else if (type === 'choice') {
            control = document.createElement('select');
            for (const optionDefinition of flag.value.options || []) {
                const option = document.createElement('option');
                const normalized = typeof optionDefinition === 'object'
                    ? optionDefinition
                    : { value: optionDefinition, label: optionDefinition || 'Unset' };
                option.value = normalized.value;
                option.textContent = normalized.label;
                control.appendChild(option);
            }
        } else {
            control = document.createElement('input');
            if (type === 'boolean' || type === 'action') control.type = 'checkbox';
            else if (type === 'integer' || type === 'number') control.type = 'number';
            else control.type = 'text';
        }

        control.id = `field-${flag.id}`;
        control.dataset.flagId = flag.id;
        control.className = 'flag-control';
        control.setAttribute('aria-describedby', `description-${flag.id}`);
        if (flag.essentialRequired) control.setAttribute('aria-required', 'true');
        if (flag.secret) {
            control.autocomplete = 'off';
            control.spellcheck = false;
        }
        if (flag.value.placeholder && 'placeholder' in control) control.placeholder = flag.value.placeholder;
        if (type === 'integer') control.step = '1';
        if (type === 'number') control.step = 'any';
        if (flag.validation?.min !== undefined) control.min = String(flag.validation.min);
        if (flag.validation?.max !== undefined) control.max = String(flag.validation.max);
        if (type === 'boolean' || type === 'action') control.checked = Boolean(value);
        else control.value = value ?? '';
        return control;
    }

    function createFlagCard(document, flag, value, error, callbacks = {}) {
        const card = element(document, 'article', 'flag-card');
        card.dataset.flagId = flag.id;
        if (flag.essentialRole) card.className += ` is-essential-${flag.essentialRole}`;
        if (filled(value)) card.className += ' is-configured';
        if (error) card.className += ' has-error';

        const heading = element(document, 'div', 'flag-card-heading');
        const identity = element(document, 'div', 'flag-identity');
        const label = element(document, 'label', 'flag-label', flag.label);
        label.htmlFor = `field-${flag.id}`;
        const aliases = element(document, 'code', 'flag-aliases', [flag.canonical, ...(flag.aliases || [])].filter(Boolean).join(' · '));
        identity.append(label, aliases);

        if (flag.essentialRequired && flag.essentialRole) {
            const role = flag.essentialRole === 'draft' ? 'Draft' : 'Target';
            const badge = element(document, 'span', `status-badge status-essential status-${flag.essentialRole}`, `Required · ${role}`);
            badge.setAttribute('aria-label', `Required ${role.toLowerCase()} model field`);
            identity.appendChild(badge);
        }

        const help = element(document, 'button', 'help-trigger', '?');
        help.type = 'button';
        help.setAttribute('aria-label', `About ${flag.label}`);
        help.setAttribute('aria-describedby', `description-${flag.id}`);
        help.dataset.descriptionId = `description-${flag.id}`;
        if (callbacks.onHelpShow) {
            help.addEventListener('mouseenter', event => callbacks.onHelpShow(flag, event.currentTarget));
            help.addEventListener('focus', event => callbacks.onHelpShow(flag, event.currentTarget));
        }
        if (callbacks.onHelpHide) {
            help.addEventListener('mouseleave', callbacks.onHelpHide);
            help.addEventListener('blur', callbacks.onHelpHide);
        }
        heading.append(identity, help);

        const control = createInput(document, flag, value);
        const eventName = ['boolean', 'action', 'choice'].includes(flag.value.type) ? 'change' : 'input';
        if (callbacks.onFieldChange) {
            control.addEventListener(eventName, event => {
                const nextValue = ['boolean', 'action'].includes(flag.value.type)
                    ? event.currentTarget.checked
                    : event.currentTarget.value;
                callbacks.onFieldChange(flag.id, nextValue);
            });
        }

        const controlWrap = element(document, 'div', `flag-input flag-input-${flag.value.type}`);
        controlWrap.appendChild(control);
        if (['boolean', 'action'].includes(flag.value.type)) {
            controlWrap.appendChild(element(document, 'span', 'boolean-state', value ? 'Enabled' : 'Disabled'));
        }

        const description = element(document, 'p', 'visually-hidden flag-description', flag.description);
        description.id = `description-${flag.id}`;

        if (flag.deprecated) {
            const badge = element(document, 'span', 'status-badge status-warning', 'Deprecated');
            badge.setAttribute('aria-label', 'Deprecated but still accepted by current llama.cpp');
            identity.appendChild(badge);
        }

        card.append(heading, controlWrap, description);
        if (error) {
            const errorNode = element(document, 'p', 'field-error', error);
            errorNode.id = `error-${flag.id}`;
            errorNode.setAttribute('role', 'alert');
            control.setAttribute('aria-invalid', 'true');
            control.setAttribute('aria-describedby', `description-${flag.id} error-${flag.id}`);
            card.appendChild(errorNode);
        }
        return card;
    }

    function renderFlagCards(document, container, items, values, errorsById, callbacks) {
        const focusSnapshot = captureFieldFocus(document);
        const cards = [];
        let activeSection = '';
        for (const item of items) {
            const flag = item.flag || item;
            if (flag.essentialSection && flag.essentialSection !== activeSection) {
                const heading = element(document, 'h2', 'essential-section-heading', flag.essentialSection);
                cards.push(heading);
                activeSection = flag.essentialSection;
            } else if (!flag.essentialSection) {
                activeSection = '';
            }
            cards.push(createFlagCard(document, flag, values[flag.id], errorsById.get(flag.id) || '', callbacks));
        }
        container.replaceChildren(...cards);
        restoreFieldFocus(document, focusSnapshot);
        return cards;
    }

    function createRenderer(document, callbacks = {}) {
        const nodes = Object.fromEntries([
            'categoryNav', 'configuredTotal', 'flagList', 'emptyResults', 'resultCount',
            'workspaceEyebrow', 'workspaceHeading', 'workspaceSummary', 'commandOutput',
            'warningList', 'commandPlatformLabel', 'commandPanel', 'logTable', 'liveRegion', 'tooltip',
            'windowsShellSelector', 'presetSelector', 'presetDescription', 'presetApplies'
        ].map(id => [id, document.getElementById(id)]));

        let tooltipTrigger = null;
        let tooltipTimer = null;

        function showHelp(flag, trigger) {
            if (!nodes.tooltip) return;
            tooltipTrigger = trigger;
            clearTimeout(tooltipTimer);
            nodes.tooltip.textContent = flag.description;
            nodes.tooltip.hidden = false;
            requestAnimationFrame(() => nodes.tooltip.classList.add('is-visible'));
            if (typeof trigger.getBoundingClientRect !== 'function') return;
            const bounds = trigger.getBoundingClientRect();
            const tooltipBounds = nodes.tooltip.getBoundingClientRect();
            const margin = 12;
            let left = bounds.left + bounds.width / 2 - tooltipBounds.width / 2;
            left = Math.max(margin, Math.min(left, window.innerWidth - tooltipBounds.width - margin));
            let top = bounds.top - tooltipBounds.height - 10;
            if (top < margin) top = bounds.bottom + 10;
            nodes.tooltip.style.left = `${left}px`;
            nodes.tooltip.style.top = `${top}px`;
        }

        function hideHelp() {
            if (!nodes.tooltip) return;
            tooltipTrigger = null;
            nodes.tooltip.classList.remove('is-visible');
            clearTimeout(tooltipTimer);
            tooltipTimer = setTimeout(() => {
                if (tooltipTrigger) return;
                nodes.tooltip.hidden = true;
                nodes.tooltip.textContent = '';
            }, 180);
        }

        function fieldCallbacks() {
            return {
                onFieldChange: callbacks.onFieldChange,
                onHelpShow: showHelp,
                onHelpHide: hideHelp
            };
        }

        function renderNavigation(registry, state) {
            const modeFlags = registry.forMode(state.mode);
            const categories = [{
                id: 'essentials',
                label: 'Essentials',
                items: presets.fieldsForPreset(registry, state.activePreset, state.mode)
            }]
                .concat(registry.categories.map(category => ({
                    ...category,
                    items: [
                        ...fieldsForCategory(registry, state.mode, category.id),
                        ...modeFlags.filter(flag => flag.category === category.id)
                    ]
                })));
            const buttons = categories.map(category => {
                const button = element(document, 'button', 'category-button');
                button.type = 'button';
                button.dataset.categoryId = category.id;
                if (category.id === state.activeCategory) {
                    button.className += ' is-active';
                    button.setAttribute('aria-current', 'page');
                }
                if (!category.items.length && category.id !== 'essentials') button.disabled = true;
                const name = element(document, 'span', 'category-name', category.label);
                const count = countConfigured(category.items, state.values);
                const countNode = element(document, 'span', 'category-count', String(count));
                countNode.setAttribute('aria-label', `${count} configured`);
                button.append(name, countNode);
                if (callbacks.onCategoryChange) {
                    button.addEventListener('click', () => callbacks.onCategoryChange(category.id));
                }
                return button;
            });
            nodes.categoryNav.replaceChildren(...buttons);
            const configured = countConfigured(modeFlags, state.values)
                + countConfigured(registry.fields.filter(field => field.modes.includes(state.mode)), state.values);
            nodes.configuredTotal.textContent = `${configured} configured`;
        }

        function renderFlags(registry, state, validation, searchQuery, searchResults) {
            const searching = Boolean(String(searchQuery || '').trim());
            const items = searching ? searchResults : itemsForCategory(registry, state);
            renderFlagCards(document, nodes.flagList, items, state.values, validation.errorsById, fieldCallbacks());

            const category = registry.categories.find(item => item.id === state.activeCategory);
            const activePreset = presets.presetById(registry, state.activePreset);
            nodes.workspaceEyebrow.textContent = searching
                ? 'Global search'
                : state.activeCategory === 'essentials'
                    ? `${activePreset.label} preset`
                    : category.label;
            nodes.workspaceHeading.textContent = searching
                ? `Results for “${searchQuery}”`
                : state.activeCategory === 'essentials'
                    ? 'Start here'
                    : 'Configure your command';
            nodes.workspaceSummary.textContent = searching
                ? 'Matches include flag names, aliases, labels, categories, and descriptions.'
                : state.activeCategory === 'essentials'
                    ? activePreset.description
                    : `Current ${state.mode === 'server' ? 'llama-server' : 'llama-cli'} options in this group.`;
            const showPresetApplies = !searching && state.activeCategory === 'essentials';
            nodes.presetApplies.hidden = !showPresetApplies;
            nodes.presetApplies.textContent = showPresetApplies
                ? activePreset.appliedArguments.length
                    ? `Preset applies: ${activePreset.appliedArguments.join(' · ')}`
                    : 'Preset applies: no fixed arguments'
                : '';
            nodes.resultCount.textContent = `${items.length} ${items.length === 1 ? 'option' : 'options'}`;
            nodes.emptyResults.hidden = items.length !== 0;
        }

        function renderSearchResults(registry, state, validation, query, results) {
            renderFlags(registry, state, validation, query, results);
        }

        function renderCommand(command, state) {
            nodes.commandOutput.textContent = command;
            const labels = {
                linux: 'Linux · Bash/Zsh',
                macos: 'macOS · Bash/Zsh',
                windows: state.windowsShell === 'cmd' ? 'Windows · Command Prompt' : 'Windows · PowerShell'
            };
            nodes.commandPlatformLabel.textContent = labels[state.platform];
            nodes.commandOutput.dataset.platform = state.platform;
            nodes.commandOutput.dataset.shell = state.platform === 'windows' ? state.windowsShell : 'posix';
            nodes.commandPanel.dataset.platform = state.platform;
            nodes.commandPanel.dataset.shell = state.platform === 'windows' ? state.windowsShell : 'posix';
        }

        function renderWarnings(warnings) {
            const items = warnings.map(item => {
                const button = element(document, 'button', `warning-item warning-${item.severity || 'warning'}`, item.message);
                button.type = 'button';
                button.dataset.severity = item.severity || 'warning';
                if (item.fieldId && callbacks.onWarningFocus) {
                    button.addEventListener('click', () => callbacks.onWarningFocus(item.fieldId));
                } else {
                    button.disabled = true;
                }
                return button;
            });
            nodes.warningList.replaceChildren(...items);
            nodes.warningList.hidden = !items.length;
        }

        function renderLogs(logs) {
            if (!logs.length) {
                const row = document.createElement('tr');
                const cell = element(document, 'td', 'empty-table-cell', 'No benchmark logs yet.');
                cell.colSpan = 8;
                row.appendChild(cell);
                nodes.logTable.replaceChildren(row);
                return;
            }

            const rows = logs.map(log => {
                const row = document.createElement('tr');
                const date = element(document, 'td', '', new Date(log.timestamp).toLocaleString());
                date.dataset.label = 'Date';
                const run = document.createElement('td');
                run.dataset.label = 'Run';
                run.append(element(document, 'strong', '', log.name), element(document, 'small', 'table-model', log.model));
                const values = [
                    ['Tool', log.mode],
                    ['Prompt t/s', log.promptTps],
                    ['Gen t/s', log.genTps],
                    ['Tokens', [log.promptTokens, log.genTokens].filter(Boolean).join(' / ')],
                    ['Build', log.build]
                ].map(([label, value]) => {
                    const cell = element(document, 'td', '', value);
                    cell.dataset.label = label;
                    return cell;
                });
                const actions = document.createElement('td');
                actions.dataset.label = 'Actions';
                const copy = element(document, 'button', 'table-action', 'Copy command');
                copy.type = 'button';
                copy.addEventListener('click', () => callbacks.onCopyLog?.(log));
                const remove = element(document, 'button', 'table-action table-action-danger', 'Delete');
                remove.type = 'button';
                remove.addEventListener('click', () => callbacks.onDeleteLog?.(log.id));
                actions.append(copy, remove);
                row.append(date, run, ...values, actions);
                return row;
            });
            nodes.logTable.replaceChildren(...rows);
        }

        function renderTargetControls(state) {
            for (const input of document.querySelectorAll('input[name="mode"]')) input.checked = input.value === state.mode;
            for (const input of document.querySelectorAll('input[name="platform"]')) input.checked = input.value === state.platform;
            for (const input of document.querySelectorAll('input[name="windowsShell"]')) input.checked = input.value === state.windowsShell;
            const windows = state.platform === 'windows';
            nodes.windowsShellSelector.hidden = !windows;
            nodes.windowsShellSelector.disabled = !windows;
            for (const input of nodes.windowsShellSelector.querySelectorAll('input')) input.disabled = !windows;
            document.getElementById('multilineCheck').checked = state.multiline;
        }

        function renderPresetControl(registry, state) {
            if (nodes.presetSelector.dataset.mode !== state.mode) {
                const groups = presetGroups(registry, state.mode).map(group => {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = group.label;
                    for (const preset of group.items) {
                        const option = document.createElement('option');
                        option.value = preset.id;
                        option.textContent = preset.label;
                        optgroup.appendChild(option);
                    }
                    return optgroup;
                });
                nodes.presetSelector.replaceChildren(...groups);
                nodes.presetSelector.dataset.mode = state.mode;
            }
            nodes.presetSelector.value = state.activePreset;
            const activePreset = presets.presetById(registry, state.activePreset);
            nodes.presetDescription.textContent = `${activePreset.description} Selecting a preset clears alternative model sources and replaces only recipe-specific values.`;
            nodes.presetSelector.title = activePreset.description;
        }

        function announce(message) {
            nodes.liveRegion.textContent = '';
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => { nodes.liveRegion.textContent = message; });
            } else {
                nodes.liveRegion.textContent = message;
            }
        }

        function render(view) {
            renderTargetControls(view.state);
            renderPresetControl(view.registry, view.state);
            renderNavigation(view.registry, view.state);
            renderFlags(view.registry, view.state, view.validation, view.searchQuery, view.searchResults || []);
            renderCommand(view.command, view.state);
            renderWarnings(view.model.warnings || []);
            renderLogs(view.logs || []);
        }

        document.addEventListener('pointerdown', event => {
            if (tooltipTrigger && !tooltipTrigger.contains(event.target)) hideHelp();
        });

        return {
            render,
            renderNavigation,
            renderFlags,
            renderSearchResults,
            renderCommand,
            renderWarnings,
            renderLogs,
            announce
        };
    }

    return {
        filled,
        countConfigured,
        fieldsForCategory,
        itemsForCategory,
        presetGroups,
        scrollToFlagWorkspace,
        captureFieldFocus,
        restoreFieldFocus,
        createFlagCard,
        renderFlagCards,
        createRenderer
    };
});
