import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';

const dir = 'dist/susm/browser';
await build({
  entryPoints: ['scripts/offline.ts'],
  outfile: dir + '/offline.js',
  bundle: true,
  minify: true,
});
for (const file of ['index.html', 'index.csr.html']) {
  const path = dir + '/' + file;
  const html = await readFile(path, 'utf8');
  await writeFile(
    path,
    html.replace('</head>', '<meta name="susm-production" content="true"></head>'),
  );
}
const assets = (await readdir(dir))
  .filter(
    (name) =>
      /^(offline\.(html|js)|index\.csr\.html|manifest\.json|susm\.svg|apple-touch-icon\.png|icon-\d+\.png)$/.test(
        name,
      ) || /-[A-Z0-9]{8}\.(js|css)$/.test(name),
  )
  .sort();
const hash = createHash('sha256');
const worker = await readFile(dir + '/service-worker.js', 'utf8');
hash.update(worker);
for (const asset of assets) hash.update(asset).update(await readFile(dir + '/' + asset));
await writeFile(
  dir + '/service-worker.js',
  worker
    .replace('/* BUILD_ASSETS */ []', JSON.stringify(assets.map((name) => '/' + name)))
    .replace('BUILD_VERSION', hash.digest('hex')),
);
console.log('PWA release includes', assets.length, 'assets');
