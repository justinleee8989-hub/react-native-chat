import { type Href, useRouter } from 'expo-router'
import { useDesktopNavigation } from './DesktopNavigation'
import type { ProductSection } from './layout'

export function useRailNavigation (section: ProductSection) {
  const context = useDesktopNavigation()
  const router = useRouter()
  return context?.switchSection ?? ((next: ProductSection) => {
    if (next !== section)
      router.navigate(`/(tabs)/${next}` as Href)
  })
}
