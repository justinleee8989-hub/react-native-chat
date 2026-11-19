import React from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ChatListAvatar } from '@kesha-antonov/react-native-chat'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { Person } from '@/features/im/domain/directory'
import { useT } from '../i18n'
import { ProductHeader } from '../ui/primitives'
import { ProductModal } from '../ui/ProductModal'
import { useProductColors as useChatListColors, useProductTheme } from '../ui/theme'

export function Action ({
  title,
  onPress,
  disabled = false,
  danger = false,
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  danger?: boolean
}) {
  const colors = useChatListColors()
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { opacity: disabled ? 0.4 : 1, backgroundColor: colors.pressed }]}
    >
      <Text style={{ color: danger ? colors.draft : colors.attachment, fontWeight: '600' }}>
        {title}
      </Text>
    </Pressable>
  )
}
export function Field ({
  value,
  onChangeText,
  placeholder,
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder: string
}) {
  const colors = useChatListColors()
  return (
    <TextInput
      accessibilityLabel={placeholder}
      placeholder={placeholder}
      placeholderTextColor={colors.message}
      value={value}
      onChangeText={onChangeText}
      autoCapitalize='none'
      style={[
        styles.input,
        {
          color: colors.name,
          borderColor: colors.divider,
          backgroundColor: colors.headerBackground,
        },
      ]}
    />
  )
}
export function Label ({ children }: React.PropsWithChildren) {
  const colors = useChatListColors()
  return <Text style={[styles.label, { color: colors.name }]}>{children}</Text>
}
export function PersonRow ({ person, children }: React.PropsWithChildren<{ person: Person }>) {
  const colors = useChatListColors()
  return (
    <View style={[styles.row, { borderColor: colors.divider }]}>
      <ChatListAvatar
        id={person.userID}
        title={person.remark || person.nickname || person.userID}
        uri={person.faceURL}
        size={44}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.name, fontWeight: '600' }}>
          {person.remark || person.nickname || person.userID}
        </Text>
        <Text selectable style={{ color: colors.message }}>
          {person.userID}
        </Text>
        <View style={styles.actions}>{children}</View>
      </View>
    </View>
  )
}
export function Page ({
  title,
  root = false,
  busy,
  error,
  children,
}: React.PropsWithChildren<{ title: string, busy: boolean, error: string, root?: boolean }>) {
  const tr = useT()
  const router = useRouter()
  const colors = useChatListColors()
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ProductHeader
        title={title}
        large={root}
        onBack={
          root
            ? undefined
            : () => {
              if (router.canGoBack())
                router.back()
              else
                router.replace('/(tabs)/chats')
            }
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps='handled'
      >
        {busy && <ActivityIndicator accessibilityLabel={tr('common.processing')} color={colors.attachment} />}
        {!!error && (
          <Text accessibilityRole='alert' style={{ color: colors.draft }}>
            {error}
          </Text>
        )}
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}
export function Confirm ({
  title,
  confirmLabel,
  danger = true,
  message,
  onConfirm,
  onCancel,
  busy,
  error,
  children,
}: {
  children?: React.ReactNode
  title?: string
  confirmLabel?: string
  danger?: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
  busy: boolean
  error?: string
}) {
  const tr = useT()
  const colors = useChatListColors()
  const t = useProductTheme()
  const cancel = () => {
    if (!busy)
      onCancel()
  }
  return (
    <ProductModal
      testID='confirmation-modal'
      visible
      transparent
      animationType='fade'
      onRequestClose={cancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.confirmOverlay, { backgroundColor: t.scrim }]}
        accessibilityViewIsModal
        onAccessibilityEscape={cancel}
      >
        {!children && (
          <Pressable
            accessibilityRole='button'
            accessibilityLabel={tr('common.closeDialog')}
            disabled={busy}
            onPress={cancel}
            style={StyleSheet.absoluteFill}
          />
        )}
        <ScrollView
          style={[styles.confirmDialog, { backgroundColor: t.surface, boxShadow: t.shadow }]}
          contentContainerStyle={{ gap: 0 }}
          keyboardShouldPersistTaps='handled'
        >
          <View style={styles.confirm}>
            {title && (
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: 17,
                  lineHeight: 24,
                  fontWeight: '600',
                  color: colors.name,
                }}
              >
                {title}
              </Text>
            )}
            {!!message && (
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: title ? 14 : 17,
                  lineHeight: title ? 21 : 24,
                  fontWeight: title ? '400' : '600',
                  color: title ? colors.message : colors.name,
                }}
              >
                {message}
              </Text>
            )}
            {children}
            {!!error && (
              <Text accessibilityRole='alert' style={{ color: colors.draft, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>
                {error}
              </Text>
            )}
            {busy && <ActivityIndicator accessibilityLabel={tr('common.processing')} color={colors.attachment} />}
          </View>
          <View
            style={{
              flexDirection: 'row',
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: colors.divider,
            }}
          >
            {[
              { title: tr('common.cancel'), action: cancel },
              { title: confirmLabel ?? tr('common.confirm'), action: onConfirm },
            ].map((item, index) => (
              <Pressable
                key={item.title}
                accessibilityRole='button'
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={item.action}
                style={{
                  flex: 1,
                  height: 50,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderLeftWidth: index ? StyleSheet.hairlineWidth : 0,
                  borderColor: colors.divider,
                  opacity: busy ? 0.4 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: index ? '600' : '400',
                    color: index ? (danger ? colors.draft : colors.attachment) : colors.name,
                  }}
                >
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ProductModal>
  )
}
export const styles = StyleSheet.create({
  page: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 48,
    gap: 16,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: 24, fontWeight: '700' },
  label: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 0, borderRadius: 12, padding: 16, minHeight: 56, fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  confirmOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  confirmDialog: { flexGrow: 0, maxHeight: '90%', width: '100%', maxWidth: 300, borderRadius: 20 },
  confirm: { paddingTop: 24, paddingHorizontal: 22, paddingBottom: 18, gap: 6 },
})
