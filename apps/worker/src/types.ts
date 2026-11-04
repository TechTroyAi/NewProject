export type Stage =
  | 'sniff'
  | 'convert'
  | 'ocr'
  | 'chunk'
  | 'embed'
  | 'summarize'
  | 'cards'
  | 'match'

export interface Job {
  id: string
  user_id: string
  item_id: string
  stage: Stage
  status: 'queued' | 'running' | 'done' | 'failed'
  progress: number
  error?: string | null
}

export interface SniffResult {
  type: 'cbz' | 'zip' | 'pdf' | 'pptx' | 'docx' | 'epub' | 'image' | 'txt' | 'unknown'
  mime: string
  safe: boolean
  reason?: string
}

export interface ConvertedPage {
  idx: number
  buffer: Buffer
  width: number
  height: number
}

export interface ExtractedPage {
  idx: number
  text: string
  speakerNotes?: string | null
}
