import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { Student } from '../components/hazira/ui'
import { isNative } from './native'

export type Report = {
  className: string
  date: Date
  closedAt: string
  total: number
  present: Student[]
  // Whole class list (from Load class); used to name the absent students
  roster: Student[]
  teacher?: string
  room?: string
}

type Row = { roll: string; name: string; status: 'Present' | 'Absent'; time: string; method: string }

function rows(r: Report): Row[] {
  const here = new Map(r.present.map((s) => [s.roll, s]))
  const all = [...r.roster.filter((s) => !here.has(s.roll)), ...r.present]
  const seen = new Set<string>()
  return all
    .filter((s) => !seen.has(s.roll) && seen.add(s.roll))
    .sort((a, b) => a.roll.localeCompare(b.roll))
    .map((s) => {
      const p = here.get(s.roll)
      if (!p) return { roll: s.roll, name: s.name, status: 'Absent', time: '', method: '' }
      const manual = p.time.includes('by you')
      return { roll: s.roll, name: s.name, status: 'Present', time: p.time.replace(/\s*·\s*by you/, ''), method: manual ? 'Manual' : 'Bluetooth' }
    })
}

const cell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildCsv(r: Report) {
  const day = r.date.toLocaleDateString('en-CA') // 2025-11-17
  const lines = [
    ['Class', r.className],
    ['Date', day],
    ['Closed at', r.closedAt],
    ['Present', `${r.present.length} of ${r.total}`],
    [],
    ['Student ID', 'Name', 'Status', 'Time', 'Marked by'],
    ...rows(r).map((x) => [x.roll, x.name, x.status, x.time, x.method]),
  ]
  // BOM so Excel opens it as UTF-8
  return '\uFEFF' + lines.map((l) => l.map(cell).join(',')).join('\r\n')
}

export function fileName(r: Report) {
  const day = r.date.toLocaleDateString('en-CA')
  const slug = r.className.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `RollCall_${slug}_${day}.csv`
}

const longDay = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

// Caption for WhatsApp / Messenger groups: who attended, so students can check themselves
export function buildText(r: Report, withPdf = false) {
  const all = rows(r)
  const present = all.filter((x) => x.status === 'Present')
  const absent = all.filter((x) => x.status === 'Absent')
  const rate = r.total ? Math.round((r.present.length / r.total) * 100) : 0
  return [
    `Attendance · ${r.className}`,
    `${longDay(r.date)} · ${r.closedAt}${r.room ? ` · Room ${r.room}` : ''}`,
    `Present ${present.length} of ${r.total} (${rate}%)`,
    '',
    `Present students (${present.length}):`,
    ...present.map((x) => `${x.roll}  ${x.name}`),
    ...(absent.length ? ['', `Absent (${absent.length}): ${absent.map((x) => x.roll).join(', ')}`] : []),
    '',
    withPdf ? 'Full report attached (PDF). If your name is missing, tell your teacher today.' : 'If your name is missing, tell your teacher today.',
  ].join('\n')
}

export function pdfName(r: Report) {
  return fileName(r).replace(/\.csv$/, '.pdf')
}

type RGB = [number, number, number]
const BLUE: RGB = [0, 102, 204]
const INK: RGB = [15, 27, 45]
const MUTED: RGB = [91, 103, 122]
const RED: RGB = [214, 69, 69]

// A4 attendance report: brand header, class details, summary boxes, full class table, page footer.
// jsPDF is loaded only when needed so the app itself stays small.
export async function buildPdf(r: Report) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const list = rows(r)
  const present = r.present.length
  const absent = Math.max(r.total - present, 0)
  const rate = r.total ? Math.round((present / r.total) * 100) : 0

  doc.setFillColor(...BLUE)
  doc.rect(0, 0, W, 84, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('RollCall', M, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Attendance Report', M, 62)
  doc.setFontSize(10)
  doc.text(longDay(r.date), W - M, 42, { align: 'right' })
  doc.text(`Closed ${r.closedAt}`, W - M, 62, { align: 'right' })

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(r.className, M, 118)
  const meta = [r.teacher && `Teacher: ${r.teacher}`, r.room && `Room: ${r.room}`].filter(Boolean).join('     ')
  if (meta) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(meta, M, 136)
  }

  const y = 154
  const gap = 12
  const bw = (W - 2 * M - 2 * gap) / 3
  const stats: [string, string, RGB][] = [
    ['Present', String(present), BLUE],
    ['Absent', String(absent), RED],
    ['Attendance', `${rate}%`, INK],
  ]
  stats.forEach(([label, value, color], i) => {
    const x = M + i * (bw + gap)
    doc.setDrawColor(225, 231, 240)
    doc.setFillColor(244, 247, 251)
    doc.roundedRect(x, y, bw, 58, 8, 8, 'FD')
    doc.setTextColor(...color)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text(value, x + 14, y + 28)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.text(label, x + 14, y + 46)
  })

  autoTable(doc, {
    startY: y + 58 + 20,
    head: [['#', 'Student ID', 'Name', 'Status', 'Time', 'Marked by']],
    body: list.map((x, i) => [String(i + 1), x.roll, x.name, x.status, x.time || '-', x.method || '-']),
    margin: { left: M, right: M, bottom: 50 },
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 6, textColor: INK, lineColor: [225, 231, 240], lineWidth: 0.5 },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    columnStyles: {
      0: { cellWidth: 28, halign: 'right', textColor: MUTED },
      1: { cellWidth: 84 },
      3: { cellWidth: 58, fontStyle: 'bold' },
      4: { cellWidth: 62 },
      5: { cellWidth: 68 },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 3) d.cell.styles.textColor = d.cell.raw === 'Present' ? BLUE : RED
    },
  })

  const pages = doc.getNumberOfPages()
  const H = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(140, 150, 165)
    doc.text('Generated by RollCall', M, H - 24)
    doc.text(`Page ${i} of ${pages}`, W - M, H - 24, { align: 'right' })
  }
  return doc
}

const cancelled = (e: unknown) => /cancel/i.test(String((e as Error)?.message ?? e))

// CSV: on the phone, write to the app cache and open the Android share sheet (Save to Files / Drive / Gmail…).
// No storage permission needed. In the browser preview, download the file.
export async function exportCsv(r: Report): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const csv = buildCsv(r)
  const name = fileName(r)
  if (isNative) {
    const { uri } = await Filesystem.writeFile({ path: name, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 })
    try {
      await Share.share({ title: name, files: [uri], dialogTitle: 'Save or send attendance CSV' })
      return 'shared'
    } catch (e) {
      if (cancelled(e)) return 'cancelled'
      throw e
    }
  }
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}

// Share: PDF report + "who attended" caption, for the class WhatsApp / Messenger group.
// Phone: Android share sheet with the PDF attached. Browser: share sheet if it supports files,
// otherwise download the PDF and copy the caption.
export async function shareReport(r: Report): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const doc = await buildPdf(r)
  const name = pdfName(r)
  const text = buildText(r, true)
  const title = `Attendance · ${r.className}`
  try {
    if (isNative) {
      const data = doc.output('datauristring').split(',')[1]
      const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache })
      await Share.share({ title, text, files: [uri], dialogTitle: 'Share attendance' })
      return 'shared'
    }
    const file = new File([doc.output('blob')], name, { type: 'application/pdf' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, text, files: [file] })
      return 'shared'
    }
  } catch (e) {
    if (cancelled(e) || (e as Error)?.name === 'AbortError') return 'cancelled'
    throw e
  }
  const url = URL.createObjectURL(doc.output('blob'))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  await navigator.clipboard?.writeText(text).catch(() => {})
  return 'downloaded'
}
