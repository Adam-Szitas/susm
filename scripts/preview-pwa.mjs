import express from 'express';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';

const root = resolve('dist/susm/browser');
await access(resolve(root, 'offline.js'));
const app = express();
app.use(express.static(root));
app.get(
  /^\/(projects|objects|dashboard|admin|login|register|protocols|files|share|checklist-feedback)(\/.*)?$/,
  (_, res) => res.sendFile(resolve(root, 'index.csr.html')),
);
const port = Number(process.env.PORT || 4173);
app.listen(port, '127.0.0.1', () =>
  console.log('SUSM PWA preview at http://127.0.0.1:' + port + '/projects'),
);
