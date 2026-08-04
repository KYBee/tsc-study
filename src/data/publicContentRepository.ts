import type {
  CourseInsight,
  LearningExpression,
  PartCatalogItem,
  PartNumber,
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
} from '../domain/entities'
import type { PublicContentRepository } from '../domain/repositories'
import type {
  Part4Fixture,
  Part4FullFixture,
  Part2VisualFixture,
  Part7VisualFixture,
  TextPartsFixture,
} from '../domain/validation'
import {
  loadPart2VisualFixture,
  loadPart7VisualFixture,
  loadTextPartsFixture,
} from './fixtureLoader'

const PART_CATALOG: ReadonlyArray<Omit<PartCatalogItem, 'available_question_count'>> = [
  { part: 1, name: '자기소개', availability: 'available' },
  { part: 2, name: '그림 보고 답하기', availability: 'available' },
  { part: 3, name: '빠르게 반응하기', availability: 'available' },
  { part: 4, name: '일상 화제 설명하기', availability: 'available' },
  { part: 5, name: '의견 제시하기', availability: 'available' },
  { part: 6, name: '상황 대응하기', availability: 'available' },
  { part: 7, name: '스토리 구성하기', availability: 'available' },
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
  private readonly fixture: Part4Fixture | Part4FullFixture | TextPartsFixture
  private readonly visualFixture?: Part2VisualFixture
  private readonly storyFixture?: Part7VisualFixture

  constructor(
    fixture: Part4Fixture | Part4FullFixture | TextPartsFixture,
    visualFixture?: Part2VisualFixture,
    storyFixture?: Part7VisualFixture,
  ) {
    this.fixture = fixture
    this.visualFixture = visualFixture
    this.storyFixture = storyFixture
  }

  async listParts(): Promise<PartCatalogItem[]> {
    return PART_CATALOG.map((part) => {
      if (part.availability !== 'available') return { ...part }
      if (part.part === 2 || part.part === 7) {
        const visualMaterial =
          part.part === 2 ? this.visualFixture : this.storyFixture
        if (!visualMaterial) {
          return { ...part, availability: 'coming_soon' as const }
        }
        return {
          ...part,
          available_visual_set_count: visualMaterial.visualSets.length,
          available_visual_question_count:
            'visualQuestions' in visualMaterial
              ? visualMaterial.visualQuestions.length
              : undefined,
        }
      }
      const availableQuestionCount = this.fixture.questions.filter(
        (question) => question.part === part.part,
      ).length
      if (availableQuestionCount === 0) {
        return { ...part, availability: 'coming_soon' as const }
      }
      return {
        ...part,
        available_question_count: availableQuestionCount,
      }
    })
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

  async listPartGuides(partNumber: number): Promise<PartGuide[]> {
    const materialFixture =
      partNumber === 2
        ? this.visualFixture
        : partNumber === 7
          ? this.storyFixture
          : this.fixture
    if (!materialFixture || !('partGuides' in materialFixture)) return []
    return materialFixture.partGuides
      .filter((guide) => guide.part === partNumber)
      .sort((left, right) => compareStableIds(left.part_guide_id, right.part_guide_id))
  }

  async listLearningExpressionsByPart(
    partNumber: number,
  ): Promise<LearningExpression[]> {
    const materialFixture =
      partNumber === 2
        ? this.visualFixture
        : partNumber === 7
          ? this.storyFixture
          : this.fixture
    if (!materialFixture || !('learningExpressions' in materialFixture)) {
      return []
    }
    return materialFixture.learningExpressions
      .filter((expression) => expression.part_numbers.includes(partNumber as PartNumber))
      .sort((left, right) => compareStableIds(left.expression_id, right.expression_id))
  }

  async listPracticeDrillsByPart(partNumber: number): Promise<PracticeDrill[]> {
    const materialFixture =
      partNumber === 2
        ? this.visualFixture
        : partNumber === 7
          ? this.storyFixture
          : this.fixture
    if (!materialFixture || !('practiceDrills' in materialFixture)) return []
    return materialFixture.practiceDrills
      .filter((drill) => drill.part === partNumber)
      .sort((left, right) => compareStableIds(left.drill_id, right.drill_id))
  }

  async listCourseInsightsByPart(partNumber: number): Promise<CourseInsight[]> {
    const materialFixture =
      partNumber === 2
        ? this.visualFixture
        : partNumber === 7
          ? this.storyFixture
          : this.fixture
    if (!materialFixture || !('courseInsights' in materialFixture)) return []
    return materialFixture.courseInsights
      .filter((insight) => insight.part_numbers.includes(partNumber as PartNumber))
      .sort((left, right) => compareStableIds(left.insight_id, right.insight_id))
  }

  async listVisualSetsByPart(partNumber: number): Promise<VisualSet[]> {
    const visualMaterial =
      partNumber === 2 ? this.visualFixture : partNumber === 7 ? this.storyFixture : undefined
    return (visualMaterial?.visualSets ?? [])
      .filter((item) => item.part === partNumber)
      .sort((left, right) =>
        compareStableIds(left.visual_set_id, right.visual_set_id),
      )
  }

  async getVisualSetById(
    visualSetId: string,
  ): Promise<VisualSet | undefined> {
    return [...(this.visualFixture?.visualSets ?? []), ...(this.storyFixture?.visualSets ?? [])]
      .find((item) => item.visual_set_id === visualSetId)
  }

  async listVisualAssetsBySetId(
    visualSetId: string,
  ): Promise<VisualAsset[]> {
    const visualMaterial = visualSetId.startsWith('vs-P7-')
      ? this.storyFixture
      : this.visualFixture
    if (!visualMaterial) return []
    const assetsById = new Map(
      visualMaterial.visualAssets.map((item) => [item.visual_asset_id, item]),
    )
    return visualMaterial.visualSetAssets
      .filter((item) => item.visual_set_id === visualSetId)
      .sort(
        (left, right) =>
          left.sequence - right.sequence ||
          compareStableIds(
            left.visual_set_asset_id,
            right.visual_set_asset_id,
          ),
      )
      .map((item) => assetsById.get(item.visual_asset_id))
      .filter((item): item is VisualAsset => item !== undefined)
  }

  async getVisualAssetById(
    visualAssetId: string,
  ): Promise<VisualAsset | undefined> {
    return [
      ...(this.visualFixture?.visualAssets ?? []),
      ...(this.storyFixture?.visualAssets ?? []),
    ].find((item) => item.visual_asset_id === visualAssetId)
  }

  async listVisualQuestionsBySetId(
    visualSetId: string,
  ): Promise<VisualQuestion[]> {
    return (this.visualFixture?.visualQuestions ?? [])
      .filter((item) => item.visual_set_id === visualSetId)
      .sort(
        (left, right) =>
          left.item_number - right.item_number ||
          compareStableIds(
            left.visual_question_id,
            right.visual_question_id,
          ),
      )
  }

  async getVisualQuestionById(
    visualQuestionId: string,
  ): Promise<VisualQuestion | undefined> {
    return this.visualFixture?.visualQuestions.find(
      (item) => item.visual_question_id === visualQuestionId,
    )
  }

  async listModelAnswersByVisualQuestionId(
    visualQuestionId: string,
  ) {
    return (this.visualFixture?.modelAnswers ?? [])
      .filter(
        (item) =>
          item.answer_target_type === 'visual_question' &&
          item.answer_target_id === visualQuestionId,
      )
      .sort((left, right) => compareStableIds(left.answer_id, right.answer_id))
  }

  async getStoryGuideByVisualSetId(
    visualSetId: string,
  ): Promise<StoryGuide | undefined> {
    return this.storyFixture?.storyGuides.find(
      (item) => item.visual_set_id === visualSetId,
    )
  }

  async listQuestionVisualLinkCandidatesBySetId(
    visualSetId: string,
  ): Promise<QuestionVisualLinkCandidate[]> {
    return (this.storyFixture?.questionVisualLinkCandidates ?? [])
      .filter((item) => item.source_entity_id === visualSetId)
      .sort((left, right) => compareStableIds(left.candidate_id, right.candidate_id))
  }

  async listModelAnswersByVisualSetId(
    visualSetId: string,
  ) {
    if (
      !this.storyFixture?.visualSets.some(
        (item) => item.visual_set_id === visualSetId,
      )
    ) {
      return []
    }
    return this.storyFixture?.modelAnswers ?? []
  }

  async getPart7CommonInstruction(): Promise<Question | undefined> {
    const questions = this.storyFixture?.questions ?? []
    if (questions.length !== 12) return undefined
    const first = questions[0]
    // Only the Chinese instruction and pinyin are common across all 12 rows.
    // Korean text describes each candidate story and cannot be attached to a
    // VisualSet while QuestionVisualSet remains unverified.
    const fields = ['question_zh', 'question_pinyin'] as const
    return fields.every((field) =>
      questions.every((item) => item[field] === first[field]),
    )
      ? first
      : undefined
  }

  async listSourceReferencesForTarget(
    targetType: SourceReferenceTargetType,
    targetId: string,
  ): Promise<SourceReference[]> {
    return [
      ...this.fixture.sourceReferences,
      ...(this.visualFixture?.sourceReferences ?? []),
      ...(this.storyFixture?.sourceReferences ?? []),
    ]
      .filter(
        (reference) =>
          reference.target_type === targetType && reference.target_id === targetId,
      )
      .sort((left, right) =>
        compareStableIds(left.source_reference_id, right.source_reference_id),
      )
  }
}

export function createPublicContentRepository(
  fixture?:
    | Part4Fixture
    | Part4FullFixture
    | TextPartsFixture,
  visualFixture?: Part2VisualFixture,
  storyFixture?: Part7VisualFixture,
): PublicContentRepository {
  return new FixturePublicContentRepository(
    fixture ?? loadTextPartsFixture(),
    visualFixture ?? (fixture === undefined ? loadPart2VisualFixture() : undefined),
    storyFixture ?? (fixture === undefined ? loadPart7VisualFixture() : undefined),
  )
}

export const isPartNumber = (value: number): value is PartNumber =>
  Number.isInteger(value) && value >= 1 && value <= 7
