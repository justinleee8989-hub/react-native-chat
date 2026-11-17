import type { ServerConfig } from '../domain/types'
import type { createHomeSnapshots } from '../infrastructure/storage/home-snapshot'
import type { Runtime } from './runtime'

/** Coalesce display snapshot writes; unrelated message/read/typing updates do no disk work. */
export function watchHomeSnapshot (runtime: Runtime, cache: ReturnType<typeof createHomeSnapshots>, userID: string, config: ServerConfig) {
  let previous = runtime.state.conversations
  let timer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    timer = undefined
    if (runtime.state.session?.userID === userID && runtime.state.config === config && runtime.state.conversationsLoaded)
      void cache.save(userID, config, runtime.state.conversations)
  }
  const stop = runtime.subscribe(() => {
    if (previous === runtime.state.conversations)
      return
    previous = runtime.state.conversations
    if (timer !== undefined)
      clearTimeout(timer)
    timer = setTimeout(save, 250)
  })
  return {
    stop: () => {
      stop()
      if (timer !== undefined)
        clearTimeout(timer)
    },
    flush: async () => {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      if (runtime.state.session?.userID === userID && runtime.state.config === config)
        await cache.save(userID, config, runtime.state.conversations, { required: true })
    },
  }
}
