import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { withI18n } from '../../i18n/test-modules.mjs'

function loadCreateNativeMedia ({ copy, sdk }) {
  class File {
    constructor (...parts) {
      const [first, second] = parts
      this.uri = second === undefined ? String(first) : `${first.uri}/${second}`
      this.name = this.uri.split('/').at(-1)
    }

    copy (destination) {
      return copy(destination)
    }
  }
  const exports = {}
  const source = readFileSync(new URL('./media.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  runInNewContext(compiled, {
    exports,
    require: name => {
      if (/shared\/(product-error|error-message)|i18n\/translate/.test(name)) return withI18n()(name)
      if (name === '@openim/rn-client-sdk')
        return sdk
      if (name === 'expo-file-system')
        return { File, Paths: { cache: { uri: 'file:///cache' } } }
      if (name === 'expo-image-manipulator')
        return { ImageManipulator: {}, SaveFormat: {} }
      if (name === 'expo-video')
        return { createVideoPlayer: () => assert.fail('video player must not be used for image') }
      throw new Error(`Unexpected import: ${name}`)
    },
    Date,
    Math,
    Promise,
  })
  return exports.createNativeMedia
}

test('native media waits for content URI copy before calling OpenIM', async () => {
  let finishCopy
  let copyFinished = false
  let sdkCalls = 0
  let sdkSawCompletedCopy = false
  const copyGate = new Promise(resolve => { finishCopy = resolve })
  const createNativeMedia = loadCreateNativeMedia({
    copy: async () => {
      await copyGate
      copyFinished = true
    },
    sdk: {
      createImageMessageFromFullPath: async () => {
        sdkCalls++
        sdkSawCompletedCopy = copyFinished
        return { type: 'image' }
      },
    },
  })

  const pending = createNativeMedia({ type: 'image', uri: 'content://provider/image.jpg' })
  await Promise.resolve()
  const callsBeforeCopyFinished = sdkCalls
  finishCopy()
  assert.deepEqual(await pending, { type: 'image' })
  assert.equal(callsBeforeCopyFinished, 0, 'OpenIM call must wait while the source is being copied')
  assert.equal(sdkSawCompletedCopy, true, 'OpenIM must receive the path only after copy completes')
  assert.equal(sdkCalls, 1)
})

test('native media propagates copy failure without calling OpenIM', async () => {
  const copyError = new Error('copy failed')
  const copyFailure = Promise.reject(copyError)
  // Keep the intentionally rejected fake promise handled even if the source forgets to await it.
  copyFailure.catch(() => {})
  let sdkCalls = 0
  const createNativeMedia = loadCreateNativeMedia({
    copy: () => copyFailure,
    sdk: {
      createImageMessageFromFullPath: async () => {
        sdkCalls++
        return { type: 'image' }
      },
    },
  })

  await assert.rejects(
    createNativeMedia({ type: 'image', uri: 'content://provider/image.jpg' }),
    error => error === copyError,
  )
  assert.equal(sdkCalls, 0, 'OpenIM must not run after the source copy fails')
})
