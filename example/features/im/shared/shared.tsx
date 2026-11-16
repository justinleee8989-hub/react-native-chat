import React from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ChatListAvatar } from '@kesha-antonov/react-native-chat'
import { useRouter } from 'expo-router'
import { useChatListColors } from '@/components/chat-list/theme'
import type { Person } from '@/features/im/domain/directory'

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
      style={[styles.input, { color: colors.name, borderColor: colors.divider }]}
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
  const router = useRouter()
  const colors = useChatListColors()
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps='handled'
    >
      <View style={styles.actions}>
        {!root && <Action title='返回' onPress={() => {
          if (router.canGoBack())
            router.back()
          else
            router.replace('/(tabs)/chats')
        }}
        />}
        <Text style={[styles.title, { color: colors.name }]}>{title}</Text>
      </View>
      {busy && <ActivityIndicator accessibilityLabel='正在处理' color={colors.attachment} />}
      {!!error && (
        <Text accessibilityRole='alert' style={{ color: colors.draft }}>
          {error}
        </Text>
      )}
      {children}
    </ScrollView>
  )
}
export function Confirm ({
  message,
  onConfirm,
  onCancel,
  busy,
  error,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
  busy: boolean
  error?: string
}) {
  const colors = useChatListColors()
  const cancel = () => {
    if (!busy)
      onCancel()
  }
  return (
    <Modal
      testID='confirmation-modal'
      visible
      transparent
      animationType='fade'
      onRequestClose={cancel}
    >
      <View style={styles.confirmOverlay} accessibilityViewIsModal onAccessibilityEscape={cancel}>
        <ScrollView
          style={[styles.confirmDialog, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.confirm}
          keyboardShouldPersistTaps='handled'
        >
          <Label>{message}</Label>
          {!!error && <Text accessibilityRole='alert' style={{ color: colors.draft }}>{error}</Text>}
          {busy && <ActivityIndicator accessibilityLabel='正在处理' color={colors.attachment} />}
          <View style={styles.actions}>
            <Action title='确认' danger onPress={onConfirm} disabled={busy} />
            <Action title='取消' onPress={cancel} disabled={busy} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}
export const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 48,
    gap: 16,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: 24, fontWeight: '700' },
  label: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  button: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  confirmOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.4)' },
  confirmDialog: { flexGrow: 0, maxHeight: '90%', width: '100%', maxWidth: 480, borderWidth: 1, borderColor: '#E56555', borderRadius: 12 },
  confirm: { padding: 16, gap: 12 },
})
