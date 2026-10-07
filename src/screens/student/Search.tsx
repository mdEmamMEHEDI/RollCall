import { useEffect, useState } from 'react'
import { Button, Icon, Radar, TopBar } from '../../components/hazira/ui'
import { MIN_RSSI, findClassByCode, type NearbyClass } from '../../services/ble'

function Signal({ rssi }: { rssi: number }) {
  const n = rssi > -65 ? 3 : rssi > -80 ? 2 : 1
  return (
    <span className="flex items-end gap-0.5" aria-label={`Signal ${n} of 3`}>
      {[1, 2, 3].map((b) => (
        <span key={b} className={`w-1 rounded-full ${b <= n ? 'bg-primary' : 'bg-line'}`} style={{ height: 4 + b * 4 }} />
      ))}
    </span>
  )
}

export function Search({
  code,
  demo,
  onBack,
  onConfirm,
  onFar,
}: {
  code: string
  demo: 'one' | 'two' | 'none' | 'far'
  onFar: () => void
  onBack: () => void
  onConfirm: (c: NearbyClass) => void
}) {
  const [found, setFound] = useState<NearbyClass[] | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    setFound(null)
    findClassByCode(code, n > 0 && demo === 'none' ? 'one' : demo).then((r) => {
      if (!live) return
      // Too weak = outside the room: never show the class, never send
      const near = r.filter((c) => c.rssi >= MIN_RSSI)
      if (r.length && !near.length) return onFar()
      setFound(near)
    })
    return () => {
      live = false
    }
  }, [code, demo, n])

  if (found && found.length === 0)
    return (
      <div className="flex h-full flex-col">
        <TopBar onBack={onBack} title="Find class" />
        <div className="anim-rise flex flex-1 flex-col px-6">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <NoClassArt />
            <h2 className="mt-6 font-display text-[24px] font-extrabold text-ink">No class with code {code}</h2>
            <p className="mt-1 text-[14px] text-ink-2">Check these things:</p>
            <ul className="mt-6 w-full space-y-2 text-left">
              {['Is the code the same as the board? It changes every 30 s', 'Has the teacher started the class?', 'Are you inside the room?'].map((t, i) => (
                <li key={t} className="flex items-center gap-3 rounded-base border border-line bg-surface px-4 py-3.5 text-[14px] text-ink">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mint font-display text-[13px] font-bold text-on-mint">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2 pb-8">
            <Button className="w-full" onClick={() => setN(n + 1)}>Search again</Button>
            <Button variant="text" className="w-full" onClick={onBack}>Type code again</Button>
          </div>
        </div>
      </div>
    )

  if (!found)
    return (
      <div className="flex h-full flex-col">
        <TopBar onBack={onBack} title="Find class" />
        <div className="flex flex-1 flex-col items-center pt-16 text-center">
          <Radar size={230} />
          <p className="mt-6 font-display text-[18px] font-bold text-ink">Looking for code {code}</p>
          <p className="mt-1 max-w-[28ch] text-[13px] text-ink-2">Other classes nearby are ignored. Only your teacher's phone matches this code.</p>
        </div>
      </div>
    )

  const many = found.length > 1
  return (
    <div className="flex h-full flex-col">
      <TopBar onBack={onBack} title={many ? 'Pick your class' : 'Is this your class?'} />
      <div className="flex-1 px-5 pt-2">
        {many && (
          <p className="mb-4 flex gap-2 rounded-base bg-mint px-4 py-3 text-[13px] leading-snug text-on-mint">
            <span className="shrink-0"><Icon name="alert" size={18} /></span>
            Two rooms nearby have the same code. Pick the one with your teacher and room.
          </p>
        )}
        <ul className="space-y-3">
          {found.map((c, i) => (
            <li key={c.sessionId} className="anim-rise rounded-sheet border border-line bg-surface p-5" style={{ animationDelay: `${i * 120}ms` }}>
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary font-display text-[16px] font-extrabold text-on-primary">
                  {c.teacher.replace('Dr. ', '').split(' ').map((w) => w[0]).join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[18px] font-extrabold leading-tight text-ink">{c.teacher}</p>
                  <p className="text-[13px] text-ink-2">{c.designation}</p>
                </div>
                <Signal rssi={c.rssi} />
              </div>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
                <dt className="text-ink-2">Course</dt><dd className="font-semibold text-ink">{c.course}</dd>
                <dt className="text-ink-2">Section</dt><dd className="font-semibold text-ink">{c.section}</dd>
                <dt className="text-ink-2">Room</dt><dd className="font-semibold text-ink">{c.room}</dd>
              </dl>
              {many && (
                <Button className="mt-4 w-full h-12!" onClick={() => onConfirm(c)}>This is my class</Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {!many && (
        <div className="space-y-2 px-6 pb-8">
          <Button className="w-full" icon={<Icon name="check" size={20} stroke={3} />} onClick={() => onConfirm(found[0])}>
            Confirm attendance
          </Button>
          <Button variant="text" className="w-full" onClick={onBack}>Not my class</Button>
        </div>
      )}
    </div>
  )
}

function NoClassArt() {
  return (
    <svg width="150" height="120" viewBox="0 0 150 120" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5">
      <rect x="45" y="22" width="44" height="76" rx="10" stroke="var(--primary)" />
      <path d="M60 30h14" stroke="var(--primary)" />
      <path d="M100 40a22 22 0 010 30M110 32a34 34 0 010 46" stroke="var(--line)" />
      <path d="M100 40a22 22 0 010 30" stroke="#F5A524" strokeDasharray="4 6" />
      <circle cx="67" cy="60" r="9" stroke="#F5A524" />
      <path d="M67 56v4M67 63.5v.5" stroke="#F5A524" />
      <path d="M20 104h110" stroke="var(--line)" />
    </svg>
  )
}

export function Connecting({ cls }: { cls: string }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setStep(1), 1100)
    return () => clearTimeout(t)
  }, [])
  const steps = ['Sending your ID, signed by this phone', 'Waiting for teacher to confirm']
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="relative size-24">
        <span className="absolute inset-0 rounded-full border-[6px] border-mint" />
        <span className="anim-spin absolute inset-0 rounded-full border-[6px] border-transparent border-t-primary" />
        <span className="absolute inset-0 grid place-items-center text-primary"><Icon name="nearby" size={30} /></span>
      </div>
      <p className="mt-8 text-[14px] text-ink-2">Sending to</p>
      <p className="mt-1 font-display text-[24px] font-extrabold text-ink">{cls}</p>
      <ol className="mt-6 space-y-2 text-left">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-2.5 text-[14px] ${i <= step ? 'text-ink' : 'text-ink-2/60'}`}>
            <span className={`grid size-5 place-items-center rounded-full ${i < step ? 'bg-primary text-on-primary' : 'border-2 border-current'}`}>
              {i < step && <Icon name="check" size={12} stroke={3} />}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <p className="mt-6 max-w-[30ch] text-[12px] text-ink-2">No hotspot or Wi-Fi. Your phone just broadcasts, so the whole class can join at once.</p>
    </div>
  )
}
