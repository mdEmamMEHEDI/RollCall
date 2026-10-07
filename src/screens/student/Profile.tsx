import { Button, Icon } from '../../components/hazira/ui'

// Mock profile until the DIU login API is connected
const me = { name: 'Ayesha Rahman', id: '221-15-4821', dept: 'Computer Science & Engineering', batch: '61_A' }

export default function Profile({ onAttend, onLogout }: { onAttend: () => void; onLogout: () => void }) {
  const rows = [
    ['Student ID', me.id],
    ['Department', me.dept],
    ['Batch · Section', me.batch],
  ]
  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end px-4 pt-2">
        <button onClick={onLogout} className="h-10 rounded-full px-4 text-[14px] font-semibold text-ink-2 hover:bg-mint">Log out</button>
      </div>
      <div className="flex-1 px-6">
        <div className="flex flex-col items-center pt-6 text-center">
          <span className="grid size-24 place-items-center rounded-full bg-primary font-display text-[32px] font-extrabold text-on-primary shadow-[0_0_0_8px_var(--mint)]">
            AR
          </span>
          <h1 className="mt-6 font-display text-[26px] font-extrabold tracking-[-0.02em] text-ink">{me.name}</h1>
          <p className="mt-1 text-[15px] text-ink-2">Student</p>
        </div>
        <dl className="mt-8 rounded-sheet border border-line bg-surface px-5">
          {rows.map(([k, v], i) => (
            <div key={k} className={`py-4 ${i ? 'border-t border-line' : ''}`}>
              <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-2">{k}</dt>
              <dd className={`mt-1 text-[16px] font-semibold text-ink ${k === 'Student ID' ? 'font-display tabular-nums tracking-[0.04em]' : ''}`}>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 flex gap-2 text-[13px] leading-snug text-ink-2">
          <span className="shrink-0"><Icon name="nearby" size={16} /></span>
          This phone is linked to your ID. Attendance works only inside the classroom.
        </p>
      </div>
      <div className="px-6 pb-8">
        <Button className="w-full" icon={<Icon name="broadcast" />} onClick={onAttend}>Attend class</Button>
      </div>
    </div>
  )
}
