
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "redirectTo": "/projects",
    "route": "/"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-LDUKQHRL.js",
      "chunk-JDIK4ESQ.js"
    ],
    "route": "/login"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-YLKOK6AW.js",
      "chunk-JDIK4ESQ.js"
    ],
    "route": "/register"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-K6GGKJKY.js"
    ],
    "route": "/dashboard"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-W6NRO6O5.js",
      "chunk-3OVHKP5J.js",
      "chunk-6LKDQ6BM.js",
      "chunk-K5OQVDQI.js",
      "chunk-JDIK4ESQ.js"
    ],
    "route": "/projects"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-W6NRO6O5.js",
      "chunk-3OVHKP5J.js",
      "chunk-6LKDQ6BM.js",
      "chunk-K5OQVDQI.js",
      "chunk-JDIK4ESQ.js"
    ],
    "route": "/projects/tab/*"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-4D53SEH4.js",
      "chunk-3OVHKP5J.js",
      "chunk-6LKDQ6BM.js"
    ],
    "route": "/objects"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-4D53SEH4.js",
      "chunk-3OVHKP5J.js",
      "chunk-6LKDQ6BM.js"
    ],
    "route": "/objects/tab/*"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-P4DTOPSI.js",
      "chunk-EHP2MKLM.js",
      "chunk-K5OQVDQI.js",
      "chunk-JDIK4ESQ.js"
    ],
    "route": "/protocols"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-JZHQW3J7.js",
      "chunk-6LKDQ6BM.js"
    ],
    "route": "/share/*"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 1191, hash: '910bbf91800696a6ebaa8e70052da3c673d815d0719d7f112e5a656aba6791fa', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1095, hash: 'd6d9f00fb96487caa10f43411a101363f25092017bb99d64d9763417a3fce2c7', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'protocols/index.html': {size: 309, hash: '64130dcc14fea37c9d0acdb8914d7299614ff8b299658aaaedd685cfec3ae662', text: () => import('./assets-chunks/protocols_index_html.mjs').then(m => m.default)},
    'objects/index.html': {size: 303, hash: '05b72c3155a99a740dacdcb8a89efb7217b33617adfcd68c9dfcca03bde974b5', text: () => import('./assets-chunks/objects_index_html.mjs').then(m => m.default)},
    'dashboard/index.html': {size: 309, hash: '3983a94f489cd8ff89c7da9a885dc0188f9ba5d058c8809d15bf19728249e5e8', text: () => import('./assets-chunks/dashboard_index_html.mjs').then(m => m.default)},
    'projects/index.html': {size: 306, hash: 'aeab31280118c5aa0bb2b071bd7c9a34459ab940a0afe0b1cd3ecf18b4706e45', text: () => import('./assets-chunks/projects_index_html.mjs').then(m => m.default)},
    'login/index.html': {size: 12819, hash: 'b07bd8fecb7d93979a0cc0678dd9290a15337e721043dd74f628fc2fa63d79ed', text: () => import('./assets-chunks/login_index_html.mjs').then(m => m.default)},
    'register/index.html': {size: 15726, hash: 'fdc3714f9a1449a7a04a559333b5f2a19873aa557f8c14da01aad952f513105b', text: () => import('./assets-chunks/register_index_html.mjs').then(m => m.default)},
    'styles-IR2JO3JF.css': {size: 3997, hash: 'Ujgy8TucfJE', text: () => import('./assets-chunks/styles-IR2JO3JF_css.mjs').then(m => m.default)}
  },
};
