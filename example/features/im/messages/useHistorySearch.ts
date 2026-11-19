import { useCallback, useEffect, useRef, useState } from 'react'
import { loadServerHistory } from '../application/store'
import { mergeMessages } from '../domain/model'
import type { IMMessage } from '../domain/types'
import { useT } from '../i18n'
import { errorMessage } from '../shared/error-message'
import { ProductError } from '../shared/product-error'

/** Each edit invalidates in-flight pages, including failures from an older keyword. */
export function useHistorySearch (id: string) {
  const tr = useT()
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')
  const [messages, setMessages] = useState<IMMessage[]>([])
  const [cursor, setCursor] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  // The failure itself, put into words on each render, so it follows a change of language.
  const [failure, setFailure] = useState<unknown>()
  const revision = useRef(0)
  const alive = useRef(false)
  const pending = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      revision.current += 1
      clearTimeout(timer.current)
    }
  }, [])
  const request = useCallback(async (keyword: string, nextCursor: string, more: boolean, version: number) => {
    if (!keyword)
      return
    pending.current = true
    setBusy(true)
    setFailure(undefined)
    const current = () => alive.current && revision.current === version
    try {
      const result = await loadServerHistory({ conversationID: id, query: keyword, cursor: nextCursor })
      if (current()) {
        setMessages(previous => more ? mergeMessages(previous, result.messages) : result.messages)
        setCursor(result.cursor)
        setHasMore(result.hasMore)
        setSearched(keyword)
      }
    } catch (failure) {
      if (current())
        setFailure(failure || new ProductError('search.failed'))
    }
    if (current()) {
      pending.current = false
      setBusy(false)
    }
  }, [id])
  const changeQuery = (value: string) => {
    setQuery(value)
    const version = ++revision.current
    clearTimeout(timer.current)
    pending.current = false
    setBusy(false)
    setMessages([])
    setCursor('')
    setHasMore(false)
    setSearched('')
    setFailure(undefined)
    timer.current = setTimeout(() => {
      void request(value.trim(), '', false, version)
    }, 300)
  }
  const search = (more = false) => {
    clearTimeout(timer.current)
    if (pending.current)
      return
    void request(more ? searched : query.trim(), more ? cursor : '', more, revision.current)
  }
  return { query, setQuery: changeQuery, searched, messages, hasMore, busy, error: failure ? errorMessage(failure, tr) : '', search }
}
