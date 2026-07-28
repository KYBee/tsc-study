import type {
  AnswerPoint,
  CourseInsight,
  LearningExpression,
  ModelAnswer,
  PartCatalogItem,
  PartGuide,
  PracticeDrill,
  Question,
  SourceReference,
  SourceReferenceTargetType,
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
  listSourceReferencesForTarget(
    targetType: SourceReferenceTargetType,
    targetId: string,
  ): Promise<SourceReference[]>
}
