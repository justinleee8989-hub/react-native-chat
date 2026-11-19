import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { toMessage, toChat } from '../domain/model.ts'
import { withI18n } from '../i18n/test-modules.mjs'
import { zhT } from '../i18n/test-modules.mjs'
const exports = {}
const extras = {}
runInNewContext(ts.transpileModule(readFileSync(new URL('./extras.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: extras, Object, Array, Math, AbortController, setTimeout, clearTimeout, fetch, JSON, Error, require: withI18n() })
runInNewContext(ts.transpileModule(readFileSync(new URL('./projection.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, Set, Object, require: withI18n(id => id === './extras' ? extras : undefined) })

test('projection is display metadata on a copy and never alters SDK fields', () => {
  const raw = { clientMsgID: 'm1', contentType: 101, textElem: { content: 'original' } }
  const projected = exports.projectMessage(raw, { text: 'edited', editedAt: 5, revision: 2 })
  assert.equal(projected.projection.text, 'edited')
  assert.equal(projected.textElem.content, 'original')
  assert.equal(raw.projection, undefined)
  assert.equal(exports.searchableText(projected), 'edited')
})

test('quote and forward source copy applies edited text and removes projection metadata', () => {
  for (const message of [
    { clientMsgID: 'plain', contentType: 101, textElem: { content: 'raw' } },
    { clientMsgID: 'at', contentType: 106, atTextElem: { text: 'raw', atUserList: ['u'] } },
    { clientMsgID: 'quote', contentType: 114, quoteElem: { text: 'raw', quoteMessage: { clientMsgID: 'source' } } },
  ]) {
    const source = exports.sdkMessageWithProjection({ ...message, projection: { text: 'edited', revision: 1 } })
    const text = source.textElem?.content || source.atTextElem?.text || source.quoteElem?.text
    assert.equal(text, 'edited')
    assert.equal(source.projection, undefined)
    assert.notEqual(source, message)
  }
})

test('revoked and system messages never gain projected content', () => {
  const revoked = { clientMsgID: 'revoked', contentType: 2101, textElem: { content: 'revoked' } }
  assert.equal(exports.projectMessage(revoked, { text: 'resurrected', revision: 1 }).projection, undefined)
})

test('message and conversation previews consume projection metadata and preserve revoked notices', () => {
  const raw = { clientMsgID: 'm1', sendID: 'u1', sendTime: 10, status: 2, contentType: 101, textElem: { content: 'original' } }
  const projected = exports.projectMessage(raw, { text: 'edited', editedAt: 123, revision: 1 })
  const bubble = toMessage(projected, zhT)
  assert.equal(bubble.text, 'edited')
  assert.equal(bubble.isEdited, true)
  assert.equal(toChat({ conversationID: 'c1', showName: 'Chat', unreadCount: 0, latestMsg: JSON.stringify(projected) }, zhT).lastMessage.text, 'edited')
  const quoted = exports.projectMessage({ clientMsgID: 'q', sendID: 'u2', sendTime: 11, status: 2, contentType: 114,
    quoteElem: { text: 'reply', quoteMessage: raw } }, { text: 'reply edit', revision: 2 }, { m1: { text: 'source edit', revision: 3 } })
  assert.equal(toMessage(quoted, zhT).replyMessage.text, 'source edit')
  const revoked = toMessage({ ...projected, contentType: 2101, notificationElem: { detail: '{}' } }, zhT)
  assert.equal(revoked.system, true)
  assert.notEqual(revoked.text, 'edited')
})
