// Use the real animation builders: Reanimated's global Jest mock erases their
// identity and options, including the distinction that matters to web cleanup.
jest.mock('react-native-reanimated', () => {
  const { createJSReanimatedModule } = require('react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated')
  Object.getPrototypeOf(createJSReanimatedModule()).setCSSEventHandler = () => {}
  return {
    ...require('react-native-reanimated/mock'),
    ...require('react-native-reanimated/src/layoutReanimation'),
  }
})

it('keeps web composer swaps in flex layout after animation cleanup', () => {
  jest.isolateModules(() => {
    const { Platform } = require('react-native')
    const previousOS = Platform.OS
    Platform.OS = 'web'
    try {
      const { swapIn, swapOut } = require('../InputToolbar/animations')
      // Custom Keyframes are converted to absolute snapshot positions by web
      // cleanup. Named zoom presets keep participating in responsive flex layout.
      expect(swapIn.constructor.presetName).toBe('ZoomIn')
      expect(swapOut.constructor.presetName).toBe('ZoomOut')
      expect(swapIn.getDuration()).toBe(220)
      expect(swapOut.getDuration()).toBe(220)
    } finally {
      Platform.OS = previousOS
    }
  })
})

it('retains the original native composer keyframes', () => {
  jest.isolateModules(() => {
    const { Platform } = require('react-native')
    const previousOS = Platform.OS
    Platform.OS = 'ios'
    try {
      const { Keyframe } = require('react-native-reanimated')
      const { swapIn, swapOut } = require('../InputToolbar/animations')
      expect(swapIn).toBeInstanceOf(Keyframe)
      expect(swapOut).toBeInstanceOf(Keyframe)
    } finally {
      Platform.OS = previousOS
    }
  })
})
