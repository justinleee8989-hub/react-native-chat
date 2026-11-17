import { awaitRecorderStart, RecorderStartCancelled, VoiceRecorderError } from '../components/VoiceMessageInput/startRecorder'

describe('web voice recorder startup guard', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('rejects when startup exceeds its deadline', async () => {
    jest.useFakeTimers()
    const never = new Promise<void>(() => {})
    const pending = awaitRecorderStart(never, 50, new Promise<never>(() => {}))
    const rejection = pending.catch(error => error)

    await jest.advanceTimersByTimeAsync(50)
    expect(await rejection).toMatchObject<Partial<VoiceRecorderError>>({ code: 'VOICE_RECORDER_START_TIMEOUT' })
  })

  it('settles immediately when startup is cancelled', async () => {
    jest.useFakeTimers()
    let cancel!: () => void
    const cancelled = new Promise<never>((_, reject) => {
      cancel = () => reject(new RecorderStartCancelled())
    })
    const pending = awaitRecorderStart(new Promise<void>(() => {}), 1000, cancelled)

    cancel()
    await expect(pending).rejects.toBeInstanceOf(RecorderStartCancelled)
    expect(jest.getTimerCount()).toBe(0)
  })
})
