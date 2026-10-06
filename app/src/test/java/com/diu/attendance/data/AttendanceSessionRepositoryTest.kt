package com.diu.attendance.data

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AttendanceSessionRepositoryTest {
    private val course = Course("SWE431", "Software Engineering Capstone", listOf("A", "B"))
    private val roster = (1..50).map { Student("241-15-%03d".format(it), "Student $it") }
    private var now = 1_000L
    private val recordStore = InMemoryAttendanceRecordStore()
    private val repository = TeacherAttendanceSessionRepository(
        recordStore = recordStore,
        nowMillis = { now },
        generateCredential = { TEST_CREDENTIAL },
    )

    @Test
    fun generatedSessionCodeIsSixDigits() = runBlocking {
        val defaultRepository = TeacherAttendanceSessionRepository(InMemoryAttendanceRecordStore())
        val started = defaultRepository.startSession(course, "A", "Room 301", "Demo Teacher", roster)

        assertTrue(started.credential.matches(Regex("\\d{6}")))
        defaultRepository.stopSession(started.session.id)
    }

    @Test
    fun validRosterRequestCreatesTeacherRecordBeforeReturningRecorded() = runBlocking {
        val started = startSession()
        val result = repository.submit(request(started, roster.first()))

        assertTrue(result is AttendanceSubmission.Recorded)
        assertEquals(1, repository.records(started.session.id).size)
    }

    @Test
    fun duplicateRequestReturnsExistingRecordWithoutCreatingAnother() = runBlocking {
        val started = startSession()
        val student = roster.first()
        val first = repository.submit(request(started, student)) as AttendanceSubmission.Recorded
        val retry = repository.submit(request(started, student)) as AttendanceSubmission.Recorded

        assertEquals(first.record, retry.record)
        assertEquals(1, repository.records(started.session.id).size)
    }

    @Test
    fun invalidCredentialDoesNotCreateRecord() = runBlocking {
        val started = startSession()
        val result = repository.submit(request(started, roster.first()).copy(credential = "wrong"))

        assertTrue(result is AttendanceSubmission.Rejected)
        assertTrue(repository.records(started.session.id).isEmpty())
    }

    @Test
    fun studentOutsideRosterDoesNotCreateRecord() = runBlocking {
        val started = startSession()
        val result = repository.submit(request(started, Student("unknown", "Unknown")))

        assertTrue(result is AttendanceSubmission.Rejected)
        assertTrue(repository.records(started.session.id).isEmpty())
    }

    @Test
    fun expiredSessionRejectsRequests() = runBlocking {
        val started = startSession()
        now = started.session.expiresAtMillis
        val result = repository.submit(request(started, roster.first()))

        assertTrue(result is AttendanceSubmission.Rejected)
        assertEquals(AttendanceSessionState.EXPIRED, repository.activeSession()?.state)
        assertTrue(repository.records(started.session.id).isEmpty())
    }

    @Test
    fun stoppedSessionRejectsRequests() = runBlocking {
        val started = startSession()
        repository.stopSession(started.session.id)
        val result = repository.submit(request(started, roster.first()))

        assertTrue(result is AttendanceSubmission.Rejected)
        assertEquals(AttendanceSessionState.STOPPED, repository.activeSession()?.state)
        assertTrue(repository.records(started.session.id).isEmpty())
    }

    @Test
    fun fiftyRosterStudentsCanBeRecordedInOneSession() = runBlocking {
        val started = startSession()
        roster.forEach { student ->
            assertTrue(repository.submit(request(started, student)) is AttendanceSubmission.Recorded)
        }

        assertEquals(50, repository.records(started.session.id).size)
    }

    private suspend fun startSession() = repository.startSession(
        course = course,
        section = "A",
        room = "Room 301",
        teacherName = "Demo Teacher",
        roster = roster,
    )

    private fun request(started: StartedAttendanceSession, student: Student) = AttendanceRequest(
        sessionId = started.session.id,
        studentId = student.id,
        studentName = student.name,
        credential = started.credential,
    )

    private companion object {
        const val TEST_CREDENTIAL = "a-valid-test-session-credential"
    }
}
