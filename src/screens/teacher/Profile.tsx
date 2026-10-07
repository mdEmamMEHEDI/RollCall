import { useState } from 'react'
import { Button, Icon, Spinner } from '../../components/hazira/ui'
import { listSaved, markUploaded, uploadAttendance } from '../../services/attendance'

// Mock profile until the login API is connected
const teacher = {
  name: 'Dr. Nasrin Sultana',
  designation: 'Associate Professor',
  employeeId: '710001842',
  department: 'Computer Science & Engineering',
  faculty: 'Science & Information Technology',
}

export default function Profile({ onStart, onLogout }: { onStart: () => void; onLogout: () => void }) {
  const rows = [
    ['Employee ID', teacher.employeeId],
    ['Department', teacher.department],
    ['Faculty', teacher.faculty],
  ]
  const [pending, setPending] = useState(() => listSaved().length)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  async function uploadAll() {
    setBusy(true)
    setNote('')
    const all = listSaved()
    try {
      await uploadAttendance(all)
      markUploaded(all.map((s) => s.id))
      setPending(0)
      setNote('All sessions uploaded')
    } catch {
      setNote('Still no internet. Try again later.')
    }
    setBusy(false)
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end px-4 pt-2">
        <button onClick={onLogout} className="h-10 rounded-full px-4 text-[14px] font-semibold text-ink-2 hover:bg-mint">
          Log out
        </button>
      </div>
      <div className="flex-1 px-6">
        <div className="flex flex-col items-center pt-6 text-center">
          <span className="grid size-24 place-items-center rounded-full bg-primary font-display text-[32px] font-extrabold text-on-primary shadow-[0_0_0_8px_var(--mint)]">
            NS
          </span>
          <h1 className="mt-6 font-display text-[26px] font-extrabold tracking-[-0.02em] text-ink">{teacher.name}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{teacher.designation}</p>
        </div>
        <dl className="mt-8 rounded-sheet border border-line bg-surface px-5">
          {rows.map(([k, v], i) => (
            <div key={k} className={`py-4 ${i ? 'border-t border-line' : ''}`}>
              <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-2">{k}</dt>
              <dd className={`mt-1 text-[16px] font-semibold text-ink ${k === 'Employee ID' ? 'font-display tabular-nums tracking-[0.04em]' : ''}`}>{v}</dd>
            </div>
          ))}
        </dl>
        {(pending > 0 || note) && (
          <div className="anim-rise mt-4 flex items-center gap-3 rounded-base bg-mint px-4 py-3 text-on-mint">
            <Icon name={pending ? 'alert' : 'check'} size={20} />
            <p className="min-w-0 flex-1 text-[14px] font-semibold">
              {note || `${pending} session${pending > 1 ? 's' : ''} not uploaded`}
            </p>
            {pending > 0 && (
              <button
                onClick={uploadAll}
                disabled={busy}
                className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-primary px-4 font-display text-[13px] font-bold text-on-primary disabled:opacity-70"
              >
                {busy && <Spinner size={14} />}
                {busy ? 'Uploading' : 'Upload all'}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="px-6 pb-8">
        <Button className="w-full" icon={<Icon name="broadcast" />} onClick={onStart}>
          Start attendance
        </Button>
      </div>
    </div>
  )
}
