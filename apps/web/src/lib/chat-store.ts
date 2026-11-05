'use client'
import { create } from 'zustand'
import { useScopeStore } from './scope-store'

export interface ChatSource {
  n: number
  label: string
  href: string
  detail: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  pending?: boolean
}

interface ChatState {
  messages: ChatMessage[]
  busy: boolean
  send: (text: string) => Promise<void>
}

/**
 * The assistant's conversation.
 *
 * It lives in a store rather than in the panel so the desktop side
 * panel and the mobile bottom sheet are the same conversation — on a
 * phone the panel is a sheet, on a desktop it is a column, and the
 * thread does not change with the layout.
 */
export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  busy: false,

  async send(text: string) {
    const question = text.trim()
    if (!question || get().busy) return
    set({ busy: true })

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: question }
    const botMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
      pending: true,
    }
    set((s) => ({ messages: [...s.messages, userMsg, botMsg] }))

    try {
      const scope = useScopeStore.getState().scope
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, scope }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.error ?? `assistant returned ${res.status}`)
      }
      if (!res.body) throw new Error('no stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const handle = (line: string) => {
        if (!line.startsWith('data: ')) return
        try {
          const evt = JSON.parse(line.slice(6))
          if (evt.type === 'sources') {
            set((s) => ({
              messages: s.messages.map((x) =>
                x.id === botMsg.id ? { ...x, sources: evt.sources } : x,
              ),
            }))
          } else if (evt.type === 'text') {
            set((s) => ({
              messages: s.messages.map((x) =>
                x.id === botMsg.id ? { ...x, content: x.content + evt.text } : x,
              ),
            }))
          }
        } catch {
          /* ignore a malformed frame */
        }
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) handle(line)
      }
      // The last frame may not have been newline-terminated.
      buffer += decoder.decode()
      if (buffer.trim()) handle(buffer.trim())
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      set((s) => ({
        messages: s.messages.map((x) =>
          x.id === botMsg.id
            ? {
                ...x,
                content: x.content
                  ? `${x.content}\n\n_Something went wrong: ${detail}_`
                  : `Something went wrong reaching the assistant: ${detail}`,
              }
            : x,
        ),
      }))
    } finally {
      set((s) => ({
        busy: false,
        messages: s.messages.map((x) => (x.id === botMsg.id ? { ...x, pending: false } : x)),
      }))
    }
  },
}))
