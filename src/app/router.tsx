import { Route, Routes } from 'react-router-dom'

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

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/parts/4" element={<PartDetailScreen />} />
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
