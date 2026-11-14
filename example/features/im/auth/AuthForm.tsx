import React, { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useChatListColors } from '@/components/chat-list/theme'

export function AuthPage ({ title, subtitle, children }: React.PropsWithChildren<{ title: string, subtitle: string }>) {
  const colors = useChatListColors()
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={styles.page}>
        <View style={styles.form}>
          <View style={[styles.brand, { backgroundColor: colors.badge }]}><Text style={styles.brandText}>聊</Text></View>
          <Text style={[styles.title, { color: colors.name }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.message }]}>{subtitle}</Text>
          <View style={styles.fields}>{children}</View>
          <Text style={[styles.footer, { color: colors.message }]}>OpenIM · 让沟通更简单</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
}

export function AuthField ({ label, password = false, ...props }: TextInputProps & { label: string, password?: boolean }) {
  const colors = useChatListColors()
  const [visible, setVisible] = useState(false)
  return <View style={styles.field}>
    <Text style={[styles.label, { color: colors.name }]}>{label}</Text>
    <View style={[styles.inputRow, { borderColor: colors.divider, backgroundColor: colors.headerBackground }]}>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.message} autoCapitalize='none' autoCorrect={false} {...props} secureTextEntry={password && !visible} style={[styles.input, { color: colors.name }]} />
      {password && <Pressable accessibilityRole='button' accessibilityLabel={visible ? `隐藏${label}` : `显示${label}`} onPress={() => setVisible(!visible)} style={styles.reveal}><Text style={{ color: colors.attachment }}>{visible ? '隐藏' : '显示'}</Text></Pressable>}
    </View>
  </View>
}

export function AuthButton ({ title, onPress, disabled, busy, secondary = false }: { title: string, onPress: () => void, disabled?: boolean, busy?: boolean, secondary?: boolean }) {
  const colors = useChatListColors()
  return <Pressable accessibilityRole='button' accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.selectedRow : colors.badge, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    {busy && <ActivityIndicator color={secondary ? colors.attachment : '#fff'} />}
    <Text style={[styles.buttonText, { color: secondary ? colors.attachment : '#fff' }]}>{title}</Text>
  </Pressable>
}

export function AuthLink ({ title, onPress, disabled }: { title: string, onPress: () => void, disabled?: boolean }) {
  const colors = useChatListColors()
  return <Pressable accessibilityRole='button' disabled={disabled} onPress={onPress} style={styles.link}><Text style={{ color: colors.attachment, opacity: disabled ? 0.45 : 1 }}>{title}</Text></Pressable>
}

export function AuthNotice ({ children, error = false }: React.PropsWithChildren<{ error?: boolean }>) {
  const colors = useChatListColors()
  return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion='polite' style={[styles.notice, { color: error ? colors.draft : colors.attachment, backgroundColor: colors.selectedRow }]}>{children}</Text>
}

export function AdvancedSettings ({ children }: React.PropsWithChildren) {
  const [open, setOpen] = useState(false)
  const colors = useChatListColors()
  return <View style={[styles.advanced, { borderColor: colors.divider }]}>
    <Pressable accessibilityRole='button' accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.advancedToggle}><Text style={{ color: colors.message }}>高级设置 · 服务连接</Text><Text style={{ color: colors.message }}>{open ? '收起 −' : '展开 +'}</Text></Pressable>
    {open && <View style={styles.fields}><Text style={{ color: colors.message, lineHeight: 20 }}>默认连接已配置的服务。真机访问时，请使用服务器的局域网地址。</Text>{children}</View>}
  </View>
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 36 },
  form: { width: '100%', maxWidth: 400 },
  brand: { width: 60, height: 60, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  brandText: { color: '#fff', fontSize: 29, fontWeight: '700' },
  title: { fontSize: 30, fontWeight: '700', marginBottom: 10 },
  subtitle: { fontSize: 15, lineHeight: 23, marginBottom: 28 },
  fields: { gap: 16 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, minHeight: 50 },
  input: { flex: 1, minWidth: 0, padding: 14, fontSize: 16 },
  reveal: { padding: 14 },
  button: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  link: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  notice: { padding: 12, borderRadius: 10, fontSize: 14, lineHeight: 21 },
  advanced: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  advancedToggle: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 32 },
})
