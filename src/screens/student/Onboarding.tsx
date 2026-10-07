import { useState } from 'react'
import { Button, Icon, Logo, TopBar } from '../../components/hazira/ui'

export function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex h-full flex-col px-6 pb-8">
      <div className="flex flex-1 flex-col items-center justify-center">
        <Logo size={80} />
        <h1 className="mt-6 font-display text-[40px] font-extrabold leading-none tracking-[-0.03em] text-ink">RollCall</h1>
      </div>
      {/* TODO: open DIU login https://auth1.diu.edu.bd/realms/diu-student/... (client_id=student-portal-ui), then return with the token */}
      <Button className="w-full" onClick={onNext}>Login</Button>
    </div>
  )
}

const perms = [
  { key: 'bluetooth', label: 'Bluetooth', why: "To send your attendance to the teacher. No connection needed." },
  { key: 'location', label: 'Location', why: 'Android needs this to scan nearby. We never save it.' },
  { key: 'nearby', label: 'Nearby devices', why: 'To join the class on this phone.' },
] as const

export function Permissions({ denied: deniedInit, onBack, onNext }: { denied: boolean; onBack: () => void; onNext: () => void }) {
  const [on, setOn] = useState<Record<string, boolean>>({ bluetooth: true, location: true, nearby: false })
  const [denied, setDenied] = useState(deniedInit)
  const all = perms.every((p) => on[p.key])

  return (
    <div className="flex h-full flex-col">
      <TopBar onBack={onBack} title="Quick setup" />
      <div className="no-scrollbar flex-1 overflow-y-auto px-6">
        <p className="text-[15px] text-ink-2">RollCall needs these to find your class. You do this only once.</p>
        <div className="mt-5 rounded-sheet border border-line bg-surface p-2">
          {perms.map((p, i) => {
            const isOn = on[p.key]
            const blocked = denied && p.key === 'nearby'
            return (
              <div key={p.key} className={`flex items-start gap-3 px-3 py-3.5 ${i ? 'border-t border-line' : ''}`}>
                <span className={`grid size-11 shrink-0 place-items-center rounded-base ${isOn ? 'bg-mint text-on-mint' : blocked ? 'bg-red-soft text-red' : 'bg-bg text-ink-2 border border-line'}`}>
                  <Icon name={p.key} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink">{p.label}</p>
                  <p className="text-[12px] leading-snug text-ink-2">{p.why}</p>
                </div>
                <div className="self-center">
                  {isOn ? (
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-on-mint">
                      On
                      <span className="grid size-6 place-items-center rounded-full bg-primary text-on-primary">
                        <Icon name="check" size={14} stroke={3} />
                      </span>
                    </span>
                  ) : blocked ? (
                    <span className="text-[13px] font-semibold text-red">Blocked</span>
                  ) : (
                    <button
                      onClick={() => setOn({ ...on, [p.key]: true })}
                      className="h-9 rounded-full bg-primary px-4 font-display text-[13px] font-bold text-on-primary"
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {denied && (
          <div className="anim-rise mt-4 rounded-base bg-red-soft p-4">
            <p className="text-[14px] font-semibold text-ink">Nearby devices was denied</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">
              Open Settings → Apps → RollCall → Permissions, then allow Nearby devices.
            </p>
            <Button
              variant="secondary"
              className="mt-3 h-11! w-full text-[14px]"
              onClick={() => {
                setDenied(false)
                setOn({ ...on, nearby: true })
              }}
            >
              Open settings
            </Button>
          </div>
        )}
      </div>
      <div className="px-6 pb-8 pt-3">
        <Button disabled={!all} className="w-full" onClick={onNext}>Continue</Button>
      </div>
    </div>
  )
}
