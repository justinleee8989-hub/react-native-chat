import type { IMMessage } from '../domain/types'

/** Bound inactive history only. Active/paging and unfinished sends own their full working set. */
export function trimMessageCache (source: Record<string, IMMessage[]>, activeID: string, oldestFirst: string[], loading: string[] = []) {
  const protectedIDs = new Set([activeID, ...loading])
  for (const [id, rows] of Object.entries(source))
    if (rows.some(row => row.status === 1 || row.status === 3))
      protectedIDs.add(id)
  const order = [...new Set([...Object.keys(source), ...oldestFirst])]
  // Explicit access order wins over object insertion order (including numeric IDs).
  order.sort((a, b) => oldestFirst.indexOf(a) - oldestFirst.indexOf(b))
  const retained = new Set([...protectedIDs].filter(id => source[id]))
  for (const id of order.reverse())
    if (source[id] && retained.size < 50)
      retained.add(id)
  let messages = source
  const truncated: string[] = []
  for (const [id, rows] of Object.entries(source)) {
    const next = !retained.has(id) ? undefined : protectedIDs.has(id) ? rows : rows.slice(0, 30)
    if (next && next.length === rows.length)
      continue
    if (messages === source)
      messages = { ...source }
    if (next)
      messages[id] = next
    else
      delete messages[id]
    truncated.push(id)
  }
  return { messages, truncated }
}
