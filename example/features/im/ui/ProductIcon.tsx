import React from 'react'
import Svg, { Path } from 'react-native-svg'

const paths = {
  back: 'M15 18l-6-6 6-6',
  chev: 'M9 18l6-6-6-6',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  more: '!M5 12h.01M12 12h.01M19 12h.01',
  phone:
    'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  video: 'M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 10l5-3v10l-5-3',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  users:
    'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.8M15.5 3.2a3.5 3.5 0 0 1 0 6.6',
  user: 'M19 20v-1a5 5 0 0 0-5-5h-4a5 5 0 0 0-5 5v1M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  userPlus:
    'M15 20v-1a5 5 0 0 0-5-5H7a5 5 0 0 0-5 5v1M8.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M16 11h6',
  pin: 'M12 17v5M8 3h8l-1 6 3 4H6l3-4z',
  bellOff:
    'M8.6 4.2A6 6 0 0 1 18 9c0 3 .8 5 1.6 6M6.3 6.3A6 6 0 0 0 6 9c0 5-2 6-2 7h12M10 20a2 2 0 0 0 4 0M3 3l18 18',
  archive: 'M3 5h18v4H3zM5 9v10h14V9M10 13h4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  send: 'M5 12h14M13 6l6 6-6 6',
  mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  micOff:
    'M9 9v2a3 3 0 0 0 5 2.2M15 9.5V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.6 5.3M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  image: 'M4 5h16v14H4zM4 15l4.5-4.5L14 16M13 13l2.5-2.5L20 15M9 9h.01',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  file: 'M14 3H6v18h12V7zM14 3v4h4',
  loc: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  card: 'M3 5h18v14H3zM8.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.5 16a3 3 0 0 1 6 0M14 9h4M14 13h4',
  at: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4 7.5',
  reply: 'M9 14L4 9l5-5M4 9h9a7 7 0 0 1 7 7v3',
  forward: 'M15 14l5-5-5-5M20 9h-9a7 7 0 0 0-7 7v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  undo: 'M4 8h10a5 5 0 0 1 0 10H8M4 8l4-4M4 8l4 4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  // Lucide rotate-cw: one arc ending in its arrowhead (the old one stopped short of a detached corner).
  retry: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5',
  play: 'M8 5l11 7-11 7z',
  pause: 'M8 5v14M16 5v14',
  speaker: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  compose: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  eyeOff:
    'M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.6M6.5 7.6A16.6 16.6 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 4-.9M9.9 10a3 3 0 0 0 4.1 4.1',
  warn: 'M12 8v5M12 16.5h.01',
  select: 'M4 12l5 5L20 6',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  device: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18.5h2',
} as const

export function ProductIcon ({
  name,
  size = 22,
  color,
}: {
  name: keyof typeof paths
  size?: number
  color: string
}) {
  return (
    <Svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
      <Path
        d={paths[name].replace(/^!/, '')}
        stroke={color}
        strokeWidth={paths[name].startsWith('!') ? 2.8 : 1.8}
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </Svg>
  )
}
