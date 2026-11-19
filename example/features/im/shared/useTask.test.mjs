import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { withI18n, zhT } from '../i18n/test-modules.mjs'
import { errorMessage } from './error-message.ts'
import { ProductError } from './product-error.ts'

function harness () {
  const values = []
  const react = { useCallback: fn => fn, useRef: value => ({ current: value }), useEffect: fn => fn(),
    useState: value => { const i = values.push(value) - 1; return [value, next => { values[i] = next }] } }
  function load (url) {
    const exports = {}
    runInNewContext(ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
      exports, require: name => name === 'react' ? react : name === '../i18n' ? { useT: () => zhT } : withI18n(dep => load(new URL(dep.endsWith('.ts') ? dep : `${dep}.ts`, url)))(name),
    })
    return exports
  }
  return { task: load(new URL('./useTask.ts', import.meta.url)).useTask(), values }
}
test('missing user is a Chinese recovery prompt, never a backend stack trace', async () => {
  const { task, values } = harness()
  await task.run(async () => { throw { errMsg: 'error *stack.stackError not implement CodeError: Error: 10100 User ID not found /openim/internal/rpc/user/user.go:42' } })
  assert.equal(errorMessage(values[1], zhT), '未找到用户，请检查用户 ID')
  assert.equal(values[0], false)
})
test('unknown internal error hides paths and leaves retry enabled', async () => {
  const { task, values } = harness()
  await task.run(async () => { throw { errMsg: 'rpc error: code = Internal desc = database failed /workspace/private.go:20' } })
  assert.equal(errorMessage(values[1], zhT), '操作失败，请稍后重试')
  assert.equal(values[0], false)
})
test('the app\'s own failure is said in the current language', async () => {
  const { task, values } = harness()
  await task.run(async () => { throw new ProductError('manage.enterName') })
  assert.equal(errorMessage(values[1], zhT), '请输入群名称')
})

test('first failure is not successful data and later success survives refresh failure', async () => {
  const { task, values } = harness()
  assert.equal(values[2], false)
  await task.run(async () => { throw new Error('暂时失败') })
  assert.equal(values[2], false)
  await task.run(async () => {})
  assert.equal(values[2], true)
  await task.run(async () => { throw new Error('刷新失败') })
  assert.equal(values[2], true)
})
