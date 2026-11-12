// Copies the icon registry from src/app/icons/icon.definitions.ts into design/foundation.html,
// so the foundation page always shows the same glyphs as <app-icon>.
// Run: node scripts/sync-foundation-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/app/icons/icon.definitions.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { icons } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const pagePath = resolve(root, 'design/foundation.html');
const page = readFileSync(pagePath, 'utf8');
const start = '/* icons:start */';
const end = '/* icons:end */';
const from = page.indexOf(start);
const to = page.indexOf(end);
if (from < 0 || to < from) {
  throw new Error(`Markers ${start} … ${end} not found in design/foundation.html`);
}

const block = `${start}\n      const ICONS = ${JSON.stringify(icons)};\n      `;
writeFileSync(pagePath, page.slice(0, from) + block + page.slice(to));
console.log(`Synced ${Object.keys(icons).length} icons into design/foundation.html`);
