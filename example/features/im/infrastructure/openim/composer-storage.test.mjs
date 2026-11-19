import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { withI18n } from '../../i18n/test-modules.mjs'

function setup () {
  const values = new Map()
  const exports = {}
  const draftStorage = { getItem: async key => values.get(key) || null, setItem: async (key, value) => { values.set(key, value) } }
  const source = readFileSync(new URL('./composer-storage.ts', import.meta.url), 'utf8')
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: withI18n(() => ({ draftStorage })), Map, Set, JSON, Promise, encodeURIComponent, Error })
  return exports
}
test('simultaneous local text and mentions writes preserve both fields', async () => {
  const storage = setup()
  storage.setDraftStorageScope('server')
  await Promise.all([storage.writeLocalDraft('a', 'c', 'hello'), storage.writeDraftMentions('a', 'c', ['member'])])
  assert.equal(await storage.readLocalDraft('a', 'c'), 'hello')
  assert.deepEqual(await storage.readDraftMentions('a', 'c'), ['member'])
  await storage.clearDeliveredDraft('a', 'c')
  assert.equal(await storage.readLocalDraft('a', 'c'), '')
  assert.deepEqual(await storage.readDraftMentions('a', 'c'), [])
})
test('changing servers during queued writes cannot leak old drafts into the new server', async () => {
  const storage = setup()
  storage.setDraftStorageScope('old')
  const pending = storage.writeLocalDraft('a', 'c', 'private')
  storage.setDraftStorageScope('new')
  await pending
  assert.equal(await storage.readLocalDraft('a', 'c'), undefined)
  storage.setDraftStorageScope('old')
  assert.equal(await storage.readLocalDraft('a', 'c'), 'private')
})
