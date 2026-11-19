import React, { useState } from 'react'
import {
  Platform,
  Image,
  Text,
  View,
  Pressable,
  TextInput,
  type TextStyle,
  type TextInputProps,
} from 'react-native'
import type { Group, Person } from '../domain/directory'
import { useT } from '../i18n'
import { ProductAvatar, ProductRow, useProductRowSeparator } from '../ui/primitives'
import { useProductTheme } from '../ui/theme'
export function GroupAvatar ({ group, size }: { group: Group, size: number }) {
  const [failedURL, setFailedURL] = useState('')
  const colors = [
    '#5B7CFA',
    '#F0883E',
    '#2FB67C',
    '#E5566D',
    '#9B6BF2',
    '#2AA5C9',
    '#E26BB1',
    '#C29A2B',
    '#5E6AD2',
    '#10A37F',
  ]
  let hash = 0
  for (const char of group.groupID)
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors[hash % colors.length],
      }}
    >
      {group.faceURL && group.faceURL !== failedURL ? (
        <Image
          onError={() => setFailedURL(group.faceURL || '')}
          source={{ uri: group.faceURL }}
          style={{ width: size, height: size }}
        />
      ) : (
        <Text style={{ fontSize: size * 0.4, fontWeight: '600', color: '#fff' }}>
          {Array.from(group.groupName || group.groupID)
            .slice(0, 1)
            .join('')}
        </Text>
      )}
    </View>
  )
}
/** The small text under a card: a note, or with `error` what went wrong, in red and announced. */
export function ProductHint ({ children, error }: React.PropsWithChildren<{ error?: boolean }>) {
  const t = useProductTheme()
  return (
    <Text
      accessibilityRole={error ? 'alert' : undefined}
      style={{ color: error ? t.danger : t.text2, fontSize: 13, lineHeight: 19, paddingHorizontal: 32, paddingTop: 8 }}
    >
      {children}
    </Text>
  )
}
export function HeaderAction ({
  title,
  disabled,
  onPress,
}: {
  title: string
  disabled?: boolean
  onPress: () => void
}) {
  const t = useProductTheme()
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ height: 44, paddingHorizontal: 12, justifyContent: 'center' }}
    >
      <Text
        style={{
          color: disabled ? t.text3 : t.accent,
          fontSize: 16,
          lineHeight: 22,
          fontWeight: '500',
        }}
      >
        {title}
      </Text>
    </Pressable>
  )
}
export function SettingField ({ label, ...props }: TextInputProps & { label?: string }) {
  const separator = useProductRowSeparator()
  const t = useProductTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingHorizontal: 16,
        gap: 10,
      }}
    >
      {separator && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 16,
            right: 0,
            height: 0.5,
            backgroundColor: t.line,
          }}
        />
      )}
      {label && <Text style={{ color: t.text, fontSize: 16, width: 84 }}>{label}</Text>}
      <TextInput
        accessibilityLabel={label || props.placeholder}
        placeholderTextColor={t.text3}
        {...props}
        style={{
          ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : {}),
          flex: 1,
          minWidth: 0,
          color: t.text,
          fontSize: 16,
          paddingVertical: 16,
        }}
      />
    </View>
  )
}
export function MemberRow ({ member, onPress }: { member: Person, onPress: () => void }) {
  const tr = useT()
  const t = useProductTheme()
  const role =
    member.roleLevel === 100
      ? tr('role.owner')
      : member.roleLevel === 60
        ? tr('role.admin')
        : (member.muteEndTime || 0) / ((member.muteEndTime || 0) > 100000000000 ? 1000 : 1) >
            Date.now() / 1000
          ? tr('role.muted')
          : ''
  return (
    <ProductRow
      separatorInset={68}
      chevron={false}
      title={member.nickname || member.userID}
      leading={
        <ProductAvatar
          id={member.userID}
          title={member.nickname || member.userID}
          uri={member.faceURL}
          size={40}
        />
      }
      trailing={
        role ? (
          <Text
            style={{
              color: member.roleLevel === 100 || member.roleLevel === 60 ? t.accent : t.text2,
              backgroundColor:
                member.roleLevel === 100 || member.roleLevel === 60 ? t.accentWeak : t.surface2,
              fontSize: 12,
              lineHeight: 22,
              height: 22,
              borderRadius: 7,
              paddingHorizontal: 8,
              overflow: 'hidden',
            }}
          >
            {role}
          </Text>
        ) : (
          <></>
        )
      }
      onPress={onPress}
    />
  )
}
