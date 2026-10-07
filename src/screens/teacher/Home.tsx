import { useEffect, useState } from 'react'
import { Button, Icon, Select, Stepper, TextField, TopBar } from '../../components/hazira/ui'
import { fetchMyCourses, fetchRoster, type ClassQuery, type Course, type RosterStudent } from '../../services/roster'

export type LoadedClass = ClassQuery & { students: RosterStudent[]; window: number }

export default function Home({ onBack, onStart }: { onBack: () => void; onStart: (c: LoadedClass) => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [courseCode, setCourseCode] = useState('')
  const [section, setSection] = useState('')
  const [room, setRoom] = useState('')
  const [win, setWin] = useState(5)
  const [state, setState] = useState<'form' | 'loading' | 'loaded'>('form')
  const [students, setStudents] = useState<RosterStudent[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    fetchMyCourses().then(setCourses)
  }, [])

  const course = courses?.find((c) => c.code === courseCode)
  const courseLabel = course ? `${course.code} ${course.title}` : ''
  const q: ClassQuery = { course: courseLabel, section, room }

  function pickCourse(code: string) {
    const c = courses?.find((x) => x.code === code)
    setCourseCode(code)
    setSection(c && c.sections.length === 1 ? c.sections[0] : '')
    setRoom(c?.room ?? '')
    setErr('')
  }

  async function load() {
    if (!room.trim()) return setErr('Add the room number.')
    setState('loading')
    try {
      setStudents(await fetchRoster(q))
      setState('loaded')
    } catch (x) {
      setErr((x as Error).message)
      setState('form')
    }
  }

  if (state === 'loaded')
    return (
      <div className="relative flex h-full flex-col">
        <TopBar onBack={() => setState('form')} title="Class list" />
        <div className="px-6">
          <p className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink">{courseLabel}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
            {[`Section ${section}`, `Room ${room}`, `Open for ${win} min`].map((t) => (
              <span key={t} className="rounded-full bg-mint px-3 py-1 font-semibold text-on-mint">{t}</span>
            ))}
          </div>
          <p className="mt-5 text-[13px] font-semibold text-ink-2">{students.length} students enrolled</p>
        </div>
        <ul className="no-scrollbar mt-2 flex-1 overflow-y-auto px-3 pb-28">
          {students.map((s, i) => (
            <li key={s.id} className="anim-rise flex items-center gap-3 rounded-base px-3 py-2.5" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <span className="w-6 text-right font-display text-[12px] font-bold tabular-nums text-ink-2">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">{s.name}</p>
                <p className="text-[12px] tabular-nums text-ink-2">{s.id}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="absolute inset-x-0 bottom-0 border-t border-line bg-bg/90 px-4 pb-7 pt-3 backdrop-blur">
          <Button className="w-full" icon={<Icon name="broadcast" />} onClick={() => onStart({ ...q, students, window: win })}>
            Start class
          </Button>
        </div>
      </div>
    )

  return (
    <div className="flex h-full flex-col">
      <TopBar onBack={onBack} title="Load class" />
      <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-6 pt-2">
        <p className="text-[15px] text-ink-2">Pick your course and section to get the student list.</p>
        {courses === null ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i}>
                <div className="mb-2 h-3 w-20 animate-pulse rounded bg-line" />
                <div className="h-14 animate-pulse rounded-base bg-line/70" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <Select
              label="Course"
              value={courseCode}
              onChange={pickCourse}
              placeholder="Choose a course"
              options={courses.map((c) => ({ value: c.code, label: `${c.code} · ${c.title}` }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Section"
                value={section}
                onChange={(v) => {
                  setSection(v)
                  setErr('')
                }}
                disabled={!course}
                placeholder={course ? 'Choose' : 'Pick course first'}
                options={(course?.sections ?? []).map((s) => ({ value: s, label: s }))}
              />
              <TextField
                label="Room"
                value={room}
                onChange={(v) => {
                  setRoom(v)
                  setErr('')
                }}
                placeholder="AB4-702"
              />
            </div>
          </>
        )}

        <div className="rounded-base border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className="text-primary"><Icon name="clock" size={20} /></span>
            <p className="flex-1 text-[14px] text-ink">
              Attendance open for <b className="font-display font-extrabold">{win} min</b>
            </p>
            <Stepper value={win} onChange={setWin} min={1} max={15} />
          </div>
          <div className="mt-3 flex gap-2">
            {[3, 5, 10].map((m) => (
              <button
                key={m}
                onClick={() => setWin(m)}
                className={`h-8 rounded-full px-3 text-[13px] font-semibold transition ${win === m ? 'bg-primary text-on-primary' : 'bg-mint text-on-mint'}`}
              >
                {m} min
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-snug text-ink-2">Students who don't join in time are absent for today.</p>
        </div>

        {err && (
          <p className="anim-rise flex gap-2 rounded-base bg-red-soft px-4 py-3 text-[13px] leading-snug text-red">
            <Icon name="alert" size={18} />
            {err}
          </p>
        )}
      </div>
      <div className="px-6 pb-8 pt-3">
        <Button className="w-full" disabled={!course || !section || state === 'loading'} onClick={load}>
          {state === 'loading' ? (
            <>
              <span className="anim-spin size-5 rounded-full border-[3px] border-current border-t-transparent" />
              Loading students…
            </>
          ) : (
            'Load students'
          )}
        </Button>
      </div>
    </div>
  )
}
