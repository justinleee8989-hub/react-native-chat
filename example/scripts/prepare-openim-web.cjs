const { copyFileSync, mkdirSync, cpSync, writeFileSync } = require('node:fs')
const path = require('node:path')
const assets = path.resolve(__dirname, '../node_modules/@openim/wasm-client-sdk/assets')
const target = path.resolve(__dirname, '../public')
mkdirSync(target, { recursive: true })
for (const [source, destination] of [['openIM.wasm', 'openim.wasm'], ['sql-wasm.wasm', 'sql-wasm.wasm'], ['wasm_exec.js', 'wasm_exec.js']])
  copyFileSync(path.join(assets, source), path.join(target, destination))
console.log('OpenIM browser SDK assets prepared')

// Preserve import.meta.url so the official SDK resolves its database workers.
cpSync(path.resolve(assets, '../lib'), path.join(target, 'openim-sdk'), { recursive: true })
writeFileSync(path.join(target, 'openim-sdk-loader.js'), "import * as SDK from './openim-sdk/index.es.js'\nwindow.OpenIMWebSDK = SDK\n")
