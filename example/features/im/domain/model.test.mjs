import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeMessages, belongsToConversation, toMessage, toChat } from './model.ts'
import { isConversationArchived, updateConversationArchiveEx } from './conversation-archive.ts'
import { zhT } from '../i18n/test-modules.mjs'

test('history and live events merge by client ID and preserve chronological display', () => {
  const first = { clientMsgID: 'a', sendTime: 1, status: 1 }
  const latest = { clientMsgID: 'b', sendTime: 2, status: 2 }
  const result = mergeMessages([first, latest], [{ ...first, status: 2 }])
  assert.deepEqual(result.map(m => m.clientMsgID), ['b', 'a'])
  assert.equal(result[1].status, 2)
})
test('incoming direct messages cannot leak into a different chat', () => {
  assert.equal(belongsToConversation({ sendID: 'bob', recvID: 'me' }, { userID: 'bob' }, 'me'), true)
  assert.equal(belongsToConversation({ sendID: 'bob', recvID: 'me' }, { userID: 'alice' }, 'me'), false)
  assert.equal(belongsToConversation({ groupID: 'g' }, { groupID: 'other' }, 'me'), false)
})
test('failed messages never display a successful delivery receipt', () => {
  const message = toMessage({ clientMsgID: 'a', sendID: 'me', sendTime: 10, status: 3, contentType: 101, textElem: { content: 'hello' } }, zhT)
  assert.equal(message.sent, false)
  assert.equal(message.pending, false)
  assert.equal(message.text, 'hello')
})

test('message arriving before conversation metadata stays queued and is delivered once after metadata arrives', async () => {
  const { routeMessages } = await import('./model.ts')
  const message = { clientMsgID: 'first', sendID: 'bob', recvID: 'me', sendTime: 10 }
  const pending = routeMessages([message], [], 'me')
  assert.equal(pending.remaining.length, 1)
  const delivered = routeMessages(pending.remaining, [{ conversationID: 'bob-chat', userID: 'bob' }], 'me')
  assert.equal(delivered.remaining.length, 0)
  assert.equal(delivered.byConversation['bob-chat'][0].clientMsgID, 'first')
})

test('persisted media maps to official photo, voice, video and file bubbles', () => {
  const base = { clientMsgID: 'media', sendTime: 10, status: 2 }
  assert.equal(toMessage({ ...base, contentType: 102, pictureElem: { sourcePicture: { url: 'https://media/photo' } } }, zhT).image, 'https://media/photo')
  assert.equal(toMessage({ ...base, contentType: 103, soundElem: { sourceUrl: 'https://media/voice', duration: 4 } }, zhT).duration, 4)
  assert.equal(toMessage({ ...base, contentType: 104, videoElem: { videoUrl: 'https://media/video' } }, zhT).video, 'https://media/video')
  assert.deepEqual(toMessage({ ...base, contentType: 105, fileElem: { sourceUrl: 'https://media/file', fileName: 'a.pdf', fileSize: 123 } }, zhT).file, { uri: 'https://media/file', name: 'a.pdf', size: 123 })
})
test('failed media retains local preview and advertises failure; progress uses official transfer ring', () => {
  const message = { clientMsgID: 'media', sendTime: 10, contentType: 103, status: 3, soundElem: { soundPath: 'file:///voice', duration: 2 }, uploadProgress: 50 }
  assert.equal(toMessage(message, zhT).audio, 'file:///voice')
  assert.equal(toMessage(message, zhT).isFailed, true)
  assert.equal(toMessage(message, zhT).transfer, undefined)
  assert.deepEqual(toMessage({ ...message, status: 1 }, zhT).transfer, { type: 'upload', progress: 0.5 })
})

