const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function readIndex() {
    return fs.readFileSync(path.join(root, 'index.html'), 'utf8');
}

function readStyles() {
    return fs.readFileSync(path.join(root, 'style.css'), 'utf8');
}

test('shell has exactly one global flag search', () => {
    const html = readIndex();
    assert.equal((html.match(/type="search"/g) || []).length, 1);
    assert.match(html, /id="flagSearch"/);
    assert.match(html, /aria-controls="flagWorkspace"/);
});

test('shell declares a local static favicon', () => {
    const html = readIndex();
    assert.match(html, /rel="icon"[^>]*href="assets\/favicon\.svg"/);
    assert.equal(fs.existsSync(path.join(root, 'assets/favicon.svg')), true);
});

test('mode and operating system are peer radio groups', () => {
    const html = readIndex();
    assert.match(html, /<fieldset[^>]*id="modeSelector"/);
    assert.match(html, /<fieldset[^>]*id="platformSelector"/);
    for (const value of ['server', 'cli', 'linux', 'macos', 'windows']) {
        assert.match(html, new RegExp(`value="${value}"`));
    }
});

test('preset selector is a distinct labeled control between tool and operating system', () => {
    const html = readIndex();
    const modeIndex = html.indexOf('id="modeSelector"');
    const presetIndex = html.indexOf('id="presetSelector"');
    const platformIndex = html.indexOf('id="platformSelector"');

    assert.match(html, /<label[^>]*for="presetSelector"[^>]*>Preset<\/label>/);
    assert.match(html, /<select[^>]*id="presetSelector"[^>]*aria-describedby="presetDescription"/);
    assert.ok(modeIndex < presetIndex && presetIndex < platformIndex);
    assert.ok(html.indexOf('lib/presets.js') < html.indexOf('lib/render.js'));
});

