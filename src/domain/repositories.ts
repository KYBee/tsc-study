import type {
  AnswerPoint,
  CourseInsight,
  LearningExpression,
  ModelAnswer,
  PartCatalogItem,
  PartGuide,
  PracticeDrill,
  Question,
  QuestionVisualLinkCandidate,
  SourceReference,
  SourceReferenceTargetType,
  StoryGuide,
  VisualAsset,
  VisualQuestion,
  VisualSet,
} from './entities'

export interface PublicContentRepository {
  listParts(): Promise<PartCatalogItem[]>
  getPart(partNumber: number): Promise<PartCatalogItem | undefined>
  listQuestionsByPart(partNumber: number): Promise<Question[]>
  getQuestionById(questionId: string): Promise<Question | undefined>
  listAnswerPointsByQuestionId(questionId: string): Promise<AnswerPoint[]>
  listModelAnswersByQuestionId(questionId: string): Promise<ModelAnswer[]>
  listPartGuides(partNumber: number): Promise<PartGuide[]>
  listLearningExpressionsByPart(partNumber: number): Promise<LearningExpression[]>
  listPracticeDrillsByPart(partNumber: number): Promise<PracticeDrill[]>
  listCourseInsightsByPart(partNumber: number): Promise<CourseInsight[]>
  listVisualSetsByPart(partNumber: number): Promise<VisualSet[]>
  getVisualSetById(visualSetId: string): Promise<VisualSet | undefined>
  listVisualAssetsBySetId(visualSetId: string): Promise<VisualAsset[]>
  getVisualAssetById(visualAssetId: string): Promise<VisualAsset | undefined>
  listVisualQuestionsBySetId(visualSetId: string): Promise<VisualQuestion[]>
  getVisualQuestionById(
    visualQuestionId: string,
  ): Promise<VisualQuestion | undefined>
  listModelAnswersByVisualQuestionId(
    visualQuestionId: string,
  ): Promise<ModelAnswer[]>
  getStoryGuideByVisualSetId(
    visualSetId: string,
  ): Promise<StoryGuide | undefined>
  listQuestionVisualLinkCandidatesBySetId(
    visualSetId: string,
  ): Promise<QuestionVisualLinkCandidate[]>
  listModelAnswersByVisualSetId(visualSetId: string): Promise<ModelAnswer[]>
  getPart7CommonInstruction(): Promise<Question | undefined>
  listSourceReferencesForTarget(
    targetType: SourceReferenceTargetType,
    targetId: string,
  ): Promise<SourceReference[]>
}
