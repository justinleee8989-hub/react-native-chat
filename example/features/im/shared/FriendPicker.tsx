import React, { useEffect, useState } from 'react'
import { directory } from '@/features/im/application/directory'
import { mergeDirectory, type Person } from '@/features/im/domain/directory'
import { useTask } from '@/features/im/shared/useTask'
import { Action, Label, PersonRow } from './shared'

export function FriendPicker ({
  selected,
  onChange,
  disabled = false,
  excluded = [],
}: {
  excluded?: string[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const [people, setPeople] = useState<Person[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(true)
  const { run, busy, error } = useTask()
  useEffect(() => {
    void run(async current => {
      const page = await directory.friends()
      if (current()) {
        setPeople(page)
        setOffset(page.length)
        setMore(page.length === 30)
      }
    })
  }, [run])
  return (
    <>
      <Label>选择好友 · 已选 {selected.length} 人</Label>
      {!!error && <Label>{error}</Label>}
      {people
        .filter(person => !excluded.includes(person.userID))
        .map(person => (
          <PersonRow key={person.userID} person={person}>
            <Action
              title={selected.includes(person.userID) ? '✓ 已选择' : '选择'}
              disabled={disabled}
              onPress={() =>
                onChange(
                  selected.includes(person.userID)
                    ? selected.filter(id => id !== person.userID)
                    : [...selected, person.userID]
                )
              }
            />
          </PersonRow>
        ))}
      {!busy && !people.length && <Label>暂无好友可选择</Label>}
      {more && (
        <Action
          title={busy ? '加载中…' : '加载更多好友'}
          disabled={busy || disabled}
          onPress={() => {
            void run(async current => {
              const page = await directory.friends(offset)
              if (current()) {
                setPeople(items => mergeDirectory(items, page, item => item.userID))
                setOffset(offset + page.length)
                setMore(page.length === 30)
              }
            })
          }}
        />
      )}
    </>
  )
}
