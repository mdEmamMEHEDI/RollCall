import type { ReactNode, ButtonHTMLAttributes } from 'react'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'text'
  icon?: ReactNode
}

export function Button({ variant = 'primary', icon, className = '', children, ...rest }: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-display font-bold text-[16px] tracking-[-0.01em] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:cursor-not-allowed'
  const v = {
    primary: 'h-14 px-6 bg-primary text-on-primary disabled:bg-line disabled:text-ink-2 hover:brightness-110',
    secondary: 'h-14 px-6 bg-surface text-primary border-2 border-primary/25 hover:border-primary disabled:opacity-50',
    text: 'h-10 px-3 text-primary hover:bg-mint',
  }[variant]
  return (
    <button className={`${base} ${v} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  )
}

export type Status = 'present' | 'error'
export function StatusChip({ status }: { status: Status }) {
  const map = {
    present: ['bg-mint text-on-mint', 'Present'],
    error: ['bg-red-soft text-red', 'Error'],
  } as const
  const [cls, label] = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 text-[12px] font-semibold ${cls}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  error?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-ink-2">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-14 w-full rounded-base border-2 bg-surface px-4 text-[16px] text-ink outline-none transition placeholder:text-ink-2/60 focus:ring-4 ${
          error ? 'border-red focus:ring-red/20' : 'border-line focus:border-primary focus:ring-primary/15'
        }`}
      />
      {error && <span className="mt-2 block text-[13px] text-red">{error}</span>}
    </label>
  )
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-ink-2">{label}</span>
      <span className="relative block">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-14 w-full appearance-none truncate rounded-base border-2 border-line bg-surface pl-4 pr-11 text-[16px] text-ink outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-50"
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-ink-2">
          <Icon name="chevron" size={18} />
        </span>
      </span>
    </label>
  )
}

export function Stepper({ value, onChange, min = 0, max = 30 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const b = 'size-9 rounded-full grid place-items-center bg-mint text-on-mint text-lg font-bold disabled:opacity-40'
  return (
    <div className="flex items-center gap-3">
      <button aria-label="Less" className={b} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="w-6 text-center font-display text-[18px] font-extrabold tabular-nums">{value}</span>
      <button aria-label="More" className={b} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}

// flag: 'far' = weak signal (maybe outside the room), 'dup' = this phone already marked another ID
export type Student = { roll: string; name: string; status: Status; time: string; id: number; flag?: 'far' | 'dup' }

export function StudentRow({ s, onRemove, animate }: { s: Student; onRemove?: () => void; animate?: boolean }) {
  return (
    <li className={`flex items-center gap-3 rounded-base px-3 py-2.5 ${animate ? 'anim-slide' : ''}`}>
      <span className="grid h-10 w-11 shrink-0 place-items-center rounded-xl bg-bg font-display text-[13px] font-extrabold tabular-nums text-ink-2 border border-line">
        {s.roll.slice(-4)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{s.name}</p>
        <p className="truncate text-[12px] text-ink-2 tabular-nums">{s.roll} · {s.time}</p>
      </div>
      <StatusChip status={s.status} />
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${s.name}`}
          className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-red-soft hover:text-red"
        >
          <Icon name="x" size={18} />
        </button>
      )}
    </li>
  )
}

export function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#14211f]/45" />
      <div className="anim-rise relative rounded-t-sheet bg-surface px-6 pb-8 pt-3">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" />
        {children}
      </div>
    </div>
  )
}

// Mock of the Android system permission dialog
export function SystemDialog({ text, onAllow, onDeny }: { text: string; onAllow: () => void; onDeny: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[#14211f]/45 px-8">
      <div className="anim-pop w-full rounded-[24px] bg-surface p-6 shadow-2xl">
        <div className="mx-auto mb-4 w-fit"><Logo size={40} /></div>
        <p className="text-center text-[16px] leading-snug text-ink">{text}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onDeny} className="h-10 rounded-full px-4 text-[14px] font-semibold text-primary hover:bg-mint">Deny</button>
          <button onClick={onAllow} className="h-10 rounded-full px-4 text-[14px] font-semibold text-primary hover:bg-mint">Allow</button>
        </div>
      </div>
    </div>
  )
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="anim-spin inline-block rounded-full border-[2.5px] border-current border-t-transparent" style={{ width: size, height: size }} />
}

export function Toast({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="anim-rise flex items-center gap-3 rounded-base bg-ink py-3 pl-4 pr-2 text-bg shadow-xl">
      <span className="flex-1 text-[14px]">{text}</span>
      {action && (
        <button onClick={onAction} className="h-9 rounded-full px-4 font-display text-[14px] font-bold text-amber hover:bg-white/10">
          {action}
        </button>
      )}
    </div>
  )
}

export function Radar({ size = 220 }: { size?: number }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {[0, 0.8, 1.6].map((d) => (
        <span key={d} className="anim-radar absolute inset-0 rounded-full border-2 border-primary" style={{ animationDelay: `${d}s` }} />
      ))}
      <span className="absolute inset-[30%] rounded-full bg-mint" />
      <span className="relative grid size-14 place-items-center rounded-full bg-primary text-on-primary">
        <Icon name="broadcast" size={26} />
      </span>
    </div>
  )
}

export function Logo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-label="RollCall">
      <rect width="56" height="56" rx="18" fill="var(--primary)" />
      <path d="M19 41V15h10a7 7 0 010 14H19M28 29l10 12" stroke="var(--on-primary)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="42" cy="14" r="5" fill="#F5A524" />
    </svg>
  )
}

const paths: Record<string, ReactNode> = {
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  bluetooth: <path d="M7 7l10 10-5 4V3l5 4L7 17" />,
  wifi: (
    <>
      <path d="M2.5 9a14 14 0 0119 0M5.5 12.5a9.5 9.5 0 0113 0M8.7 16a5 5 0 016.6 0" />
      <circle cx="12" cy="19.5" r="1" fill="currentColor" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  nearby: (
    <>
      <rect x="3" y="6" width="7" height="12" rx="2" />
      <rect x="14" y="6" width="7" height="12" rx="2" />
      <path d="M10.5 12h3" />
    </>
  ),
  broadcast: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4M5 5a10 10 0 000 14M19 5a10 10 0 010 14" />
    </>
  ),
  download: <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />,
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  alert: (
    <>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.3" r="0.8" fill="currentColor" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a5.5 5.5 0 013.5 6" />
    </>
  ),
}

export function Icon({ name, size = 22, stroke = 2 }: { name: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="flex h-14 items-center gap-2 px-4">
      {onBack && (
        <button onClick={onBack} aria-label="Back" className="grid size-10 place-items-center rounded-full text-ink hover:bg-mint">
          <Icon name="back" />
        </button>
      )}
      <h1 className="flex-1 font-display text-[17px] font-bold text-ink">{title}</h1>
      {right}
    </div>
  )
}