test('shell contains workbench and preserved benchmark landmarks', () => {
    const html = readIndex();
    for (const id of ['categoryNav', 'flagWorkspace', 'presetApplies', 'commandOutput', 'warningList', 'benchmarkLog', 'logTable']) {
        assert.match(html, new RegExp(`id="${id}"`));
    }
});

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.attributes = {};
        this.dataset = {};
        this.className = '';
        this.id = '';
        this.textContent = '';
        this.value = '';
        this.checked = false;
        this.type = '';
        this.listeners = {};
    }

    set innerHTML(_) {
        throw new Error('Renderer must not assign metadata with innerHTML');
    }

    append(...children) {
        this.children.push(...children);
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    replaceChildren(...children) {
        this.children = [...children];
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    getAttribute(name) {
        return this.attributes[name];
    }

    addEventListener(name, callback) {
        this.listeners[name] = callback;
    }

    focus() {
        this.focused = true;
    }

    setSelectionRange(start, end, direction) {
        this.selectionStart = start;
        this.selectionEnd = end;
        this.selectionDirection = direction;
    }
}

const fakeDocument = {
    createElement(tagName) {
        return new FakeElement(tagName);
    }
};

function descendants(element) {
    return element.children.flatMap(child => [child, ...descendants(child)]);
}

test('renderer configured counts include only meaningful values', () => {
    const { countConfigured } = require('../lib/render');
    const flags = ['empty', 'spaces', 'disabled', 'enabled', 'zero'].map(id => ({ id }));
    const values = { empty: '', spaces: '   ', disabled: false, enabled: true, zero: '0' };
    assert.equal(countConfigured(flags, values), 2);
});

test('renderer uses textContent and persistent described-by help', () => {
    const { createFlagCard } = require('../lib/render');
    const flag = {
        id: 'ctxSize',
        label: '<script>Context size</script>',
        canonical: '--ctx-size',
        aliases: ['-c'],
        value: { type: 'integer' },
        description: 'Sets the context size. Higher values require more memory.'
    };
    const card = createFlagCard(fakeDocument, flag, '4096', '', {});
    const all = [card, ...descendants(card)];
    const help = all.find(element => element.attributes['aria-describedby']);
    const description = all.find(element => element.id === 'description-ctxSize');

    assert.equal(card.dataset.flagId, 'ctxSize');
    assert.equal(help.attributes['aria-describedby'], 'description-ctxSize');
    assert.equal(description.textContent, flag.description);
    assert.ok(all.some(element => element.textContent === flag.label));
});

test('renderer highlights required target and draft fields only when preset metadata requests it', () => {
    const { createFlagCard } = require('../lib/render');
    const base = {
        id: 'modelPath',
        label: 'Target model path',
        canonical: '--model',
        aliases: ['-m'],
        value: { type: 'string' },
        description: 'Selects a model. Use a local GGUF path.'
    };
    const target = createFlagCard(fakeDocument, {
        ...base,
        essentialRole: 'target',
        essentialRequired: true
    }, '', '', {});
    const ordinary = createFlagCard(fakeDocument, base, '', '', {});

    assert.match(target.className, /is-essential-target/);
    assert.ok(descendants(target).some(element => element.textContent === 'Required · Target'));
    assert.equal(descendants(target).find(element => element.dataset.flagId === 'modelPath').attributes['aria-required'], 'true');
    assert.doesNotMatch(ordinary.className, /is-essential/);
    assert.equal(descendants(ordinary).some(element => element.textContent.startsWith('Required')), false);
});

test('renderer inserts preset-only setup section labels', () => {
    const { renderFlagCards } = require('../lib/render');
    const container = new FakeElement('div');
    const fields = ['device', 'splitMode'].map((id, index) => ({
        id,
        label: id,
        canonical: index ? '--split-mode' : '--device',
        aliases: [],
        value: { type: 'string' },
        description: 'Configures multi-GPU behavior. Use it only when needed.',
        essentialSection: 'Multi-GPU setup'
    }));

    renderFlagCards(fakeDocument, container, fields, {}, new Map(), {});
    assert.equal(container.children[0].textContent, 'Multi-GPU setup');
    assert.match(container.children[0].className, /essential-section-heading/);
});

test('renderer search results reuse canonical flag state keys', () => {
    const { renderFlagCards } = require('../lib/render');
    const container = new FakeElement('div');
    const flag = {
        id: 'flashAttn',
        label: 'Flash attention',
        canonical: '--flash-attn',
        aliases: ['-fa'],
        value: { type: 'choice', options: ['auto', 'on', 'off'] },
        description: 'Controls flash attention. Automatic mode lets llama.cpp choose.'
    };

    renderFlagCards(fakeDocument, container, [{ flag, score: 100 }], { flashAttn: 'auto' }, new Map(), {});
    assert.equal(container.children.length, 1);
    assert.equal(container.children[0].dataset.flagId, 'flashAttn');
    assert.ok(descendants(container.children[0]).some(element => element.dataset.flagId === 'flashAttn'));
});

test('renderer restores active field focus and cursor after rerender', () => {
    const { captureFieldFocus, restoreFieldFocus } = require('../lib/render');
    const active = new FakeElement('input');
    active.dataset.flagId = 'ctxSize';
    active.selectionStart = 2;
    active.selectionEnd = 2;
    active.selectionDirection = 'none';
    const replacement = new FakeElement('input');
    const document = {
        activeElement: active,
        getElementById(id) {
            return id === 'field-ctxSize' ? replacement : null;
        }
    };

    const snapshot = captureFieldFocus(document);
    restoreFieldFocus(document, snapshot);

    assert.equal(replacement.focused, true);
    assert.equal(replacement.selectionStart, 2);
    assert.equal(replacement.selectionEnd, 2);
});

test('category navigation anchors the workspace below the sticky header', () => {
    const { scrollToFlagWorkspace } = require('../lib/render');
    let options = null;
    const document = {
        getElementById(id) {
            if (id !== 'flagWorkspace') return null;
            return { scrollIntoView(nextOptions) { options = nextOptions; } };
        }
    };

    scrollToFlagWorkspace(document);

    assert.deepEqual(options, { behavior: 'auto', block: 'start' });
    assert.match(readStyles(), /\.flag-workspace\s*\{[^}]*scroll-margin-top:\s*var\(--sticky-offset\)/s);
    assert.match(readStyles(), /html\s*\{\s*min-width:\s*20rem;\s*scroll-behavior:\s*auto/s);
});

test('preset groups preserve registry order and omit server-only workloads in CLI mode', () => {
    const { createRegistry } = require('../lib/registry');
    const { presetGroups } = require('../lib/render');
    const data = JSON.parse(fs.readFileSync(path.join(root, 'flags.json'), 'utf8'));
    const registry = createRegistry(data);

    assert.deepEqual(presetGroups(registry, 'server').map(group => group.label), [
        'General', 'Speculative', 'Server workloads'
    ]);
    assert.deepEqual(presetGroups(registry, 'cli').map(group => group.label), [
        'General', 'Speculative'
    ]);
});

test('Essentials follows the active preset while normal category tabs remain complete', () => {
    const { createRegistry } = require('../lib/registry');
    const { itemsForCategory } = require('../lib/render');
    const data = JSON.parse(fs.readFileSync(path.join(root, 'flags.json'), 'utf8'));
    const registry = createRegistry(data);
    const state = { mode: 'server', activeCategory: 'essentials', activePreset: 'dflash' };

    const essentials = itemsForCategory(registry, state).map(field => field.id);
    assert.ok(essentials.includes('dflashModel'));
    assert.equal(essentials.includes('prompt'), false);

    state.activeCategory = 'speculative';
    const speculative = itemsForCategory(registry, state).map(field => field.id);
    assert.ok(speculative.includes('dflashModel'));
    assert.ok(speculative.includes('specType'));

    state.activeCategory = 'advanced';
    const advanced = itemsForCategory(registry, state).map(field => field.id);
    assert.ok(advanced.includes('serverPath'));
    assert.ok(advanced.includes('extraFlags'));
});

test('typography is local, readable, and preserves monospace command surfaces', () => {
    const css = readStyles();
    const fontPath = path.join(root, 'assets/fonts/SpaceGrotesk-Variable.ttf');
    const licensePath = path.join(root, 'assets/fonts/SpaceGrotesk-OFL.txt');

    assert.equal(fs.existsSync(fontPath), true, 'Space Grotesk font must be bundled locally');
    assert.equal(fs.existsSync(licensePath), true, 'Space Grotesk license must be bundled locally');
    assert.match(css, /@font-face\s*\{[^}]*font-family:\s*["']Space Grotesk["'][^}]*url\(["']assets\/fonts\/SpaceGrotesk-Variable\.ttf["']\)\s*format\(["']truetype["']\)/s);
    assert.match(css, /body\s*\{[^}]*font-family:\s*["']Space Grotesk["'],\s*-apple-system,\s*BlinkMacSystemFont,\s*["']Segoe UI["'],\s*sans-serif/s);
    assert.match(css, /\.flag-aliases\s*\{[^}]*font-family:\s*ui-monospace/s);
    assert.match(css, /#commandOutput\s*\{[^}]*font-family:\s*ui-monospace/s);
    assert.doesNotMatch(css, /Audiowide/i);
});

test('cosmic styles expose the approved visual and accessibility tokens', () => {
    const css = readStyles();
    for (const token of ['--neutral-primary-soft', '--signal-cyan', '--signal-violet', '--focus-ring']) {
        assert.match(css, new RegExp(token));
    }
    assert.match(css, /font-family:\s*["']Space Grotesk["']/i);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /forced-colors/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /@media\s*\(max-width:\s*720px\)/);
    assert.match(css, /\.flag-card\.is-essential-target/);
    assert.match(css, /\.flag-card\.is-essential-draft/);
    assert.match(css, /\.warning-danger/);
    assert.match(css, /\.warning-info/);
});

test('responsive workbench children can shrink without page overflow', () => {
    const css = readStyles();
    assert.match(css, /\.category-rail,\s*\.command-panel\s*\{[^}]*min-width:\s*0/s);
    assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*?h1\s*\{[^}]*font-size:\s*1\.7rem/);
});

test('legacy split catalogue files are removed', () => {
    for (const file of ['command-rules.js', 'script.js', 'starter-fields.js', 'starter-fields.css', 'test/dflash.test.js']) {
        assert.equal(fs.existsSync(path.join(root, file)), false, file);
    }
    const allRuntime = ['index.html', 'app.js', ...fs.readdirSync(path.join(root, 'lib')).map(file => `lib/${file}`)]
        .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
        .join('\n');
});
