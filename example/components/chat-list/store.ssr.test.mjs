import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToString } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)

function loadStore () {
  const source = readFileSync(new URL('./store.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  runInNewContext(outputText, {
    exports: module.exports,
    module,
    require: name => {
      // Native UI dependencies are irrelevant to these real React server-rendered hooks.
      if (name === '@kesha-antonov/react-native-chat')
        return { Chat: {} }
      if (name === './data')
        return { DIALOGS: [{ id: 'alice', title: 'Alice' }], INITIAL_MESSAGES: {}, ME: { _id: 'me' } }
      return require(name)
    },
  })
  return module.exports
}

test('demo dialog hooks support static server rendering, including unknown profile routes', () => {
  const store = loadStore()
  function Profile ({ id }) {
    const dialog = store.useDialog(id)
    const messages = store.useMessages(id)
    return React.createElement('span', null, `${dialog?.title || 'Missing'}:${messages.length}`)
  }
  assert.equal(renderToString(React.createElement(Profile, { id: 'alice' })), '<span>Alice:0</span>')
  assert.equal(renderToString(React.createElement(Profile, { id: 'unknown' })), '<span>Missing:0</span>')
})
