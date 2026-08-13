import type { InputLanguage, PartNumber, StructureSegment } from './entities'

export type CorrectionMode = 'minimal' | 'natural' | 'level_8_expansion'

export interface CorrectionRequest {
  question_id: string
  part: PartNumber
  question_zh: string
  input_language: InputLanguage
  original_input: string
  correction_mode: CorrectionMode
}

export interface CorrectionChange {
  before: string
  after: string
  reason: string
}

export interface CorrectionUncertainty {
  message: string
}

export interface CorrectionResult {
  corrected_zh: string
  pinyin: string
  ko: string
  changes: CorrectionChange[]
  structure_segments: StructureSegment[]
  relevance_note: string
  uncertainties: CorrectionUncertainty[]
  key_expressions?: string[]
  message?: string
}

export type CorrectionProviderResult =
  | {
      status: 'success'
      original_input: string
      result: CorrectionResult
    }
  | {
      status: 'unsupported_by_mock'
      original_input: string
      message: string
      explanation: string
    }
  | {
      status: 'failure'
      original_input: string
      message: string
      error_code?: string
    }
