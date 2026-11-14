import { act, renderHook } from '@testing-library/react-native'
import { usePanGesture } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'

import { useRecordGesture } from '../components/RecordButton/useRecordGesture'

jest.mock('react-native-gesture-handler', () => ({
  usePanGesture: jest.fn(config => config),
  useTapGesture: jest.fn(config => config),
  useCompetingGestures: jest.fn((tap, pan) => ({ tap, pan })),
}))

async function setup (onTap?: () => void) {
  const onStart = jest.fn()
  const onFinish = jest.fn()
  await renderHook(() => {
    const value = useSharedValue(0)
    return useRecordGesture({
      onTap, isVoice: true, cancelSign: -1, slideDistance: 100, lockDistance: 60,
      slideProgress: value, fingerUp: value, lockedSV: value, isTakeSV: value,
      lockHide: value, lockHideTarget: value, lastReported: value,
      callbacksRef: { current: { onStart, onFinish, onLock: jest.fn() } },
      exitReasonRef: { current: 'send' }, setIsLockHintVisible: jest.fn(),
    })
  })
  const config = jest.mocked(usePanGesture).mock.calls.at(-1)![0]
  return { config, onStart }
}

beforeEach(() => {
  jest.mocked(usePanGesture).mockImplementation(config => config as ReturnType<typeof usePanGesture>)
})

it('single-mode recording can activate with a stationary pointer, without the default pan movement threshold', async () => {
  const { config, onStart } = await setup()
  // The web pan recognizer otherwise waits for 15px of movement indefinitely.
  expect(config.minDistance).toBe(0)
  expect(config.activateAfterLongPress).toBe(0)
  await act(() => config.onActivate?.({} as never))
  expect(onStart).toHaveBeenCalledTimes(1)
})

it('dual-mode recording keeps the 150ms hold so a stationary short tap can still switch modes', async () => {
  const { config, onStart } = await setup(jest.fn())
  expect(config.activateAfterLongPress).toBe(150)
  // A zero-distance pan would win the tap race immediately.
  expect(config.minDistance).toBeUndefined()
  expect(onStart).not.toHaveBeenCalled()
})
