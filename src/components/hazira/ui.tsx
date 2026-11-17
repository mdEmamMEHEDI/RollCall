import type { ReactNode, ButtonHTMLAttributes } from 'react'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'text'
  icon?: ReactNode
}

export function Button({ variant = 'primary', icon, className = '', children, ...rest }: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl font-display font-bold text-[15.5px] tracking-[-0.01em] transition duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:active:scale-100'
  const v = {
    primary: 'h-[52px] px-6 bg-primary text-on-primary hover:bg-primary-deep disabled:bg-line disabled:text-ink-2',
    secondary: 'h-[52px] px-6 bg-mint text-on-mint hover:brightness-[0.97] disabled:opacity-50',
    text: 'h-11 px-4 text-[15px] text-ink-2 hover:bg-mint hover:text-primary',
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
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-[52px] w-full rounded-2xl border-[1.5px] bg-surface px-4 text-[16px] text-ink outline-none transition placeholder:text-ink-2/60 focus:ring-4 ${
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
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      <span className="relative block">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-[52px] w-full appearance-none truncate rounded-2xl border-[1.5px] border-line bg-surface pl-4 pr-11 text-[16px] text-ink outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-50"
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

// Minimal segmented picker (e.g. attendance window)
export function Segmented<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-line bg-bg p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`h-10 rounded-xl text-[14px] font-semibold tabular-nums transition ${value === o.value ? 'bg-primary text-on-primary shadow-[0_4px_10px_-4px_var(--primary)]' : 'text-ink-2 hover:bg-mint hover:text-on-mint'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// The batch prefix (241-35) is shared by the whole class; the last part tells students apart
export const shortId = (roll: string) => roll.split('-').pop() || roll

// flag: 'far' = weak signal (maybe outside the room), 'dup' = this phone already marked another ID
export type Student = { roll: string; name: string; status: Status; time: string; id: number; flag?: 'far' | 'dup' }

export function StudentRow({ s, onRemove, animate }: { s: Student; onRemove?: () => void; animate?: boolean }) {
  const initials = s.name.split(' ').map((w) => w[0]).join('').slice(0, 2)
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${animate ? 'anim-slide' : ''}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mint font-display text-[13px] font-bold text-on-mint">{initials}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{s.name}</p>
        <p className="truncate text-[12.5px] tabular-nums text-ink-2">{s.roll}</p>
      </div>
      <span className="shrink-0 text-[12px] tabular-nums text-ink-2">{s.time}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${s.name}`}
          className="-mr-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-2/70 hover:bg-red-soft hover:text-red"
        >
          <Icon name="x" size={17} />
        </button>
      )}
    </li>
  )
}

export function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-scrim" />
      <div className="anim-rise relative rounded-t-sheet bg-surface px-6 pb-8 pt-3">
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-line" />
        {children}
      </div>
    </div>
  )
}

// Mock of the Android system permission dialog
export function SystemDialog({ text, onAllow, onDeny }: { text: string; onAllow: () => void; onDeny: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-scrim px-8">
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

// Mark: the tile is the classroom. The teacher's phone (amber) broadcasts BLE ripples
// across a grid of seats; the reached seat is checked in, the far seat is out of range.
export function Logo({ size = 56 }: { size?: number }) {
  const seats = [22, 34, 46].flatMap((y) => [22, 34, 46].map((x) => ({ x, y })))
  const id = `rc-clip-${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" role="img" aria-label="RollCall">
      <defs>
        <clipPath id={id}>
          <rect width="56" height="56" rx="16" />
        </clipPath>
      </defs>
      <rect width="56" height="56" rx="16" fill="var(--primary)" />
      <g clipPath={`url(#${id})`} fill="none" stroke="var(--on-primary)" strokeWidth="2">
        <circle cx="12" cy="12" r="13" opacity="0.28" />
        <circle cx="12" cy="12" r="24" opacity="0.18" />
        <circle cx="12" cy="12" r="35" opacity="0.1" />
      </g>
      <circle cx="12" cy="12" r="4.5" fill="#F5A524" />
      {seats.map(({ x, y }) =>
        x === 34 && y === 34 ? null : (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" fill="var(--on-primary)" opacity={x === 46 && y === 46 ? 0.3 : 1} />
        ),
      )}
      <circle cx="34" cy="34" r="6.8" fill="var(--on-primary)" />
      <path d="M30.8 34.2l2.2 2.2 4.2-4.6" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
  login: <path d="M14 4h3.5A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5H14M4 12h10m0 0l-4-4m4 4l-4 4" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
      <circle cx="12" cy="15.5" r="1" fill="currentColor" />
    </>
  ),
  id: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16a3 3 0 016 0M14.5 10h4M14.5 13.5h3" />
    </>
  ),
  building: (
    <>
      <path d="M4 20V6l8-3 8 3v14M2.5 20h19" />
      <path d="M9 20v-4h6v4M8 9h.01M12 9h.01M16 9h.01M8 12.5h.01M12 12.5h.01M16 12.5h.01" />
    </>
  ),
  cap: (
    <>
      <path d="M2.5 9.5L12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.5V16c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2v-4.5M21.5 9.5V15" />
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

// Blue identity header shared by the teacher and student profile screens
export function ProfileHeader({ initials, name, subtitle, onLogout }: { initials: string; name: string; subtitle: string; onLogout: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-b-[32px] bg-gradient-to-br from-primary to-primary-deep px-6 pb-7 pt-2 text-white">
      <span aria-hidden className="absolute -right-16 -top-20 size-56 rounded-full border-[28px] border-white/[0.07]" />
      <span aria-hidden className="absolute -bottom-24 -left-10 size-48 rounded-full bg-white/[0.06]" />
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2 font-display text-[14px] font-bold opacity-90">
          <span className="overflow-hidden rounded-[9px] ring-2 ring-white/30">
            <Logo size={26} />
          </span>
          RollCall
        </span>
        <button onClick={onLogout} className="h-10 rounded-full px-4 text-[14px] font-semibold text-white/85 hover:bg-white/10">
          Log out
        </button>
      </div>
      <div className="relative mt-5 flex items-center gap-4">
        <span className="grid size-[72px] shrink-0 place-items-center rounded-full bg-white font-display text-[26px] font-extrabold text-primary shadow-[0_0_0_6px_rgb(255_255_255/0.16)]">
          {initials}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[23px] font-extrabold leading-tight tracking-[-0.02em]">{name}</h1>
          <p className="mt-0.5 text-[14px] text-white/75">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

// Label/value list used on profile screens
export function InfoList({ rows }: { rows: { icon: string; label: string; value: string; mono?: boolean }[] }) {
  return (
    <dl className="rounded-sheet border border-line bg-surface px-4 shadow-card">
      {rows.map((r, i) => (
        <div key={r.label} className={`flex items-center gap-3.5 py-3.5 ${i ? 'border-t border-line' : ''}`}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint text-on-mint">
            <Icon name={r.icon} size={19} />
          </span>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">{r.label}</dt>
            <dd className={`mt-0.5 truncate text-[15px] font-semibold text-ink ${r.mono ? 'font-display tabular-nums tracking-[0.04em]' : ''}`}>{r.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
