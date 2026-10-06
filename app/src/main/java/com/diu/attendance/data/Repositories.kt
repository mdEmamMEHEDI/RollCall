package com.diu.attendance.data

import android.content.Context
import android.content.SharedPreferences
import com.diu.attendance.BuildConfig
import kotlinx.coroutines.delay

interface AuthRepository {
    suspend fun login(email: String, password: String): Result<Teacher>
    fun savedTeacher(): Teacher?
    fun logout()
}
interface CourseRepository {
    suspend fun courses(): List<Course>
    suspend fun rooms(): List<String>
}
interface StudentListRepository {
    suspend fun students(courseCode: String, section: String): List<Student>
}
interface AttendanceUploadRepository {
    suspend fun upload(data: AttendanceUpload): Result<Unit>
}

private const val FAKE_DELAY = 500L

/** Demo login: demo@diu.edu.bd / 1234. Stays signed in via SharedPreferences (will be encrypted later). */
class FakeAuthRepository(private val prefs: SharedPreferences) : AuthRepository {
    override suspend fun login(email: String, password: String): Result<Teacher> {
        delay(FAKE_DELAY)
        return if (email.trim() == "demo@diu.edu.bd" && password == "1234") {
            val t = Teacher("Demo Teacher", email.trim())
            prefs.edit().putString("name", t.name).putString("email", t.email).apply()
            Result.success(t)
        } else Result.failure(Exception("Wrong email or password"))
    }

    override fun savedTeacher(): Teacher? {
        val email = prefs.getString("email", null) ?: return null
        return Teacher(prefs.getString("name", "") ?: "", email)
    }

    override fun logout() { prefs.edit().clear().apply() }
}

class FakeCourseRepository : CourseRepository {
    override suspend fun courses(): List<Course> {
        delay(FAKE_DELAY)
        return listOf(
            Course("SWE431", "Software Engineering Capstone", listOf("A", "B")),
            Course("CSE312", "Computer Networks", listOf("A", "B")),
        )
    }

    override suspend fun rooms(): List<String> {
        delay(FAKE_DELAY)
        return listOf("Room 301", "Room 405", "Room 502")
    }
}

class FakeStudentListRepository : StudentListRepository {
    private val first = listOf("Rahim", "Karim", "Nusrat", "Tanvir", "Sadia", "Fahim", "Mim", "Arif", "Tania", "Shakib")
    private val last = listOf("Hossain", "Islam", "Ahmed", "Rahman", "Akter")

    override suspend fun students(courseCode: String, section: String): List<Student> {
        delay(FAKE_DELAY)
        return (0 until 50).map { i ->
            Student("241-15-%03d".format(i + 1), "${first[i % 10]} ${last[i / 10]}")
        }
    }
}

class FakeAttendanceUploadRepository : AttendanceUploadRepository {
    @Volatile var shouldFail = false
    override suspend fun upload(data: AttendanceUpload): Result<Unit> {
        delay(FAKE_DELAY)
        return if (shouldFail) Result.failure(Exception("Simulated network failure")) else Result.success(Unit)
    }
}

object ServiceLocator {
    lateinit var auth: AuthRepository
    lateinit var courses: CourseRepository
    lateinit var students: StudentListRepository
    lateinit var upload: AttendanceUploadRepository

    fun init(context: Context) {
        if (BuildConfig.USE_FAKE_BACKEND) {
            auth = FakeAuthRepository(context.getSharedPreferences("auth", Context.MODE_PRIVATE))
            courses = FakeCourseRepository()
            students = FakeStudentListRepository()
            upload = FakeAttendanceUploadRepository()
        } else {
            error("Real backend is not added yet")
        }
    }
}
