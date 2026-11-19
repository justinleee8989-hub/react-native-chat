import React from 'react'
import { Text, View } from 'react-native'
import { usePathname } from 'expo-router'
import CallHistoryScreen from '../../calls/CallHistoryScreen'
import ContactsScreen from '../../contacts/ContactsScreen'
import ChatListScreen from '../../conversations/ChatListScreen'
import { useT } from '../../i18n'
import { useProductLayout } from '../../ui/preferences'
import { ProductIcon } from '../../ui/ProductIcon'
import { useProductTheme } from '../../ui/theme'
import { useDesktopNavigation } from '../DesktopNavigation'
import { productSection } from '../layout'
import MyScreen from '../MyScreen'
import { Rail } from './Rail'
import { styles } from './styles'

/** The existing navigator remains the detail pane, including deep-link and back history. */
export default function ProductShell ({
  children,
  master = false,
}: React.PropsWithChildren<{ master?: boolean }>) {
  const tr = useT()
  const { desktop } = useProductLayout()
  const path = usePathname()
  const navigation = useDesktopNavigation()
  const section = navigation?.section ?? productSection(path)
  const blank = {
    chats: [tr('shell.pickChat'), tr('shell.pickChatHint')],
    contacts: [tr('tab.contacts'), tr('shell.contactsHint')],
    calls: [tr('tab.calls'), tr('shell.callsHint')],
    me: [tr('tab.me'), tr('shell.meHint')],
  }[section]
  const blankIcon = { chats: 'chat', contacts: 'users', calls: 'phone', me: 'user' } as const
  const t = useProductTheme()
  return (
    <View style={styles.columns}>
      <View style={!desktop && styles.hidden}>{desktop && <Rail section={section} />}</View>
      <View
        style={[
          styles.master,
          { backgroundColor: t.page, borderColor: t.line },
          !desktop && (master ? styles.mobile : styles.hidden),
        ]}
      >
        {master ? (
          children
        ) : desktop ? (
          section === 'contacts' ? (
            <ContactsScreen root />
          ) : section === 'calls' ? (
            <CallHistoryScreen />
          ) : section === 'me' ? (
            <MyScreen />
          ) : (
            <ChatListScreen autoRefresh={path !== '/chats/archived'} />
          )
        ) : null}
      </View>
      <View style={[styles.detail, { backgroundColor: t.bg }, !desktop && master && styles.hidden]}>
        {master ? (
          <View style={styles.blank}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 18,
                marginBottom: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: t.surface2,
              }}
            >
              <ProductIcon name={blankIcon[section]} size={30} color={t.text3} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '600', color: t.text2 }}>{blank[0]}</Text>
            <Text style={{ fontSize: 14, color: t.text3, maxWidth: 280, textAlign: 'center' }}>
              {blank[1]}
            </Text>
          </View>
        ) : (
          children
        )}
      </View>
    </View>
  )
}
