import type { Student } from '../../components/hazira/ui'
import { mockClass } from '../../services/roster'

// Demo roster for the live class, built from the same mock class list the server returns
export const roster: Student[] = mockClass.map((r, i) => ({
  id: i,
  roll: r.id,
  name: r.name,
  status: 'present',
  time: `10:${String(1 + Math.floor(i / 12)).padStart(2, '0')} AM`,
}))

export const newCode = () => String(Math.floor(1000 + Math.random() * 9000))
