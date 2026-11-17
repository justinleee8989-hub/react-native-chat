import { execFileSync } from 'child_process'
import path from 'path'

// The parser runs in Node so Jest does not compile the TypeScript tooling bundle.
const result = JSON.parse(execFileSync(process.execPath, [path.resolve(__dirname, '../../scripts/check-sdk-boundary.cjs')], { encoding: 'utf8' }))

it('keeps published SDK modules independent of application code and OpenIM adapters', () => {
  expect(result.imports).toEqual([])
})

it('does not require OpenIM packages when the chat UI library is installed', () => {
  expect(result.dependencies).toEqual([])
})
