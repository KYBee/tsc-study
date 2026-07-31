import { describe, expect, it } from 'vitest'

import {
  clearLastLearningLocation,
  loadLastVisualLearningLocation,
  loadLastStoryLearningLocation,
  loadLastLearningLocation,
  saveLastVisualLearningLocation,
  saveLastStoryLearningLocation,
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

  it('preserves the same storage contract for another enabled text Part', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } as unknown as Storage

    saveLastLearningLocation(
      { last_part: 1, last_question_id: 'P1-004' },
      storage,
      () => '2026-07-28T10:00:00.000Z',
    )

    expect(loadLastLearningLocation(['P1-001', 'P1-004'], storage)).toEqual({
      last_part: 1,
      last_question_id: 'P1-004',
      updated_at: '2026-07-28T10:00:00.000Z',
    })
  })

  it('stores a registered VisualQuestion separately from the text location', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } as unknown as Storage

    saveLastVisualLearningLocation(
      {
        last_visual_set_id: 'vs-P2-V01',
        last_visual_question_id: 'vq-P2-V01-Q1',
      },
      storage,
      () => '2026-07-30T10:00:00.000Z',
    )

    expect(
      loadLastVisualLearningLocation(
        ['vs-P2-V01'],
        ['vq-P2-V01-Q1'],
        storage,
      ),
    ).toEqual({
      last_visual_set_id: 'vs-P2-V01',
      last_visual_question_id: 'vq-P2-V01-Q1',
      updated_at: '2026-07-30T10:00:00.000Z',
    })
    expect(
      loadLastVisualLearningLocation(
        ['vs-P2-V02'],
        ['vq-P2-V01-Q1'],
        storage,
      ),
    ).toBeUndefined()
  })

  it('stores a registered Part 7 VisualSet without inventing a Question link', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } as unknown as Storage

    saveLastStoryLearningLocation(
      { last_visual_set_id: 'vs-P7-V03' },
      storage,
      () => '2026-07-31T10:00:00.000Z',
    )

    expect(
      loadLastStoryLearningLocation(
        ['vs-P7-V01', 'vs-P7-V03'],
        storage,
      ),
    ).toEqual({
      last_visual_set_id: 'vs-P7-V03',
      updated_at: '2026-07-31T10:00:00.000Z',
    })
    expect(
      loadLastStoryLearningLocation(['vs-P7-V01'], storage),
    ).toBeUndefined()
  })
})
