export type ProductAppearance = 'auto' | 'light' | 'dark'
export function parseAppearance (value: string | null): ProductAppearance {
  return value === 'dark' || value === 'light' ? value : 'auto'
}
export function resolveAppearance (appearance: ProductAppearance, system: 'light' | 'dark') {
  return appearance === 'auto' ? system : appearance
}
