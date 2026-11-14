/** Never render SDK/backend diagnostics (paths, stacks or credentials) as product copy. */
export function errorMessage (reason: unknown): string {
  const value = reason as { errMsg?: unknown, message?: unknown, name?: unknown }
  const raw = typeof value?.errMsg === 'string' ? value.errMsg : typeof value?.message === 'string' ? value.message : typeof reason === 'string' ? reason : ''
  if (/user\s*(?:id)?\s*(?:not found|does not exist|not exist)/i.test(raw))
    return '未找到用户，请检查用户 ID'
  if (/group\s*(?:id)?\s*(?:not found|does not exist|not exist)/i.test(raw))
    return '未找到群组，请检查群 ID'
  if (/permission denied|no permission|not (?:a )?group member|not in (?:the )?group/i.test(raw))
    return '当前账号没有权限执行此操作'
  if (value?.name === 'AbortError' || /timeout|timed out|failed to fetch|network request failed/i.test(raw))
    return '连接暂时失败，请检查网络后重试'
  if (/stackError|CodeError|rpc error|goroutine|\bat .+\(|\.(?:go|tsx?|jsx?):\d|\b(?:token|password|secret)\s*[:=]/i.test(raw) || raw.length > 300)
    return '操作失败，请稍后重试'
  // Application validation messages are Chinese; unknown service text is not a safe UI contract.
  return /[\u3400-\u9fff]/.test(raw) ? raw : '操作失败，请稍后重试'
}
