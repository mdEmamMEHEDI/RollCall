import { useEffect, useState } from 'react'
import { BottomSheet, Button, Icon, Logo, Spinner, SystemDialog, TopBar } from '../../components/hazira/ui'

// TODO: replace onContinue with the real login API call
export function Welcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex h-full flex-col px-6 pb-8">
      <div className="flex flex-1 flex-col items-center justify-center">
        <Logo size={80} />
        <h1 className="mt-6 font-display text-[40px] font-extrabold leading-none tracking-[-0.03em] text-ink">RollCall</h1>
      </div>
      <Button onClick={onContinue} className="w-full">Login</Button>
    </div>
  )
}

export type SetupKey = 'bluetooth' | 'location' | 'nearby'
type ItemState = 'off' | 'turning-on' | 'on' | 'failed'

// auto: the app can ask Android to turn it on. manual: the teacher has to do it in Settings.
const items: { key: SetupKey; label: string; hint: string; mode: 'auto' | 'manual'; ask?: string; steps?: string[] }[] = [
  { key: 'bluetooth', label: 'Bluetooth', hint: 'Hears every student at once, no hotspot', mode: 'auto', ask: 'Allow RollCall to turn on Bluetooth?',
    steps: ['Swipe down from the top of the screen', 'Tap Bluetooth so it turns blue', 'Come back to RollCall'] },
  { key: 'location', label: 'Location', hint: 'Android needs it to scan', mode: 'manual',
    steps: ['Swipe down from the top of the screen', 'Tap Location so it turns blue', 'Come back to RollCall'] },
  { key: 'nearby', label: 'Nearby devices', hint: 'Permission to connect', mode: 'auto', ask: 'Allow RollCall to find, connect to and see the position of nearby devices?',
    steps: ['Tap Open settings', 'Go to Permissions → Nearby devices', 'Choose Allow, then come back'] },
]

export const defaultSetup: Record<SetupKey, boolean> = { bluetooth: false, location: false, nearby: true }

