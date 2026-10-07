# Final polish within DIU's limits — Plan

## Context
DIU will give only two things: (1) the registered student list for a course and section, readable from the teacher app, and (2) permission to push attendance. Students already see their attendance % in the DIU portal. So no history, report or admin screens are needed. The project succeeds if the automatic attendance works properly. This plan trims the prototype to exactly that scope and marks the two DIU integration points clearly.

## Changes
1. **Mark the 2 DIU integration points clearly**
   - `src/services/roster.ts` `fetchRoster`: TODO says "DIU API: registered students of course + section".
   - `src/services/attendance.ts` `uploadAttendance`: TODO says "DIU API: push attendance".
   - Every other mock (`findClassByCode`, login) is labelled as ours, not DIU's.
2. **Device binding without DIU:** DIU won't issue device keys, so the key is created on the phone at first login. The student ID → device ID mapping travels inside the uploaded attendance. The teacher app flags an ID that shows up from a new device, and the same device used for two IDs, as "Needs your check" (already in LiveClass). Update the comment in `src/services/ble.ts` to say this: no extra server needed.
3. **Remove what's out of scope / dead**
   - `recent` in `src/screens/teacher/data.ts`.
   - The `late` status in `StatusChip` (`src/components/hazira/ui.tsx`).
   - The unused `name` prop on Join, if unused.
4. **Real dates instead of hardcoded ones**
   - Summary: date, time range and upload time come from the session's `new Date()`.
   - LiveClass header shows the start time.
   - Student success screen shows the confirm time.
5. **Student setup:** use the same `defaultSetup` pattern as the teacher app, with one TODO, instead of `setupOk = false`.

## Verification
`npx tsc --noEmit`, then click through both flows: teacher Load class → Live → Upload, and student Login → Attend → Present.
