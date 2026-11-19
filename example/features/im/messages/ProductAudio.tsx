import React from 'react'
import { Text, View } from 'react-native'
import {
  MessageAudio,
  type AudioPlayerRenderProps,
  type IMessage,
  type RenderMessageAudioProps,
} from '@kesha-antonov/react-native-chat'
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler'
import { formatCallDuration } from '../calls/terminal-metadata'
import { useSentPartColor } from '../ui/ProductChatTheme'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductTheme } from '../ui/theme'
import { ProductPulse } from './ProductMotion'

function AudioControls ({
  isPlaying,
  isDisabled,
  duration,
  onToggle,
  color,
}: AudioPlayerRenderProps & { color: string }) {
  const gesture = useTapGesture({
    runOnJS: true,
    cancelsTouchesInView: false,
    onDeactivate: event => {
      if (!event.canceled && !isDisabled)
        onToggle()
    },
  })
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole='button'
        accessibilityLabel={isPlaying ? '暂停语音' : '播放语音'}
        accessibilityState={{ disabled: isDisabled }}
        onAccessibilityTap={isDisabled ? undefined : onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minWidth: 120,
          paddingVertical: 9,
          paddingHorizontal: 14,
        }}
      >
        <ProductIcon name={isPlaying ? 'pause' : 'play'} size={18} color={color} />
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 20 }}
          accessibilityElementsHidden
        >
          {Array.from({ length: 16 }, (_, index) => (
            <ProductPulse key={index} index={index} active={isPlaying} wave color={color} />
          ))}
        </View>
        <Text style={{ color, fontSize: 13 }}>{formatCallDuration(duration)}</Text>
      </View>
    </GestureDetector>
  )
}

export function ProductAudio (props: RenderMessageAudioProps<IMessage>) {
  const t = useProductTheme()
  const sent = useSentPartColor()
  return (
    <MessageAudio
      {...props}
      containerStyle={{ marginHorizontal: 0, marginVertical: 0 }}
      renderPlayer={player => (
        <AudioControls {...player} color={props.position === 'right' ? sent : t.text} />
      )}
    />
  )
}
