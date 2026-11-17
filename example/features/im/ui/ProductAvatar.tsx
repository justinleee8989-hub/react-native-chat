import React, { useState } from 'react'
import { Image, Text, View } from 'react-native'

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
export function ProductAvatar ({
  id,
  title,
  uri,
  size,
  group = false,
}: {
  id: string | number
  title: string
  uri?: string
  size: number
  group?: boolean
}) {
  const [failed, setFailed] = useState<string>()
  let hash = 0
  for (const char of String(id))
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: group ? size * 0.3 : size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors[hash % colors.length],
      }}
    >
      {uri && uri !== failed ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(uri)}
          style={{ width: size, height: size }}
        />
      ) : (
        <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '600' }}>
          {Array.from(title || '?')[0]}
        </Text>
      )}
    </View>
  )
}
