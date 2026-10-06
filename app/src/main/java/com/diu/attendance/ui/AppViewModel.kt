package com.diu.attendance.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.diu.attendance.data.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

sealed interface Screen {
    data object Role : Screen
    data object Login : Screen
    data object Select : Screen
    data object Attendance : Screen
    data object StudentProfile : Screen
    data object StudentNearby : Screen
    data object StudentCodeEntry : Screen
    data object StudentSuccess : Screen
}

class AppViewModel : ViewModel() {
    var screen by mutableStateOf<Screen>(Screen.Role); private set
    var teacher by mutableStateOf<Teacher?>(null); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var message by mutableStateOf<String?>(null); private set

    var courses by mutableStateOf<List<Course>>(emptyList()); private set
    var rooms by mutableStateOf<List<String>>(emptyList()); private set
    var course by mutableStateOf<Course?>(null); private set
    var section by mutableStateOf(""); private set
    var room by mutableStateOf(""); private set

    var students by mutableStateOf<List<Student>>(emptyList()); private set
    val present = mutableStateMapOf<String, Boolean>()
    var attendanceSession by mutableStateOf<AttendanceSession?>(null); private set
    var sessionCredential by mutableStateOf<String?>(null); private set
    var localHostDetails by mutableStateOf<LocalHostDetails?>(null); private set
    var hostDiscoveryStatus by mutableStateOf("Not started"); private set
    var liveAttendanceCount by mutableStateOf(0); private set
    var canUseCurrentWifi by mutableStateOf(false); private set
    var simulateFailure by mutableStateOf(false); private set

    // Student Flow & Hybrid BLE State
    var studentProfile by mutableStateOf<StudentProfile?>(null); private set
    var nearbySessions by mutableStateOf<List<ActiveClassSession>>(emptyList()); private set
    var selectedSession by mutableStateOf<ActiveClassSession?>(null); private set
    var studentError by mutableStateOf<String?>(null); private set
    var studentSuccessMessage by mutableStateOf<String?>(null); private set
    var bleStatus by mutableStateOf(BleStatus.DISABLED); private set

    fun chooseTeacher() {
        val saved = ServiceLocator.auth.savedTeacher()
        if (saved != null) { teacher = saved; openSelect() } else screen = Screen.Login
    }

    fun chooseStudent() {
        studentError = null
        val saved = ServiceLocator.studentProfile.getProfile()
        if (saved != null) {
            studentProfile = saved
            openStudentNearby()
        } else {
            screen = Screen.StudentProfile
        }
    }

    fun saveStudentProfile(id: String, name: String) {
        if (id.isBlank() || name.isBlank()) {
            studentError = "Please fill in both Student ID and Name"
            return
        }
        val profile = StudentProfile(id.trim(), name.trim())
        ServiceLocator.studentProfile.saveProfile(profile)
        studentProfile = profile
        studentError = null
        openStudentNearby()
    }

    fun openStudentProfileEdit() {
        studentError = null
        screen = Screen.StudentProfile
    }

    fun openStudentNearby() {
        screen = Screen.StudentNearby
        bleStatus = ServiceLocator.bleManager.status()
        viewModelScope.launch {
            busy = true
            val sessions = ServiceLocator.nearbyClasses.getNearbySessions().toMutableList()
            // In-process demo: surface the teacher-authoritative session if one is active.
            val active = ServiceLocator.attendanceSessions.activeSession()
            if (active?.state == AttendanceSessionState.ACTIVE) {
                val liveSession = ActiveClassSession(
                    sessionId = active.id,
                    courseCode = active.courseCode,
                    courseName = active.courseName,
                    section = active.section,
                    room = active.room,
                    teacherName = active.teacherName,
                    expiresAtMillis = active.expiresAtMillis,
                )
                sessions.removeAll { it.courseCode == liveSession.courseCode && it.section == liveSession.section }
                sessions.add(0, liveSession)
            }
            if (bleStatus == BleStatus.ACTIVE) {
                ServiceLocator.bleManager.onSessionDiscovered = { discovered ->
                    if (sessions.none { it.sessionId == discovered.sessionId }) {
                        sessions.add(0, discovered)
                        nearbySessions = sessions.toList()
                    }
                }
                ServiceLocator.bleManager.startScanning()
            }
            nearbySessions = sessions
            busy = false
        }
    }

    fun selectNearbySession(s: ActiveClassSession) {
        selectedSession = s
        studentError = null
        screen = Screen.StudentCodeEntry
    }

