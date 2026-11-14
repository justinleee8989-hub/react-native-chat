import assert from 'node:assert/strict'
import test from 'node:test'
import { uploadProfileAvatar, prepareWebAvatar } from './profile-avatar-service.ts'
test('web avatar uploads actual selected image bytes, never a blob URL as the avatar', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71])
  const asset = { uri: 'blob:local', fileName: 'avatar.png', mimeType: 'image/png' }
  const url = await uploadProfileAvatar(asset, async value => prepareWebAvatar(value, async () => ({ ok: true, blob: async () => new Blob([bytes], { type: 'image/png' }) })), async params => {
    assert.equal(params.name, 'avatar.png')
    assert.equal(params.contentType, 'image/png')
    assert.ok(params.uuid)
    assert.deepEqual(new Uint8Array(await params.file.arrayBuffer()), bytes)
    return { url: 'https://storage/avatar.png' }
  }, () => true)
  assert.equal(url, 'https://storage/avatar.png')
})
test('native avatar sends copied file path and always releases its temporary file', async () => {
  let disposed = 0
  const url = await uploadProfileAvatar({ uri: 'content://photo' }, async () => ({ params: { filepath: '/cache/avatar.jpg', name: 'avatar.jpg', contentType: 'image/jpeg', uuid: 'uuid' }, dispose: () => disposed++ }), async params => {
    assert.equal(params.filepath, '/cache/avatar.jpg')
    return { url: 'https://storage/a.jpg' }
  }, () => true)
  assert.equal(url, 'https://storage/a.jpg')
  assert.equal(disposed, 1)
})
test('session change before upload and local-only upload result cannot update profile', async () => {
  let active = true
  let uploaded = false
  let disposed = false
  await assert.rejects(uploadProfileAvatar({ uri: 'file:///a' }, async () => {
    active = false
    return { params: {}, dispose: () => { disposed = true } }
  }, async () => { uploaded = true }, () => active), /登录状态/)
  assert.equal(uploaded, false)
  assert.equal(disposed, true)
  await assert.rejects(uploadProfileAvatar({ uri: 'file:///a' }, async () => ({ params: {}, dispose: () => {} }), async () => ({ url: 'blob:local' }), () => true), /上传响应/)
})
