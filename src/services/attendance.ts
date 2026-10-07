export type Session = {
  id: string
  course: string
  date: string
  total: number
  present: { id: string; name: string; time: string }[]
}

const KEY = 'rollcall.pending'

// Demo override so the preview can simulate no internet
let override: boolean | null = null
export const setOnlineOverride = (v: boolean | null) => (override = v)
export const isOnline = () => override ?? navigator.onLine

// TODO (DIU API #2): push attendance with the teacher's token. This is the only write DIU allows.
export async function uploadAttendance(s: Session | Session[]): Promise<void> {
  await new Promise((r) => setTimeout(r, 1200))
  if (!isOnline()) throw new Error('No internet. Save on phone and upload later.')
  void s
}

export function listSaved(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveOffline(s: Session) {
  localStorage.setItem(KEY, JSON.stringify([...listSaved().filter((x) => x.id !== s.id), s]))
}

export function markUploaded(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(listSaved().filter((x) => !ids.includes(x.id))))
}