    fun submitAttendanceCredential(credential: String) {
        val selected = selectedSession ?: return
        val profile = studentProfile ?: return
        if (busy) return

        viewModelScope.launch {
            busy = true
            studentError = null
            val outcome = ServiceLocator.attendanceSessions.submit(
                AttendanceRequest(
                    sessionId = selected.sessionId,
                    studentId = profile.id,
                    studentName = profile.name,
                    credential = credential,
                )
            )
            when (outcome) {
                is AttendanceSubmission.Recorded -> {
                    val record = outcome.record
                    if (attendanceSession?.id == record.sessionId && students.any { it.id == record.studentId }) {
                        present[record.studentId] = true
                    }
                    studentSuccessMessage =
                        "Attendance record created for ${selected.courseCode} (Section ${selected.section})."
                    screen = Screen.StudentSuccess
                }
                is AttendanceSubmission.Rejected -> studentError = outcome.reason
            }
            busy = false
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            busy = true; error = null
            ServiceLocator.auth.login(email, password)
                .onSuccess { teacher = it; openSelect() }
                .onFailure { error = it.message }
            busy = false
        }
    }

    fun logout() {
        stopSession()
        ServiceLocator.auth.logout(); teacher = null; screen = Screen.Role
    }

    private fun openSelect() {
        screen = Screen.Select
        viewModelScope.launch {
            busy = true
            courses = ServiceLocator.courses.courses()
            rooms = ServiceLocator.courses.rooms()
            busy = false
        }
    }

    fun pickCourse(c: Course) { course = c; section = "" }
    fun pickSection(s: String) { section = s }
    fun pickRoom(r: String) { room = r }

    fun loadStudentList() {
        val c = course ?: return
        viewModelScope.launch {
            busy = true
            students = ServiceLocator.students.students(c.code, section)
            present.clear()
            students.forEach { present[it.id] = false }
            attendanceSession = null
            sessionCredential = null
            message = null
            screen = Screen.Attendance
            busy = false
        }
    }

    fun toggle(id: String) { present[id] = !(present[id] ?: false) }

    fun prerequisitesReady(): Boolean {
        val problem = when {
            course == null -> "Select a course before starting attendance."
            section.isBlank() -> "Select a section before starting attendance."
            room.isBlank() -> "Select a room before starting attendance."
            students.isEmpty() -> "Load the course roster before starting attendance."
            teacher?.name.isNullOrBlank() -> "Teacher information is missing. Sign in again."
            else -> null
        }
        if (problem != null) message = problem
        return problem == null
    }

    fun startSession(useCurrentWifi: Boolean = false) {
        val selectedCourse = course ?: run { prerequisitesReady(); return }
        if (busy || !prerequisitesReady()) return

        viewModelScope.launch {
            busy = true
            message = null
            canUseCurrentWifi = false
            hostDiscoveryStatus = "Starting"
            var created: StartedAttendanceSession? = null
            try {
                created = ServiceLocator.attendanceSessions.startSession(
                    course = selectedCourse,
                    section = section,
                    room = room,
                    teacherName = teacher?.name.orEmpty(),
                    roster = students.toList(),
                )
                val started = created
                val details = if (useCurrentWifi) {
                    ServiceLocator.localClassroomHost.startOnCurrentWifi(
                        started.session,
                        ServiceLocator.attendanceSessions,
                        ::onHostDiscoveryStatus,
                    )
                } else {
                    ServiceLocator.localClassroomHost.startOnLocalOnlyHotspot(
                        started.session,
                        ServiceLocator.attendanceSessions,
                        ::onHostDiscoveryStatus,
                    ) { reason ->
                        stopAfterHostLoss(started.session.id, reason)
                    }
                }
                attendanceSession = started.session
                sessionCredential = started.credential
                localHostDetails = details
                message = null
                watchSessionExpiry(started.session.id, started.session.expiresAtMillis)
                watchAttendanceRecords(started.session.id)
                bleStatus = ServiceLocator.bleManager.status(requireAdvertise = true)
                if (bleStatus == BleStatus.ACTIVE) {
                    ServiceLocator.bleManager.startAdvertising(
                        ActiveClassSession(
                            sessionId = started.session.id,
                            courseCode = started.session.courseCode,
                            courseName = started.session.courseName,
                            section = started.session.section,
                            room = started.session.room,
                            teacherName = started.session.teacherName,
                            expiresAtMillis = started.session.expiresAtMillis,
                        )
                    )
                }
            } catch (error: Exception) {
                ServiceLocator.localClassroomHost.stop()
                created?.let { ServiceLocator.attendanceSessions.stopSession(it.session.id) }
                attendanceSession = null
                sessionCredential = null
                localHostDetails = null
                hostDiscoveryStatus = "Not started"
                canUseCurrentWifi = (error as? LocalHostStartException)?.canUseCurrentWifi == true
                message = error.message ?: "Could not start classroom hosting."
            } finally {
                busy = false
            }
        }
    }

