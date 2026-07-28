import { describe, expect, it } from 'vitest'

import {
  clearLastLearningLocation,
  loadLastLearningLocation,
  saveLastLearningLocation,
} from './lastLearningLocation'

describe('last learning location', () => {
  it('round-trips an existing canonical Question and ignores stale IDs', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } as unknown as Storage
    saveLastLearningLocation(
      { last_part: 4, last_question_id: 'P4-006' },
      storage,
      () => '2026-07-26T10:00:00.000Z',
    )

    expect(loadLastLearningLocation(['P4-001', 'P4-006'], storage)).toEqual({
      last_part: 4,
      last_question_id: 'P4-006',
      updated_at: '2026-07-26T10:00:00.000Z',
    })
    expect(loadLastLearningLocation(['P4-001'], storage)).toBeUndefined()
    clearLastLearningLocation(storage)
    expect(loadLastLearningLocation(['P4-001', 'P4-006'], storage)).toBeUndefined()
  })
})
