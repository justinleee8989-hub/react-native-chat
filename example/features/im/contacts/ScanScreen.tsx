import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, StyleSheet, Text, View } from 'react-native'
import { type Href, useFocusEffect, useNavigation, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scanQRInPhoto } from '../application/scan-photo'
import { useT } from '../i18n'
import { ProductToast, showProductToast } from '../shared/ProductToast'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductPressable as Pressable } from '../ui/ProductPressable'
import { userIDFromQR } from './friend-qr'
import { QRScanner } from './QRScanner'

// The same wrong code stays in view and is read many times a second: say so once a while.
const NOTICE_GAP = 2000

type LeavingEvent = { data?: { closing?: boolean } }
interface NavigationWithLeaving {
  addListener: (event: 'transitionStart' | 'gestureCancel', listener: (event: LeavingEvent) => void) => () => void
  getParent?: () => NavigationWithLeaving | undefined
}

/**
 * True from the moment this page starts to close (back, a swipe back, or a code that opens a
 * profile) until a swipe back is given up. Focus is lost only when the closing ends, and the camera
 * would run through the whole animation. The page is pushed in its own stack or arrives as the
 * first page of one, so both stacks are listened to.
 */
function useLeaving () {
  const navigation = useNavigation() as unknown as NavigationWithLeaving | undefined
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (!navigation?.addListener)
      return
    const navigators = [navigation, navigation.getParent?.()].filter(Boolean) as NavigationWithLeaving[]
    const unsubscribes = navigators.flatMap(nav => [
      nav.addListener('transitionStart', event => {
        if (event?.data?.closing)
          setLeaving(true)
      }),
      nav.addListener('gestureCancel', () => setLeaving(false)),
    ])
    return () => unsubscribes.forEach(unsubscribe => unsubscribe())
  }, [navigation])
  return leaving
}

/**
 * 扫一扫: the camera with a viewfinder. A 我的二维码 code opens that user's profile, where a friend
 * request is sent; any other code is reported and scanning goes on. 相册 reads a code from a photo. The camera runs only while
 * this page is in front and the app is active, and stops as soon as the page starts to close.
 */
export default function ScanScreen () {
  const tr = useT()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [focused, setFocused] = useState(false)
  const [foreground, setForeground] = useState(AppState.currentState === 'active')
  const leaving = useLeaving()
  const handled = useRef(false)
  const lastNotice = useRef(0)
  useFocusEffect(useCallback(() => {
    handled.current = false
    setFocused(true)
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'))
    return () => {
      setFocused(false)
      subscription.remove()
    }
  }, []))
  const back = () => {
    if (router.canGoBack())
      router.back()
    else
      router.replace('/(tabs)/contacts' as Href)
  }
  const scanned = (value: string) => {
    if (handled.current)
      return
    const userID = userIDFromQR(value)
    if (userID) {
      handled.current = true
      router.replace(`/chats/people/${encodeURIComponent(userID)}` as Href)
      return
    }
    if (Date.now() - lastNotice.current > NOTICE_GAP) {
      lastNotice.current = Date.now()
      showProductToast(tr('scan.notFriendCode'))
    }
  }
  const fromPhoto = () => {
    void scanQRInPhoto().then(value => {
      if (value === undefined)
        return
      if (!value)
        showProductToast(tr('scan.noCodeInPhoto'))
      else
        scanned(value)
    }, () => showProductToast(tr('scan.photoUnreadable')))
  }
  return (
    <View style={styles.page}>
      <QRScanner active={focused && foreground && !leaving} onScanned={scanned} />
      <View pointerEvents='none' style={styles.overlay}>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <Text style={styles.hint}>{tr('scan.hint')}</Text>
      </View>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole='button' accessibilityLabel={tr('common.back')} onPress={back} style={styles.back}>
          <ProductIcon name='back' color='#FFFFFF' />
        </Pressable>
        <Text style={styles.title}>{tr('contacts.scan')}</Text>
        <View style={styles.back} />
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable accessibilityRole='button' accessibilityLabel={tr('scan.fromPhoto')} onPress={fromPhoto} style={styles.album}>
          <View style={styles.albumIcon}>
            <ProductIcon name='image' color='#FFFFFF' />
          </View>
          <Text style={styles.albumText}>{tr('scan.album')}</Text>
        </Pressable>
      </View>
      <ProductToast />
    </View>
  )
}

const CORNER = 28
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  // A scrim under the white title and back button, which a bright camera image would hide.
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 6, backgroundColor: '#00000059' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '500', textAlign: 'center' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 24 },
  frame: { width: 240, height: 240 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#FFFFFF' },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  hint: { color: '#FFFFFFCC', fontSize: 14, lineHeight: 20 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  album: { alignItems: 'center', gap: 6 },
  albumIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF33' },
  albumText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18 },
})