export function SetupCheck({ initial, onBack, onStart }: { initial: Record<SetupKey, boolean>; onBack: () => void; onStart: () => void }) {
  const [state, setState] = useState<Record<SetupKey, ItemState>>(
    () => Object.fromEntries(items.map((i) => [i.key, initial[i.key] ? 'on' : 'off'])) as Record<SetupKey, ItemState>,
  )
  const [dialog, setDialog] = useState<SetupKey | null>(null)
  const [sheet, setSheet] = useState<SetupKey | null>(null)
  const [checking, setChecking] = useState(false)
  const [runAll, setRunAll] = useState(false)

  const set = (k: SetupKey, s: ItemState) => setState((p) => ({ ...p, [k]: s }))
  const offItems = items.filter((i) => state[i.key] !== 'on')
  const ready = offItems.length === 0

  function turnOn(k: SetupKey) {
    const it = items.find((i) => i.key === k)!
    if (it.mode === 'auto' && state[k] !== 'failed') setDialog(k)
    else setSheet(k)
  }

  function allow(k: SetupKey) {
    setDialog(null)
    set(k, 'turning-on')
    setTimeout(() => set(k, 'on'), 900)
  }

  function deny(k: SetupKey) {
    setDialog(null)
    set(k, 'failed')
    setSheet(k)
  }

  function checkAgain(k: SetupKey) {
    setChecking(true)
    setTimeout(() => {
      setChecking(false)
      setSheet(null)
      set(k, 'on')
    }, 900)
  }

  // "Turn on all": walk through each off item one at a time
  useEffect(() => {
    if (!runAll || dialog || sheet || checking) return
    if (Object.values(state).includes('turning-on')) return
    const next = offItems[0]
    if (!next) return setRunAll(false)
    turnOn(next.key)
  }, [runAll, dialog, sheet, checking, state])

  const sheetItem = items.find((i) => i.key === sheet)

  return (
    <div className="relative flex h-full flex-col">
      <TopBar onBack={onBack} title="Before you start" />
      <div className="flex-1 px-6 pt-2">
        <div className="flex items-center gap-3">
          <p className="flex-1 text-[15px] text-ink-2">
            {ready
              ? 'All set. Students can find your class now.'
              : `${offItems.length} ${offItems.length > 1 ? 'things are' : 'thing is'} off. Turn ${offItems.length > 1 ? 'them' : 'it'} on to start.`}
          </p>
          {!ready && offItems.length > 1 && (
            <button onClick={() => setRunAll(true)} className="h-9 shrink-0 rounded-full px-3 text-[14px] font-bold text-primary hover:bg-mint">
              Turn on all
            </button>
          )}
        </div>
        <div className="mt-5 rounded-sheet border border-line bg-surface p-2">
          {items.map((it, idx) => {
            const s = state[it.key]
            const tone = s === 'on' ? 'bg-mint text-on-mint' : s === 'turning-on' ? 'bg-mint text-primary' : 'bg-red-soft text-red'
            return (
              <div key={it.key} className={`flex items-center gap-3 px-3 py-3.5 ${idx ? 'border-t border-line' : ''}`}>
                <span className={`grid size-11 shrink-0 place-items-center rounded-base transition-colors ${tone}`}>
                  <Icon name={it.key} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink">{it.label}</p>
                  <p className="text-[12px] text-ink-2">
                    {s === 'failed' ? 'Not allowed. Turn it on in Settings' : s === 'off' && it.mode === 'manual' ? 'Turn on in Settings' : it.hint}
                  </p>
                </div>
                {s === 'on' ? (
                  <span className="anim-pop flex items-center gap-1.5 text-[13px] font-semibold text-on-mint">
                    On
                    <span className="grid size-6 place-items-center rounded-full bg-primary text-on-primary">
                      <Icon name="check" size={14} stroke={3} />
                    </span>
                  </span>
                ) : s === 'turning-on' ? (
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-primary">
                    <Spinner size={16} /> Turning on…
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-red">Off</span>
                    <button
                      onClick={() => turnOn(it.key)}
                      className="h-9 rounded-full bg-primary px-4 font-display text-[13px] font-bold text-on-primary"
                    >
                      Turn on
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {!ready && (
          <p className="mt-4 flex gap-2 text-[13px] leading-snug text-ink-2">
            <span className="shrink-0"><Icon name="alert" size={16} /></span>
            RollCall turns on what it can. Location must be turned on by you. No Wi-Fi or hotspot needed. We'll show you how.
          </p>
        )}
      </div>
      <div className="px-6 pb-8">
        <Button disabled={!ready} onClick={onStart} className="w-full">
          Start class
        </Button>
      </div>

      {dialog && (
        <SystemDialog text={items.find((i) => i.key === dialog)!.ask!} onAllow={() => allow(dialog)} onDeny={() => deny(dialog)} />
      )}

      <BottomSheet
        open={!!sheetItem}
        onClose={() => {
          setSheet(null)
          setRunAll(false)
        }}
      >
        {sheetItem && (
          <>
            <span className="grid size-12 place-items-center rounded-base bg-mint text-on-mint">
              <Icon name={sheetItem.key} />
            </span>
            <h2 className="mt-4 font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink">Turn on {sheetItem.label}</h2>
            <p className="mt-1 text-[14px] text-ink-2">
              {state[sheetItem.key] === 'failed' ? 'Permission was denied, so please turn it on yourself.' : 'Android doesn’t let apps do this. It takes 5 seconds.'}
            </p>
            <ol className="mt-5 space-y-3">
              {sheetItem.steps!.map((st, i) => (
                <li key={st} className="flex items-start gap-3 text-[15px] text-ink">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mint font-display text-[13px] font-bold text-on-mint">{i + 1}</span>
                  <span className="pt-0.5">{st}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 space-y-2">
              <Button className="w-full" icon={<Icon name="chevron" size={18} />}>Open settings</Button>
              <Button variant="secondary" className="w-full" disabled={checking} onClick={() => checkAgain(sheetItem.key)}>
                {checking ? (<><Spinner /> Checking…</>) : "I've turned it on"}
              </Button>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  )
}
