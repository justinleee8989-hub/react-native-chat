import React, { type ComponentProps } from 'react'
import { StyleSheet, View } from 'react-native'
import { LoadEarlierMessages } from '@kesha-antonov/react-native-chat'

type Props = ComponentProps<typeof LoadEarlierMessages> & { paging: boolean }

/** Keep the paging slot stable without a spinner for background conversation refreshes. */
export function HistoryLoadIndicator ({ paging, ...props }: Props) {
  if (props.isLoading && paging)
    return <LoadEarlierMessages {...props} />
  return <View pointerEvents='none' style={[styles.slot, props.containerStyle]} />
}

const styles = StyleSheet.create({ slot: { height: 44 } })
