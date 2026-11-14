import assert from 'node:assert/strict'
import test from 'node:test'
import { createWebMedia } from './media.web.ts'

test('web file factory passes actual bytes into SDK for upload instead of persisting a local URL', async () => {
  let params
  const sdk = { createFileMessageByFile: async value => { params = value; return { data: { clientMsgID: 'file' } } } }
  const result = await createWebMedia(sdk, { type: 'file', uri: 'data:text/plain;base64,aGVsbG8=', name: 'hello.txt' })
  assert.equal(result.clientMsgID, 'file')
  assert.equal(await params.file.text(), 'hello')
  assert.equal(params.fileName, 'hello.txt')
  assert.equal(params.fileSize, 5)
  assert.equal(params.sourceUrl, '')
})

test('web voice factory retains recorded data and duration for SDK upload', async () => {
  let params
  const sdk = { createSoundMessageByFile: async value => { params = value; return { data: { clientMsgID: 'voice' } } } }
  await createWebMedia(sdk, { type: 'audio', uri: 'data:audio/webm;base64,aGVsbG8=', duration: 2.6 })
  assert.equal(params.file.type, 'audio/webm')
  assert.equal(params.duration, 3)
  assert.equal(params.dataSize, 5)
  assert.equal(params.sourceUrl, '')
})

test('image SDK UUID mutation is shared by source, big and snapshot upload metadata', async () => {
  const previous = globalThis.createImageBitmap
  globalThis.createImageBitmap = async () => ({ width: 10, height: 20, close () {} })
  try {
    const sdk = { createImageMessageByFile: async params => {
      params.sourcePicture.uuid += '/photo.png'
      assert.equal(params.bigPicture.uuid, params.sourcePicture.uuid)
      assert.equal(params.snapshotPicture.uuid, params.sourcePicture.uuid)
      return { data: { clientMsgID: 'image' } }
    } }
    await createWebMedia(sdk, { type: 'image', uri: 'data:image/png;base64,aGVsbG8=' })
  } finally {
    globalThis.createImageBitmap = previous
  }
})
