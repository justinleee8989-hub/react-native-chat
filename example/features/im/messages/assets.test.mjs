import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { withI18n } from '../i18n/test-modules.mjs'

const exports = {}
runInNewContext(ts.transpileModule(readFileSync(new URL('./assets.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, URL, Set, Map, Object, Error, RegExp, require: withI18n() })

const message = (id, sendTime, patch = {}) => ({
  clientMsgID: id,
  sendTime,
  status: 2,
  contentType: 101,
  textElem: { content: `see https://example.com/${id}` },
  ...patch,
})

test('extracts image, safe file URL, and projected edited links while excluding revoked and system rows', () => {
  const messages = [
    message('image', 4, { contentType: 102, pictureElem: { sourcePicture: { url: 'https://cdn.example/p.jpg' } } }),
    message('snapshot', 4, { contentType: 102, pictureElem: { snapshotPicture: { url: 'https://cdn.example/snapshot.jpg' } } }),
    message('file', 3, { contentType: 105, fileElem: { sourceUrl: 'https://cdn.example/a.pdf', fileName: 'a.pdf', fileSize: 12 } }),
    message('edited', 2, { textElem: { content: 'old body' } }),
    message('unsafe', 1, { textElem: { content: 'https://example.com https://example.com.evil.test javascript:alert(1)' } }),
    message('revoked', 9, { contentType: 2101, notificationElem: { detail: '{}' }, textElem: { content: 'https://no.test' } }),
    message('system', 10, { contentType: 1501, status: 2, textElem: { content: 'https://no.test' } }),
    message('pending', 11, { status: 1, textElem: { content: 'https://no.test' } }),
  ]
  const assets = exports.extractAssets(messages, {
    edited: { text: 'new text https://edited.example/path', revision: 1 },
  })
  assert.deepEqual(JSON.parse(JSON.stringify(assets.map(item => [item.kind, item.messageID]))), [
    ['image', 'image'], ['image', 'snapshot'], ['file', 'file'], ['link', 'edited'], ['link', 'unsafe'], ['link', 'unsafe'],
  ])
  assert.equal(assets[3].uri, 'https://edited.example/path')
  assert.equal(assets[4].uri, 'https://example.com/')
  assert.equal(assets[1].uri, 'https://cdn.example/snapshot.jpg')
})

test('page cursor uses chronological minimum regardless of SDK response ordering and deduplicates overlaps', async () => {
  const calls = []
  const pages = [
    { messageList: [message('new', 30), message('old', 10), message('middle', 20)], isEnd: false },
    { messageList: [message('old', 10), message('older', 5)], isEnd: true },
  ]
  const pager = exports.createAssetsPager({
    history: async (_id, cursor) => {
      calls.push(cursor)
      return pages[calls.length - 1]
    },
    project: async () => ({}),
    isCurrent: () => true,
  })
  const first = await pager.loadNext('conversation')
  const second = await pager.loadNext('conversation')
  assert.deepEqual(calls, ['', 'old'])
  assert.equal(first.done, false)
  assert.equal(first.assets.length, 3)
  assert.equal(second.done, true)
  assert.equal(second.assets.length, 1)
  assert.equal(second.assets[0].messageID, 'older')
})

test('projection is fetched for each successful text page and supplies edited link content', async () => {
  const calls = []
  const pager = exports.createAssetsPager({
    history: async (_id, cursor) => cursor
      ? { messageList: [], isEnd: true }
      : { messageList: [message('edit', 1, { textElem: { content: 'stale' } })], isEnd: true },
    project: async (id, ids) => {
      calls.push([id, ids])
      return { edit: { text: 'now https://current.example', revision: 2 } }
    },
    isCurrent: () => true,
  })
  const result = await pager.loadNext('chat')
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['chat', ['edit']]])
  assert.deepEqual(JSON.parse(JSON.stringify(result.assets.map(asset => asset.uri))), ['https://current.example/'])
})

test('stale pages are discarded and repeated cursors fail instead of looping forever', async () => {
  let active = true
  const stale = exports.createAssetsPager({
    history: async () => {
      active = false
      return { messageList: [message('stale', 1)], isEnd: false }
    },
    project: async () => ({}),
    isCurrent: () => active,
  })
  await assert.rejects(stale.loadNext('chat'), /登录或页面已变化/)

  const stuck = exports.createAssetsPager({
    history: async () => ({ messageList: [message('same', 1)], isEnd: false }),
    project: async () => ({}),
    isCurrent: () => true,
  })
  await stuck.loadNext('chat')
  await assert.rejects(stuck.loadNext('chat'), /分页游标未前进/)
})

test('a failed extras read leaves the history cursor unchanged so retry cannot skip the page', async () => {
  const calls = []
  let failProjection = true
  const pager = exports.createAssetsPager({
    history: async (_id, cursor) => {
      calls.push(['history', cursor])
      return { messageList: [message('old', 1, { textElem: { content: 'https://old.example' } })], isEnd: false }
    },
    project: async () => {
      if (failProjection) {
        failProjection = false
        throw new Error('projection unavailable')
      }
      return {}
    },
    isCurrent: () => true,
  })
  await assert.rejects(pager.loadNext('chat'), /projection unavailable/)
  const retried = await pager.loadNext('chat')
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['history', ''], ['history', '']])
  assert.equal(retried.assets.length, 1)
})

test('an account change while projected extras are loading rejects the old page without advancing', async () => {
  let active = true
  let projectionDone
  const projection = new Promise(resolve => { projectionDone = resolve })
  const cursors = []
  const pager = exports.createAssetsPager({
    history: async (_id, cursor) => {
      cursors.push(cursor)
      return { messageList: [message('old', 1)], isEnd: false }
    },
    project: async () => {
      await projection
      return {}
    },
    isCurrent: () => active,
  })
  const pending = pager.loadNext('chat')
  await new Promise(resolve => setImmediate(resolve))
  active = false
  projectionDone()
  await assert.rejects(pending, /登录或页面已变化/)
  assert.deepEqual(JSON.parse(JSON.stringify(cursors)), [''])
})
