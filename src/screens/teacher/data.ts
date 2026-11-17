import type { Student } from '../../components/hazira/ui'
import { mockClass, type RosterStudent } from '../../services/roster'

// Turns the class list from the server (fetchRoster) into live-class rows
export const toStudents = (list: RosterStudent[]): Student[] =>
  list.map((r, i) => ({
    id: i,
    roll: r.id,
    name: r.name,
    status: 'present',
    time: `10:${String(1 + Math.floor(i / 12)).padStart(2, '0')} AM`,
  }))

// Demo class used when a screen is opened directly from the preview menu
export const roster: Student[] = toStudents(mockClass)

export const newCode = () => String(Math.floor(1000 + Math.random() * 9000))
