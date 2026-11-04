'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileArchive, FileText, Loader2, Upload, X, XCircle } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'
import { useUploadStore, type UploadTask } from '@/lib/upload-store'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/primitives'

/* ─── Folder walking ─────────────────────────────────────────── */

interface FsEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (cb: (f: File) => void) => void
  createReader?: () => { readEntries: (cb: (e: FsEntry[]) => void) => void }
}

async function collectFiles(dt: DataTransfer): Promise<File[]> {
  const out: File[] = []
  const entries: FsEntry[] = []

  for (const item of Array.from(dt.items)) {
    const entry = (item as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry?.()
    if (entry) entries.push(entry)
  }

  if (!entries.length) return Array.from(dt.files)

  const walk = async (entry: FsEntry, depth = 0): Promise<void> => {
    if (depth > 8) return
    if (entry.isFile && entry.file) {
      const file = await new Promise<File | null>((res) => entry.file!(res))
      if (file) out.push(file)
      return
    }
    if (entry.isDirectory && entry.createReader) {
      const reader = entry.createReader()
      // readEntries returns at most 100 entries per call.
      for (;;) {
        const batch = await new Promise<FsEntry[]>((res) => reader.readEntries(res))
        if (!batch.length) break
        for (const child of batch) await walk(child, depth + 1)
      }
    }
  }

  for (const e of entries) await walk(e)
  return out
}

/* ─── Hashing via worker ─────────────────────────────────────── */

let worker: Worker | null = null
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../../workers/hash.worker.ts', import.meta.url))
  }
  return worker
}

function hashFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = getWorker()
    const onMessage = (e: MessageEvent) => {
      if (e.data.type === 'done') {
        w.removeEventListener('message', onMessage)
        resolve(e.data.hash)
      } else if (e.data.type === 'error') {
        w.removeEventListener('message', onMessage)
        reject(new Error(e.data.error))
      }
    }
    w.addEventListener('message', onMessage)
    w.postMessage({ file })
  })
}

/* ─── Global drop target ─────────────────────────────────────── */

export function GlobalDrop() {
  const [over, setOver] = React.useState(false)
  const depth = React.useRef(0)
  const { add, update } = useUploadStore()

  React.useEffect(() => {
    const enter = (e: DragEvent) => {
      e.preventDefault()
      depth.current++
      setOver(true)
    }
    const leave = (e: DragEvent) => {
      e.preventDefault()
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setOver(false)
    }
    const overFn = (e: DragEvent) => {
      e.preventDefault()
    }
    const drop = async (e: DragEvent) => {
      e.preventDefault()
      depth.current = 0
      setOver(false)
      const files = await collectFiles(e.dataTransfer!)
      for (const file of files) void enqueue(file, add, update)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overFn)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overFn)
      window.removeEventListener('drop', drop)
    }
  }, [add, update])

  if (!over) return null

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-bg/85 backdrop-blur-md animate-fade-in">
      <div className="grid-paper pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <span className="absolute inset-0 animate-pulse-ring rounded-3xl bg-accent/25" />
          <span className="relative grid size-16 place-items-center rounded-3xl border border-line/12 bg-surface shadow-pop">
            <Upload className="size-6 text-accent" />
          </span>
        </div>
        <div>
          <p className="text-[19px] font-semibold tracking-tight">Drop it on the shelf</p>
          <p className="mt-1 text-[13px] text-muted">
            CBZ · PDF · PPTX · DOCX · EPUB — folders are walked automatically
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Upload pipeline (client half) ──────────────────────────── */

