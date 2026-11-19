import assert from 'node:assert/strict'
import test from 'node:test'
import { en } from './en.ts'
import { parseLanguageChoice, resolveLanguage, translate, translatorFor } from './translate.ts'
import { zh } from './zh.ts'

test('the user pick wins, else the first system language the app has, else Chinese', () => {
  assert.equal(resolveLanguage('en', ['zh-Hans-CN']), 'en')
  assert.equal(resolveLanguage('auto', ['fr-FR', 'en-GB', 'zh-CN']), 'en')
  assert.equal(resolveLanguage('auto', ['zh-Hant-TW']), 'zh')
  assert.equal(resolveLanguage('auto', ['fr-FR']), 'zh')
  assert.equal(resolveLanguage('auto', []), 'zh')
})

test('a saved choice outside the known ones reads as following the system', () => {
  assert.equal(parseLanguageChoice('en'), 'en')
  assert.equal(parseLanguageChoice('fr'), 'auto')
  assert.equal(parseLanguageChoice(null), 'auto')
})

test('params fill placeholders and a missing param leaves its placeholder', () => {
  assert.equal(translate('zh', 'error.generic'), zh['error.generic'])
  assert.equal(translate('en', 'notice.revoked', { name: 'Bob' }), 'Bob recalled a message')
  assert.equal(translate('en', 'notice.revoked'), '{name} recalled a message')
})

test('every language has every key and nothing more', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
  for (const [key, value] of Object.entries(en))
    assert.ok(typeof value === 'function' || value.trim(), key)
})

test('one translator per language, so memoised screens recompute only when it changes', () => {
  assert.equal(translatorFor('en'), translatorFor('en'))
  assert.notEqual(translatorFor('en'), translatorFor('zh'))
})
