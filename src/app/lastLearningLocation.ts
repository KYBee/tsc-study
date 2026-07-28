import { PART4_FIXTURE_DATASET_ID } from '../data/fixtureLoader'
import type { PartNumber } from '../domain/entities'

const STORAGE_KEY = `tsc-study:${PART4_FIXTURE_DATASET_ID}:last-learning-location`

export interface LastLearningLocation {
  last_part: PartNumber
  last_question_id: string
  updated_at: string
}

const defaultStorage = (): Storage => window.localStorage

export function saveLastLearningLocation(
  value: Pick<LastLearningLocation, 'last_part' | 'last_question_id'>,
  storage: Storage = defaultStorage(),
  now: () => string = () => new Date().toISOString(),
): LastLearningLocation {
  const stored: LastLearningLocation = { ...value, updated_at: now() }
  storage.setItem(STORAGE_KEY, JSON.stringify(stored))
  return stored
}

export function loadLastLearningLocation(
  validQuestionIds: readonly string[],
  storage: Storage = defaultStorage(),
): LastLearningLocation | undefined {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return undefined
  try {
    const value = JSON.parse(raw) as Partial<LastLearningLocation>
    if (
      ![1, 3, 4, 5, 6].includes(value.last_part ?? 0) ||
      typeof value.last_question_id !== 'string' ||
      typeof value.updated_at !== 'string' ||
      !validQuestionIds.includes(value.last_question_id)
    ) {
      return undefined
    }
    return value as LastLearningLocation
  } catch {
    return undefined
  }
}

export function clearLastLearningLocation(
  storage: Storage = defaultStorage(),
): void {
  storage.removeItem(STORAGE_KEY)
}
