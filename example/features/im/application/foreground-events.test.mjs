import assert from 'node:assert/strict'
import test from 'node:test'
import { watchNativeForeground, watchWebForeground } from './foreground-events.ts'

function target () {
  const listeners = new Map()
  return {
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
    emit: name => listeners.get(name)?.(),
    count: () => listeners.size,
  }
}

test('native foreground notifies once per inactive-to-active transition and unsubscribes', () => {
  const listeners = new Map()
  const appState = {
    currentState: 'active',
    addEventListener: (name, listener) => {
      listeners.set(name, listener)
      return { remove: () => listeners.delete(name) }
    },
  }
  let resumes = 0
  const unsubscribe = watchNativeForeground(appState, () => resumes++)
  listeners.get('change')('inactive')
  listeners.get('change')('active')
  listeners.get('change')('active')
  assert.equal(resumes, 1)
  unsubscribe()
  assert.equal(listeners.size, 0)
})

test('web visibility and focus events coalesce into one foreground transition', () => {
  const document = target()
  const window = target()
  document.visibilityState = 'visible'
  let resumes = 0
  const unsubscribe = watchWebForeground(document, window, () => resumes++)
  document.visibilityState = 'hidden'
  document.emit('visibilitychange')
  document.visibilityState = 'visible'
  document.emit('visibilitychange')
  window.emit('focus')
  assert.equal(resumes, 1)
  window.emit('blur')
  window.emit('focus')
  assert.equal(resumes, 2)
  unsubscribe()
  assert.equal(document.count(), 0)
  assert.equal(window.count(), 0)
})
