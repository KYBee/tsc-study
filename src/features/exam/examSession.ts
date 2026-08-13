export type ExamPhase =
  | 'idle'
  | 'preparing'
  | 'playing_question'
  | 'answering'
  | 'finished'

export interface ExamConfig {
  preparationSeconds: number
  answerSeconds: number
  firstPhase: 'preparing' | 'playing_question'
  afterPreparationPhase: 'playing_question' | 'answering'
  afterQuestionPhase: 'preparing' | 'answering'
}

export const PART2_EXAM_CONFIG: ExamConfig = {
  preparationSeconds: 3,
  answerSeconds: 6,
  firstPhase: 'preparing',
  afterPreparationPhase: 'playing_question',
  afterQuestionPhase: 'answering',
}

export const PART3_EXAM_CONFIG: ExamConfig = {
  preparationSeconds: 2,
  answerSeconds: 15,
  firstPhase: 'playing_question',
  afterPreparationPhase: 'answering',
  afterQuestionPhase: 'preparing',
}

export interface ExamState {
  phase: ExamPhase
  remainingSeconds: number
  config?: ExamConfig
  sessionNumber: number
}

export type ExamEvent =
  | { type: 'START'; config: ExamConfig }
  | { type: 'TICK' }
  | { type: 'QUESTION_FINISHED' }
  | { type: 'RESET' }

export const createExamState = (): ExamState => ({
  phase: 'idle',
  remainingSeconds: 0,
  sessionNumber: 0,
})

const startAnswering = (state: ExamState): ExamState => ({
  ...state,
  phase: 'answering',
  remainingSeconds: state.config?.answerSeconds ?? 0,
})

export function examReducer(state: ExamState, event: ExamEvent): ExamState {
  if (event.type === 'RESET') {
    return createExamState()
  }

  if (event.type === 'START') {
    return {
      phase: event.config.firstPhase,
      remainingSeconds:
        event.config.firstPhase === 'preparing'
          ? event.config.preparationSeconds
          : 0,
      config: event.config,
      sessionNumber: state.sessionNumber + 1,
    }
  }

  if (!state.config) {
    return state
  }

  if (event.type === 'QUESTION_FINISHED') {
    if (state.phase !== 'playing_question') return state
    return state.config.afterQuestionPhase === 'preparing'
      ? {
          ...state,
          phase: 'preparing',
          remainingSeconds: state.config.preparationSeconds,
        }
      : startAnswering(state)
  }

  if (event.type !== 'TICK') return state
  if (state.phase !== 'preparing' && state.phase !== 'answering') {
    return state
  }
  if (state.remainingSeconds > 1) {
    return { ...state, remainingSeconds: state.remainingSeconds - 1 }
  }
  if (state.phase === 'answering') {
    return { ...state, phase: 'finished', remainingSeconds: 0 }
  }
  return state.config.afterPreparationPhase === 'playing_question'
    ? { ...state, phase: 'playing_question', remainingSeconds: 0 }
    : startAnswering(state)
}
