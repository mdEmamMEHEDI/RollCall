import { useEffect, useState } from 'react'
import { Welcome as SWelcome, Permissions } from './screens/student/Onboarding'
import Profile from './screens/student/Profile'
import Join from './screens/student/Join'
import { Connecting, Search } from './screens/student/Search'
import Result, { type ResultKind } from './screens/student/Result'
import type { Student } from './components/hazira/ui'
import { roster } from './screens/teacher/data'
import { SetupCheck, Welcome, defaultSetup } from './screens/teacher/Onboarding'
import Home, { type LoadedClass } from './screens/teacher/Home'
import TeacherProfile from './screens/teacher/Profile'
import LiveClass, { type SaveStatus } from './screens/teacher/LiveClass'
import Summary from './screens/teacher/Summary'
import { setOnlineOverride } from './services/attendance'
import { isNative, sendAttendance, type NearbyClass } from './services/ble'
import { nativeRole, preparePhone } from './services/native'

type View = 'welcome' | 'profile' | 'setup-missing' | 'setup-ready' | 'home' | 'live' | 'live-empty' | 'live-bt' | 'live-closed' | 'summary' | 'summary-saved'

const nav: { id: View; label: string; n: string }[] = [
  { id: 'welcome', label: 'Login', n: '01' },
  { id: 'profile', label: 'Teacher profile', n: '01b' },
  { id: 'home', label: 'Load class → student list', n: '02' },
  { id: 'setup-missing', label: 'Setup · some off', n: '03a' },
  { id: 'setup-ready', label: 'Setup · all ready', n: '03b' },
  { id: 'live', label: 'Live class', n: '04' },
  { id: 'live-empty', label: 'Live · waiting', n: '04b' },
  { id: 'live-closed', label: 'Live · attendance closed', n: '04c' },
  { id: 'live-bt', label: 'Live · Bluetooth off', n: '07' },
  { id: 'summary', label: 'Summary · uploaded', n: '06a' },
  { id: 'summary-saved', label: 'Summary · saved offline', n: '06b' },
]

type SView =
  | 'welcome' | 'perms' | 'perms-denied' | 'profile' | 'join' | 'search' | 'search-two' | 'search-none' | 'search-far' | 'connecting' | 'exited'
  | `r-${ResultKind}`

const snav: { id: SView; label: string; n: string }[] = [
  { id: 'welcome', label: 'Login', n: '01' },
  { id: 'profile', label: 'Student profile', n: '02' },
  { id: 'perms', label: 'Setup · only if off', n: '03a' },
  { id: 'perms-denied', label: 'Setup · denied', n: '03b' },
  { id: 'join', label: 'Type the code', n: '04' },
  { id: 'search', label: 'Code match → confirm teacher', n: '05a' },
  { id: 'search-two', label: 'Two rooms, same code', n: '05b' },
  { id: 'search-none', label: 'No class found', n: '05c' },
  { id: 'search-far', label: 'Outside the room', n: '05d' },
  { id: 'connecting', label: 'Sending to teacher', n: '06' },
  { id: 'r-success', label: 'Present', n: '07a' },
  { id: 'r-closed', label: 'Attendance closed', n: '07b' },
  { id: 'r-code', label: 'Wrong code', n: '07c' },
  { id: 'r-roll', label: 'ID already marked', n: '07d' },
  { id: 'r-phone', label: 'Phone linked elsewhere', n: '07e' },
  { id: 'r-failed', label: 'Not confirmed', n: '07f' },
  { id: 'exited', label: 'App exited', n: '08' },
]

const studentSetup = { bluetooth: true, location: false, nearby: true }

