import { PART4_FIXTURE_DATASET_ID } from '../data/fixtureLoader'

const STORAGE_KEY = `tsc-study:${PART4_FIXTURE_DATASET_ID}:last-learning-location`

export interface LastLearningLocation {
  last_part: 4
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
      value.last_part !== 4 ||
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
