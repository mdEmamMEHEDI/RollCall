import { useEffect, useRef, useState } from 'react'
import { BottomSheet, Button, Icon, Radar, Spinner, StudentRow, SystemDialog, Toast, shortId, type Student } from '../../components/hazira/ui'
import { saveOffline, uploadAttendance, type Session } from '../../services/attendance'
import { FAR_RSSI, hostSession, idDigits, isNative } from '../../services/ble'
import { Ble, phoneReady, turnOnNative, usePhoneState } from '../../services/native'
import { newCode, roster as demoRoster } from './data'

export type SaveStatus = 'uploaded' | 'saved'

const CYCLE = 30

function CountdownRing({ left }: { left: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#0f1b2d" strokeOpacity="0.14" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#0f1b2d"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - left / CYCLE)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-[17px] font-extrabold tabular-nums text-[#0f1b2d]">
        {left}
      </span>
    </div>
  )
}

export default function LiveClass({
  className,
  empty,
  btOff: btOffInit,
  window: windowMin,
  closed: closedInit = false,
  total,
  room = '',
  teacher = 'Dr. Nasrin Sultana',
  students: roster = demoRoster,
  onEnd,
}: {
  className: string
  empty: boolean
  btOff: boolean
  window: number
  closed?: boolean
  total: number
  room?: string
  teacher?: string
  // The class list loaded on Load class (server roster); Bluetooth and manual marking match against it
  students?: Student[]
  onEnd: (list: Student[], status: SaveStatus) => void
}) {
  const [startedAt] = useState(() => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
  const [uploading, setUploading] = useState(false)
  const [upErr, setUpErr] = useState('')
  const toSession = (): Session => ({
    id: `${className}-${new Date().toISOString().slice(0, 10)}`,
    course: className,
    date: new Date().toLocaleString(),
    total,
    present: list.map((s) => ({ id: s.roll, name: s.name, time: s.time })),
  })
  async function upload() {
    setUpErr('')
    setUploading(true)
    try {
      await uploadAttendance(toSession())
      onEnd(list, 'uploaded')
    } catch (e) {
      setUpErr((e as Error).message)
      setUploading(false)
    }
  }
  const [remaining, setRemaining] = useState(closedInit ? 0 : windowMin * 60)
  const closed = remaining <= 0
  const [code, setCode] = useState(newCode)
  const [left, setLeft] = useState(CYCLE)
  const [list, setList] = useState<Student[]>(() => (empty || isNative ? [] : roster.slice(0, 18).reverse()))
  const [fresh, setFresh] = useState<number | null>(null)
  const [btOff, setBtOff] = useState(btOffInit)
  const [btAsk, setBtAsk] = useState(false)
  // Android app: pause and warn the moment Bluetooth, Location or the permission goes off mid-class
  const phone = usePhoneState()
  useEffect(() => {
    if (phone) setBtOff(!phoneReady(phone))
  }, [phone])
  const offKey = !phone ? 'bluetooth' : !phone.nearby ? 'nearby' : !phone.bluetooth ? 'bluetooth' : !phone.location ? 'location' : 'bluetooth'
  const offLabel = { bluetooth: 'Bluetooth is off.', location: 'Location is off.', nearby: 'Nearby devices is not allowed.' }[offKey]
  const [removed, setRemoved] = useState<{ s: Student; idx: number } | null>(null)
  const [sheet, setSheet] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [q, setQ] = useState('')
  const [added, setAdded] = useState<string | null>(null)
  const [review, setReview] = useState<Student[]>([])
  const absent = roster.filter(
    (s) => !list.some((x) => x.id === s.id) && !review.some((x) => x.id === s.id) && (s.name.toLowerCase().includes(q.toLowerCase()) || s.roll.includes(q)),
  )
  function markPresent(s: Student) {
    const now = new Date()
    const time = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} · by you`
    setList((l) => [{ ...s, time }, ...l])
    setFresh(s.id)
    setAdded(s.name)
  }
  const next = useRef(18)
  const [confirming, setConfirming] = useState(0)

  useEffect(() => {
    if (closed) return
    const t = setInterval(() => {
      setRemaining((r) => r - 1)
      setLeft((l) => {
        if (l <= 1) {
          setCode(newCode())
          return CYCLE
        }
        return l - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [closed])

  useEffect(() => {
    if (isNative || empty || btOff || closed) return
    const t = setInterval(() => {
      // Students arrive in bursts, like a real class typing the code at once. 4 never show up.
      if (next.current >= roster.length - 4) return
      const burst = roster.slice(next.current, next.current + 2 + Math.floor(Math.random() * 3))
      next.current += burst.length
      setConfirming((c) => c + burst.length)
      setTimeout(() => {
        setConfirming((c) => c - burst.length)
        const ok: Student[] = []
        const flagged: Student[] = []
        for (const s of burst) {
          if (s.id === 27) flagged.push({ ...s, flag: 'far' })
          else if (s.id === 39) flagged.push({ ...s, flag: 'dup' })
          else ok.push(s)
        }
        if (ok.length) {
          setFresh(ok[ok.length - 1].id)
          setList((l) => [...ok.reverse(), ...l])
        }
        if (flagged.length) setReview((v) => [...flagged, ...v])
      }, 1100)
    }, 1800)
    return () => clearInterval(t)
  }, [empty, btOff, closed])

  // Android app: real Bluetooth instead of the simulation above
  const host = useRef<ReturnType<typeof hostSession> | null>(null)
  const acks = useRef(new Map<number, string>())
  useEffect(() => {
    if (!isNative || closed || btOff) return
    const [course, section = ''] = className.split(' · ')
    const usedBy = new Map<string, string>()
    const h = hostSession({ teacher, course, section, room }, (a) => {
      const s = roster.find((r) => idDigits(r.roll) === a.idDigits)
      if (!s) return
      // Device binding: the phone an ID used before, and one phone sending two IDs
      const known: Record<string, string> = JSON.parse(localStorage.getItem('rollcall.devices') ?? '{}')
      const dup = (known[a.idDigits] && known[a.idDigits] !== a.deviceId) || (usedBy.has(a.deviceId) && usedBy.get(a.deviceId) !== a.idDigits)
      usedBy.set(a.deviceId, a.idDigits)
      if (!known[a.idDigits]) localStorage.setItem('rollcall.devices', JSON.stringify({ ...known, [a.idDigits]: a.deviceId }))
      acks.current.set(s.id, a.ack)
      const now = new Date()
      const st = { ...s, time: `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}` }
      const flag = a.rssi < FAR_RSSI ? 'far' : dup ? 'dup' : undefined
      if (flag) {
        setReview((v) => (v.some((x) => x.id === s.id) ? v : [{ ...st, flag }, ...v]))
        return
      }
      setFresh(s.id)
      setList((l) => (l.some((x) => x.id === s.id) ? l : [st, ...l]))
    })
    host.current = h
    return () => {
      host.current = null
      h.stop()
    }
  }, [closed, btOff])
  useEffect(() => {
    host.current?.setCode(code)
  }, [code, closed, btOff])
  useEffect(() => {
    host.current?.setAcks(list.map((s) => acks.current.get(s.id)).filter((x): x is string => !!x))
  }, [btOff])
  useEffect(() => {
    host.current?.setAcks(list.map((s) => acks.current.get(s.id)).filter((x): x is string => !!x))
  }, [list])

  useEffect(() => {
    if (!added) return
    const t = setTimeout(() => setAdded(null), 2500)
    return () => clearTimeout(t)
  }, [added])

  useEffect(() => {
    if (!removed) return
    const t = setTimeout(() => setRemoved(null), 5000)
    return () => clearTimeout(t)
  }, [removed])

  const mm = Math.floor(Math.max(remaining, 0) / 60)
  const ss = String(Math.max(remaining, 0) % 60).padStart(2, '0')

  return (
    <div className="relative flex h-full flex-col">
      {btOff && (
        <div className="anim-rise mx-4 mt-2 flex items-center gap-3 rounded-base bg-red-soft px-4 py-3 text-red">
          <Icon name={offKey} size={20} />
          <p className="flex-1 text-[13px] leading-snug">
            <b className="font-semibold">{offLabel}</b> New students can't join until you turn it on.
          </p>
          <button onClick={() => (phone ? turnOnNative(offKey).then((ok) => void (!ok && offKey === 'nearby' && Ble.openAppSettings())).catch(() => {}) : setBtAsk(true))} className="h-9 rounded-xl bg-red px-4 font-display text-[13px] font-bold text-white">
            Turn on
          </button>
        </div>
      )}
      {btAsk && (
        <SystemDialog
          text="Allow RollCall to turn on Bluetooth?"
          onAllow={() => {
            setBtAsk(false)
            setBtOff(false)
          }}
          onDeny={() => setBtAsk(false)}
        />
      )}

      {/* Header: class, status and time left */}
      <div className="flex items-center gap-3 px-5 pb-3 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[16px] font-bold text-ink">{className}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <span className={`size-1.5 rounded-full ${closed ? 'bg-ink-2' : btOff ? 'bg-red' : 'anim-blink bg-primary'}`} />
            {closed ? 'Closed' : btOff ? 'Paused' : 'Live'} · Started {startedAt}
          </p>
        </div>
        {!closed && (
          <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 font-display text-[14px] font-bold tabular-nums text-ink" aria-label="Time left">
            <Icon name="clock" size={16} />
            {mm}:{ss}
          </span>
        )}
      </div>

      {/* The hero: amber code panel */}
      {closed ? (
        <div className="anim-rise mx-4 flex items-center gap-4 rounded-sheet bg-mint px-5 py-6 text-on-mint">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
            <Icon name="check" size={28} stroke={3} />
          </span>
          <div>
            <p className="font-display text-[22px] font-extrabold leading-tight">Attendance closed</p>
            <p className="mt-0.5 text-[13px] text-ink-2">Time is over. No one else can join today.</p>
          </div>
        </div>
      ) : (
        <div className="mx-4 rounded-sheet bg-amber px-5 pb-5 pt-4 text-[#0f1b2d]">
          <div className="flex items-center justify-between">
            <p className="font-display text-[12.5px] font-bold uppercase tracking-[0.16em] opacity-80">Class code</p>
            <CountdownRing left={left} />
          </div>
          <p key={code} className="anim-code -mt-2 font-display text-[88px] font-extrabold leading-[0.95] tracking-[0.12em] tabular-nums">
            {code}
          </p>
          <p className="mt-1 text-[12.5px] font-medium opacity-70">Show this on the board · Changes every 30 s</p>
        </div>
      )}

      {/* Count */}
      <div className="mx-4 mt-3 rounded-sheet border border-line bg-surface px-5 py-4 shadow-card">
        <div className="flex items-baseline gap-2">
          <p className="font-display text-[34px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-primary">{list.length}</p>
          <p className="text-[14px] text-ink-2">of {total} present</p>
          {confirming > 0 && (
            <span className="anim-pop ml-auto flex items-center gap-1.5 self-center text-[12.5px] font-semibold text-primary">
              <Spinner size={12} /> {confirming} confirming
            </span>
          )}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${Math.min(list.length / Math.max(total, 1), 1) * 100}%`, transition: 'width 0.5s ease-out' }}
          />
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-ink-2">
          {closed ? (
            'Final count'
          ) : btOff ? (
            'Paused. Students can join again once it is back on.'
          ) : (
            <>
              <Icon name="broadcast" size={14} /> Broadcasting · {Math.max(total - list.length - review.length, 0)} not joined yet
            </>
          )}
        </p>
      </div>

      <div className="no-scrollbar mt-3 flex-1 overflow-y-auto px-3 pb-28">
        {review.length > 0 && (
          <div className="anim-rise mx-1 mb-3 rounded-2xl border border-amber/60 bg-amber/10 p-3">
            <p className="px-1 font-display text-[13px] font-bold uppercase tracking-[0.1em] text-ink">Needs your check · {review.length}</p>
            <ul className="mt-1">
              {review.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-1 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{s.name}</p>
                    <p className="text-[12px] leading-snug text-ink-2">
                      {s.flag === 'far' ? 'Very weak signal. Maybe outside the room.' : 'Same phone already marked 241-35-007.'}
                    </p>
                  </div>
                  <button
                    aria-label={`Reject ${s.name}`}
                    onClick={() => setReview((v) => v.filter((x) => x.id !== s.id))}
                    className="grid size-9 place-items-center rounded-full text-red hover:bg-red-soft"
                  >
                    <Icon name="x" size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setReview((v) => v.filter((x) => x.id !== s.id))
                      setFresh(s.id)
                      setList((l) => [{ ...s, flag: undefined }, ...l])
                    }}
                    className="h-9 rounded-xl bg-primary px-3 font-display text-[13px] font-bold text-on-primary"
                  >
                    Accept
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {list.length === 0 ? (
          <div className="flex flex-col items-center pt-4 text-center">
            <Radar size={190} />
            <p className="mt-2 font-display text-[18px] font-bold text-ink">Waiting for students to join</p>
            <p className="mt-1 max-w-[30ch] text-[13px] text-ink-2">Ask students to open RollCall, tap Find class and type the code.</p>
          </div>
        ) : (
          <ul>
            {list.map((s, idx) => (
              <StudentRow
                key={s.id}
                s={s}
                animate={s.id === fresh}
                onRemove={() => {
                  setList((l) => l.filter((x) => x.id !== s.id))
                  setRemoved({ s, idx })
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {removed && (
        <div className="absolute inset-x-4 bottom-28 z-20">
          <Toast
            text={`${removed.s.name} removed`}
            action="Undo"
            onAction={() => {
              setList((l) => [...l.slice(0, removed.idx), removed.s, ...l.slice(removed.idx)])
              setRemoved(null)
            }}
          />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex gap-3 border-t border-line bg-bg/90 px-4 pb-7 pt-3 backdrop-blur">
        <Button variant="secondary" className="flex-1" icon={<Icon name="users" size={20} />} onClick={() => setAddOpen(true)}>
          Add manually
        </Button>
        {closed ? (
          <Button className="flex-1" onClick={() => setSheet(true)}>
            Save attendance
          </Button>
        ) : (
          <Button className="flex-1" onClick={() => setSheet(true)}>
            End class
          </Button>
        )}
      </div>

      <BottomSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          setQ('')
        }}
      >
        <h2 className="font-display text-[24px] font-extrabold tracking-[-0.02em] text-ink">Mark present manually</h2>
        <p className="mt-1 text-[14px] text-ink-2">For students whose phone didn't work. You can undo with × on the list.</p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or ID, e.g. 024"
          className="mt-4 h-12 w-full rounded-base border-2 border-line bg-bg px-4 text-[15px] text-ink outline-none placeholder:text-ink-2/60 focus:border-primary"
        />
        <ul className="no-scrollbar -mx-3 mt-2 max-h-[300px] overflow-y-auto">
          {absent.length === 0 ? (
            <li className="px-3 py-6 text-center text-[14px] text-ink-2">{q ? 'No match' : 'Everyone is present'}</li>
          ) : (
            absent.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-base px-3 py-2">
                <span className="grid h-11 min-w-[56px] shrink-0 place-items-center rounded-xl bg-mint px-2 font-display text-[17px] font-extrabold tabular-nums tracking-[0.02em] text-on-mint">
                  {shortId(s.roll)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{s.name}</p>
                  <p className="truncate text-[12px] tabular-nums text-ink-2">{s.roll}</p>
                </div>
                <button
                  onClick={() => markPresent(s)}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-mint px-3 font-display text-[13px] font-bold text-on-mint hover:brightness-95"
                >
                  <Icon name="check" size={16} stroke={3} /> Present
                </button>
              </li>
            ))
          )}
        </ul>
        {added && (
          <div className="mt-3">
            <Toast text={`${added} marked present`} />
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={sheet} onClose={() => setSheet(false)}>
        <h2 className="font-display text-[24px] font-extrabold tracking-[-0.02em] text-ink">{closed ? 'Save attendance' : 'End this class?'}</h2>
        <p className="mt-1 text-[14px] text-ink-2">
          {closed ? 'Upload now, or keep it on this phone if there is no internet.' : `${mm}:${ss} left. Students who haven't joined will be marked absent.`}
        </p>
        <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-base border border-line">
          {[
            ['Present', list.length, 'text-primary'],
            ['Absent', Math.max(total - list.length, 0), 'text-red'],
            ['Total', total, 'text-ink'],
          ].map(([l, v, c], i) => (
            <div key={l as string} className={`px-4 py-3 ${i ? 'border-l border-line' : ''}`}>
              <p className={`font-display text-[30px] font-extrabold tabular-nums ${c}`}>{v}</p>
              <p className="text-[12px] text-ink-2">{l}</p>
            </div>
          ))}
        </div>
        {upErr && (
          <p className="anim-rise mt-4 flex gap-2 rounded-base bg-red-soft px-4 py-3 text-[13px] leading-snug text-red">
            <span className="shrink-0"><Icon name="alert" size={18} /></span>
            {upErr}
          </p>
        )}
        <div className="mt-6 space-y-2">
          <Button className="w-full" disabled={uploading} onClick={upload} icon={uploading ? <Spinner /> : <Icon name="share" size={20} />}>
            {uploading ? 'Uploading…' : 'Upload to server'}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            disabled={uploading}
            icon={<Icon name="download" size={20} />}
            onClick={() => {
              saveOffline(toSession())
              onEnd(list, 'saved')
            }}
          >
            Save on phone
          </Button>
          {!closed && <Button variant="text" className="w-full" onClick={() => setSheet(false)}>Keep class open</Button>}
        </div>
      </BottomSheet>
    </div>
  )
}