async function enqueue(
  file: File,
  add: (t: UploadTask) => void,
  update: (id: string, patch: Partial<UploadTask>) => void,
) {
  const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  add({ id, name: file.name, size: file.size, type: file.name.split('.').pop()?.toLowerCase(), status: 'hashing', progress: 0 })

  try {
    const hash = await hashFile(file)
    update(id, { status: 'uploading', progress: 0.4, detail: 'hash ' + hash.slice(0, 12) })

    const initRes = await fetch('/api/upload/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: file.name, size: file.size, mime: file.type, hash }),
    })
    const init = await initRes.json()

    if (init.duplicate) {
      update(id, { status: 'done', progress: 1, detail: 'already in your library' })
      return
    }

    // Upload straight to storage via the presigned URL when one is issued.
    if (init.uploadUrl) {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', init.uploadUrl)
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)))
        xhr.onerror = () => reject(new Error('network error'))
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) update(id, { progress: 0.4 + 0.4 * (e.loaded / e.total) })
        }
        xhr.send(file)
      })
    } else {
      // Demo mode — no storage configured, simulate the transfer.
      for (let p = 0.4; p <= 0.8; p += 0.08) {
        await new Promise((r) => setTimeout(r, 70))
        update(id, { progress: p })
      }
    }

    await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: init.itemId, path: init.path ?? `originals/${file.name}` }),
    })

    update(id, { status: 'processing', progress: 0.85, detail: 'converting pages · running OCR' })
    await new Promise((r) => setTimeout(r, 1600))
    update(id, { status: 'done', progress: 1, detail: 'ready' })
  } catch (err) {
    update(id, { status: 'error', progress: 0, error: String(err) })
  }
}

/* ─── Upload tray ────────────────────────────────────────────── */

export function UploadTray() {
  const { open, setOpen, tasks, clear } = useUploadStore()
  const router = useRouter()
  const fileInput = React.useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = React.useState(false)

  const add = useUploadStore((s) => s.add)
  const update = useUploadStore((s) => s.update)

  async function onFiles(list: FileList | null) {
    if (!list) return
    for (const f of Array.from(list)) void enqueue(f, add, update)
  }

  if (!open) return null

  const active = tasks.filter((t) => t.status !== 'done' && t.status !== 'error').length

  return (
    <>
      <div className="fixed inset-0 z-[85] bg-black/40 backdrop-blur-[2px] animate-fade-in" onClick={() => setOpen(false)} />
      <div className="fixed bottom-4 right-4 z-[86] w-[min(420px,calc(100vw-2rem))] animate-scale-in overflow-hidden rounded-2xl border border-line/12 bg-surface shadow-pop">
        <div className="flex items-center gap-2 border-b border-line/8 px-4 py-3">
          <Upload className="size-4 text-accent" />
          <p className="text-[13px] font-semibold">Uploads</p>
          {active > 0 && <span className="rounded-md bg-accent/15 px-1.5 py-px text-[10.5px] font-semibold text-accent">{active} active</span>}
          <span className="flex-1" />
          <button onClick={() => clear()} className="text-[11.5px] text-faint transition hover:text-fg">
            Clear
          </button>
          <button onClick={() => setOpen(false)} className="grid size-6 place-items-center rounded-lg text-faint transition hover:bg-raised hover:text-fg" aria-label="Close">
            <X className="size-3.5" />
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragActive(false)
            void onFiles(e.dataTransfer.files)
          }}
          className={cn(
            'border-b border-line/8 p-3 transition',
            dragActive && 'bg-accent/8',
          )}
        >
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void onFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <Button variant="secondary" size="sm" className="w-full" onClick={() => fileInput.current?.click()}>
            <Upload /> Choose files
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-faint">or drop files / folders anywhere</p>
        </div>

        <div className="max-h-[46vh] overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-faint">Nothing uploaded yet.</p>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 border-b border-line/5 px-4 py-2.5 last:border-0">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-raised text-faint">
                  {t.type === 'cbz' ? <FileArchive className="size-3.5" /> : <FileText className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{t.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Progress value={t.progress * 100} className="h-1 flex-1" />
                    <span className="shrink-0 text-[10.5px] text-faint">{formatBytes(t.size)}</span>
                  </div>
                  {t.detail && <p className="mt-0.5 truncate text-[10.5px] text-faint">{t.detail}</p>}
                  {t.error && <p className="mt-0.5 truncate text-[10.5px] text-bad">{t.error}</p>}
                </div>
                <span className="shrink-0">
                  {t.status === 'done' && <CheckCircle2 className="size-4 text-good" />}
                  {t.status === 'error' && <XCircle className="size-4 text-bad" />}
                  {(t.status === 'hashing' || t.status === 'uploading' || t.status === 'processing') && (
                    <Loader2 className="size-4 animate-spin text-accent" />
                  )}
                </span>
              </div>
            ))
          )}
        </div>

        {tasks.some((t) => t.status === 'done') && (
          <div className="border-t border-line/8 px-4 py-2.5">
            <Button size="sm" className="w-full" onClick={() => { setOpen(false); router.push('/app/library') }}>
              Open library
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
