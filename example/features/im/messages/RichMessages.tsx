import React, { useState } from 'react'
import { Button, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler'
import type { ContactCard, IMMessage, LocationInput } from '../domain/types'
import { directory } from '../infrastructure/openim/directory-client'
import { locationURL, validateLocation } from './composer'

export function RichMessage ({ message, onError }: { message?: IMMessage, onError: (error: unknown) => void }) {
  const router = useRouter()
  const open = () => {
    if (message?.contentType === 108 && message.cardElem?.userID)
      router.push(`/chats/people/${encodeURIComponent(message.cardElem.userID)}`)
    if (message?.contentType === 109 && message.locationElem)
      try {
        void Linking.openURL(locationURL(message.locationElem)).catch(onError)
      } catch (error) {
        onError(error) 
      }
  }
  const gesture = useTapGesture({ runOnJS: true, cancelsTouchesInView: false, onDeactivate: event => {
    if (!event.canceled)
      open()
  } })
  if (![108, 109].includes(message?.contentType || 0))
    return null
  const label = message?.contentType === 108 ? '查看联系人资料' : '在地图中打开位置'
  return <GestureDetector gesture={gesture}>
    <View accessible accessibilityRole='button' accessibilityLabel={label} onAccessibilityTap={open} style={styles.card}>
      <Text style={styles.action}>{label} ›</Text>
      {message?.locationElem && <Text style={styles.coordinate}>{message.locationElem.latitude}, {message.locationElem.longitude}</Text>}
    </View>
  </GestureDetector>
}

export function RichComposer ({ onLocation, onCard }: {
  onLocation: (location: LocationInput) => Promise<void>
  onCard: (card: ContactCard) => Promise<void>
}) {
  const [mode, setMode] = useState<'location' | 'card'>()
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [label, setLabel] = useState('')
  const [userID, setUserID] = useState('')
  const [card, setCard] = useState<ContactCard>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (action: () => Promise<void>) => {
    if (busy)
      return
    setBusy(true)
    setError('')
    try {
      await action() 
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
    setBusy(false)
  }
  return <View>
    <View style={styles.actions}>
      <Button title='发送位置' onPress={() => {
        setMode('location'); setError('') 
      }}
      />
      <Button title='发送名片' onPress={() => {
        setMode('card'); setError('') 
      }}
      />
    </View>
    <Modal visible={!!mode} transparent animationType='fade' onRequestClose={() => {
      if (!busy) 
        setMode(undefined) 
    }}
    >
      <View style={styles.overlay}><ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps='handled'>
        <Text style={styles.title}>{mode === 'location' ? '发送位置' : '发送联系人名片'}</Text>
        {mode === 'location' ? <>
          <Text>手动填写经纬度，不读取设备定位。使用 WGS84 坐标。</Text>
          <TextInput accessibilityLabel='地点名称' placeholder='地点名称' value={label} onChangeText={setLabel} style={styles.input} />
          <TextInput accessibilityLabel='纬度' placeholder='纬度（-90～90）' value={latitude} onChangeText={setLatitude} style={styles.input} />
          <TextInput accessibilityLabel='经度' placeholder='经度（-180～180）' value={longitude} onChangeText={setLongitude} style={styles.input} />
          <Button title='发送此位置' disabled={busy} onPress={() => {
            void run(async () => {
              if (!latitude.trim() || !longitude.trim())
                throw new Error('请输入经度和纬度')
              await onLocation(validateLocation({ latitude: Number(latitude), longitude: Number(longitude), description: label }))
              setMode(undefined)
            }) 
          }}
          />
        </> : <>
          <TextInput accessibilityLabel='联系人 ID' placeholder='联系人 ID' value={userID} onChangeText={value => {
            setUserID(value); setCard(undefined) 
          }} style={styles.input}
          />
          <Button title='查找联系人' disabled={busy || !userID.trim()} onPress={() => {
            void run(async () => {
              const people = await directory.users(userID.trim())
              const person = people.find(item => item.userID === userID.trim())
              if (!person)
                throw new Error('未找到此联系人')
              setCard({ userID: person.userID, nickname: person.nickname || person.userID, faceURL: person.faceURL || '', ex: '' })
            }) 
          }}
          />
          {card && <><Text>{card.nickname} · {card.userID}</Text><Button title='发送此名片' disabled={busy} onPress={() => {
            void run(async () => {
              await onCard(card)
              setMode(undefined)
            }) 
          }}
          /></>}
        </>}
        {!!error && <Text accessibilityRole='alert' style={styles.error}>{error}</Text>}
        <Button title='取消' disabled={busy} onPress={() => setMode(undefined)} />
      </ScrollView></View>
    </Modal>
  </View>
}
const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'center' },
  card: { padding: 12, minWidth: 180 },
  action: { color: '#1565c0', fontWeight: '600' },
  coordinate: { color: '#555', marginTop: 6 },
  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 12, color: '#111' },
  error: { color: '#b42318' },
})
