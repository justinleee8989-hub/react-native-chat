import React, { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { chatThemeOf } from '../../ui/chat-theme'
import { useProductScheme } from '../../ui/preferences'
import { ProductIcon } from '../../ui/ProductIcon'

/** What the login form is doing, which the sprite acts out. */
export type AuthMood = 'idle' | 'email' | 'password' | 'peek' | 'busy' | 'error'

// The web has no native animation driver: asking for it only logs a warning on every run.
const nativeDriver = Platform.OS !== 'web'
// The square in the app's own blue: the gradient of sent bubbles in the default chat theme.
const GRADIENT = chatThemeOf('default').light.gradient ?? ['#6E6BF2', '#0087F2']
const SIZE = 60

/** A pose: shift x, y (points), turn (degrees), stretch x, y. */
type Pose = [number, number, number, number, number]
/** A move: [time 0…1, ...pose] stops, played over `ms`. */
type Move = { ms: number, loop?: boolean, frames: [number, ...Pose][] }

const still: Pose = [0, 0, 0, 1, 1]
type MoveName = 'hop' | 'flip' | 'peekLeft' | 'peekRight' | 'wiggle' | 'spin' | 'tiptoe' | 'tilt' | 'stretch'
  | 'nod' | 'bounce' | 'shiver' | 'sneak' | 'shake'
const moves: Record<MoveName, Move> = {
  hop: { ms: 460, frames: [[0, ...still], [0.22, 0, 2, 0, 1.2, 0.8], [0.48, 0, -12, 0, 0.88, 1.14], [0.76, 0, 1, 0, 1.16, 0.84], [1, ...still]] },
  flip: { ms: 580, frames: [[0, ...still], [0.18, 0, 2, 0, 1.22, 0.78], [0.52, 0, -17, -360, 0.9, 1.12], [0.8, 0, 1, -360, 1.2, 0.8], [1, 0, 0, -360, 1, 1]] },
  peekLeft: { ms: 1150, frames: [[0, ...still], [0.1, 1.5, 1, 0, 1.06, 0.94], [0.2, -9, 0, -26, 1, 1], [0.5, -9.6, -0.6, -28, 1, 1], [0.78, -9, 0, -26, 1, 1], [0.9, 1.6, 0, 7, 1, 1], [1, ...still]] },
  peekRight: { ms: 1150, frames: [[0, ...still], [0.1, -1.5, 1, 0, 1.06, 0.94], [0.2, 9, 0, 26, 1, 1], [0.5, 9.6, -0.6, 28, 1, 1], [0.78, 9, 0, 26, 1, 1], [0.9, -1.6, 0, -7, 1, 1], [1, ...still]] },
  wiggle: { ms: 720, frames: [[0, ...still], [0.12, -2, 0, -18, 1, 1], [0.28, 2, 0, 16, 1, 1], [0.44, -1.5, 0, -14, 1, 1], [0.6, 1.5, 0, 12, 1, 1], [0.78, 0, 0, -5, 1, 1], [1, ...still]] },
  spin: { ms: 500, frames: [[0, ...still], [0.5, 0, -2, 180, 0.94, 1.06], [1, 0, 0, 360, 1, 1]] },
  // Tiptoes off to the left in steps, looks back over its shoulder, and darts home.
  tiptoe: { ms: 1300, frames: [[0, ...still], [0.1, -2.5, -3, -9, 1, 1], [0.2, -4.5, 0, -3, 1.07, 0.93], [0.3, -6.5, -3, -9, 1, 1], [0.4, -8, 0, -3, 1.07, 0.93], [0.52, -8, 0, -18, 1, 1], [0.6, -8, 0, -18, 1, 1], [0.68, -8, 0, 10, 1, 1], [0.74, -8, 0, 10, 1, 1], [0.88, 1.5, -2, 5, 1, 1], [1, ...still]] },
  tilt: { ms: 1100, frames: [[0, ...still], [0.14, 0, 1.5, 0, 1.06, 0.94], [0.28, 1.5, -2, 24, 1, 1], [0.44, 1.8, -2.8, 30, 1, 1], [0.56, 1.5, -2, 22, 1, 1], [0.7, 1.5, -2, 24, 1, 1], [0.84, 0, 0, -6, 1, 1], [1, ...still]] },
  stretch: { ms: 1400, frames: [[0, ...still], [0.18, 0, 2, 0, 1.14, 0.84], [0.42, 0, -4, 0, 0.85, 1.22], [0.53, 0, -4.6, 4, 0.83, 1.24], [0.64, 0, -4, 0, 0.85, 1.22], [0.8, 0, 1, 0, 1.1, 0.9], [1, ...still]] },
  // Each letter typed: a nod.
  nod: { ms: 220, frames: [[0, ...still], [0.4, 0, 3.5, 0, 1.12, 0.88], [1, ...still]] },
  // Connecting: hops from foot to foot, squashed on each landing.
  bounce: { ms: 900, loop: true, frames: [[0, 0, 0, -10, 1.2, 0.82], [0.1, 0, -9, -4, 0.94, 1.08], [0.25, 0, -14, 0, 0.9, 1.12], [0.4, 0, -9, 4, 0.94, 1.08], [0.5, 0, 0, 10, 1.2, 0.82], [0.6, 0, -9, 4, 0.94, 1.08], [0.75, 0, -14, 0, 0.9, 1.12], [0.9, 0, -9, -4, 0.94, 1.08], [1, 0, 0, -10, 1.2, 0.82]] },
  // Turned away from the password: a giggly shiver.
  shiver: { ms: 160, loop: true, frames: [[0, ...still], [0.5, 0.8, 0, 0, 1, 1], [1, ...still]] },
  // The password shown: leans in to look, then snaps back as if caught.
  sneak: { ms: 1500, loop: true, frames: [[0, ...still], [0.3, -5, 1, -14, 1.04, 0.96], [0.52, -5, 1, -14, 1.04, 0.96], [0.6, 4, 2.5, 14, 0.9, 1], [0.78, ...still], [1, ...still]] },
  // Wrong account or password: shakes its head before slumping.
  shake: { ms: 620, frames: [[0, ...still], [0.1, -4, 0, -28, 1, 1], [0.24, 4, 0, 26, 1, 1], [0.38, -3, 0, -18, 1, 1], [0.52, 3, 0, 12, 1, 1], [0.66, -1, 0, -5, 1, 1], [1, ...still]] },
}
const idleMoves: MoveName[] = ['peekLeft', 'peekRight', 'hop', 'flip', 'wiggle', 'spin', 'tiptoe', 'tilt', 'stretch']

// The pose each state holds, with the move it plays from there.
function poseOf (mood: AuthMood, typed: number): Pose {
  // Over the email it slides along under the text as it grows.
  const lean = -4 + Math.min(typed, 26) / 26 * 8
  switch (mood) {
    case 'email': return [lean * 1.2, 4, lean * 4, 1.05, 0.95]
    case 'password': return [7, 3, 32, 0.88, 0.88]
    case 'peek': return [-4, -2, -16, 1.04, 1.04]
    case 'error': return [0, 5, -8, 1.1, 0.86]
    default: return still
  }
}
const moodMove: Partial<Record<AuthMood, MoveName>> = { busy: 'bounce', password: 'shiver', peek: 'sneak', error: 'shake' }

const between = (min: number, max: number) => min + Math.random() * (max - min)

function useReducedMotion () {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let live = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => live && setReduced(value))
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      live = false
      subscription.remove()
    }
  }, [])
  return reduced
}

