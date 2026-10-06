package com.diu.attendance.data

import android.content.SharedPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.UUID

enum class AttendanceSessionState {
    ACTIVE,
    STOPPED,
    EXPIRED
}

data class AttendanceSession(
    val id: String,
    val courseCode: String,
    val courseName: String,
    val section: String,
    val room: String,
    val teacherName: String,
    val startedAtMillis: Long,
    val expiresAtMillis: Long,
    val state: AttendanceSessionState,
    val roster: List<Student>,
    internal val credentialHash: String,
)

data class StartedAttendanceSession(
    val session: AttendanceSession,
    val credential: String,
)

data class AttendanceRequest(
    val sessionId: String,
    val studentId: String,
    val studentName: String,
    val credential: String,
)

data class AttendanceRecord(
    val sessionId: String,
    val studentId: String,
    val studentName: String,
    val recordedAtMillis: Long,
)

sealed interface AttendanceSubmission {
    data class Recorded(val record: AttendanceRecord) : AttendanceSubmission
    data class Rejected(val reason: String) : AttendanceSubmission
}

interface AttendanceRecordStore {
    fun find(sessionId: String, studentId: String): AttendanceRecord?
    fun insertIfAbsent(record: AttendanceRecord): Boolean
    fun records(sessionId: String): List<AttendanceRecord>
}

class InMemoryAttendanceRecordStore : AttendanceRecordStore {
    private val lock = Any()
    private val records = linkedMapOf<Pair<String, String>, AttendanceRecord>()

    override fun find(sessionId: String, studentId: String): AttendanceRecord? =
        synchronized(lock) { records[sessionId to studentId] }

    override fun insertIfAbsent(record: AttendanceRecord): Boolean = synchronized(lock) {
        val key = record.sessionId to record.studentId
        if (records.containsKey(key)) return@synchronized false
        records[key] = record
        true
    }

    override fun records(sessionId: String): List<AttendanceRecord> = synchronized(lock) {
        records.values.filter { it.sessionId == sessionId }
    }
}

class SharedPreferencesAttendanceRecordStore(
    private val preferences: SharedPreferences,
) : AttendanceRecordStore {
    private val lock = Any()

    override fun find(sessionId: String, studentId: String): AttendanceRecord? = synchronized(lock) {
        preferences.getString(recordKey(sessionId, studentId), null)?.let(::decodeRecord)
    }

    override fun insertIfAbsent(record: AttendanceRecord): Boolean = synchronized(lock) {
        val key = recordKey(record.sessionId, record.studentId)
        if (preferences.contains(key)) return@synchronized false
        preferences.edit().putString(key, encodeRecord(record)).commit()
    }

    override fun records(sessionId: String): List<AttendanceRecord> = synchronized(lock) {
        preferences.all.entries.mapNotNull { (key, value) ->
            if (!key.startsWith(RECORD_PREFIX) || value !is String) return@mapNotNull null
            decodeRecord(value)?.takeIf { it.sessionId == sessionId }
        }
    }

    private fun recordKey(sessionId: String, studentId: String): String =
        RECORD_PREFIX + sha256("$sessionId\u0000$studentId")

    private fun encodeRecord(record: AttendanceRecord): String = listOf(
        record.sessionId,
        record.studentId,
        record.studentName,
    ).joinToString(".") { Base64.getUrlEncoder().withoutPadding().encodeToString(it.toByteArray(StandardCharsets.UTF_8)) } +
        ".${record.recordedAtMillis}"

    private fun decodeRecord(value: String): AttendanceRecord? = runCatching {
        val parts = value.split('.')
        require(parts.size == 4)
        AttendanceRecord(
            sessionId = String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8),
            studentId = String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8),
            studentName = String(Base64.getUrlDecoder().decode(parts[2]), StandardCharsets.UTF_8),
            recordedAtMillis = parts[3].toLong(),
        )
    }.getOrNull()

    private companion object {
        const val RECORD_PREFIX = "attendance_record_"
    }
}

interface AttendanceSessionRepository {
    suspend fun startSession(
        course: Course,
        section: String,
        room: String,
        teacherName: String,
        roster: List<Student>,
    ): StartedAttendanceSession

    suspend fun activeSession(): AttendanceSession?
    suspend fun stopSession(sessionId: String)
    suspend fun submit(request: AttendanceRequest): AttendanceSubmission
    suspend fun records(sessionId: String): List<AttendanceRecord>
}

