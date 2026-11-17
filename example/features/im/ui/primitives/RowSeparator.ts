import { createContext, useContext } from 'react'

export const RowSeparator = createContext(false)
export function useProductRowSeparator() {
  return useContext(RowSeparator)
}
