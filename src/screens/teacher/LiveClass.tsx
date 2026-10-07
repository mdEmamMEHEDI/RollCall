import { useEffect, useRef, useState } from 'react'
import { BottomSheet, Button, Icon, Radar, Spinner, StudentRow, SystemDialog, Toast, type Student } from '../../components/hazira/ui'
import { saveOffline, uploadAttendance, type Session } from '../../services/attendance'
import { FAR_RSSI, hostSession, idDigits, isNative } from '../../services/ble'
import { newCode, roster } from './data'

export type SaveStatus = 'uploaded' | 'saved'

const CYCLE = 30

function CountdownRing({ left }: { left: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#14211f" strokeOpacity="0.14" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#14211f"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - left / CYCLE)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-[17px] font-extrabold tabular-nums text-[#14211f]">
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
    if (!isNative || closed) return
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
  }, [closed])
  useEffect(() => {
    host.current?.setCode(code)
  }, [code, closed])
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
          <Icon name="bluetooth" size={20} />
          <p className="flex-1 text-[13px] leading-snug">
            <b className="font-semibold">Bluetooth is off.</b> New students can't join until you turn it on.
          </p>
          <button onClick={() => setBtAsk(true)} className="h-9 rounded-full bg-red px-4 font-display text-[13px] font-bold text-white">
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

      <div className="flex items-center gap-2 px-6 pb-3 pt-3">
        <span className={`size-2 rounded-full ${closed ? 'bg-ink-2' : btOff ? 'bg-red' : 'anim-blink bg-primary'}`} />
        <p className="flex-1 truncate text-[13px] font-semibold text-ink-2">
          {closed ? 'Closed' : btOff ? 'Paused' : 'Live'} · {className}
        </p>
        <p className="text-[13px] tabular-nums text-ink-2">{startedAt}</p>
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
        <div className="mx-4 rounded-sheet bg-amber px-5 pb-5 pt-4 text-[#14211f] shadow-[0_18px_40px_-18px_rgba(245,165,36,0.8)]">
          <div className="flex items-center justify-between">
            <p className="font-display text-[14px] font-bold uppercase tracking-[0.14em]">Show this on the board</p>
            <CountdownRing left={left} />
          </div>
          <p key={code} className="anim-code -mt-1 font-display text-[92px] font-extrabold leading-[0.95] tracking-[0.12em] tabular-nums">
            {code}
          </p>
          <p className="mt-2 text-[13px] font-medium opacity-70">New code every 30 seconds · Old codes stop working</p>
        </div>
      )}

      {/* Live counter */}
      <div className="flex items-end gap-3 px-6 pt-5">
        <p className="font-display text-[56px] font-extrabold leading-[0.85] tracking-[-0.03em] tabular-nums text-primary">{list.length}</p>
        <div className="flex-1 pb-0.5">
          <p className="font-display text-[20px] font-bold leading-none text-ink">present</p>
          <p className="mt-1 text-[13px] tabular-nums text-ink-2">
            {closed ? 'Final count' : (
              <>Closes in <b className="font-display font-extrabold text-ink">{mm}:{ss}</b></>
            )}
          </p>
        </div>
      </div>
      {!closed && (
        <div className="mx-6 mt-3 h-1.5 overflow-hidden rounded-full bg-line">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${(remaining / (windowMin * 60)) * 100}%`, transition: 'width 1s linear' }}
          />
        </div>
      )}
      {!closed && !btOff && (
        <div className="mx-6 mt-3 flex items-center gap-2 text-[12px] text-ink-2">
          <Icon name="broadcast" size={16} />
          <span className="flex-1">Broadcasting · {total - list.length - review.length} not joined yet</span>
          {confirming > 0 && (
            <span className="anim-pop flex items-center gap-1.5 font-semibold text-primary">
              <Spinner size={12} /> {confirming} confirming
            </span>
          )}
        </div>
      )}

      <div className="no-scrollbar mt-3 flex-1 overflow-y-auto px-3 pb-28">
        {review.length > 0 && (
          <div className="anim-rise mx-1 mb-3 rounded-base border-2 border-amber/60 bg-amber/10 p-3">
            <p className="px-1 font-display text-[13px] font-bold uppercase tracking-[0.1em] text-ink">Needs your check · {review.length}</p>
            <ul className="mt-1">
              {review.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-1 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{s.name}</p>
                    <p className="text-[12px] leading-snug text-ink-2">
                      {s.flag === 'far' ? 'Very weak signal. Maybe outside the room.' : 'Same phone already marked 221-15-4106.'}
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
                    className="h-9 rounded-full bg-primary px-3 font-display text-[13px] font-bold text-on-primary"
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
          placeholder="Search name or roll"
          className="mt-4 h-12 w-full rounded-base border-2 border-line bg-bg px-4 text-[15px] text-ink outline-none placeholder:text-ink-2/60 focus:border-primary"
        />
        <ul className="no-scrollbar -mx-3 mt-2 max-h-[300px] overflow-y-auto">
          {absent.length === 0 ? (
            <li className="px-3 py-6 text-center text-[14px] text-ink-2">{q ? 'No match' : 'Everyone is present'}</li>
          ) : (
            absent.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-base px-3 py-2">
                <span className="grid h-10 w-11 shrink-0 place-items-center rounded-xl border border-line bg-bg font-display text-[13px] font-extrabold tabular-nums text-ink-2">
                  {s.roll}
                </span>
                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{s.name}</p>
                <button
                  onClick={() => markPresent(s)}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-mint px-3 font-display text-[13px] font-bold text-on-mint hover:brightness-95"
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
