import React from 'react'
import { Text, View } from 'react-native'
import { usePathname } from 'expo-router'
import ContactsScreen from '../../contacts/ContactsScreen'
import ChatListScreen from '../../conversations/ChatListScreen'
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
  const { desktop } = useProductLayout()
  const path = usePathname()
  const navigation = useDesktopNavigation()
  const section = navigation?.section ?? productSection(path)
  const blank = {
    chats: ['选择一个会话', '从左侧列表选择会话，或点右上角发起新的聊天'],
    contacts: ['通讯录', '从左侧选择好友，或查看新的朋友和群聊'],
    me: ['我的', '从左侧选择要查看的设置'],
  }[section]
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
              <ProductIcon name='chat' size={30} color={t.text3} />
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
