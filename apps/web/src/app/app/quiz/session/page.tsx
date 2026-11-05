import { QuizSession } from '@/components/quiz/quiz-session'
import { getQuizQueue } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function QuizSessionPage() {
  const cards = await getQuizQueue(20)
  return (
    <div className="h-full">
      <QuizSession cards={cards} />
    </div>
  )
}
