import { useState } from 'react'
import { Button, Icon } from '../../components/hazira/ui'

export default function Join({ name, roll, onFind }: { name: string; roll: string; onFind: (code: string) => void }) {
  const [code, setCode] = useState('')
  const press = (k: string) => setCode((c) => (k === 'del' ? c.slice(0, -1) : c.length < 4 ? c + k : c))
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 pt-4">
        <span className="grid size-10 place-items-center rounded-full bg-mint font-display text-[14px] font-bold text-on-mint">
          {name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
        </span>
        <div>
          <p className="font-display text-[15px] font-bold text-ink">{name}</p>
          <p className="text-[12px] tabular-nums text-ink-2">{roll}</p>
        </div>
      </div>

      <div className="px-6 pt-10">
        <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em] text-ink">Type the class code</h1>
        <p className="mt-1 text-[14px] text-ink-2">It's on the board, in the amber box.</p>
        <div className="mt-7 grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => {
            const d = code[i]
            const active = i === code.length
            return (
              <div
                key={i}
                className={`relative grid h-[84px] place-items-center rounded-base border-2 bg-surface font-display text-[44px] font-extrabold tabular-nums text-ink transition ${
                  active ? 'border-amber ring-4 ring-amber/20' : d ? 'border-primary/40' : 'border-line'
                }`}
              >
                {d && <span className="anim-pop">{d}</span>}
                {active && <span className="anim-blink absolute h-9 w-[3px] rounded-full bg-amber" />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-auto px-6 pb-3">
        <Button disabled={code.length < 4} className="w-full" icon={<Icon name="broadcast" />} onClick={() => onFind(code)}>
          Find class
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1 bg-surface px-4 pb-7 pt-2 border-t border-line">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              onClick={() => press(k)}
              aria-label={k === 'del' ? 'Delete' : k}
              className="grid h-14 place-items-center rounded-base font-display text-[24px] font-bold text-ink active:bg-mint hover:bg-bg"
            >
              {k === 'del' ? <Icon name="back" /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
