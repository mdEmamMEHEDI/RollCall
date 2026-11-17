import { useState } from 'react'
import { Button, Icon, InfoList, ProfileHeader, Spinner } from '../../components/hazira/ui'
import { listSaved, markUploaded, uploadAttendance } from '../../services/attendance'

// Mock profile until the login API is connected
const teacher = {
  name: 'Dr. Nasrin Sultana',
  designation: 'Associate Professor',
  employeeId: '710001842',
  department: 'Computer Science & Engineering',
  faculty: 'Science & Information Technology',
}

export default function Profile({ onStart, onLogout }: { onStart: () => void; onLogout: () => void }) {
  const [pending, setPending] = useState(() => listSaved().length)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  async function uploadAll() {
    setBusy(true)
    setNote('')
    const all = listSaved()
    try {
      await uploadAttendance(all)
      markUploaded(all.map((s) => s.id))
      setPending(0)
      setNote('All sessions uploaded')
    } catch {
      setNote('Still no internet. Try again later.')
    }
    setBusy(false)
  }
  return (
    <div className="flex h-full flex-col">
      <ProfileHeader initials="NS" name={teacher.name} subtitle={teacher.designation} onLogout={onLogout} />
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pt-5">
        <InfoList
          rows={[
            { icon: 'id', label: 'Employee ID', value: teacher.employeeId, mono: true },
            { icon: 'building', label: 'Department', value: teacher.department },
            { icon: 'cap', label: 'Faculty', value: teacher.faculty },
          ]}
        />
        {(pending > 0 || note) && (
          <div className="anim-rise mt-4 flex items-center gap-3 rounded-base bg-mint px-4 py-3 text-on-mint">
            <Icon name={pending ? 'alert' : 'check'} size={20} />
            <p className="min-w-0 flex-1 text-[14px] font-semibold">
              {note || `${pending} session${pending > 1 ? 's' : ''} not uploaded`}
            </p>
            {pending > 0 && (
              <button
                onClick={uploadAll}
                disabled={busy}
                className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 font-display text-[13px] font-bold text-on-primary disabled:opacity-70"
              >
                {busy && <Spinner size={14} />}
                {busy ? 'Uploading' : 'Upload all'}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="px-6 pb-8">
        <Button className="w-full" icon={<Icon name="broadcast" />} onClick={onStart}>
          Start attendance
        </Button>
      </div>
    </div>
  )
}
