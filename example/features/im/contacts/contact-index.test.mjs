import assert from 'node:assert/strict'
import test from 'node:test'
import { groupByInitial, initialOf } from './contact-index.ts'

test('a name indexes under the first letter of its pinyin, or of itself', () => {
  assert.equal(initialOf('张三'), 'Z')
  assert.equal(initialOf('alice'), 'A')
  assert.equal(initialOf('Bob'), 'B')
  assert.equal(initialOf('  欧阳'), 'O')
  // Surnames with two readings take the surname one.
  assert.equal(initialOf('曾小明'), 'Z')
  assert.equal(initialOf('单田芳'), 'S')
  assert.equal(initialOf('解晓东'), 'X')
})

test('names that start with no letter go under #', () => {
  for (const name of ['123', '_qa', '😀 smile', ''])
    assert.equal(initialOf(name), '#', name)
})

test('groups run A–Z then #, each in pinyin order, mixing Chinese and Latin', () => {
  const names = ['张三', 'Bob', '#hash', '阿明', 'alice', '李四', '曾小明', '张伟', '9lives', 'Charlie']
  const sections = groupByInitial(names, name => name)
  assert.deepEqual(sections.map(section => section.letter), ['A', 'B', 'C', 'L', 'Z', '#'])
  assert.deepEqual(sections.find(section => section.letter === 'A').items, ['alice', '阿明'])
  assert.deepEqual(sections.find(section => section.letter === 'Z').items, ['曾小明', '张三', '张伟'])
  assert.deepEqual(sections.at(-1).items, ['#hash', '9lives'])
})
