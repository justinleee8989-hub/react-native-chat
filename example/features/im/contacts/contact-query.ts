/** What 添加好友's search box was given: a user ID, a full email, or a full phone number. */
export type ContactQuery =
  | { kind: 'id', userID: string }
  | { kind: 'email', email: string }
  | { kind: 'phone', areaCode: string, phoneNumber: string }

// A mainland mobile number, with or without +86 in front.
const MAINLAND = /^(?:\+?86)?(1\d{10})$/
// Another country's number needs its code and a separator, so the code is not guessed.
const INTERNATIONAL = /^\+(\d{1,4})[ -](\d{6,14})$/

/**
 * Reads the search text. An email or phone number is only looked up in full on the server (there is
 * no partial search), so anything else, an 11-digit user ID included, is taken as a user ID.
 */
export function parseContactQuery (text: string): ContactQuery {
  const value = text.trim()
  if (value.includes('@'))
    return { kind: 'email', email: value }
  const mainland = MAINLAND.exec(value.replace(/[\s-]/g, ''))
  if (mainland)
    return { kind: 'phone', areaCode: '+86', phoneNumber: mainland[1] }
  const international = INTERNATIONAL.exec(value)
  if (international)
    return { kind: 'phone', areaCode: `+${international[1]}`, phoneNumber: international[2] }
  return { kind: 'id', userID: value }
}
