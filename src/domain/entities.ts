export type PartNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface LanguageSet {
  zh?: string
  pinyin?: string
  ko?: string
}

export interface StructureSegment {
  label: string
  content: string
}

export interface ChangeReason {
  before: string
  after: string
  reason: string
}

export interface Source {
  source_id: string
  title: string
  source_type:
    | 'course_analysis'
    | 'excel'
    | 'pdf'
    | 'instructor_correction'
    | 'self_created'
    | 'other'
  provenance_status: 'verified_source' | 'unverified_source' | 'self_created'
  creator_or_provider?: string
  original_file_name?: string
  file_ref?: string
  claimed_original_names?: string[]
  sha256?: string
  acquired_date?: string
  rights_status: 'review_needed' | 'private_use' | 'public_allowed' | 'restricted'
  source_status?: 'raw' | 'review_needed' | 'reviewed'
  evidence_kind?: EvidenceKind
  notes?: string
}

export type SourceReferenceTargetType =
  | 'question'
  | 'model_answer'
  | 'correction'
  | 'part_guide'
  | 'visual_set'
  | 'visual_question'
  | 'question_visual_set'
  | 'story_guide'
  | 'answer_point'
  | 'learning_expression'
  | 'pronunciation_item'
  | 'practice_drill'
  | 'course_insight'

export interface SourceReference {
  source_reference_id: string
  target_type: SourceReferenceTargetType
  target_id: string
  source_id: string
  source_locator?: string
  relationship_kind:
    | 'extracted_from'
    | 'claimed_origin'
    | 'derived_from'
    | 'supports'
    | 'self_created'
  claimed_source_name?: string
  claimed_source_url?: string
  source_grade?: string
  originality?: string
  evidence_kind?: EvidenceKind
  verification_status: 'unverified' | 'review_needed' | 'verified' | 'rejected'
  notes?: string
}

export interface Question {
  question_id: string
  part: PartNumber
  question_type?: string
  question_zh: string
  question_pinyin?: string
  question_ko?: string
  question_status: 'raw' | 'normalized' | 'verified'
  normalization_notes?: string
  tags?: string[]
}

export interface AnswerPoint {
  answer_point_id: string
  question_id: string
  point_type:
    | 'response_structure'
    | 'key_hint'
    | 'time_guidance'
    | 'evaluation_focus'
    | 'source_note'
    | 'story_point'
    | 'unclassified'
    | 'other'
  content: string
  sequence?: number
  point_status: 'raw' | 'review_needed' | 'reviewed'
  source_reference_ids?: string[]
  notes?: string
}

export interface VisualAsset {
  visual_asset_id: string
  source_id: string
  source_locator: string
  repository_path: string
  media_type: string
  file_size: number
  sha256: string
  width?: number
  height?: number
  rights_status: 'review_needed' | 'private_use' | 'public_allowed' | 'restricted'
  asset_status: 'raw' | 'review_needed' | 'reviewed'
  notes?: string
}

export interface VisualSet {
  visual_set_id: string
  part: PartNumber
  set_type: 'four_question_image' | 'story_image' | 'official_sample' | 'other'
  set_status: 'raw' | 'review_needed' | 'reviewed'
  source_reference_ids?: string[]
  notes?: string
}

export interface VisualSetAsset {
  visual_set_asset_id: string
  visual_set_id: string
  visual_asset_id: string
  sequence: number
  role?: string
  mapping_status: 'raw' | 'review_needed' | 'verified'
  notes?: string
}

export interface QuestionVisualSet {
  question_visual_set_id: string
  question_id: string
  visual_set_id: string
  relationship_kind: 'primary' | 'supporting' | 'variation' | 'unverified'
  mapping_status: 'raw' | 'review_needed' | 'verified'
  source_reference_ids?: string[]
  notes?: string
}

