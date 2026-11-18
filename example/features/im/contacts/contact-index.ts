import { pinyin } from 'pinyin-pro'

/** The index bar's last entry: names that start with no letter (digits, symbols, emoji). */
export const OTHER_INITIAL = '#'

export type InitialSection<T> = { letter: string, items: T[] }

// Read as a name, so a surname with two readings takes its surname one: 曾 zeng, 单 shan, 解 xie.
const syllables = (name: string) =>
  pinyin(name, { toneType: 'none', surname: 'head', type: 'array' }) as string[]

/** A name's index letter: A–Z from its first syllable (pinyin for Chinese), otherwise '#'. */
export function initialOf (name: string) {
  const first = syllables(name.trim())[0]?.[0]?.toUpperCase() ?? ''
  return first >= 'A' && first <= 'Z' ? first : OTHER_INITIAL
}

const rank = (letter: string) => (letter === OTHER_INITIAL ? 26 : letter.charCodeAt(0) - 65)

/**
 * Items grouped under their name's index letter, A–Z then '#', each group in pinyin order (阿明
 * reads "aming", after "alice"). The full pinyin is the sort key, not `localeCompare(…, 'zh')`:
 * that order depends on the platform's collation data and differs between Hermes and browsers.
 */
export function groupByInitial<T> (items: T[], nameOf: (item: T) => string): InitialSection<T>[] {
  const keyed = items.map(item => {
    const name = nameOf(item).trim()
    return { item, name, letter: initialOf(name), key: syllables(name).join('').toLowerCase() }
  })
  // Plain code-point order on the pinyin key: the same result on every platform.
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  keyed.sort((a, b) =>
    rank(a.letter) - rank(b.letter) || compare(a.key, b.key) || compare(a.name, b.name))
  const sections: InitialSection<T>[] = []
  for (const { item, letter } of keyed) {
    const last = sections.at(-1)
    if (last?.letter === letter)
      last.items.push(item)
    else
      sections.push({ letter, items: [item] })
  }
  return sections
}
