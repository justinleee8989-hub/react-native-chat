export function assertMediaReplyAllowed (reply: unknown) {
  if (reply)
    throw new Error('引用回复仅支持文字，请先取消引用，再发送附件或语音')
}
