import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { withI18n } from '../i18n/test-modules.mjs'

function loadModule (relativePath, dependencies) {
  const exports = {}
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  runInNewContext(compiled, {
    exports,
    require: name => {
      if (/shared\/(product-error|error-message)|i18n\/translate/.test(name)) return withI18n()(name)
      if (name in dependencies)
        return dependencies[name]
      throw new Error(`Unexpected import: ${name}`)
    },
    Promise,
    Date,
    Math,
  })
  return exports
}

function makeFileSystem (copy) {
  class File {
    constructor (...parts) {
      const [first, second] = parts
      this.uri = second === undefined ? String(first) : `${first.uri}/${second}`
      this.name = this.uri.split('/').at(-1)
      this.size = 1
      this.exists = true
    }

    copy (destination) {
      return copy(destination)
    }

    delete () {}
  }
  class Directory {
    constructor (...parts) {
      const [first, ...rest] = parts
      this.uri = [first.uri, ...rest].join('/')
      this.exists = true
    }

    create () {}
    delete () {}
  }
  return { File, Directory, Paths: { cache: { uri: 'file:///cache' }, document: { uri: 'file:///documents' } } }
}

test('avatar upload waits for the local file copy to finish', async () => {
  let finishCopy
  let copyStarted = false
  let copyFinished = false
  let uploadCalls = 0
  let uploadSawCompletedCopy = false
  const copyGate = new Promise(resolve => { finishCopy = resolve })
  const sdk = {
    uploadFile: async () => {
      uploadCalls++
      uploadSawCompletedCopy = copyFinished
      return { url: 'https://example.com/avatar.jpg' }
    },
  }
  const fs = makeFileSystem(async () => {
    copyStarted = true
    await copyGate
    copyFinished = true
  })
  const service = loadModule('./openim/profile-avatar-service.ts', {})
  const module = loadModule('./openim/profile-avatar.ts', {
    'expo-file-system': fs,
    './client': { getSDKClient: async () => sdk },
    './profile-avatar-service': service,
  })

  const pending = module.uploadAvatar({ uri: 'content://provider/avatar.jpg' }, () => true)
  while (!copyStarted)
    await Promise.resolve()
  for (let turn = 0; turn < 5; turn++)
    await Promise.resolve()
  const callsBeforeCopyFinished = uploadCalls
  finishCopy()
  assert.equal(await pending, 'https://example.com/avatar.jpg')
  assert.equal(callsBeforeCopyFinished, 0, 'SDK upload must wait while the avatar is copied')
  assert.equal(uploadSawCompletedCopy, true, 'SDK upload must receive a completed local copy')
  assert.equal(uploadCalls, 1)
})

test('avatar upload propagates copy failure without calling the SDK', async () => {
  const copyError = new Error('copy failed')
  const copyFailure = Promise.reject(copyError)
  copyFailure.catch(() => {})
  let uploadCalls = 0
  const fs = makeFileSystem(() => copyFailure)
  const service = loadModule('./openim/profile-avatar-service.ts', {})
  const module = loadModule('./openim/profile-avatar.ts', {
    'expo-file-system': fs,
    './client': { getSDKClient: async () => ({ uploadFile: async () => { uploadCalls++; return { url: 'https://example.com/avatar.jpg' } } }) },
    './profile-avatar-service': service,
  })

  await assert.rejects(module.uploadAvatar({ uri: 'content://provider/avatar.jpg' }, () => true), error => error === copyError)
  assert.equal(uploadCalls, 0, 'SDK upload must not run after the local copy fails')
})

test('attachment outbox waits for the retained file copy to finish', async () => {
  let finishCopy
  let copyFinished = false
  const copyGate = new Promise(resolve => { finishCopy = resolve })
  const fs = makeFileSystem(async () => {
    await copyGate
    copyFinished = true
  })
  const module = loadModule('./storage/attachment-outbox.ts', {
    'expo-file-system': fs,
    '@react-native-async-storage/async-storage': { default: {} },
  })

  const pending = module.attachmentOutbox.retain('user-1', 'batch-1/0', { type: 'image', uri: 'content://provider/image.jpg', name: 'image.jpg' })
  let settled = false
  pending.then(() => { settled = true })
  await Promise.resolve()
  assert.equal(settled, false, 'retain must remain pending while the file is copied')
  finishCopy()
  const retained = await pending
  assert.equal(copyFinished, true)
  assert.match(retained.uri, /^file:\/\/\/documents\//)
})

test('attachment outbox rejects when retaining the file fails', async () => {
  const copyError = new Error('copy failed')
  const copyFailure = Promise.reject(copyError)
  copyFailure.catch(() => {})
  const fs = makeFileSystem(() => copyFailure)
  const module = loadModule('./storage/attachment-outbox.ts', {
    'expo-file-system': fs,
    '@react-native-async-storage/async-storage': { default: {} },
  })

  await assert.rejects(
    module.attachmentOutbox.retain('user-1', 'batch-1/0', { type: 'image', uri: 'content://provider/image.jpg', name: 'image.jpg' }),
    error => error === copyError,
  )
})
