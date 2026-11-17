import { useEffect, useState } from 'react'
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

// True inside the Android app (Capacitor), false in the browser / Figma preview
export const isNative = Capacitor.isNativePlatform()

// Which app this build is: `pnpm build:teacher` or `pnpm build:student` (vite --mode sets it)
export const nativeRole: 'teacher' | 'student' = import.meta.env.MODE === 'student' ? 'student' : 'teacher'

export type PhoneState = { bluetooth: boolean; location: boolean; nearby: boolean; canAdvertise: boolean }
export type Packet = { address: string; rssi: number; data: Record<string, string> }

type RollCallBle = {
  status(): Promise<PhoneState>
  prepare(): Promise<PhoneState>
  openLocationSettings(): Promise<void>
  openAppSettings(): Promise<void>
  requestNearby(): Promise<PhoneState>
  enableBluetooth(): Promise<PhoneState>
  advertise(o: { slot: string; data: Record<string, string>; scanResponse?: Record<string, string> }): Promise<void>
  stopAdvertise(o?: { slot?: string }): Promise<void>
  startScan(): Promise<void>
  stopScan(): Promise<void>
  addListener(e: 'state', f: (s: PhoneState) => void): Promise<PluginListenerHandle>
  addListener(e: 'packet', f: (p: Packet) => void): Promise<PluginListenerHandle>
  addListener(e: 'advertiseError' | 'scanError', f: (e: { code: number; slot?: string }) => void): Promise<PluginListenerHandle>
}

// Kotlin/Java side: android/app/src/main/java/bd/edu/diu/rollcall/RollCallBlePlugin.java
// Registered only inside the Android app, and only once: the browser preview never touches it
// (it keeps the mocks), and hot reload re-runs this module, which Capacitor would reject.
const g = globalThis as { __rollCallBle?: RollCallBle }
function plugin(): RollCallBle {
  if (!g.__rollCallBle) {
    try {
      g.__rollCallBle = registerPlugin<RollCallBle>('RollCallBle')
    } catch {
      g.__rollCallBle = (Capacitor as unknown as { Plugins: Record<string, RollCallBle> }).Plugins.RollCallBle
    }
  }
  return g.__rollCallBle
}
export const Ble = new Proxy({} as RollCallBle, {
  get: (_, k) => {
    const p = plugin() as unknown as Record<PropertyKey, unknown>
    const v = p[k]
    return typeof v === 'function' ? v.bind(p) : v
  },
})

/** Real phone state on Android. Asks for permission + Bluetooth if needed. Web preview: everything on. */
export async function preparePhone(): Promise<PhoneState> {
  if (!isNative) return { bluetooth: true, location: true, nearby: true, canAdvertise: true }
  return Ble.prepare()
}

export const phoneReady = (s: PhoneState) => s.bluetooth && s.location && s.nearby

/** Live Bluetooth / Location / Nearby state. Updates when the user flips a switch or comes back from Settings. Null on web. */
export function usePhoneState() {
  const [st, setSt] = useState<PhoneState | null>(null)
  useEffect(() => {
    if (!isNative) return
    let live = true
    Ble.status().then((s) => live && setSt(s))
    const h = Ble.addListener('state', (s) => live && setSt(s))
    return () => {
      live = false
      h.then((x) => x.remove())
    }
  }, [])
  return st
}

/**
 * Turns one thing on the real Android way. Bluetooth and Nearby get the system dialog;
 * Location (and a permission denied with "Don't ask again") can only be turned on in Settings.
 * Resolves true if it is on now.
 */
export async function turnOnNative(k: 'bluetooth' | 'location' | 'nearby'): Promise<boolean> {
  if (k === 'location') {
    await Ble.openLocationSettings()
    return false
  }
  if (k === 'nearby') return (await Ble.requestNearby()).nearby
  const s = await Ble.status()
  if (!s.nearby && !(await Ble.requestNearby()).nearby) return false
  return (await Ble.enableBluetooth()).bluetooth
}
