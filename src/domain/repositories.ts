import type {
  AnswerPoint,
  ModelAnswer,
  PartCatalogItem,
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
  listSourceReferencesForTarget(
    targetType: SourceReferenceTargetType,
    targetId: string,
  ): Promise<SourceReference[]>
}
