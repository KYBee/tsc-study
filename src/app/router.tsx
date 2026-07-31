import { Navigate, Route, Routes, useParams } from 'react-router-dom'

import { AnswerEditorScreen } from '../features/answer/AnswerEditorScreen'
import { CorrectionResultScreen } from '../features/correction/CorrectionResultScreen'
import { HomeScreen } from '../features/home/HomeScreen'
import { MistakesScreen } from '../features/mistakes/MistakesScreen'
import { MyAnswersScreen } from '../features/my-answers/MyAnswersScreen'
import { PartDetailScreen } from '../features/part/PartDetailScreen'
import { QuestionScreen } from '../features/question/QuestionScreen'
import { ReviewScreen } from '../features/review/ReviewScreen'
import { NotFoundScreen } from '../features/question/NotFoundScreen'
import { Part4DataReviewScreen } from '../features/data-review/Part4DataReviewScreen'
import { Part2SetScreen } from '../features/part2/Part2SetScreen'
import { Part2SetsScreen } from '../features/part2/Part2SetsScreen'
import { VisualQuestionAnswerScreen } from '../features/part2/VisualQuestionAnswerScreen'
import { VisualQuestionScreen } from '../features/part2/VisualQuestionScreen'
import { Part7SetScreen } from '../features/part7/Part7SetScreen'
import { Part7SetsScreen } from '../features/part7/Part7SetsScreen'
import { Part7StoryAnswerScreen } from '../features/part7/Part7StoryAnswerScreen'

function VisualQuestionRecallRoute() {
  const { visualQuestionId = '' } = useParams()
  return (
    <Navigate
      replace
      to={`/visual-questions/${visualQuestionId}/answer?step=recall`}
    />
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/parts/2" element={<Part2SetsScreen />} />
      <Route path="/parts/2/sets/:visualSetId" element={<Part2SetScreen />} />
      <Route
        path="/visual-questions/:visualQuestionId"
        element={<VisualQuestionScreen />}
      />
      <Route
        path="/visual-questions/:visualQuestionId/answer"
        element={<VisualQuestionAnswerScreen />}
      />
      <Route
        path="/visual-questions/:visualQuestionId/recall"
        element={<VisualQuestionRecallRoute />}
      />
      <Route path="/parts/7" element={<Part7SetsScreen />} />
      <Route path="/parts/7/sets/:visualSetId" element={<Part7SetScreen />} />
      <Route
        path="/parts/7/sets/:visualSetId/answer"
        element={<Part7StoryAnswerScreen />}
      />
      <Route
        path="/parts/7/sets/:visualSetId/recall"
        element={<Part7StoryAnswerScreen />}
      />
      <Route path="/parts/:part" element={<PartDetailScreen />} />
      <Route path="/questions/:questionId" element={<QuestionScreen />} />
      <Route
        path="/questions/:questionId/answer"
        element={<AnswerEditorScreen />}
      />
      <Route
        path="/questions/:questionId/correction"
        element={<CorrectionResultScreen />}
      />
      <Route path="/my-answers" element={<MyAnswersScreen />} />
      <Route path="/review" element={<ReviewScreen />} />
      <Route path="/mistakes" element={<MistakesScreen />} />
      <Route path="/data-review/part4" element={<Part4DataReviewScreen />} />
      <Route path="*" element={<NotFoundScreen />} />
    </Routes>
  )
}
