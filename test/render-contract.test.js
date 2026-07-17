const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function readIndex() {
    return fs.readFileSync(path.join(root, 'index.html'), 'utf8');
}

test('shell has exactly one global flag search', () => {
    const html = readIndex();
    assert.equal((html.match(/type="search"/g) || []).length, 1);
    assert.match(html, /id="flagSearch"/);
    assert.match(html, /aria-controls="flagWorkspace"/);
});

test('mode and operating system are peer radio groups', () => {
    const html = readIndex();
    assert.match(html, /<fieldset[^>]*id="modeSelector"/);
    assert.match(html, /<fieldset[^>]*id="platformSelector"/);
    for (const value of ['server', 'cli', 'linux', 'macos', 'windows']) {
        assert.match(html, new RegExp(`value="${value}"`));
    }
});

test('shell contains workbench and preserved benchmark landmarks', () => {
    const html = readIndex();
    for (const id of ['categoryNav', 'flagWorkspace', 'commandOutput', 'warningList', 'benchmarkLog', 'logTable']) {
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
