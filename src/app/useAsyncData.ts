import { useEffect, useState, type DependencyList } from 'react'

interface AsyncDataState<T> {
  data?: T
  error?: Error
  loading: boolean
}

export function useAsyncData<T>(
  loader: () => Promise<T>,
  dependencies: DependencyList,
): AsyncDataState<T> {
  const [state, setState] = useState<AsyncDataState<T>>({ loading: true })

  useEffect(() => {
    let active = true

    void loader().then(
      (data) => {
        if (active) {
          setState({ data, loading: false })
        }
      },
      (cause: unknown) => {
        if (active) {
          const error = cause instanceof Error ? cause : new Error(String(cause))
          console.error(error)
          setState({ error, loading: false })
        }
      },
    )

    return () => {
      active = false
    }
    // The caller owns the dependency list for the requested resource.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  return state
}
