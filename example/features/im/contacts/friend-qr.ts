import QRCode from 'qrcode'

/**
 * What a 我的二维码 code holds: a link into this app's profile page for the user, so a phone's own
 * camera can open it too. 扫一扫 reads the user ID back out of it.
 */
const PREFIX = 'example:///chats/people/'

export function friendQRValue (userID: string) {
  return PREFIX + encodeURIComponent(userID)
}

/** The user ID in a scanned code, or undefined for a code that is not one of ours. */
export function userIDFromQR (value: string | undefined) {
  const text = value?.trim() ?? ''
  // `example://chats/people/…` is the same link written with two slashes.
  const match = /^example:\/\/\/?chats\/people\/([^/?#]+)\/?$/.exec(text)
  if (!match)
    return undefined
  try {
    return decodeURIComponent(match[1]) || undefined
  } catch {
    return undefined
  }
}

/**
 * The dark modules of `value`'s QR code as one SVG path in module units (a `size`-wide square),
 * written with the highest error correction so a logo can cover the middle.
 */
export function qrPath (value: string) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'H' })
  const size = modules.size
  let d = ''
  for (let row = 0; row < size; row++) 
    for (let col = 0; col < size; col++) 
      if (modules.get(row, col))
        d += `M${col} ${row}h1v1h-1z`
    
  
  return { size, d }
}
