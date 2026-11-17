/** Exhaust pages for counts; never present the first page as the total. */
export async function directorySummary<T> (load: (offset: number) => Promise<T[]>, current: () => boolean, include: (item: T) => boolean = () => true) {
  let offset = 0
  let count = 0
  while (current()) {
    const page = await load(offset)
    count += page.filter(include).length
    if (page.length < 30)
      break
    offset += page.length
  }
  return count
}
