import test from 'node:test'
import assert from 'node:assert/strict'
import { requestCallToken } from './token-api.ts'

const session = { userID: 'user-test-42', chatToken: 'chat-token-test-only' }
const baseURL = 'https://chat.example.test/'
const success = {
  errCode: 0,
  data: { serverUrl: 'wss://rtc.example.test', token: 'jwt-test-only' },
}

function mockResponse(body, { ok = true } = {}) {
  return { ok, json: async () => body }
}

test('requests a token with the chat token and session user identity', async () => {
  let requestURL
  let requestOptions
  const request = async (url, options) => {
    requestURL = url
    requestOptions = options
    return mockResponse(success)
  }

  assert.deepEqual(await requestCallToken(session, 'imcall-test-room', baseURL, request), success.data)
  assert.equal(requestURL, 'https://chat.example.test/user/rtc/get_token')
  assert.equal(requestOptions.method, 'POST')
  assert.equal(requestOptions.headers.token, session.chatToken)
  assert.deepEqual(JSON.parse(requestOptions.body), {
    room: 'imcall-test-room',
    identity: session.userID,
  })
})

test('requires a chat token without making a request', async () => {
  let called = false
  await assert.rejects(
    requestCallToken({ userID: session.userID }, 'room', baseURL, async () => {
      called = true
      return mockResponse(success)
    }),
    /重新登录/,
  )
  assert.equal(called, false)
})

test('rejects a non-200 response', async () => {
  await assert.rejects(requestCallToken(session, 'room', baseURL, async () => mockResponse(success, { ok: false })))
})

test('rejects an API error code and uses its message', async () => {
  await assert.rejects(
    requestCallToken(session, 'room', baseURL, async () => mockResponse({ errCode: 17, errMsg: 'token denied', data: success.data })),
    /token denied/,
  )
})

test('rejects missing token or server URL', async () => {
  for (const data of [{ serverUrl: success.data.serverUrl }, { token: success.data.token }]) {
    await assert.rejects(requestCallToken(session, 'room', baseURL, async () => mockResponse({ errCode: 0, data })))
  }
})
