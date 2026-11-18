import React from 'react'
import type { ChatProps, IMessage } from '@kesha-antonov/react-native-chat'
import { loadHistory, reportError } from '../../application/store'
import type { useProductChatTheme } from '../../ui/ProductChatTheme'
import { HistoryLoadIndicator } from '../HistoryLoadIndicator'

/** Earlier history: loaded as the list nears its top, with the pill shown while a page loads. */
export function chatHistoryProps ({ id, available, loading, paging, theme }: {
  id: string
  available: boolean
  loading: boolean
  paging: boolean
  theme: ReturnType<typeof useProductChatTheme>
}): Pick<ChatProps<IMessage>, 'renderLoadEarlier' | 'loadEarlierMessagesProps'> {
  return {
    renderLoadEarlier: props => <HistoryLoadIndicator {...props} paging={paging} />,
    loadEarlierMessagesProps: {
      isAvailable: available,
      isLoading: loading,
      isInfiniteScrollEnabled: true,
      onPress: () => {
        void loadHistory(id, true).catch(reportError)
      },
      label: '加载更早消息',
      containerStyle: { marginTop: 6, marginBottom: 10 },
      wrapperStyle: {
        backgroundColor: theme.colors.surface,
        height: 30,
        paddingHorizontal: 14,
        paddingVertical: 0,
        borderRadius: 15,
      },
      textStyle: { color: theme.colors.incomingMeta, fontSize: 13, marginTop: 0 },
    },
  }
}
