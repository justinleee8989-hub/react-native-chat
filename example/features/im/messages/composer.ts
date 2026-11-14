import type { IMMessage, LocationInput } from '../domain/types'

export function readReply (message: IMMessage): IMMessage | undefined {
  try {
    const reply = JSON.parse(message.ex || '{}').imRichReplyV1
    if (reply && typeof reply.clientMsgID === 'string' && typeof reply.contentType === 'number' && typeof reply.sendTime === 'number' && reply.status === 2)
      return quoteSnapshot(reply)
  } catch { /* Unknown extensions belong to other clients. */ }
  return undefined
}

function quoteSnapshot (reply: IMMessage) {
  const source = { ...reply }
  delete source.projection
  delete source.ex
  if (source.contentType === 114) {
    source.contentType = 101
    source.textElem = { content: source.quoteElem?.text || '' }
  }
  delete source.quoteElem
  return source
}

export function attachReply (message: IMMessage, reply?: IMMessage): IMMessage {
  if (!reply)
    return message
  let extensions: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(message.ex || '{}')
    extensions = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { originalEx: message.ex }
  } catch {
    extensions = { originalEx: message.ex }
  }
  const source = quoteSnapshot(reply)
  return { ...message, ex: JSON.stringify({ ...extensions, imRichReplyV1: source }) }
}

export function validateLocation (location: LocationInput): LocationInput {
  if (!Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 || !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180)
    throw new Error('请输入有效经纬度：纬度 -90～90，经度 -180～180')
  if (!location.description.trim())
    throw new Error('请输入地点名称')
  return { ...location, description: location.description.trim().slice(0, 500) }
}

export function locationURL (location: LocationInput) {
  const valid = validateLocation(location)
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${valid.latitude},${valid.longitude}`)}`
}
