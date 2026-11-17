import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAppearance, parseAppearance } from './preferences-model.ts'
test('appearance follows system only in auto mode', () => {
  assert.equal(resolveAppearance('auto', 'dark'), 'dark')
  assert.equal(resolveAppearance('light', 'dark'), 'light')
  assert.equal(resolveAppearance('dark', 'light'), 'dark')
})
test('invalid saved appearance safely uses system', () => {
  assert.equal(parseAppearance('broken'), 'auto')
  assert.equal(parseAppearance('dark'), 'dark')
})
