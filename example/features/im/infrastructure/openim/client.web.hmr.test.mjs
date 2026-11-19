import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { withI18n } from '../../i18n/test-modules.mjs'

const source = new URL('./client.web.ts', import.meta.url)
const settle = () => new Promise(resolve => setImmediate(resolve))

function harness (overrides = {}) {
  const scripts = []
  const timers = new Map()
  let nextTimer = 0
  const sdkCalls = []
  const loginCalls = []
  const statusCalls = []
  const registered = new Map()
  const sdk = {
    on: (event, listener) => {
      const listeners = registered.get(event) || new Set()
      listeners.add(listener)
      registered.set(event, listeners)
    },
    off: (event, listener) => registered.get(event)?.delete(listener),
    login: async options => {
      loginCalls.push(options)
      return overrides.login?.(options, loginCalls.length)
    },
    getLoginStatus: async () => {
      statusCalls.push(true)
      return { data: overrides.getLoginStatus ? await overrides.getLoginStatus(statusCalls.length) : 3 }
    },
  }
  const window = { OpenIMWebSDK: { getSDK: options => { sdkCalls.push(options); return sdk } } }
  const document = {
    createElement: () => ({ remove () {} }),
    head: { appendChild: script => scripts.push(script) },
  }
  const setTimer = (callback, milliseconds) => {
    const id = ++nextTimer
    timers.set(id, { callback, milliseconds })
    return id
  }
  const clearTimer = id => timers.delete(id)
  function loadClient () {
    const module = { exports: {} }
    const outputText = ts.transpileModule(readFileSync(source, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    runInNewContext(outputText, {
      exports: module.exports,
      module,
      window,
      document,
      setTimeout: setTimer,
      clearTimeout: clearTimer,
      require: name => {
        if (/shared\/(product-error|error-message)|i18n\/translate/.test(name)) return withI18n()(name)
        if (name === '../../config') return { platformID: 5 }
        if (name === './media.web') return { createWebMedia: async () => ({}) }
        if (name === './web-session') return { endWebSession: async () => {} }
        throw new Error(`Unexpected dependency ${name}`)
      },
    })
    return module.exports
  }
  async function finishLoading () {
    // Script load callbacks enqueue the next script. Drain each wave until ready settles.
    for (let i = 0; i < 8; i++) {
      await Promise.resolve()
      const pending = scripts.splice(0)
      if (!pending.length) {
        await Promise.resolve()
        if (!scripts.length) return
      }
      for (const script of pending) script.onload?.()
    }
  }
  return {
    loadClient,
    finishLoading,
    expireTimers: milliseconds => {
      for (const [id, timer] of [...timers]) {
        if (timer.milliseconds === milliseconds) {
          timers.delete(id)
          timer.callback()
        }
      }
    },
    sdkCalls,
    loginCalls,
    statusCalls,
    registered,
  }
}

test('reloading the web client while ready is pending initializes the page SDK once', async () => {
  const h = harness()
  const beforeReload = h.loadClient()
  const session = { userID: 'me', imToken: 'test-only' }
  const config = { api: 'https://api.test', ws: 'wss://ws.test' }
  const oldLogin = beforeReload.client.login(session, config)
  const afterReload = h.loadClient()
  const newLogin = afterReload.client.login(session, config)

  await h.finishLoading()
  await Promise.all([oldLogin, newLogin])

  assert.equal(h.sdkCalls.length, 1, 'module reload must reuse the in-flight page SDK initialization')
  assert.equal(h.loginCalls.length, 1, 'both module instances must share the in-flight SDK login')
})

test('a listener registered before reload survives on the active SDK and can still unsubscribe', async () => {
  const h = harness()
  const previous = h.loadClient()
  let oldListenerCalls = 0
  const unsubscribe = previous.client.on('onConnect', () => { oldListenerCalls++ })
  const current = h.loadClient()
  const ready = current.getSDKClient()
  await h.finishLoading()
  await ready

  const listeners = h.registered.get('OnConnect')
  assert.equal(listeners?.size, 1, 'the active SDK should have exactly one copy of the surviving listener')
  for (const listener of listeners || []) listener({ data: {} })
  assert.equal(oldListenerCalls, 1)
  unsubscribe()
  assert.equal(h.registered.get('OnConnect')?.size, 0, 'the pre-reload unsubscribe must remove its listener')
})

test('reloading after login skips SDK login when the same key is already authenticated', async () => {
  const h = harness()
  const first = h.loadClient()
  const session = { userID: 'me', imToken: 'test-only' }
  const config = { api: 'https://api.test', ws: 'wss://ws.test' }
  const initialLogin = first.client.login(session, config)
  await h.finishLoading()
  await initialLogin

  const reloaded = h.loadClient()
  await reloaded.client.login(session, config)

  assert.equal(h.sdkCalls.length, 1, 'a loaded page SDK must survive module replacement')
  assert.equal(h.statusCalls.length, 1)
  assert.equal(h.loginCalls.length, 1, 'status 3 means the same session needs no second SDK login')
})

test('reloading after the SDK reports logged out performs login again', async () => {
  const h = harness({ getLoginStatus: async () => 0 })
  const first = h.loadClient()
  const session = { userID: 'me', imToken: 'test-only' }
  const config = { api: 'https://api.test', ws: 'wss://ws.test' }
  const initialLogin = first.client.login(session, config)
  await h.finishLoading()
  await initialLogin

  await h.loadClient().client.login(session, config)

  assert.equal(h.statusCalls.length, 1)
  assert.equal(h.loginCalls.length, 2, 'a non-3 login status must cause another SDK login')
})

test('a different token is never treated as the authenticated session', async () => {
  const h = harness()
  const first = h.loadClient()
  const config = { api: 'https://api.test', ws: 'wss://ws.test' }
  const firstLogin = first.client.login({ userID: 'me', imToken: 'old-token' }, config)
  await h.finishLoading()
  await firstLogin

  await h.loadClient().client.login({ userID: 'me', imToken: 'new-token' }, config)

  assert.equal(h.statusCalls.length, 0, 'a different session key must not reuse old login status')
  assert.equal(h.loginCalls.length, 2)
})

test('a different server configuration is not treated as the authenticated session', async () => {
  const h = harness()
  const first = h.loadClient()
  const session = { userID: 'me', imToken: 'test-only' }
  const firstLogin = first.client.login(session, { api: 'https://api-one.test', ws: 'wss://ws-one.test' })
  await h.finishLoading()
  await firstLogin

  await h.loadClient().client.login(session, { api: 'https://api-two.test', ws: 'wss://ws-two.test' })

  assert.equal(h.statusCalls.length, 0, 'a changed server config must not reuse prior authentication')
  assert.equal(h.loginCalls.length, 2)
})

test('a failed SDK login clears the pending attempt so a later module can retry', async () => {
  const h = harness({ login: async (_options, attempt) => {
    if (attempt === 1)
      throw new Error('temporary SDK failure')
  } })
  const first = h.loadClient()
  const session = { userID: 'me', imToken: 'test-only' }
  const config = { api: 'https://api.test', ws: 'wss://ws.test' }
  const failed = first.client.login(session, config)
  await h.finishLoading()
  await assert.rejects(failed, /temporary SDK failure/)

  await h.loadClient().client.login(session, config)

  assert.equal(h.loginCalls.length, 2)
  assert.equal(h.statusCalls.length, 0, 'failed login must not mark the page session authenticated')
})

test('reloading during a timed out SDK login does not start a duplicate underlying login', async () => {
  let finishSDKLogin
  const h = harness({ login: () => new Promise(resolve => { finishSDKLogin = resolve }) })
  const first = h.loadClient()
  const session = { userID: 'me', imToken: 'test-only' }
  const config = { api: 'https://api.test', ws: 'wss://ws.test' }
  const initialLogin = first.client.login(session, config)
  await h.finishLoading()
  await settle()
  assert.equal(h.loginCalls.length, 1)

  const reloaded = h.loadClient()
  const retryLogin = reloaded.client.login(session, config)
  await settle()
  assert.equal(h.loginCalls.length, 1, 'the same pending key must share the in-flight SDK login')

  h.expireTimers(30000)
  const results = await Promise.allSettled([initialLogin, retryLogin])
  assert.deepEqual(results.map(result => result.status), ['rejected', 'rejected'])
  assert.equal(h.loginCalls.length, 1, 'timeout wrappers must not start a second SDK login')
  finishSDKLogin()
})