export interface VisualQuestion {
  visual_question_id: string
  visual_set_id: string
  item_number: number
  question_id?: string
  question_zh?: string
  question_pinyin?: string
  question_ko?: string
  visual_question_status: 'raw' | 'normalized' | 'verified'
  source_reference_ids?: string[]
  notes?: string
}

export interface ModelAnswer {
  answer_id: string
  answer_target_type: 'question' | 'visual_question'
  answer_target_id: string
  answer_variant: 'basic' | 'level_8_expansion' | 'other'
  target_level?: string
  answer_zh?: string
  answer_pinyin?: string
  answer_ko?: string
  structure_segments?: StructureSegment[]
  answer_status: 'missing' | 'draft' | 'review_needed' | 'reviewed' | 'approved'
  provenance_kind: 'verified_source' | 'project_created' | 'unverified_source'
  source_reference_ids?: string[]
  review_notes?: string
}

export interface StoryGuide {
  story_guide_id: string
  visual_set_id: string
  question_id?: string
  situation_ko?: string
  recommended_flow: string
  recommended_connectors_zh?: string
  material_nature?: string
  guide_status: 'raw' | 'review_needed' | 'reviewed'
  source_reference_ids?: string[]
  notes?: string
}

export interface Correction {
  correction_id: string
  wrong_zh: string
  correct_zh: string
  correct_pinyin?: string
  correct_ko?: string
  error_type: string
  reason: string
  source_kind: 'instructor' | 'user_answer'
  source_reference_ids?: string[]
  user_answer_id?: string
  data_scope: 'shared' | 'personal'
  correction_status: 'draft' | 'review_needed' | 'reviewed'
}

export interface PartGuide {
  part_guide_id: string
  part: PartNumber
  goal?: string
  preparation_tips?: string[]
  response_structure?: string[]
  key_expressions?: LanguageSet[]
  key_expression_ids?: string[]
  representative_question_ids?: string[]
  frequent_correction_ids?: string[]
  representative_drill_ids?: string[]
  preparation_seconds?: number
  response_seconds?: number
  course_target_context?: CourseTargetContext
  evidence_kind?: EvidenceKind
  source_reference_ids?: string[]
  guide_status: 'draft' | 'review_needed' | 'reviewed'
  notes?: string
}

export type EvidenceKind =
  | 'document_text'
  | 'screen_text'
  | 'instructor_speech'
  | 'analyst_synthesis'
  | 'generated_study_material'

export type CourseTargetContext = 'level_3' | 'not_specified' | 'other'

export interface LearningExpression {
  expression_id: string
  language: LanguageSet
  part_numbers: PartNumber[]
  expression_type:
    | 'fixed_response'
    | 'reaction'
    | 'connector'
    | 'grammar_pattern'
    | 'comparison'
    | 'location'
    | 'opinion_structure'
    | 'conclusion'
    | 'reusable_sentence'
    | 'other'
  usage_context?: string
  pattern_or_slots?: string
  cautions?: string
  related_correction_ids?: string[]
  status: 'raw' | 'review_needed' | 'reviewed'
  evidence_kind: EvidenceKind
  source_reference_ids?: string[]
  notes?: string
}

export interface PracticeDrill {
  drill_id: string
  part?: PartNumber
  drill_type:
    | 'timed_response'
    | 'shadowing'
    | 'correction_recall'
    | 'picture_accuracy'
    | 'reaction_drill'
    | 'structure_recall'
    | 'pronunciation'
    | 'self_recording'
    | 'other'
  prompt_or_task: string
  preparation_seconds?: number
  response_seconds?: number
  completion_criteria?: string
  required_content_ids?: string[]
  status: 'raw' | 'review_needed' | 'draft' | 'reviewed'
  evidence_kind: EvidenceKind
  source_reference_ids?: string[]
  notes?: string
}

