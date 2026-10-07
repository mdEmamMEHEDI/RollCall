import { Ble, isNative, type Packet } from './native'

/*
 * RollCall offline attendance protocol: Bluetooth LE only, no Wi-Fi, no hotspot, no connections.
 *
 * Why no connections: a phone can hold ~7 BLE connections and a hotspot ~10 clients.
 * Advertising (broadcast) has no such limit, so all 50 students talk to the teacher at once.
 *
 * 1. TEACHER ADVERTISES (every 100 ms, legacy 31 B + scan response 31 B)
 *    adv:  serviceUUID 0xRC01 | sessionId 4B | codeTag 4B = HMAC(code, sessionId)[0..4] | slot 1B
 *    scan response: "Dr. Nasrin Sultana|CSE321|61_A|AB4-702" (teacher info shown to student)
 *    The 4-digit code itself is never broadcast, only its tag. So a student must read it off the board.
 *
 * 2. STUDENT MATCHES
 *    Student types the code. The app scans 0xRC01 and keeps only adverts where
 *    HMAC(typedCode, sessionId) == codeTag. Other teachers nearby have other codes, so they
 *    are ignored. If 2 rooms share a code (1 in 10 000) the student picks by teacher name + room.
 *
 * 3. STUDENT ADVERTISES (100 ms for up to 20 s)
 *    sessionId 4B | studentId 5B (221-15-4821 packed) | deviceId 3B | nonce 2B |
 *    tag 4B = HMAC(deviceKey, sessionId|studentId|code|nonce)
 *    deviceKey is created on the phone at first login and never leaves it (no extra server needed;
 *    DIU only gives the roster and the attendance push). The teacher's phone remembers which deviceId
 *    each studentId used. A known ID from a new phone, or one phone sending two IDs, goes to
 *    "Needs your check", so a friend can't mark you from their phone.
 *
 * 4. TEACHER SCANS
 *    One long-running scan (SCAN_MODE_LOW_LATENCY) with a hardware ScanFilter on sessionId, so
 *    the 150+ phones of other classes are dropped by the Bluetooth chip, not the app.
 *    Accepts the current code and the previous one (30 s grace). RSSI below -85 dBm is flagged as
 *    "far away". Duplicate studentId on another deviceId is flagged as "phone linked elsewhere".
 *
 * 5. TEACHER ACKS (broadcast, no connection)
 *    Ack adverts rotate every 200 ms: sessionId | 6 × 3B hash(studentId|nonce).
 *    50 students → 9 packets → whole class confirmed in ~2 s. Phones with BLE 5 extended
 *    advertising put all 50 in one 255 B packet. The student stops advertising once it sees its hash.
 *
 * 6. FALLBACK
 *    A phone that can't advertise (old chipset) does a 1 s GATT connect → write 20 B → disconnect,
 *    queued with random backoff, 4 at a time: 50 phones in ~15 s. Last resort: Add manually.
 *
 * Air budget: 250 advertisers × 10/s × 0.4 ms ≈ 1 s of air per second spread over 3 channels ≈ 33 %.
 * Collisions only delay a packet by 100 ms; each student repeats ~100 times, so loss is ~0.
 */

// Anti-remote rules: the code is only on the board (just its HMAC tag is broadcast), it rotates every 30 s,
// BLE reaches only the room, and the student phone refuses to send if the teacher is weaker than this.
// The teacher's phone also flags weak students for review, and the device key stops proxy marking.
export const MIN_RSSI = -80

export type NearbyClass = {
  sessionId: string
  teacher: string
  designation: string
  course: string
  section: string
  room: string
  rssi: number
}

// Android app: real BLE scan (below). Web preview: mock results for the demo states.
export async function findClassByCode(code: string, demo: 'one' | 'two' | 'none' | 'far' = 'one'): Promise<NearbyClass[]> {
  if (isNative) return scanForCode(code, 4000)
  await new Promise((r) => setTimeout(r, 2200))
  void code
  const a: NearbyClass = {
    sessionId: 'a91f', teacher: 'Dr. Nasrin Sultana', designation: 'Associate Professor',
    course: 'CSE321 Software Engineering', section: '61_A', room: 'AB4-702', rssi: -58,
  }
  const b: NearbyClass = {
    sessionId: '3c07', teacher: 'Kamrul Hasan', designation: 'Lecturer',
    course: 'SWE215 Data Structures', section: '63_D', room: 'AB4-704', rssi: -81,
  }
  if (demo === 'far') return [{ ...a, rssi: -91 }]
  return demo === 'none' ? [] : demo === 'two' ? [a, b] : [a]
}

