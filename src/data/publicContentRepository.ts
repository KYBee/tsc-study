import type {
  PartCatalogItem,
  PartNumber,
  Question,
  SourceReference,
  SourceReferenceTargetType,
} from '../domain/entities'
import type { PublicContentRepository } from '../domain/repositories'
import type { Part4Fixture } from '../domain/validation'
import { loadPart4Fixture } from './fixtureLoader'

const PART_CATALOG: ReadonlyArray<Omit<PartCatalogItem, 'available_question_count'>> = [
  { part: 1, name: '자기소개', availability: 'coming_soon' },
  { part: 2, name: '그림 보고 답하기', availability: 'coming_soon' },
  { part: 3, name: '빠르게 반응하기', availability: 'coming_soon' },
  { part: 4, name: '일상 화제 설명하기', availability: 'available' },
  { part: 5, name: '의견 제시하기', availability: 'coming_soon' },
  { part: 6, name: '상황 대응하기', availability: 'coming_soon' },
  { part: 7, name: '스토리 구성하기', availability: 'coming_soon' },
]

const compareStableIds = (left: string, right: string) => {
  const leftNumber = Number(left.match(/(\d+)$/)?.[1])
  const rightNumber = Number(right.match(/(\d+)$/)?.[1])
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber
  }
  return left < right ? -1 : left > right ? 1 : 0
}

class FixturePublicContentRepository implements PublicContentRepository {
  private readonly fixture: Part4Fixture

  constructor(fixture: Part4Fixture) {
    this.fixture = fixture
  }

  async listParts(): Promise<PartCatalogItem[]> {
    return PART_CATALOG.map((part) =>
      part.part === 4
        ? { ...part, available_question_count: this.fixture.questions.length }
        : { ...part },
    )
  }

  async getPart(partNumber: number): Promise<PartCatalogItem | undefined> {
    return (await this.listParts()).find((part) => part.part === partNumber)
  }

  async listQuestionsByPart(partNumber: number): Promise<Question[]> {
    return this.fixture.questions
      .filter((question) => question.part === partNumber)
      .sort((left, right) => compareStableIds(left.question_id, right.question_id))
  }

  async getQuestionById(questionId: string): Promise<Question | undefined> {
    return this.fixture.questions.find((question) => question.question_id === questionId)
  }

  async listAnswerPointsByQuestionId(questionId: string) {
    return this.fixture.answerPoints
      .filter((answerPoint) => answerPoint.question_id === questionId)
      .sort(
        (left, right) =>
          (left.sequence ?? Number.MAX_SAFE_INTEGER) -
            (right.sequence ?? Number.MAX_SAFE_INTEGER) ||
          compareStableIds(left.answer_point_id, right.answer_point_id),
      )
  }

  async listModelAnswersByQuestionId(questionId: string) {
    return this.fixture.modelAnswers
      .filter(
        (answer) =>
          answer.answer_target_type === 'question' &&
          answer.answer_target_id === questionId,
      )
      .sort((left, right) => compareStableIds(left.answer_id, right.answer_id))
  }

  async listSourceReferencesForTarget(
    targetType: SourceReferenceTargetType,
    targetId: string,
  ): Promise<SourceReference[]> {
    return this.fixture.sourceReferences
      .filter(
        (reference) =>
          reference.target_type === targetType && reference.target_id === targetId,
      )
      .sort((left, right) =>
        compareStableIds(left.source_reference_id, right.source_reference_id),
      )
  }
}

export const createPublicContentRepository = (
  fixture: Part4Fixture = loadPart4Fixture(),
): PublicContentRepository => new FixturePublicContentRepository(fixture)

export const isPartNumber = (value: number): value is PartNumber =>
  Number.isInteger(value) && value >= 1 && value <= 7
