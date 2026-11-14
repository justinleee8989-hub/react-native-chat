import { Platform } from 'react-native'
import { getVisionCamera, hasRoundVideoCapture, resetOptionalModules } from '../optional'
import { loadVisionCamera as loadWebVisionCamera } from '../optional/visionCamera.web'

let mockCameraLoads = 0
jest.mock('react-native-vision-camera', () => {
  mockCameraLoads++
  return { Camera: {}, useVideoOutput: () => {}, VisionCamera: {} }
}, { virtual: true })

afterEach(() => {
  jest.restoreAllMocks()
  resetOptionalModules()
})

test('the browser entry never loads native dependencies even without a platform runtime', () => {
  expect(loadWebVisionCamera()).toBeNull()
  expect(mockCameraLoads).toBe(0)
})

test('web never initializes the native-only camera or its Nitro dependencies', () => {
  jest.replaceProperty(Platform, 'OS', 'web')
  expect(getVisionCamera()).toBeNull()
  expect(hasRoundVideoCapture()).toBe(false)
  expect(mockCameraLoads).toBe(0)
})

test('native still resolves an installed camera and exposes round video capture', () => {
  jest.replaceProperty(Platform, 'OS', 'ios')
  expect(getVisionCamera()).toMatchObject({ Camera: {}, VisionCamera: {} })
  expect(hasRoundVideoCapture()).toBe(true)
  expect(mockCameraLoads).toBe(1)
})