/* ---------------- Real Bluetooth (Android app only) ---------------- */


// 16-bit service-data UUIDs: protocol packets, course label, teacher info (scan response)
const U_PROTO = '1c01'
const U_COURSE = '1c02'
const U_INFO = '1c03'
const T_TEACHER = 0x54
const T_STUDENT = 0x53
const T_ACK = 0x41
export const FAR_RSSI = -85

const enc = new TextEncoder()
const dec = new TextDecoder()
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((x) => parseInt(x, 16)))
const cat = (...a: Uint8Array[]) => {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0))
  let i = 0
  for (const x of a) {
    out.set(x, i)
    i += x.length
  }
  return out
}
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n))
// Keep only what fits in a legacy advert, without cutting a UTF-8 character in half
const fit = (s: string, max: number) => {
  let b = enc.encode(s)
  while (b.length > max) b = enc.encode((s = s.slice(0, -1)))
  return b
}

async function hmac(key: string | Uint8Array, msg: Uint8Array, n: number) {
  const k = await crypto.subtle.importKey('raw', (typeof key === 'string' ? enc.encode(key) : key) as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, msg as BufferSource)).slice(0, n)
}
async function sha(msg: Uint8Array, n: number) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', msg as BufferSource)).slice(0, n)
}

// "221-15-4821" → 5 bytes (digits as a number). Matching against the roster is by digits only.
export const idDigits = (id: string) => id.replace(/\D/g, '')
function packId(id: string) {
  let n = BigInt(idDigits(id) || '0')
  const b = new Uint8Array(5)
  for (let i = 4; i >= 0; i--) {
    b[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return b
}
const unpackId = (b: Uint8Array) => b.reduce((n, x) => (n << 8n) | BigInt(x), 0n).toString()

// Device key: made on this phone at first launch, never leaves it. deviceId = first 3 bytes of its hash.
async function deviceId() {
  let k = localStorage.getItem('rollcall.deviceKey')
  if (!k) {
    k = hex(rand(16))
    localStorage.setItem('rollcall.deviceKey', k)
  }
  return sha(unhex(k), 3)
}
const ackHash = (sid: Uint8Array, nonce: Uint8Array) => sha(cat(sid, nonce), 3)

async function listen(f: (p: Packet) => void) {
  const h = await Ble.addListener('packet', f)
  await Ble.startScan()
  return async () => {
    await h.remove()
    await Ble.stopScan()
  }
}

/* ---------- Teacher ---------- */

export type Arrival = { idDigits: string; rssi: number; deviceId: string; ack: string }

export type HostInfo = { teacher: string; course: string; section: string; room: string }

/**
 * Runs a live class: advertises the session + code tag, rotates acks, and reports every
 * student packet whose tag proves they typed the current (or previous, 30 s grace) code.
 */
export function hostSession(info: HostInfo, onArrive: (a: Arrival) => void) {
  const session = rand(4)
  const codes: string[] = []
  let acks: string[] = []
  let stopped = false
  let stopScan: (() => Promise<void>) | null = null
  const seen = new Set<string>()

  async function setCode(code: string) {
    codes.unshift(code)
    codes.length = Math.min(codes.length, 2)
    const tag = await hmac(code, session, 4)
    if (stopped) return
    const data: Record<string, string> = {
      [U_PROTO]: hex(cat(new Uint8Array([T_TEACHER]), session, tag)),
      [U_COURSE]: hex(fit(`${info.course.split(' ')[0]}|${info.section}`, 11)),
    }
    const scanResponse = { [U_INFO]: hex(fit(`${info.room}|${info.teacher}`, 27)) }
    await Ble.advertise({ slot: 'main', data, scanResponse }).catch(() =>
      // Some chipsets add flags and run out of room: drop the course label and try again
      Ble.advertise({ slot: 'main', data: { [U_PROTO]: data[U_PROTO] }, scanResponse }),
    )
  }

  // Ack packets rotate: 6 students per packet, a new packet every 300 ms
  let page = 0
  const ackTimer = setInterval(() => {
    if (stopped || !acks.length) return
    const pages = Math.ceil(acks.length / 6)
    page = (page + 1) % pages
    const body = acks.slice(page * 6, page * 6 + 6).map(unhex)
    Ble.advertise({ slot: 'ack', data: { [U_PROTO]: hex(cat(new Uint8Array([T_ACK]), session, ...body)) } }).catch(() => {})
  }, 300)

  listen(async (p) => {
    const raw = p.data[U_PROTO]
    if (!raw) return
    const b = unhex(raw)
    if (b.length !== 19 || b[0] !== T_STUDENT || !same(b.slice(1, 5), session)) return
    const sid = b.slice(5, 10)
    const dev = b.slice(10, 13)
    const nonce = b.slice(13, 15)
    const key = hex(b.slice(5, 15))
    if (seen.has(key)) return
    const msg = b.slice(1, 15)
    for (const c of codes) {
      if (same(await hmac(c, msg, 4), b.slice(15, 19))) {
        seen.add(key)
        onArrive({ idDigits: unpackId(sid), rssi: p.rssi, deviceId: hex(dev), ack: hex(await ackHash(sid, nonce)) })
        return
      }
    }
  }).then((s) => {
    if (stopped) s()
    else stopScan = s
  })

  return {
    setCode,
    /** Students the teacher accepted. Their phones show "Present" once they see their hash. */
    setAcks(list: string[]) {
      acks = list
    },
    async stop() {
      stopped = true
      clearInterval(ackTimer)
      await stopScan?.()
      await Ble.stopAdvertise()
    },
  }
}

/* ---------- Student ---------- */

async function scanForCode(code: string, ms: number): Promise<NearbyClass[]> {
  const found = new Map<string, NearbyClass>()
  const tags = new Map<string, Promise<Uint8Array>>()
  const stop = await listen(async (p) => {
    const raw = p.data[U_PROTO]
    if (!raw) return
    const b = unhex(raw)
    if (b.length !== 9 || b[0] !== T_TEACHER) return
    const sessionId = hex(b.slice(1, 5))
    if (!tags.has(sessionId)) tags.set(sessionId, hmac(code, b.slice(1, 5), 4))
    if (!same(await tags.get(sessionId)!, b.slice(5, 9))) return
    const [course = 'Class', section = ''] = p.data[U_COURSE] ? dec.decode(unhex(p.data[U_COURSE])).split('|') : []
    const [room = '', teacher = 'Your teacher'] = p.data[U_INFO] ? dec.decode(unhex(p.data[U_INFO])).split('|') : []
    const old = found.get(sessionId)
    // Keep the strongest reading and any info the scan response filled in
    found.set(sessionId, {
      sessionId,
      teacher: old && !p.data[U_INFO] ? old.teacher : teacher,
      designation: 'Teacher',
      course: old && !p.data[U_COURSE] ? old.course : course,
      section: old && !p.data[U_COURSE] ? old.section : section,
      room: old && !p.data[U_INFO] ? old.room : room,
      rssi: Math.max(old?.rssi ?? -127, p.rssi),
    })
  })
  await new Promise((r) => setTimeout(r, ms))
  await stop()
  return [...found.values()]
}

/** Advertises this student's signed packet until the teacher acks it (or 20 s pass). */
export async function sendAttendance(sessionId: string, studentId: string, code: string, ms = 20000): Promise<boolean> {
  const session = unhex(sessionId)
  const sid = packId(studentId)
  const nonce = rand(2)
  const body = cat(session, sid, await deviceId(), nonce)
  const pkt = cat(new Uint8Array([T_STUDENT]), body, await hmac(code, body, 4))
  const mine = await ackHash(sid, nonce)
  return new Promise<boolean>(async (resolve) => {
    let done = false
    const finish = async (ok: boolean) => {
      if (done) return
      done = true
      clearTimeout(t)
      await stop()
      await Ble.stopAdvertise({ slot: 'student' })
      resolve(ok)
    }
    const t = setTimeout(() => finish(false), ms)
    const stop = await listen((p) => {
      const raw = p.data[U_PROTO]
      if (!raw) return
      const b = unhex(raw)
      if (b[0] !== T_ACK || !same(b.slice(1, 5), session)) return
      for (let i = 5; i + 3 <= b.length; i += 3) if (same(b.slice(i, i + 3), mine)) return finish(true)
    })
    await Ble.advertise({ slot: 'student', data: { [U_PROTO]: hex(pkt) } }).catch(() => finish(false))
  })
}

export { isNative }
