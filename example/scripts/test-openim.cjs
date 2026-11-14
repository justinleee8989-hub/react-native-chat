const { readdirSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
function tests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = join(dir, entry.name)
    return entry.isDirectory() ? tests(file) : entry.name.endsWith('.test.mjs') ? [file] : []
  })
}
const result = spawnSync(process.execPath, ['--test', ...tests('features/im'), 'components/chat-list/store.ssr.test.mjs'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