/**
 * The login page's mark: the chat bubble on the app's gradient square, with two eyes, played as a
 * little sprite. The face never changes; it says everything with its body. Left alone it picks a
 * random move every second or two (peeks, hops, flips, tiptoes, stretches); as the form is used it
 * leans over the email, turns away from the password, peeks when it is shown, hops while
 * connecting, and shakes its head and slumps when the sign-in fails. Still, in each pose, when the
 * system asks for reduced motion. `typed` is the email's length: each letter is a nod.
 */
export function AuthMascot ({ mood = 'idle', typed = 0 }: { mood?: AuthMood, typed?: number }) {
  const light = useProductScheme() === 'light'
  const gradient = `mark-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
  const reduced = useReducedMotion()
  const [breath] = useState(() => new Animated.Value(0))
  const [blink] = useState(() => new Animated.Value(1))
  const [progress] = useState(() => new Animated.Value(0))
  const [pose] = useState(() => still.map(value => new Animated.Value(value)))
  const [move, setMove] = useState<MoveName>()
  const playing = useRef<Animated.CompositeAnimation>(undefined)

  const play = useEffectEvent((name: MoveName | undefined) => {
    playing.current?.stop()
    playing.current = undefined
    setMove(name)
    progress.setValue(0)
    if (!name || reduced)
      return
    const run = Animated.timing(progress, { toValue: 1, duration: moves[name].ms, easing: Easing.linear, useNativeDriver: nativeDriver })
    playing.current = moves[name].loop ? Animated.loop(run) : run
    playing.current.start(({ finished }) => finished && !moves[name].loop && setMove(undefined))
  })

  // Breathing, always.
  useEffect(() => {
    if (reduced)
      return
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
      Animated.timing(breath, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
    ]))
    animation.start()
    return () => animation.stop()
  }, [breath, reduced])

  // Springs into the state's pose and plays its move; a new letter in the email is a nod.
  const key = poseOf(mood, typed).join()
  useEffect(() => {
    const values = key.split(',').map(Number)
    pose.forEach((value, index) => reduced
      ? value.setValue(values[index])
      : Animated.spring(value, { toValue: values[index], friction: 5, tension: 140, useNativeDriver: nativeDriver }).start())
  }, [key, pose, reduced])
  useEffect(() => play(moodMove[mood]), [mood, reduced])
  const nod = useEffectEvent(() => mood === 'email' && play('nod'))
  useEffect(() => {
    if (typed)
      nod()
  }, [typed])

  // Left alone: a random move, never the same twice in a row, every second or two.
  useEffect(() => {
    if (mood !== 'idle' || reduced)
      return
    let last: MoveName | undefined
    let timer: ReturnType<typeof setTimeout>
    const next = () => {
      timer = setTimeout(() => {
        const choices = idleMoves.filter(name => name !== last)
        last = choices[Math.floor(Math.random() * choices.length)]
        play(last)
        next()
      }, between(1100, 2300) + (last ? moves[last].ms : 0))
    }
    next()
    return () => clearTimeout(timer)
  }, [mood, reduced])

  // A blink every few seconds, sometimes two; not while it turns away with its eyes shut tight.
  useEffect(() => {
    if (reduced || mood === 'password')
      return
    const shut = () => Animated.sequence([
      Animated.timing(blink, { toValue: 0.08, duration: 70, useNativeDriver: nativeDriver }),
      Animated.timing(blink, { toValue: 1, duration: 70, useNativeDriver: nativeDriver }),
    ])
    let timer: ReturnType<typeof setTimeout>
    const next = () => {
      timer = setTimeout(() => {
        (Math.random() < 0.25 ? Animated.sequence([shut(), Animated.delay(90), shut()]) : shut()).start()
        next()
      }, between(1600, 4200))
    }
    next()
    return () => clearTimeout(timer)
  }, [blink, mood, reduced])

  useEffect(() => () => playing.current?.stop(), [])
  // A tap on it, left alone: a flip.
  const [taps, setTaps] = useState(0)
  useEffect(() => {
    if (taps)
      play('flip')
  }, [taps])

  const frames = move ? moves[move].frames : [[0, ...still], [1, ...still]] as [number, ...Pose][]
  const channel = (index: number, unit = '') => progress.interpolate({
    inputRange: frames.map(frame => frame[0]),
    outputRange: frames.map(frame => unit ? `${frame[index + 1]}${unit}` : frame[index + 1]),
  }) as Animated.AnimatedInterpolation<number>
  const transform = (values: (Animated.Value | Animated.AnimatedInterpolation<number> | Animated.AnimatedInterpolation<string>)[]) => [
    { translateX: values[0] },
    { translateY: values[1] },
    { rotate: values[2] },
    { scaleX: values[3] },
    { scaleY: values[4] },
  ] as never
  const turn = pose[2].interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] })

  return (
    <Pressable
      accessible={false}
      onPress={() => mood === 'idle' && setTaps(count => count + 1)}
      style={[styles.mark, light && styles.shadow]}
    >
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradient} x1='0' y1='0' x2='1' y2='1'>
            <Stop offset='0' stopColor={GRADIENT[0]} />
            <Stop offset='1' stopColor={GRADIENT[GRADIENT.length - 1]} />
          </LinearGradient>
        </Defs>
        <Rect width={SIZE} height={SIZE} rx={18} fill={`url(#${gradient})`} />
      </Svg>
      <Animated.View
        style={[styles.layer, {
          transform: [
            { scaleX: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) },
            { scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.955] }) },
          ],
        }]}
      >
        <Animated.View style={[styles.layer, { transform: transform([pose[0], pose[1], turn, pose[3], pose[4]]) }]}>
          <Animated.View style={[styles.layer, { transform: transform([channel(0), channel(1), channel(2, 'deg'), channel(3), channel(4)]) }]}>
            <ProductIcon name='chat' size={38} color='#FFFFFF' />
            <Animated.View style={[styles.eye, { left: 24.5, transform: [{ rotate: '-4deg' }, { scaleY: blink }] }]} />
            <Animated.View style={[styles.eye, { left: 34.1, transform: [{ rotate: '4deg' }, { scaleY: blink }] }]} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  mark: { width: SIZE, height: SIZE, marginBottom: 28 },
  shadow: { boxShadow: '0 8px 20px rgba(0,135,242,.28)', borderRadius: 18 },
  // Each layer turns about the sprite's feet, so it leans and lands like it stands on something.
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', transformOrigin: '50% 80%' },
  eye: { position: 'absolute', top: 26.4, width: 4.6, height: 6.4, borderRadius: 2.3, backgroundColor: '#FFFFFF' },
})