function useStudent() {
  const [view, setView] = useState<SView>('welcome')
  const [k, setK] = useState(0)
  // Comes from the DIU login (mock)
  const name = 'Ayesha Rahman'
  const roll = '221-15-4821'
  const [cls, setCls] = useState('CSE321 Software Engineering')
  const [code, setCode] = useState('4721')
  const [picked, setPicked] = useState<NearbyClass | null>(null)
  const go = (v: SView) => {
    setView(v)
    setK((x) => x + 1)
  }
  useEffect(() => {
    if (view !== 'connecting') return
    if (isNative && picked) {
      // Real Bluetooth: advertise the signed packet until the teacher's phone acks it
      let live = true
      sendAttendance(picked.sessionId, roll, code).then((ok) => live && go(ok ? 'r-success' : 'r-failed'))
      return () => {
        live = false
      }
    }
    const t = setTimeout(() => go('r-success'), 2200)
    return () => clearTimeout(t)
  }, [view, k])

  let screen
  // Web preview uses studentSetup; the Android app asks the phone (permission + Bluetooth on)
  const attend = async () => {
    if (!isNative) return go(Object.values(studentSetup).every(Boolean) ? 'join' : 'perms')
    const st = await preparePhone()
    go(st.bluetooth && st.location && st.nearby ? 'join' : 'perms')
  }
  if (view === 'welcome') screen = <SWelcome onNext={() => go('profile')} />
  else if (view === 'exited')
    screen = (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-[#14211f] px-6 text-center">
        <p className="text-[14px] text-white/60">RollCall is closed</p>
        <button onClick={() => go('profile')} className="h-12 rounded-full bg-white/10 px-6 font-display text-[15px] font-bold text-white">
          Open again
        </button>
      </div>
    )
  else if (view.startsWith('perms'))
    screen = <Permissions denied={view === 'perms-denied'} onBack={() => go('profile')} onNext={() => (isNative ? attend() : go('join'))} />
  else if (view === 'profile')
    screen = (
      <Profile onAttend={attend} onLogout={() => go('welcome')} />
    )
  else if (view === 'join') screen = <Join name={name} roll={roll} onFind={(c) => {
          setCode(c)
          go('search')
        }} />
  else if (view.startsWith('search'))
    screen = (
      <Search
        code={code}
        demo={view === 'search-none' ? 'none' : view === 'search-two' ? 'two' : view === 'search-far' ? 'far' : 'one'}
        onBack={() => go('join')}
        onFar={() => go('r-far')}
        onConfirm={(c) => {
          setCls(c.course)
          setPicked(c)
          go('connecting')
        }}
      />
    )
  else if (view === 'connecting') screen = <Connecting cls={cls} />
  else {
    const kind = view.slice(2) as ResultKind
    screen = (
      <Result
        kind={kind}
        cls={cls}
        roll={roll}
        teacher={isNative ? picked?.teacher : undefined}
        onBack={() => go('profile')}
        onExit={() => go('exited')}
        onAction={() => go(kind === 'success' ? 'profile' : kind === 'failed' ? 'connecting' : 'join')}
      />
    )
  }
  return { view, go, k, screen }
}

export default function App() {
  const [app, setApp] = useState<'teacher' | 'student'>(isNative ? nativeRole : 'teacher')
  const student = useStudent()
  const [view, setView] = useState<View>('welcome')
  const [dark, setDark] = useState(false)
  const [cls, setCls] = useState('CSE321 Software Engineering · 61_A')
  const [total, setTotal] = useState(50)
  const [win, setWin] = useState(5)
  const [room, setRoom] = useState('')
  const [phone, setPhone] = useState(defaultSetup)
  // Android app: ask the phone for permission + Bluetooth, then go live or show only what's off
  const toLive = async () => {
    if (!isNative) return go(Object.values(defaultSetup).every(Boolean) ? 'live' : 'setup-missing')
    const st = await preparePhone()
    const s = { bluetooth: st.bluetooth, location: st.location, nearby: st.nearby }
    setPhone(s)
    go(Object.values(s).every(Boolean) ? 'live' : 'setup-missing')
  }
  const [final, setFinal] = useState<Student[]>(roster.slice(0, 46))
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('uploaded')
  const [online, setOnline] = useState(true)
  useEffect(() => {
    setOnlineOverride(online)
  }, [online])
  const [k, setK] = useState(0)
  const go = (v: View) => {
    setView(v)
    setK((x) => x + 1)
  }

  let screen
  if (view === 'welcome') screen = <Welcome onContinue={() => go('profile')} />
  else if (view === 'profile') screen = <TeacherProfile onStart={() => go('home')} onLogout={() => go('welcome')} />
  else if (view.startsWith('setup'))
    screen = (
      <SetupCheck
        initial={view === 'setup-ready' ? { bluetooth: true, location: true, nearby: true } : isNative ? phone : defaultSetup}
        onBack={() => go('home')}
        onStart={() => (isNative ? toLive() : go('live'))}
      />
    )
  else if (view === 'home')
    screen = (
      <Home
        onBack={() => go('profile')}
        onStart={(c: LoadedClass) => {
          setCls(`${c.course} · ${c.section}`)
          setTotal(c.students.length)
          setWin(c.window)
          setRoom(c.room)
          toLive()
        }}
      />
    )
  else if (view.startsWith('summary'))
    screen = (
      <Summary
        className={cls}
        total={total}
        list={final}
        status={view === 'summary-saved' ? 'saved' : saveStatus}
        onDone={() => go('profile')}
      />
    )
  else
    screen = (
      <LiveClass
        className={cls}
        empty={view === 'live-empty'}
        btOff={view === 'live-bt'}
        closed={view === 'live-closed'}
        window={win}
        total={total}
        room={room}
        onEnd={(l, st) => {
          setFinal(l)
          setSaveStatus(st)
          go('summary')
        }}
      />
    )

  // Android app: just the one app, fullscreen. No sidebar, no phone frame, no simulate buttons.
  if (isNative)
    return (
      <div key={app === 'teacher' ? `t${k}` : `s${student.k}`} className="h-dvh bg-bg pt-[env(safe-area-inset-top)] text-ink">
        {app === 'teacher' ? screen : student.screen}
      </div>
    )

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-[#e8edf3] text-ink transition-colors dark:bg-[#050a10]">
        <div className="mx-auto grid max-w-[1100px] items-center gap-10 px-6 py-10 lg:grid-cols-[260px_1fr]">
          <aside className="lg:self-start lg:pt-8">
            <p className="font-display text-[13px] font-bold uppercase tracking-[0.18em] text-primary">RollCall · {app === 'teacher' ? 'Teacher' : 'Student'}</p>
            <h1 className="mt-2 font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
              {app === 'teacher' ? 'Host a class, no internet.' : 'Join a class, no internet.'}
            </h1>
            <div className="mt-6 inline-flex rounded-full border border-line bg-surface p-1">
              {(['teacher', 'student'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setApp(a)}
                  className={`h-9 rounded-full px-5 font-display text-[13px] font-bold capitalize transition ${
                    app === a ? 'bg-primary text-on-primary' : 'text-ink-2'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <nav className="mt-6 flex flex-wrap gap-1 lg:flex-col">
              {(app === 'teacher' ? nav : snav).map((n) => (
                <button
                  key={n.id}
                  onClick={() => (app === 'teacher' ? go(n.id as View) : student.go(n.id as SView))}
                  className={`flex items-center gap-3 rounded-full px-4 py-1.5 text-left text-[14px] transition ${
                    (app === 'teacher' ? view : student.view) === n.id ? 'bg-primary text-on-primary' : 'text-ink hover:bg-mint'
                  }`}
                >
                  <span className="w-7 font-display text-[11px] font-bold opacity-60 tabular-nums">{n.n}</span>
                  {n.label}
                </button>
              ))}
            </nav>
            <button
              onClick={() => setDark(!dark)}
              className="mt-6 h-10 rounded-full border border-line bg-surface px-4 text-[13px] font-semibold text-ink"
            >
              {dark ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              onClick={() => setOnline(!online)}
              className="ml-2 mt-6 h-10 rounded-full border border-line bg-surface px-4 text-[13px] font-semibold text-ink"
            >
              Simulate: {online ? 'online' : 'offline'}
            </button>
            <p className="mt-6 max-w-[30ch] text-[12px] leading-relaxed text-ink-2">
              {app === 'teacher'
                ? 'Tip: on Live class, tap × on a student to see the undo toast, or End class for the sheet.'
                : 'Tip: type any 4 digits on Join class, then pick a class to see Sending and the success animation.'}
            </p>
          </aside>

          <div className="flex justify-center">
            <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[52px] border-[10px] border-[#14211f] bg-bg shadow-2xl">
              <div className="flex h-11 items-center justify-between px-8 pt-1 text-[13px] font-semibold text-ink">
                <span className="tabular-nums">10:24</span>
                <span className="absolute left-1/2 top-2 h-7 w-28 -translate-x-1/2 rounded-full bg-[#14211f]" />
                <span className={`text-[11px] ${online ? 'text-ink-2' : 'text-red'}`}>{online ? 'Online' : 'No internet'} · 82%</span>
              </div>
              <div key={app === 'teacher' ? `t${k}` : `s${student.k}`} className="h-[calc(100%-44px)]">
                {app === 'teacher' ? screen : student.screen}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
