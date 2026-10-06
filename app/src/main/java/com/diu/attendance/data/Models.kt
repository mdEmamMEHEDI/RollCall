package com.diu.attendance.data

data class Teacher(val name: String, val email: String)
data class Course(val code: String, val name: String, val sections: List<String>) {
    val label get() = "$code - $name"
}
data class Student(val id: String, val name: String)
data class StudentProfile(val id: String, val name: String)

data class ActiveClassSession(
    val sessionId: String,
    val courseCode: String,
    val courseName: String,
    val section: String,
    val room: String,
    val teacherName: String,
    val expiresAtMillis: Long,
) {
    val label get() = "$courseCode - $courseName (Sec $section, $room)"
}

data class AttendanceUpload(
    val courseCode: String,
    val section: String,
    val room: String,
    val sessionId: String,
    val records: Map<String, Boolean>,
)
