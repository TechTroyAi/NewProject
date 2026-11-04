import { createEmptyCard, fsrs, generatorParameters, Rating, type Card as FsrsCard } from 'ts-fsrs'
import type { Card } from '@shelf/shared'

export const f = fsrs(generatorParameters({ enable_fuzz: true }))

/** ts-fsrs v5 card shape (learning_steps is required by the library). */
export function rowToFsrsCard(row: Card): FsrsCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: 0,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as FsrsCard['state'],
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  }
}

export function fsrsToRow(card: FsrsCard) {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  }
}

export function newFsrsCard(): FsrsCard {
  return createEmptyCard(new Date())
}

/** UI rating (1–4) → ts-fsrs Rating. */
export function ratingToGrade(rating: number): Rating.Again | Rating.Hard | Rating.Good | Rating.Easy {
  switch (Math.min(4, Math.max(1, Math.round(rating)))) {
    case 1:
      return Rating.Again
    case 2:
      return Rating.Hard
    case 3:
      return Rating.Good
    default:
      return Rating.Easy
  }
}

/**
 * Schedule the next review.
 * `f.repeat()` returns a preview keyed by grade; we pick the branch for
 * the rating the user gave.
 */
export function reviewCard(row: Card, rating: number, now = new Date()) {
  const grade = ratingToGrade(rating)
  const preview = f.repeat(rowToFsrsCard(row), now)
  const result = preview[grade]
  return { card: fsrsToRow(result.card), log: result.log }
}

export const RATING_LABELS: Record<number, { label: string; hint: string; key: string; tone: string }> = {
  1: { label: 'Again', hint: 'Forgot it', key: '1', tone: 'text-bad' },
  2: { label: 'Hard', hint: 'Struggled', key: '2', tone: 'text-warn' },
  3: { label: 'Good', hint: 'Got it', key: '3', tone: 'text-good' },
  4: { label: 'Easy', hint: 'Instant', key: '4', tone: 'text-accent' },
}
