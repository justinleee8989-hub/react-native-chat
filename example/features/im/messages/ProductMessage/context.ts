import { createContext } from 'react'

// Row content width, shared from the measured list viewport or a standalone row.
export const MessageWidth = createContext<number | undefined>(undefined)