class TeacherAttendanceSessionRepository(
    private val recordStore: AttendanceRecordStore,
    private val nowMillis: () -> Long = System::currentTimeMillis,
    private val generateCredential: () -> String = ::newCredential,
) : AttendanceSessionRepository {
    private val mutex = Mutex()
    private var current: AttendanceSession? = null

    override suspend fun startSession(
        course: Course,
        section: String,
        room: String,
        teacherName: String,
        roster: List<Student>,
    ): StartedAttendanceSession = withContext(Dispatchers.IO) {
        mutex.withLock {
            require(section in course.sections) { "Select a valid course section" }
            require(room.isNotBlank()) { "Select a room" }
            require(roster.isNotEmpty()) { "The student roster is empty" }

            val now = nowMillis()
            val credential = generateCredential()
            val session = AttendanceSession(
                id = UUID.randomUUID().toString(),
                courseCode = course.code,
                courseName = course.name,
                section = section,
                room = room,
                teacherName = teacherName,
                startedAtMillis = now,
                expiresAtMillis = now + SESSION_TTL_MILLIS,
                state = AttendanceSessionState.ACTIVE,
                roster = roster.distinctBy { it.id.trim() }.map { it.copy(id = it.id.trim(), name = it.name.trim()) },
                credentialHash = sha256(credential),
            )
            current = session
            StartedAttendanceSession(session, credential)
        }
    }

    override suspend fun activeSession(): AttendanceSession? = withContext(Dispatchers.IO) {
        mutex.withLock {
            current?.let { session ->
                if (session.state == AttendanceSessionState.ACTIVE && nowMillis() >= session.expiresAtMillis) {
                    session.copy(state = AttendanceSessionState.EXPIRED).also { current = it }
                } else {
                    session
                }
            }
        }
    }

    override suspend fun stopSession(sessionId: String) {
        withContext(Dispatchers.IO) {
            mutex.withLock {
                current?.takeIf { it.id == sessionId && it.state == AttendanceSessionState.ACTIVE }
                    ?.let { current = it.copy(state = AttendanceSessionState.STOPPED) }
            }
        }
    }

    override suspend fun submit(request: AttendanceRequest): AttendanceSubmission = withContext(Dispatchers.IO) {
        mutex.withLock {
            val session = current ?: return@withLock AttendanceSubmission.Rejected("No teacher session is active")
            if (session.id != request.sessionId) {
                return@withLock AttendanceSubmission.Rejected("This teacher session is no longer active")
            }

            val now = nowMillis()
            if (session.state != AttendanceSessionState.ACTIVE || now >= session.expiresAtMillis) {
                if (session.state == AttendanceSessionState.ACTIVE) {
                    current = session.copy(state = AttendanceSessionState.EXPIRED)
                }
                return@withLock AttendanceSubmission.Rejected("The teacher session has expired or stopped")
            }

            val suppliedHash = sha256(request.credential.trim())
            if (!MessageDigest.isEqual(
                    suppliedHash.toByteArray(StandardCharsets.US_ASCII),
                    session.credentialHash.toByteArray(StandardCharsets.US_ASCII),
                )
            ) {
                return@withLock AttendanceSubmission.Rejected("Invalid session credential")
            }

            val studentId = request.studentId.trim()
            val rosterStudent = session.roster.firstOrNull { it.id == studentId }
                ?: return@withLock AttendanceSubmission.Rejected("Student ID is not in this course roster")
            val existing = recordStore.find(session.id, studentId)
            if (existing != null) return@withLock AttendanceSubmission.Recorded(existing)

            val record = AttendanceRecord(
                sessionId = session.id,
                studentId = studentId,
                studentName = rosterStudent.name,
                recordedAtMillis = now,
            )
            if (recordStore.insertIfAbsent(record)) {
                AttendanceSubmission.Recorded(record)
            } else {
                recordStore.find(session.id, studentId)?.let(AttendanceSubmission::Recorded)
                    ?: AttendanceSubmission.Rejected("Attendance record could not be saved")
            }
        }
    }

    override suspend fun records(sessionId: String): List<AttendanceRecord> = withContext(Dispatchers.IO) {
        recordStore.records(sessionId)
    }

    companion object {
        const val SESSION_TTL_MILLIS = 90L * 60L * 1000L

        private fun newCredential(): String =
            String.format(java.util.Locale.US, "%06d", SecureRandom().nextInt(1_000_000))
    }
}

private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(StandardCharsets.UTF_8))
    .joinToString("") { "%02x".format(it) }
