import { Button, Icon, Logo } from './ui'

const copy = {
  teacher: 'Fast, secure attendance for every class.',
  student: 'Check in to your class in seconds.',
}

// Shared login screen for both apps. TODO: onLogin opens the DIU login, then returns with the token.
export default function Welcome({ role, onLogin }: { role: 'teacher' | 'student'; onLogin: () => void }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-bg">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {/* The logo's own idea: a signal spreading out from the teacher's phone */}
        <div className="relative grid size-[200px] place-items-center">
          {[0, 1.2].map((d) => (
            <span key={d} className="anim-radar absolute inset-0 rounded-full border-2 border-primary/25" style={{ animationDelay: `${d}s` }} />
          ))}
          <span className="absolute inset-[18%] rounded-full bg-mint" />
          <span className="anim-pop relative rounded-[26px] shadow-[0_16px_32px_-14px_var(--primary)]">
            <Logo size={88} />
          </span>
        </div>
        <h1 className="mt-4 font-display text-[40px] font-extrabold leading-none tracking-[-0.03em] text-ink">RollCall</h1>
        <p className="mt-3 text-[15px] text-ink-2">{copy[role]}</p>
      </div>

      {/* Soft grey panel so the sign-in area reads as its own block */}
      <div className="anim-rise rounded-t-[32px] border-t border-[#e3e7ec] bg-[#eef1f5] px-6 pb-8 pt-7 dark:border-[#26313b] dark:bg-[#18222c]">
        <h2 className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink">Welcome</h2>
        <p className="mt-1 text-[14px] text-ink-2">Sign in to continue as a {role}.</p>
        <Button className="mt-5 w-full" icon={<Icon name="login" size={20} />} onClick={onLogin}>
          Login with DIU
        </Button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[12.5px] text-ink-2">
          <Icon name="lock" size={14} />
          Secure sign-in with your DIU account
        </p>
      </div>
    </div>
  )
}
