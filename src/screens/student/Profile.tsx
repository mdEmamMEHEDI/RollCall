import { Button, Icon, InfoList, ProfileHeader } from '../../components/hazira/ui'

// Mock profile until the DIU login API is connected
const me = { name: 'Ayesha Rahman', id: '241-35-024', dept: 'Computer Science & Engineering', batch: '61_A' }

export default function Profile({ onAttend, onLogout }: { onAttend: () => void; onLogout: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <ProfileHeader initials="AR" name={me.name} subtitle="Student" onLogout={onLogout} />
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pt-5">
        <InfoList
          rows={[
            { icon: 'id', label: 'Student ID', value: me.id, mono: true },
            { icon: 'building', label: 'Department', value: me.dept },
            { icon: 'cap', label: 'Batch · Section', value: me.batch },
          ]}
        />
        <p className="mt-4 flex gap-2 text-[13px] leading-snug text-ink-2">
          <span className="shrink-0"><Icon name="nearby" size={16} /></span>
          This phone is linked to your ID. Attendance works only inside the classroom.
        </p>
      </div>
      <div className="px-6 pb-8">
        <Button className="w-full" icon={<Icon name="broadcast" />} onClick={onAttend}>Attend class</Button>
      </div>
    </div>
  )
}
