import React, { useId, useMemo } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { chatThemeOf } from '../ui/chat-theme'
import { friendQRValue, qrPath } from './friend-qr'

// The modules in the app's own blue: the gradient of sent bubbles in the default chat theme, dark
// enough at both ends for a scanner against white (checked with ML Kit on a render).
const GRADIENT = chatThemeOf('default').light.gradient ?? ['#6E6BF2', '#0087F2']
// White around the code, in modules: scanners want a clear border.
const QUIET = 2
// The logo's share of the code's width; level H recovers up to 30% of the code.
const LOGO = 0.22

/**
 * The QR code of a user's 我的二维码 link, `size` wide: dark-on-white whatever the scheme (scanners
 * read that best), in a blue gradient, with the app logo in the middle. Drawn here rather than by a
 * QR library because those name every gradient alike, and on web a second code on screen (another
 * tab's page kept mounted) then borrows the first's definition and draws blank.
 */
export function FriendQRCode ({ userID, size }: { userID: string, size: number }) {
  const { size: modules, d } = useMemo(() => qrPath(friendQRValue(userID)), [userID])
  const gradient = `qr-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
  const box = modules + QUIET * 2
  const logo = Math.round(size * LOGO)
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`${-QUIET} ${-QUIET} ${box} ${box}`}>
        <Defs>
          <LinearGradient id={gradient} x1='0' y1='0' x2='1' y2='1'>
            <Stop offset='0' stopColor={GRADIENT[0]} />
            <Stop offset='1' stopColor={GRADIENT[GRADIENT.length - 1]} />
          </LinearGradient>
        </Defs>
        <Rect x={-QUIET} y={-QUIET} width={box} height={box} fill='#FFFFFF' />
        <Path d={d} fill={`url(#${gradient})`} />
      </Svg>
      <View pointerEvents='none' style={styles.center}>
        <View style={[styles.logoFrame, { width: logo + 6, height: logo + 6, borderRadius: logo * 0.3 }]}>
          {/* The app's own mark, as on the startup screen. */}
          <Image
            source={require('../../../assets/images/product-startup.png')}
            style={{ width: logo, height: logo, borderRadius: logo * 0.25 }}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  logoFrame: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
})
