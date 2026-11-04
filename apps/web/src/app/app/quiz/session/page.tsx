import { QuizSession } from '@/components/quiz/quiz-session'
import { getDueCards } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function QuizSessionPage() {
  const cards = await getDueCards(20)
  return (
    <div className="h-full">
      <QuizSession cards={cards} />
    </div>
  )
}
