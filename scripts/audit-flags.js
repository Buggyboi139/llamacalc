#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createRegistry } = require('../lib/registry.js');

function parseHelpTable(markdown, mode) {
    const rows = [];

    for (const line of String(markdown).split(/\r?\n/)) {
        if (!line.startsWith('| `')) continue;
        const codeEnd = line.indexOf('`', 3);
        if (codeEnd < 0) continue;

        const signature = line.slice(3, codeEnd);
        const explanation = line.slice(codeEnd + 1).replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '');
        if (/argument has been removed/i.test(explanation)) continue;

        const aliases = [...signature.matchAll(/(?:^|,\s+)(-{1,2}[A-Za-z0-9][A-Za-z0-9.-]*)/g)]
            .map(match => match[1]);
        if (aliases.length) rows.push({ mode, signature, aliases, explanation });
    }

    return rows;
}

function auditRegistry(registry, rows) {
    const missingRows = [];
    const modeMismatches = [];
    const documented = new Set();

    for (const row of rows) {
        row.aliases.forEach(alias => documented.add(alias));
        const matches = row.aliases.map(alias => registry.byAlias.get(alias)).filter(Boolean);
        const flag = matches[0];
        if (!flag) {
            missingRows.push(`[${row.mode}] ${row.signature}`);
            continue;
        }
        if (matches.some(match => match.id !== flag.id)) {
            missingRows.push(`[${row.mode}] aliases split across records: ${row.signature}`);
        }
        const absentAliases = row.aliases.filter(alias => registry.byAlias.get(alias)?.id !== flag.id);
        if (absentAliases.length) {
            missingRows.push(`[${row.mode}] missing aliases ${absentAliases.join(', ')} for ${row.signature}`);
        }
        if (!flag.modes.includes(row.mode)) modeMismatches.push(`${flag.canonical} is missing ${row.mode}`);
    }

    const unknownAliases = [...registry.byAlias.keys()].filter(alias => !documented.has(alias)).sort();
    return {
        missingRows: [...new Set(missingRows)].sort(),
        unknownAliases,
        modeMismatches: [...new Set(modeMismatches)].sort()
    };
}

function readOption(argv, name) {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : '';
}

function main(argv) {
    const cliPath = readOption(argv, '--cli');
    const serverPath = readOption(argv, '--server');
    if (!cliPath || !serverPath) {
        console.error('Usage: node scripts/audit-flags.js --cli PATH --server PATH');
        return 2;
    }

    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'flags.json'), 'utf8'));
    const registry = createRegistry(data);
    const rows = [
        ...parseHelpTable(fs.readFileSync(cliPath, 'utf8'), 'cli'),
        ...parseHelpTable(fs.readFileSync(serverPath, 'utf8'), 'server')
    ];
    const result = auditRegistry(registry, rows);

    if (!result.missingRows.length && !result.unknownAliases.length && !result.modeMismatches.length) {
        console.log('Registry matches current CLI and server help.');
        return 0;
    }

    for (const [label, values] of [
        ['Missing supported rows', result.missingRows],
        ['Unknown registry aliases', result.unknownAliases],
        ['Mode mismatches', result.modeMismatches]
    ]) {
        if (!values.length) continue;
        console.error(`${label}:`);
        values.forEach(value => console.error(`  ${value}`));
    }
    return 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { parseHelpTable, auditRegistry, main };