export interface CourseInsight {
  insight_id: string
  part_numbers: PartNumber[]
  insight_type:
    | 'strategy'
    | 'evaluation_focus'
    | 'time_guidance'
    | 'common_risk'
    | 'study_method'
    | 'test_day_behavior'
    | 'scope_limitation'
    | 'other'
  content_ko: string
  course_target_context: CourseTargetContext
  evidence_kind: EvidenceKind
  confidence_or_status: 'raw' | 'review_needed' | 'draft' | 'reviewed'
  source_reference_ids?: string[]
  notes?: string
}

export interface PartCatalogItem {
  part: PartNumber
  name: string
  availability: 'available' | 'coming_soon'
  available_question_count?: number
}

export type InputLanguage = 'ko' | 'zh' | 'mixed'
export type UserAnswerCorrectionMode = 'minimal' | 'easy' | 'natural' | 'level_8_expansion'
export type Part4AnswerSection =
  | 'direct_answer'
  | 'reasons'
  | 'example'
  | 'conclusion'

export type Part4PlanningKeywords = Record<Part4AnswerSection, string[]>
export type Part4StructuredAnswer = Record<Part4AnswerSection, string>

export interface UserAnswer {
  user_answer_id: string
  learner_ref?: string
  question_id: string
  input_language: InputLanguage
  original_input: string
  corrected_zh: string
  corrected_pinyin: string
  corrected_ko: string
  correction_mode: UserAnswerCorrectionMode
  change_summary: ChangeReason[]
  structure_segments: StructureSegment[]
  save_status: 'user_approved'
  created_at: string
}

export interface PracticeDraft {
  practice_draft_id: string
  learner_ref?: string
  question_id: string
  input_language: InputLanguage
  original_input: string
  planning_keywords?: Part4PlanningKeywords
  structured_answer?: Part4StructuredAnswer
  full_text?: string
  completion_status?: 'in_progress' | 'completed'
  completed_at?: string
  understanding_confirmed?: boolean
  skipped_sections?: Part4AnswerSection[]
  draft_status: 'draft'
  created_at: string
  updated_at: string
}

export interface ReusablePhrase {
  reusable_phrase_id: string
  text: string
  language: InputLanguage
  phrase_type:
    | 'reason'
    | 'advantage'
    | 'disadvantage'
    | 'experience'
    | 'example'
    | 'conclusion'
    | 'other'
  source_kind: 'user_created'
  source_question_id: string
  created_at: string
  updated_at: string
}

export type RecallMode =
  | 'full'
  | 'answer_only'
  | 'chinese_only'
  | 'keywords_only'
  | 'question_only'
export type RecallResult =
  | 'could_not_say'
  | 'used_keywords'
  | 'almost'
  | 'memorized'

export interface RecallAttempt {
  recall_attempt_id: string
  question_id: string
  practice_draft_id?: string
  user_answer_id?: string
  recall_mode: RecallMode
  result: RecallResult
  attempted_at: string
}

export interface ReviewState {
  review_state_id: string
  learner_ref?: string
  target_type: 'question' | 'user_answer' | 'correction'
  target_id: string
  learning_status: '못 외움' | '헷갈림' | '외움'
  last_reviewed_at?: string
  review_count: number
}

export type Part4ReviewField =
  | 'chinese_text'
  | 'pinyin'
  | 'korean_translation'
  | 'question_type'
  | 'answer_point'
  | 'source_locator'
  | 'claimed_source_metadata'

export type Part4ReviewFieldStatus =
  | 'approved'
  | 'needs_fix'
  | 'not_checked'

export interface Part4ReviewDecision {
  review_decision_id: string
  dataset_id: 'part4-review-fixture-v1'
  question_id: string
  field_decisions: Record<Part4ReviewField, Part4ReviewFieldStatus>
  overall_status: 'approved' | 'needs_fix' | 'deferred'
  reviewer_note: string
  reviewed_by: string
  reviewed_at: string
  source_question_hash: string
  source_answer_point_hash: string
  decision_version: 1
}
