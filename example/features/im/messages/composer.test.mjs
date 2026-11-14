import test from 'node:test'
import assert from 'node:assert/strict'
import { attachReply, readReply, validateLocation, locationURL } from './composer.ts'
const source = { clientMsgID: 'original', contentType: 102, status: 2, sendTime: 12, pictureElem: { sourcePicture: { url: 'https://example.com/photo' } } }
test('non-text quote preserves actual media and round trips through SDK ex', () => {
  const media = { clientMsgID: 'reply', contentType: 103, ex: '{"other":true}', soundElem: { soundPath: '/voice' } }
  const result = attachReply(media, source)
  assert.equal(result.contentType, 103)
  assert.deepEqual(result.soundElem, media.soundElem)
  assert.equal(JSON.parse(result.ex).other, true)
  assert.deepEqual(readReply(JSON.parse(JSON.stringify(result))), source)
  assert.equal(media.ex, '{"other":true}')
})
test('malformed metadata never breaks a bubble and nested quotes are bounded', () => {
  assert.equal(readReply({ ex: '{' }), undefined)
  assert.equal(readReply({ ex: '{"imRichReplyV1":{"clientMsgID":"x"}}' }), undefined)
  assert.equal(readReply(attachReply({}, { ...source, quoteElem: { text: 'nested', quoteMessage: source } })).quoteElem, undefined)
})
test('location validates geographic bounds and opens only fixed maps https endpoint', () => {
  assert.throws(() => validateLocation({ latitude: NaN, longitude: 1, description: 'x' }))
  assert.throws(() => validateLocation({ latitude: 91, longitude: 1, description: 'x' }))
  assert.throws(() => validateLocation({ latitude: 1, longitude: 181, description: 'x' }))
  assert.equal(locationURL({ latitude: 31.2, longitude: 121.5, description: '上海' }), 'https://www.google.com/maps/search/?api=1&query=31.2%2C121.5')
})


test('rich reply to a quoted text preserves visible text without nested chains', () => {
  const source = { clientMsgID: 'quote', sendTime: 1, status: 2, contentType: 114, quoteElem: { text: 'reply body', quoteMessage: { clientMsgID: 'old' } } }
  const reply = readReply(attachReply({ clientMsgID: 'media' }, source))
  assert.equal(reply.contentType, 101)
  assert.equal(reply.textElem.content, 'reply body')
  assert.equal(reply.quoteElem, undefined)
})