test('quote replies retain original author and bubble reference', () => {
  const original = { clientMsgID: 'original', sendID: 'bob', senderNickname: 'Bob', sendTime: 1, status: 2, contentType: 101, textElem: { content: 'hello' } }
  const result = toMessage({ ...original, clientMsgID: 'reply', contentType: 114, quoteElem: { text: 'answer', quoteMessage: original } }, zhT)
  assert.equal(result.text, 'answer')
  assert.equal(result.replyMessage._id, 'original')
  assert.equal(result.replyMessage.user.name, 'Bob')
})
test('revoked media becomes a system notice without the original attachment', () => {
  const result = toMessage({ clientMsgID: 'revoked', sendTime: 1, status: 2, contentType: 2101, notificationElem: { detail: JSON.stringify({ revokerNickname: 'Bob' }) }, pictureElem: { sourcePicture: { url: 'https://private' } } }, zhT)
  assert.equal(result.system, true)
  assert.equal(result.text, 'Bob 撤回了一条消息')
  assert.equal(result.image, undefined)
})
test('group notifications display readable event names', () => {
  assert.equal(toMessage({ clientMsgID: 'group', sendTime: 1, status: 2, contentType: 1501 }, zhT).text, '群聊已创建')
})

test('archive metadata is namespaced per user and preserves JSON ex fields', () => {
  const ex = updateConversationArchiveEx('{"other":"preserve"}', 'alice', true)
  assert.equal(isConversationArchived(ex, 'alice'), true)
  assert.equal(isConversationArchived(ex, 'bob'), false)
  assert.equal(JSON.parse(ex).other, 'preserve')
  assert.equal(isConversationArchived(updateConversationArchiveEx(ex, 'alice', false), 'alice'), false)
})

test('legacy non-JSON ex is wrapped intact before archive metadata is added', () => {
  const ex = updateConversationArchiveEx('legacy-opaque-data', 'alice', true)
  assert.equal(JSON.parse(ex).$legacyConversationEx, 'legacy-opaque-data')
  assert.equal(isConversationArchived(ex, 'alice'), true)
})

test('chat list projection scopes archived state to the current user', () => {
  const ex = updateConversationArchiveEx('', 'alice', true)
  const conversation = { conversationID: 'c', userID: 'bob', showName: 'Bob', unreadCount: 0, ex }
  assert.equal(toChat(conversation, zhT, 'alice').isArchived, true)
  assert.equal(toChat(conversation, zhT, 'bob').isArchived, false)
})

test('chat list items preserve conversation ids separately from group and private avatar ids', () => {
  const group = toChat({ conversationID: 'group-conversation', groupID: 'group-1', showName: 'QA 群', unreadCount: 0 }, zhT)
  assert.equal(group.id, 'group-conversation')
  assert.equal(group.avatarID, 'group-1')
  assert.equal(group.kind, 'group')

  const direct = toChat({ conversationID: 'private-conversation', userID: 'peer-1', showName: 'Peer', unreadCount: 0 }, zhT)
  assert.equal(direct.id, 'private-conversation')
  assert.equal(direct.avatarID, 'peer-1')
  assert.equal(direct.kind, 'private')
})

test('real card and location messages provide previews and native quote targets', () => {
  const base = { clientMsgID: 'rich', sendTime: 10, status: 2 }
  const card = { ...base, contentType: 108, cardElem: { userID: 'alice', nickname: 'Alice' } }
  assert.equal(toMessage(card, zhT).text, '[名片] Alice')
  assert.equal(toMessage({ ...base, contentType: 109, locationElem: { latitude: 31, longitude: 121, description: '上海' } }, zhT).text, '[位置] 上海')
  assert.equal(toMessage({ ...base, contentType: 114, quoteElem: { text: 'thanks', quoteMessage: card } }, zhT).replyMessage.text, '[名片] Alice')
})
test('quoted non-text messages retain playable payload plus their original quote', () => {
  const source = { clientMsgID: 'source', contentType: 102, sendTime: 5, status: 2, pictureElem: { sourcePicture: { url: 'https://example.org/photo' } } }
  const mapped = toMessage({ clientMsgID: 'response', contentType: 103, sendTime: 10, status: 2, soundElem: { sourceUrl: 'https://example.org/audio', duration: 3 }, ex: JSON.stringify({ imRichReplyV1: source }) }, zhT)
  assert.equal(mapped.audio, 'https://example.org/audio')
  assert.equal(mapped.replyMessage.image, 'https://example.org/photo')
  assert.equal(mapped.replyMessage._id, 'source')
})
