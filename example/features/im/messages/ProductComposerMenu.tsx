import React, { useEffect, useRef } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  pickDocuments,
  pickFromSystemGallery,
  takePhoto,
  type AttachmentMenuRenderProps,
  type AttachmentTab,
} from '@kesha-antonov/react-native-chat'
import { reportError, useOpenIM } from '../application/store'
import type { ContactCard, LocationInput } from '../domain/types'
import { useT } from '../i18n'
import { useProductLayout } from '../ui/preferences'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductTheme } from '../ui/theme'
import { RichComposer } from './RichMessages'

export function ProductComposerMenu ({
  visible,
  onClose,
  tabs,
  onSend,
  onMention,
  onLocation,
  onCard,
}: AttachmentMenuRenderProps & {
  onMention?: () => void
  onLocation: (location: LocationInput) => Promise<void>
  onCard: (card: ContactCard) => Promise<void>
}) {
  const tr = useT()
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const { session } = useOpenIM()
  const scope = useRef<{ alive: boolean, busy: boolean } | null>(null)
  useEffect(() => {
    const current = { alive: true, busy: false }
    scope.current = current
    return () => {
      current.alive = false
    }
  }, [session?.userID, session?.imToken])
  const pick = async (tab: AttachmentTab) => {
    const current = scope.current
    if (!current?.alive || current.busy)
      return
    current.busy = true
    onClose()
    try {
      const attachments = await (tab === 'file'
        ? pickDocuments()
        : tab === 'camera'
          ? takePhoto()
          : pickFromSystemGallery())
      if (current.alive && attachments.length)
        onSend(attachments)
    } catch (error) {
      if (current.alive)
        reportError(error)
    }
    current.busy = false
  }
  return (
    <>
      <RichComposer
        onLocation={onLocation}
        onCard={onCard}
        renderTrigger={open =>
          visible && (
            <View
              style={{
                width: '100%',
                maxWidth: 920,
                alignSelf: 'center',
                paddingHorizontal: desktop ? 28 : 12,
                paddingTop: desktop ? 16 : 14,
                paddingBottom: desktop ? 22 : 20,
                borderTopWidth: 0.5,
                borderColor: t.line,
                backgroundColor: t.bg,
              }}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 }}>
                {(
                  [
                    { tab: 'gallery', icon: 'image', label: tr('scan.album') },
                    { tab: 'camera', icon: 'camera', label: tr('composer.camera') },
                    { tab: 'file', icon: 'file', label: tr('file.defaultName') },
                  ] as const
                )
                  .filter(item => tabs.includes(item.tab))
                  .map(item => (
                    <MenuTile
                      key={item.tab}
                      icon={item.icon}
                      label={item.label}
                      onPress={() => {
                        void pick(item.tab)
                      }}
                    />
                  ))}
                <MenuTile
                  icon='loc'
                  label={tr('composer.location')}
                  onPress={() => {
                    onClose()
                    open('location')
                  }}
                />
                <MenuTile
                  icon='card'
                  label={tr('composer.card')}
                  onPress={() => {
                    onClose()
                    open('card')
                  }}
                />
                {onMention && (
                  <MenuTile
                    icon='at'
                    label={tr('composer.mention')}
                    onPress={() => {
                      onClose()
                      onMention()
                    }}
                  />
                )}
              </View>
            </View>
          )
        }
      />
    </>
  )
}
function MenuTile ({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof ProductIcon>['name']
  label: string
  onPress: () => void
}) {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: desktop ? 96 : '25%', alignItems: 'center', gap: 8 }}
    >
      <View
        style={{
          backgroundColor: t.surface,
          width: 56,
          height: 56,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ProductIcon name={icon} size={26} color={t.text} />
      </View>
      <Text style={{ color: t.text2, fontSize: 12 }}>{label}</Text>
    </Pressable>
  )
}
