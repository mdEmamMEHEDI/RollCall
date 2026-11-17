import { useEffect, useState } from 'react'
import { Button, Icon, Spinner, StudentRow, Toast, TopBar, type Student } from '../../components/hazira/ui'
import { listSaved, markUploaded, uploadAttendance } from '../../services/attendance'
import { exportCsv, shareReport, type Report } from '../../services/export'
import type { SaveStatus } from './LiveClass'

export default function Summary({
  className,
  total,
  list,
  roster = [],
  room = '',
  teacher = 'Dr. Nasrin Sultana',
  status: initStatus,
  onDone,
}: {
  className: string
  total: number
  list: Student[]
  // Whole class (from Load class) so the CSV can list absent students too
  roster?: Student[]
  room?: string
  teacher?: string
  status: SaveStatus
  onDone: () => void
}) {
  const sorted = [...list].sort((a, b) => a.roll.localeCompare(b.roll))
  const absent = Math.max(total - list.length, 0)
  const rate = total ? Math.round((list.length / total) * 100) : 0
  const [status, setStatus] = useState(initStatus)
  const [busy, setBusy] = useState(false)
  const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const [upAt, setUpAt] = useState(clock)
  const today = new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!err) return
    const t = setTimeout(() => setErr(''), 4000)
    return () => clearTimeout(t)
  }, [err])

  const [exporting, setExporting] = useState<'csv' | 'share' | null>(null)
  const [closedAt] = useState(clock)
  const report = (): Report => ({ className, date: new Date(), closedAt, total, present: list, roster, room, teacher })

  async function onCsv() {
    setExporting('csv')
    try {
      const r = await exportCsv(report())
      if (r === 'downloaded') setErr('CSV downloaded')
    } catch {
      setErr("Couldn't create the CSV. Try again.")
    }
    setExporting(null)
  }

  async function onShare() {
    setExporting('share')
    try {
      const r = await shareReport(report())
      if (r === 'downloaded') setErr('PDF downloaded and message copied')
    } catch {
      setErr("Couldn't open sharing. Try again.")
    }
    setExporting(null)
  }

  async function uploadNow() {
    setBusy(true)
    try {
      const mine = listSaved().filter((s) => s.course === className)
      await uploadAttendance(mine)
      markUploaded(mine.map((s) => s.id))
      setUpAt(clock())
      setStatus('uploaded')
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <div className="relative flex h-full flex-col">
      <TopBar onBack={onDone} title="Session summary" />
      <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-28">
        {status === 'uploaded' ? (
          <div className="anim-rise mb-5 flex items-center gap-3 rounded-base bg-mint px-4 py-3 text-on-mint">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
              <Icon name="check" size={16} stroke={3} />
            </span>
            <p className="flex-1 text-[14px] font-semibold">Uploaded to server · {upAt}</p>
          </div>
        ) : (
          <div className="anim-rise mb-5 flex items-center gap-3 rounded-base border border-line bg-surface shadow-card px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-bg text-ink-2">
              <Icon name="download" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink">Saved on this phone</p>
              <p className="text-[12px] text-ink-2">Not uploaded yet</p>
            </div>
            <button
              onClick={uploadNow}
              disabled={busy}
              className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 font-display text-[13px] font-bold text-on-primary disabled:opacity-70"
            >
              {busy && <Spinner size={14} />}
              {busy ? 'Uploading' : 'Upload now'}
            </button>
          </div>
        )}
        <p className="text-[13px] text-ink-2">{today} · Closed {closedAt}</p>
        <h2 className="mt-1 font-display text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{className}</h2>

        <div className="mt-5 rounded-sheet border border-line bg-surface p-5 shadow-card">
          <div className="grid grid-cols-3">
            {(
              [
                ['Present', list.length, 'text-primary'],
                ['Absent', absent, 'text-red'],
                ['Attendance', `${rate}%`, 'text-ink'],
              ] as const
            ).map(([l, v, c], i) => (
              <div key={l} className={i ? 'border-l border-line pl-4' : ''}>
                <p className={`font-display text-[28px] font-extrabold leading-none tabular-nums ${c}`}>{v}</p>
                <p className="mt-1.5 text-[12.5px] text-ink-2">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-red-soft">
            <span className="rounded-full bg-primary" style={{ width: `${rate}%` }} />
          </div>
        </div>

        <h3 className="mb-1 mt-8 font-display text-[15px] font-bold text-ink">Present · {list.length}</h3>
        <ul className="-mx-3">
          {sorted.map((s) => (
            <StudentRow key={s.id} s={s} />
          ))}
        </ul>
      </div>
      {err && (
        <div className="absolute inset-x-4 bottom-28 z-20">
          <Toast text={err} />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex gap-3 border-t border-line bg-bg/90 px-4 pb-7 pt-3 backdrop-blur">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={!!exporting}
          onClick={onCsv}
          icon={exporting === 'csv' ? <Spinner /> : <Icon name="download" size={20} />}
        >
          CSV
        </Button>
        <Button className="flex-[2]" disabled={!!exporting} onClick={onShare} icon={exporting === 'share' ? <Spinner /> : <Icon name="share" size={20} />}>
          Share report
        </Button>
      </div>
    </div>
  )
}
