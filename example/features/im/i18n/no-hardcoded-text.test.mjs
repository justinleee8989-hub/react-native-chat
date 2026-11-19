import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

// Every word on screen comes from i18n/zh.ts and en.ts. Chinese in a source file outside i18n/ is a
// text that the other languages cannot show; comments are fine, and a line that must keep its
// Chinese (a wire format other clients match) says so with `i18n-ignore`.
const root = fileURLToPath(new URL('..', import.meta.url))
// Chinese characters, and the full-width punctuation that goes with them (：，、～（）).
const han = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/

function sources (dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return entry.name === 'i18n' ? [] : sources(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : []
  })
}

function withoutComments (source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, block => block.replace(/[^\n]/g, ' '))
    .split('\n')
    .map(line => line.includes('i18n-ignore') ? '' : line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
}

test('no screen text is written outside the i18n tables', () => {
  const found = []
  for (const file of sources(root))
    withoutComments(readFileSync(file, 'utf8')).forEach((line, index) => {
      if (han.test(line))
        found.push(`${relative(root, file)}:${index + 1}: ${line.trim()}`)
    })
  assert.deepEqual(found, [], `Move these texts into i18n/zh.ts and en.ts:\n${found.join('\n')}`)
})
