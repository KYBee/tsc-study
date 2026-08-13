import { describe, expect, it } from 'vitest'

import {
  createExamState,
  examReducer,
  PART2_EXAM_CONFIG,
  PART3_EXAM_CONFIG,
} from './examSession'

describe('examReducer', () => {
  it('runs Part 2 through 3 seconds of preparation and 6 seconds of answering', () => {
    let state = examReducer(createExamState(), {
      type: 'START',
      config: PART2_EXAM_CONFIG,
    })

    expect(state).toMatchObject({ phase: 'preparing', remainingSeconds: 3 })
    for (let index = 0; index < 3; index += 1) {
      state = examReducer(state, { type: 'TICK' })
    }
    expect(state.phase).toBe('playing_question')

    state = examReducer(state, { type: 'QUESTION_FINISHED' })
    expect(state).toMatchObject({ phase: 'answering', remainingSeconds: 6 })
    for (let index = 0; index < 6; index += 1) {
      state = examReducer(state, { type: 'TICK' })
    }
    expect(state).toMatchObject({ phase: 'finished', remainingSeconds: 0 })
  })

  it('runs Part 3 through question playback, 2 seconds of preparation, and 15 seconds of answering', () => {
    let state = examReducer(createExamState(), {
      type: 'START',
      config: PART3_EXAM_CONFIG,
    })

    expect(state.phase).toBe('playing_question')
    state = examReducer(state, { type: 'QUESTION_FINISHED' })
    expect(state).toMatchObject({ phase: 'preparing', remainingSeconds: 2 })

    state = examReducer(state, { type: 'TICK' })
    state = examReducer(state, { type: 'TICK' })
    expect(state).toMatchObject({ phase: 'answering', remainingSeconds: 15 })

    for (let index = 0; index < 15; index += 1) {
      state = examReducer(state, { type: 'TICK' })
    }
    expect(state.phase).toBe('finished')
  })

  it('resets an active session to idle', () => {
    const active = examReducer(createExamState(), {
      type: 'START',
      config: PART2_EXAM_CONFIG,
    })

    expect(examReducer(active, { type: 'RESET' })).toEqual(createExamState())
  })
})
