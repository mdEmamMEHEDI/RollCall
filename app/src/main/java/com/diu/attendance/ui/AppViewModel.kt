package com.diu.attendance.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.diu.attendance.data.*
import kotlinx.coroutines.launch

sealed interface Screen {
    data object Role : Screen
    data object Login : Screen
    data object Select : Screen
    data object Attendance : Screen
    data object Student : Screen
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

    var students by mutableStateOf<List<com.diu.attendance.data.Student>>(emptyList()); private set
    val present = mutableStateMapOf<String, Boolean>()
    var sessionCode by mutableStateOf<String?>(null); private set
    var simulateFailure by mutableStateOf(false); private set

    fun chooseTeacher() {
        val saved = ServiceLocator.auth.savedTeacher()
        if (saved != null) { teacher = saved; openSelect() } else screen = Screen.Login
    }

    fun chooseStudent() { screen = Screen.Student }

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
            sessionCode = null; message = null
            screen = Screen.Attendance
            busy = false
        }
    }

    fun toggle(id: String) { present[id] = !(present[id] ?: false) }

    fun startSession() { sessionCode = (1000..9999).random().toString(); message = null }
    fun stopSession() { sessionCode = null }

    @JvmName("updateSimulateFailure")
    fun setSimulateFailure(v: Boolean) {
        simulateFailure = v
        (ServiceLocator.upload as? FakeAttendanceUploadRepository)?.shouldFail = v
    }

    fun save() {
        val c = course ?: return
        viewModelScope.launch {
            busy = true
            val data = AttendanceUpload(c.code, section, room, sessionCode ?: "-", present.toMap())
            ServiceLocator.upload.upload(data)
                .onSuccess { message = "Saved to portal" }
                .onFailure { message = "Upload failed (${it.message}). Tap Save again to retry." }
            busy = false
        }
    }

    fun back() {
        screen = when (screen) {
            Screen.Attendance -> Screen.Select
            else -> Screen.Role
        }
    }
}
