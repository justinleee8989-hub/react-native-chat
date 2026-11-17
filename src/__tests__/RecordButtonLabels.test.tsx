import React from 'react'
import { render } from '@testing-library/react-native'
import { useSharedValue } from 'react-native-reanimated'
import { ChatContext } from '../ChatContext'
import { ModeButton } from '../components/RecordButton/ModeButton'
import { createStyles } from '../components/RecordButton/styles'
import { defaultLabels, resolveLabels } from '../i18n'
import { ChatTheme, defaultLightTheme, mergeTheme } from '../Theme'

jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}))

function Button ({ isVideo }: { isVideo: boolean }) {
  const buttonShown = useSharedValue(1)
  const modeSV = useSharedValue(isVideo ? 1 : 0)
  return <ModeButton
    gesture={{} as React.ComponentProps<typeof ModeButton>['gesture']}
    buttonShown={buttonShown}
    modeSV={modeSV}
    isVideo={isVideo}
    styles={createStyles(defaultLightTheme)}
  />
}

function recordingButton (isVideo: boolean, labels = defaultLabels, theme: ChatTheme = defaultLightTheme) {
  return <ChatContext.Provider value={{
    getLocale: () => 'en',
    getColorScheme: () => 'light',
    actionSheet: () => ({ showActionSheetWithOptions: () => {} }),
    getLabels: () => labels,
    getTheme: () => theme,
  }}
  >
    <Button isVideo={isVideo} />
  </ChatContext.Provider>
}

const overrides = { recordAudioMessage: 'Record audio override', recordVideoMessage: 'Record video override' }

describe.each([false, true])('record button labels (isVideo: %s)', isVideo => {
  it('uses the labels override when the theme has no label', async () => {
    const view = await render(recordingButton(isVideo, resolveLabels('en', overrides)))
    expect(view.getByLabelText(isVideo ? overrides.recordVideoMessage : overrides.recordAudioMessage)).toBeTruthy()
  })

  it('keeps legacy theme labels ahead of labels overrides', async () => {
    const theme = mergeTheme(defaultLightTheme, { voice: { recordAudioLabel: 'Legacy audio', recordVideoLabel: 'Legacy video' } })
    const view = await render(recordingButton(isVideo, resolveLabels('en', overrides), theme))
    expect(view.getByLabelText(isVideo ? 'Legacy video' : 'Legacy audio')).toBeTruthy()
  })

  it('keeps the existing English default', async () => {
    const view = await render(recordingButton(isVideo))
    expect(view.getByLabelText(isVideo ? 'record video message' : 'record voice message')).toBeTruthy()
  })
})
