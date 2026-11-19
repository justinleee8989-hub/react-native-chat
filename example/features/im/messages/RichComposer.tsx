import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { directory } from '../application/directory'
import { useOpenIM } from '../application/store'
import { mergeDirectory, type Person } from '../domain/directory'
import type { ContactCard, LocationInput } from '../domain/types'
import { SettingField as ProductField } from '../groups/group-ui'
import { useT } from '../i18n'
import { ProductError } from '../shared/product-error'
import { useTask } from '../shared/useTask'
import { ProductAvatar, ProductButton, ProductCard } from '../ui/primitives'
import { ProductListRow } from '../ui/ProductListRow'
import { ProductSection } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { validateLocation } from './composer'
import { ProductPickerModal } from './ProductPickerModal'

type Props = {
  renderTrigger?: (open: (mode: 'location' | 'card') => void) => React.ReactNode
  onLocation: (location: LocationInput) => Promise<void>
  onCard: (card: ContactCard) => Promise<void>
}
export function RichComposer (props: Props) {
  const { session } = useOpenIM()
  return <SessionRichComposer key={`${session?.userID}:${session?.imToken}`} {...props} />
}
function SessionRichComposer ({ renderTrigger, onLocation, onCard }: Props) {
  const tr = useT()
  const [mode, setMode] = useState<'location' | 'card'>()
  return (
    <>
      {renderTrigger ? (
        renderTrigger(setMode)
      ) : (
        <View>
          <Pressable onPress={() => setMode('location')}>
            <Text>{tr('location.send')}</Text>
          </Pressable>
          <Pressable onPress={() => setMode('card')}>
            <Text>{tr('card.send')}</Text>
          </Pressable>
        </View>
      )}
      {mode === 'location' && (
        <LocationPicker onClose={() => setMode(undefined)} onSend={onLocation} />
      )}
      {mode === 'card' && <CardPicker onClose={() => setMode(undefined)} onSend={onCard} />}
    </>
  )
}
function LocationPicker ({ onClose, onSend }: { onClose: () => void, onSend: Props['onLocation'] }) {
  const tr = useT()
  const t = useProductTheme()
  const task = useTask()
  const [label, setLabel] = useState(''),
        [latitude, setLatitude] = useState(''),
        [longitude, setLongitude] = useState('')
  return (
    <ProductPickerModal title={tr('location.send')} onClose={onClose} busy={task.busy}>
      <ScrollView keyboardShouldPersistTaps='handled'>
        <ProductSection>{tr('location.manualHint')}</ProductSection>
        <View style={{ marginHorizontal: 16 }}>
          <ProductCard>
            <ProductField
              label={tr('location.name')}
              placeholder={tr('location.namePlaceholder')}
              value={label}
              onChangeText={setLabel}
            />
            <ProductField
              label={tr('location.latitude')}
              placeholder={tr('location.latitudeRange')}
              value={latitude}
              onChangeText={setLatitude}
            />
            <ProductField
              label={tr('location.longitude')}
              placeholder={tr('location.longitudeRange')}
              value={longitude}
              onChangeText={setLongitude}
            />
          </ProductCard>
          <View style={{ height: 24 }} />
          <ProductButton
            title={tr('location.sendThis')}
            disabled={task.busy}
            onPress={() => {
              void task.run(async current => {
                if (!latitude.trim() || !longitude.trim())
                  throw new ProductError('location.invalid')
                await onSend(
                  validateLocation({
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                    description: label.trim() || tr('composer.location'),
                  })
                )
                if (current())
                  onClose()
              })
            }}
          />
          {!!task.error && (
            <Text accessibilityRole='alert' style={{ color: t.danger, padding: 16 }}>
              {task.error}
            </Text>
          )}
        </View>
      </ScrollView>
    </ProductPickerModal>
  )
}
function CardPicker ({ onClose, onSend }: { onClose: () => void, onSend: Props['onCard'] }) {
  const tr = useT()
  const t = useProductTheme(),
        task = useTask(),
        load = useTask()
  const [people, setPeople] = useState<Person[]>([])
  const [offset, setOffset] = useState(0),
        [more, setMore] = useState(true)
  const { run } = load
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
    <ProductPickerModal title={tr('card.choose')} onClose={onClose} busy={task.busy}>
      <ScrollView keyboardShouldPersistTaps='handled'>
        {people.map((person, index) => (
          <ProductListRow
            key={person.userID}
            backgroundColor='transparent'
            small
            last={index === people.length - 1}
            title={person.remark || person.nickname || person.userID}
            subtitle={person.userID}
            leading={
              <ProductAvatar
                id={person.userID}
                title={person.nickname || person.userID}
                uri={person.faceURL}
                size={44}
              />
            }
            onPress={() => {
              void task.run(async current => {
                await onSend({
                  userID: person.userID,
                  nickname: person.nickname || person.userID,
                  faceURL: person.faceURL || '',
                  ex: '',
                })
                if (current())
                  onClose()
              })
            }}
          />
        ))}
        {!people.length && !load.busy && !load.error && (
          <Text style={{ textAlign: 'center', color: t.text3, paddingVertical: 72 }}>{tr('card.noFriends')}</Text>
        )}
        {load.busy && <ActivityIndicator color={t.accent} />}
        {!!(task.error || load.error) && (
          <Text accessibilityRole='alert' style={{ color: t.danger, padding: 16 }}>
            {task.error || load.error}
          </Text>
        )}
        {(more || !!load.error) && (
          <Pressable
            disabled={load.busy || task.busy}
            onPress={() => {
              void run(async current => {
                const page = await directory.friends(offset)
                if (current()) {
                  setPeople(previous => mergeDirectory(previous, page, person => person.userID))
                  setOffset(offset + page.length)
                  setMore(page.length === 30)
                }
              })
            }}
            style={{ padding: 16 }}
          >
            <Text style={{ textAlign: 'center', color: t.accent }}>
              {load.error ? tr('card.retryFriends') : tr('friendPicker.loadMore')}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </ProductPickerModal>
  )
}
