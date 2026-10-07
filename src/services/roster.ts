export type ClassQuery = { course: string; section: string; room: string }
export type RosterStudent = { id: string; name: string }
export type Course = { code: string; title: string; sections: string[]; room: string }

// TODO (DIU API #1): courses + sections assigned to the logged-in teacher
export async function fetchMyCourses(): Promise<Course[]> {
  await new Promise((r) => setTimeout(r, 600))
  return [
    { code: 'CSE321', title: 'Software Engineering', sections: ['61_A', '61_B'], room: 'AB4-702' },
    { code: 'CSE412', title: 'Machine Learning', sections: ['59_C'], room: 'AB4-405' },
    { code: 'SWE215', title: 'Data Structures', sections: ['63_A', '63_D', '63_F'], room: 'KT-1102' },
  ]
}

const names = [
  'Ayesha Rahman', 'Tanvir Hossain', 'Nusrat Jahan', 'Rafiul Islam', 'Sadia Akter', 'Mehedi Hasan',
  'Farhana Karim', 'Arif Chowdhury', 'Tasnim Ferdous', 'Imran Kabir', 'Jannatul Mawa', 'Shakib Ahmed',
  'Raisa Sultana', 'Nafis Iqbal', 'Lamia Haque', 'Sabbir Rahman', 'Anika Tabassum', 'Zahid Hasan',
  'Mim Akter', 'Rakibul Alam', 'Sumaiya Noor', 'Fahim Mahmud', 'Priya Das', 'Joy Barua',
  'Tahmid Khan', 'Orin Sarkar', 'Nabila Islam', 'Siam Ahmed', 'Tanjila Rahman', 'Mahin Chowdhury',
  'Rifat Hasan', 'Sharmin Akter', 'Abrar Faiyaz', 'Ishrat Jahan', 'Nayeem Hossain', 'Afsana Mimi',
  'Rashed Karim', 'Tamanna Islam', 'Sajid Hasan', 'Maliha Tabassum', 'Ehsan Ullah', 'Rumana Afroz',
  'Shuvo Das', 'Labiba Hoque', 'Zarif Rahman', 'Nowshin Tasnim', 'Kawsar Ahmed', 'Sinthia Roy',
  'Asif Iqbal', 'Fariha Anjum',
]

// Same mock list, available synchronously for the live-class demo
export const mockClass: RosterStudent[] = names.map((name, i) => ({ id: `221-15-${String(4100 + i * 3)}`, name }))
// The student app's test login (Ayesha Rahman, 221-15-4821) must be on the roster for a 2-phone test
mockClass[mockClass.length - 1] = { id: '221-15-4821', name: 'Ayesha Rahman' }

// TODO (DIU API #1): registered students of this course + section, e.g.
// fetch(`${API}/classes/roster?course=...&section=...&room=...`, { headers: { Authorization: token } })
export async function fetchRoster(q: ClassQuery): Promise<RosterStudent[]> {
  await new Promise((r) => setTimeout(r, 1200))
  if (q.section.trim().toUpperCase() === 'X') {
    throw new Error(`No students found for ${q.course}, section ${q.section}. Check the section and try again.`)
  }
  return mockClass
}
