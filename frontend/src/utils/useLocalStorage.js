import { useCallback, useState } from 'react'

export function useLocalStorage(key, defaultValue) {
  const [value, setValueState] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored === null) return defaultValue
      return JSON.parse(stored)
    } catch {
      return defaultValue
    }
  })

  const setValue = useCallback(
    (newValue) => {
      setValueState((prev) => {
        const resolved = typeof newValue === 'function' ? newValue(prev) : newValue
        try {
          localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          /* localStorage unavailable — fall back to in-memory only */
        }
        return resolved
      })
    },
    [key],
  )

  return [value, setValue]
}
