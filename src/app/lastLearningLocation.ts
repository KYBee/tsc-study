import { PART4_FIXTURE_DATASET_ID } from '../data/fixtureLoader'
import type { PartNumber } from '../domain/entities'

const STORAGE_KEY = `tsc-study:${PART4_FIXTURE_DATASET_ID}:last-learning-location`
const VISUAL_STORAGE_KEY =
  `tsc-study:${PART4_FIXTURE_DATASET_ID}:last-visual-learning-location`

export interface LastLearningLocation {
  last_part: PartNumber
  last_question_id: string
  updated_at: string
}

export interface LastVisualLearningLocation {
  last_visual_set_id: string
  last_visual_question_id: string
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

export function saveLastVisualLearningLocation(
  value: Pick<
    LastVisualLearningLocation,
    'last_visual_set_id' | 'last_visual_question_id'
  >,
  storage: Storage = defaultStorage(),
  now: () => string = () => new Date().toISOString(),
): LastVisualLearningLocation {
  const stored: LastVisualLearningLocation = { ...value, updated_at: now() }
  storage.setItem(VISUAL_STORAGE_KEY, JSON.stringify(stored))
  return stored
}

export function loadLastVisualLearningLocation(
  validVisualSetIds: readonly string[],
  validVisualQuestionIds: readonly string[],
  storage: Storage = defaultStorage(),
): LastVisualLearningLocation | undefined {
  const raw = storage.getItem(VISUAL_STORAGE_KEY)
  if (!raw) return undefined
  try {
    const value = JSON.parse(raw) as Partial<LastVisualLearningLocation>
    if (
      typeof value.last_visual_set_id !== 'string' ||
      typeof value.last_visual_question_id !== 'string' ||
      typeof value.updated_at !== 'string' ||
      !validVisualSetIds.includes(value.last_visual_set_id) ||
      !validVisualQuestionIds.includes(value.last_visual_question_id)
    ) {
      return undefined
    }
    return value as LastVisualLearningLocation
  } catch {
    return undefined
  }
}
