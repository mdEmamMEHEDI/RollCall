import type { ReactNode } from 'react'
import { Button, Icon } from '../../components/hazira/ui'

export type ResultKind = 'success' | 'closed' | 'code' | 'roll' | 'phone' | 'failed' | 'far'

const copy: Record<ResultKind, { title: string; body: string; cta: string; tone: 'primary' | 'calm' | 'red' }> = {
  success: { title: 'You are present', body: 'Your teacher confirmed your attendance.', cta: 'Back', tone: 'primary' },
  closed: { title: 'Attendance closed', body: 'Time is over for today. Talk to your teacher.', cta: 'OK', tone: 'calm' },
  code: { title: 'Code is wrong or expired', body: 'Check the board. The code changes every 30 seconds.', cta: 'Type code again', tone: 'red' },
  roll: { title: 'ID already marked', body: 'Your ID is already marked from another phone. Tell your teacher.', cta: 'OK', tone: 'red' },
  phone: { title: 'Phone linked to another ID', body: 'This phone is linked to 221-15-4790. Ask your teacher to reset it, or use your own phone.', cta: 'OK', tone: 'red' },
  far: { title: 'You seem to be outside the room', body: 'The teacher’s signal is too weak. Attendance works only inside the classroom. Move in and try again.', cta: 'Try again', tone: 'red' },
  failed: { title: 'Teacher didn’t confirm', body: 'Your signal didn’t reach the teacher. Move closer and try again.', cta: 'Retry', tone: 'red' },
}

const icons: Record<ResultKind, ReactNode> = {
  success: null,
  closed: <Icon name="clock" size={44} />,
  code: <span className="font-display text-[34px] font-extrabold tracking-[0.1em]">#?</span>,
  roll: <Icon name="users" size={44} />,
  phone: <Icon name="nearby" size={44} />,
  failed: <Icon name="broadcast" size={44} />,
  far: <Icon name="location" size={44} />,
}

export default function Result({ kind, cls, roll, teacher = 'Dr. Nasrin Sultana', onAction, onBack, onExit }: { kind: ResultKind; cls: string; roll: string; teacher?: string; onAction: () => void; onBack: () => void; onExit: () => void }) {
  const c = copy[kind]
  const ring = { primary: 'bg-primary text-on-primary', calm: 'bg-mint text-on-mint', red: 'bg-red-soft text-red' }[c.tone]
  const ok = kind === 'success'
  const [t, ap] = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).split(' ')

  return (
    <div className="flex h-full flex-col px-6 pb-8">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative">
          {kind === 'success' &&
            [...Array(8)].map((_, i) => {
              const a = (i / 8) * Math.PI * 2
              return (
                <span
                  key={i}
                  className="anim-burst absolute left-1/2 top-1/2 -ml-1 -mt-1 size-2 rounded-full"
                  style={{
                    background: i % 2 ? '#F5A524' : 'var(--primary)',
                    ['--dx' as string]: `${Math.cos(a) * 92}px`,
                    ['--dy' as string]: `${Math.sin(a) * 92}px`,
                  }}
                />
              )
            })}
          <div className={`anim-pop grid size-32 place-items-center rounded-full ${ring} ${kind === 'success' ? 'shadow-[0_0_0_14px_var(--mint)]' : ''}`}>
            {kind === 'success' ? (
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path className="anim-draw" d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            ) : (
              icons[kind]
            )}
          </div>
        </div>

        <h1 className="mt-10 font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{c.title}</h1>
        {ok && <p className="mt-2 font-display text-[40px] font-extrabold tabular-nums text-ink">{t}<span className="text-[18px] text-ink-2"> {ap}</span></p>}
        <p className="mt-3 max-w-[30ch] text-[15px] leading-snug text-ink-2">{c.body}</p>

        {ok && (
          <div className="mt-8 w-full rounded-base border border-line bg-surface px-4 py-3 text-left">
            <p className="text-[12px] text-ink-2">Class</p>
            <p className="font-display text-[16px] font-bold text-ink">{cls}</p>
            <p className="mt-1 text-[13px] text-ink-2">{roll} · {teacher}</p>
          </div>
        )}
      </div>
      <Button className="w-full" onClick={onAction}>{c.cta}</Button>
      <Button variant="text" className="mt-2 w-full" onClick={ok ? onExit : onBack}>{ok ? 'Exit app' : 'Back to profile'}</Button>
    </div>
  )
}
