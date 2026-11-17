import { stopRecorderWithTimeout } from '../components/VoiceMessageInput/stopRecorder'

describe('web voice recorder stop deadline', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('rejects when the recorder stop promise never settles', async () => {
    jest.useFakeTimers()
    const stop = jest.fn(() => new Promise<void>(() => {}))
    const pending = stopRecorderWithTimeout({ stop }, 50)
    const rejection = pending.catch(error => error)

    await jest.advanceTimersByTimeAsync(50)
    expect(await rejection).toMatchObject({ code: 'VOICE_RECORDER_STOP_TIMEOUT' })
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('does not wait for the timeout when recorder stop completes', async () => {
    jest.useFakeTimers()
    const stop = jest.fn(async () => {})
    await expect(stopRecorderWithTimeout({ stop }, 50)).resolves.toBeUndefined()
    expect(jest.getTimerCount()).toBe(0)
  })
})
