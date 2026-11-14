import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'

const root = fileURLToPath(new URL('.', import.meta.url))
function files (dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(entry.name) ? [file] : []
  })
}
test('business screens do not import SDKs or demo data, domain stays platform independent', () => {
  for (const file of files(root)) {
    const local = path.relative(root, file)
    const source = readFileSync(file, 'utf8')
    if (!local.startsWith('infrastructure/'))
      assert.doesNotMatch(source, /from ['"]@openim\//, local)
    assert.doesNotMatch(source, /from ['"][^'"]*components\/chat-list\/(data|store)['"]/, local)
    if (local.startsWith('domain/'))
      assert.doesNotMatch(source, /from ['"](?:react-native|.*infrastructure|.*application)/, local)
  }
})