    private fun onHostDiscoveryStatus(status: String) {
        hostDiscoveryStatus = status
        if (status.startsWith("Network discovery unavailable")) {
            message = status
        }
    }

    private fun stopAfterHostLoss(sessionId: String, reason: String) {
        if (attendanceSession?.id != sessionId) return
        viewModelScope.launch {
            ServiceLocator.attendanceSessions.stopSession(sessionId)
            ServiceLocator.localClassroomHost.stop()
            attendanceSession = attendanceSession?.copy(state = AttendanceSessionState.STOPPED)
            sessionCredential = null
            localHostDetails = null
            hostDiscoveryStatus = "Stopped"
            message = reason
            ServiceLocator.bleManager.stopAdvertising()
        }
    }

    fun onHostPermissionDenied() {
        val permissionName = if (android.os.Build.VERSION.SDK_INT >= 33) {
            "Nearby Wi-Fi devices"
        } else {
            "Location (required by Android Wi-Fi hotspot APIs)"
        }
        message = "$permissionName permission is required to host attendance. Allow it in app settings, then retry."
    }

    fun stopSession() {
        if (busy) return
        val sessionId = attendanceSession?.id
        busy = true
        message = null
        sessionCredential = null
        localHostDetails = null
        canUseCurrentWifi = false
        ServiceLocator.bleManager.stopAdvertising()
        viewModelScope.launch {
            try {
                if (sessionId != null) {
                    ServiceLocator.attendanceSessions.stopSession(sessionId)
                    attendanceSession = attendanceSession?.copy(state = AttendanceSessionState.STOPPED)
                }
                ServiceLocator.localClassroomHost.stop()
                hostDiscoveryStatus = "Stopped"
            } finally {
                busy = false
            }
        }
    }

    private fun watchAttendanceRecords(sessionId: String) {
        viewModelScope.launch {
            while (attendanceSession?.id == sessionId &&
                attendanceSession?.state == AttendanceSessionState.ACTIVE
            ) {
                val records = ServiceLocator.attendanceSessions.records(sessionId)
                liveAttendanceCount = records.size
                records.forEach { present[it.studentId] = true }
                delay(RECORD_REFRESH_MILLIS)
            }
        }
    }

    private fun watchSessionExpiry(sessionId: String, expiresAtMillis: Long) {
        viewModelScope.launch {
            delay((expiresAtMillis - System.currentTimeMillis()).coerceAtLeast(0L))
            if (attendanceSession?.id == sessionId && attendanceSession?.state == AttendanceSessionState.ACTIVE) {
                ServiceLocator.localClassroomHost.stop()
                attendanceSession = ServiceLocator.attendanceSessions.activeSession()
                sessionCredential = null
                localHostDetails = null
                hostDiscoveryStatus = "Session expired"
                ServiceLocator.bleManager.stopAdvertising()
            }
        }
    }

    override fun onCleared() {
        val sessionId = attendanceSession?.id
        kotlinx.coroutines.CoroutineScope(
            kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.IO
        ).launch {
            sessionId?.let { runCatching { ServiceLocator.attendanceSessions.stopSession(it) } }
            runCatching { ServiceLocator.localClassroomHost.stop() }
        }
        ServiceLocator.bleManager.stopAdvertising()
        super.onCleared()
    }

    private companion object {
        const val RECORD_REFRESH_MILLIS = 1_000L
    }

    @JvmName("updateSimulateFailure")
    fun setSimulateFailure(v: Boolean) {
        simulateFailure = v
        (ServiceLocator.upload as? FakeAttendanceUploadRepository)?.shouldFail = v
    }

    fun save() {
        val c = course ?: return
        viewModelScope.launch {
            busy = true
            val data = AttendanceUpload(c.code, section, room, attendanceSession?.id ?: "-", present.toMap())
            ServiceLocator.upload.upload(data)
                .onSuccess { message = "Saved to portal" }
                .onFailure { message = "Upload failed (${it.message}). Tap Save again to retry." }
            busy = false
        }
    }

    fun back() {
        ServiceLocator.bleManager.stopScanning()
        screen = when (screen) {
            Screen.Attendance -> {
                stopSession()
                Screen.Select
            }
            Screen.StudentCodeEntry -> Screen.StudentNearby
            Screen.StudentSuccess -> Screen.StudentNearby
            Screen.StudentNearby -> Screen.Role
            Screen.StudentProfile -> if (studentProfile != null) Screen.StudentNearby else Screen.Role
            else -> Screen.Role
        }
    }
}
