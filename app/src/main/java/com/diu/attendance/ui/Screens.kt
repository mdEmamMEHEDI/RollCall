package com.diu.attendance.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.diu.attendance.data.BleStatus

@Composable
fun AppRoot() {
    val vm: AppViewModel = viewModel()
    BackHandler(enabled = vm.screen != Screen.Role) {
        if (!vm.busy) vm.back()
    }
    when (vm.screen) {
        Screen.Role -> RoleScreen(vm)
        Screen.Login -> LoginScreen(vm)
        Screen.Select -> SelectScreen(vm)
        Screen.Attendance -> AttendanceScreen(vm)
        Screen.StudentProfile -> StudentProfileScreen(vm)
        Screen.StudentNearby -> StudentNearbyScreen(vm)
        Screen.StudentCodeEntry -> StudentCodeEntryScreen(vm)
        Screen.StudentSuccess -> StudentSuccessScreen(vm)
    }
}

@Composable
fun RoleScreen(vm: AppViewModel) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Attendance System", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(32.dp))
        Button(onClick = vm::chooseTeacher, modifier = Modifier.fillMaxWidth()) { Text("I am a Teacher") }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = vm::chooseStudent, modifier = Modifier.fillMaxWidth()) { Text("I am a Student") }
    }
}

@Composable
fun LoginScreen(vm: AppViewModel) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text("Teacher Login", style = MaterialTheme.typography.headlineSmall)
        Text("Demo: demo@diu.edu.bd / 1234", style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            password, { password = it }, label = { Text("Password") }, singleLine = true,
            visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth(),
        )
        vm.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(16.dp))
        Button(onClick = { vm.login(email, password) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth()) {
            Text(if (vm.busy) "Signing in..." else "Login")
        }
    }
}

@Composable
fun Picker(label: String, value: String, options: List<String>, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Column(Modifier.padding(vertical = 6.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Box {
            OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth()) {
                Text(value.ifEmpty { "Select" })
            }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                options.forEach { o ->
                    DropdownMenuItem(text = { Text(o) }, onClick = { onSelect(o); open = false })
                }
            }
        }
    }
}

@Composable
fun SelectScreen(vm: AppViewModel) {
    Column(Modifier.fillMaxSize().padding(24.dp)) {
        Text("Hello, ${vm.teacher?.name ?: ""}", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(16.dp))
        Picker("Course", vm.course?.label ?: "", vm.courses.map { it.label }) { l ->
            vm.courses.firstOrNull { it.label == l }?.let(vm::pickCourse)
        }
        Picker("Section", vm.section, vm.course?.sections ?: emptyList(), vm::pickSection)
        Picker("Room", vm.room, vm.rooms, vm::pickRoom)
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = vm::loadStudentList,
            enabled = !vm.busy && vm.course != null && vm.section.isNotEmpty() && vm.room.isNotEmpty(),
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (vm.busy) "Loading..." else "Load student list") }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = vm::logout) { Text("Logout") }
    }
}

@Composable
fun BleStatusBadge(status: BleStatus) {
    val (label, color) = when (status) {
        BleStatus.ACTIVE -> "🟢 BLE Active" to MaterialTheme.colorScheme.primary
        BleStatus.DISABLED -> "🟡 Bluetooth Disabled (Simulation Mode)" to MaterialTheme.colorScheme.secondary
        BleStatus.NO_PERMISSION -> "🔴 BLE Permission Missing (Simulation Mode)" to MaterialTheme.colorScheme.error
        BleStatus.UNSUPPORTED -> "⚪ BLE Unsupported (Simulation Mode)" to MaterialTheme.colorScheme.outline
    }
    Surface(
        color = color.copy(alpha = 0.12f),
        shape = MaterialTheme.shapes.small,
        modifier = Modifier.padding(vertical = 4.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}

@Composable
fun AttendanceScreen(vm: AppViewModel) {
    val presentCount = vm.present.values.count { it }
    val wifiPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.values.all { it }) vm.startSession()
        else vm.onHostPermissionDenied()
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("${vm.course?.code} | Section ${vm.section} | ${vm.room}", style = MaterialTheme.typography.titleMedium)
            BleStatusBadge(vm.bleStatus)
        }
        Text("Teacher roster: $presentCount / ${vm.students.size} marked present")
        val session = vm.attendanceSession
        val sessionActive = session?.state == com.diu.attendance.data.AttendanceSessionState.ACTIVE
        session?.let {
            Card(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Column(Modifier.padding(16.dp).fillMaxWidth()) {
                    Text("Classroom session", style = MaterialTheme.typography.titleMedium)
                    Text("${it.courseCode} - ${it.courseName}")
                    Text("Section ${it.section} | ${it.room}")
                    Text("Teacher: ${it.teacherName}")
                    Text("Session status: ${it.state}")
                    Text("Attendance recorded: ${vm.liveAttendanceCount} / ${vm.students.size}")
                    if (sessionActive) {
                        Spacer(Modifier.height(8.dp))
                        Text("Session code", style = MaterialTheme.typography.labelMedium)
                        Text(vm.sessionCredential.orEmpty(), fontSize = 26.sp, fontWeight = FontWeight.Bold)
                        Text("This 6-digit RollCall code is not the Wi-Fi password.", style = MaterialTheme.typography.bodySmall)
                        Spacer(Modifier.height(8.dp))
                        vm.localHostDetails?.let { host ->
                            Text("Network: ${host.networkMode}")
                            host.ssid?.let { ssid -> Text("Wi-Fi name: $ssid") }
                            host.passphrase?.let { password -> Text("Local-only Wi-Fi password: $password") }
                            Text("Encrypted HTTPS service port: ${host.port}")
                            Text("Service discovery: ${vm.hostDiscoveryStatus}")
                            if (host.ssid != null) {
                                Text(
                                    "Students must join this RollCall Wi-Fi network in Android Wi-Fi settings. " +
                                        "The local-only network has no internet access.",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            } else {
                                Text("Students must be connected to the same Wi-Fi network.", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        Text("Bluetooth discovery is optional and carries class metadata only.", style = MaterialTheme.typography.bodySmall)
                        Text(
                            "Expires at ${java.text.DateFormat.getTimeInstance().format(java.util.Date(it.expiresAtMillis))}",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    } else {
                        Text("The session code has been invalidated.", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (!sessionActive) {
                Button(
                    onClick = {
                        if (vm.prerequisitesReady()) {
                            val permission = if (Build.VERSION.SDK_INT >= 33) {
                                Manifest.permission.NEARBY_WIFI_DEVICES
                            } else {
                                Manifest.permission.ACCESS_FINE_LOCATION
                            }
                            wifiPermissionLauncher.launch(arrayOf(permission))
                        }
                    },
                    enabled = !vm.busy,
                ) { Text(if (vm.busy) "Starting..." else "Start Attendance") }
                if (vm.canUseCurrentWifi) {
                    OutlinedButton(
                        onClick = { if (vm.prerequisitesReady()) vm.startSession(useCurrentWifi = true) },
                        enabled = !vm.busy,
                    ) { Text("Use current Wi-Fi") }
                }
            } else {
                OutlinedButton(onClick = vm::stopSession, enabled = !vm.busy) { Text("Stop Attendance") }
            }
            Button(onClick = vm::save, enabled = !vm.busy) { Text("Save to portal") }
        }
        if (vm.busy) LinearProgressIndicator(Modifier.fillMaxWidth().padding(vertical = 4.dp))
        vm.message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (!sessionActive && !vm.busy) {
            Text(
                "Starting a class requests Android's local-only Wi-Fi hotspot. If Android cannot provide one, " +
                    "connect to an existing Wi-Fi network and use the fallback.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(checked = vm.simulateFailure, onCheckedChange = vm::setSimulateFailure)
            Spacer(Modifier.width(8.dp))
            Text("Simulate upload failure (demo)", style = MaterialTheme.typography.bodySmall)
        }
        LazyColumn(Modifier.weight(1f)) {
            items(vm.students, key = { it.id }) { s ->
                Row(
                    Modifier.fillMaxWidth().clickable { vm.toggle(s.id) }.padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(checked = vm.present[s.id] == true, onCheckedChange = { vm.toggle(s.id) })
                    Column {
                        Text(s.name)
                        Text(s.id, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
fun StudentProfileScreen(vm: AppViewModel) {
    var id by remember(vm.studentProfile) { mutableStateOf(vm.studentProfile?.id ?: "") }
    var name by remember(vm.studentProfile) { mutableStateOf(vm.studentProfile?.name ?: "") }

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Student Profile Setup", style = MaterialTheme.typography.headlineSmall)
        Text("Enter your Student ID and Name to continue", style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(
            value = id,
            onValueChange = { id = it },
            label = { Text("Student ID (e.g., 241-15-001)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Full Name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        vm.studentError?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { vm.saveStudentProfile(id, name) },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Save & Continue")
        }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = vm::back, modifier = Modifier.fillMaxWidth()) {
            Text("Back")
        }
    }
}

@Composable
fun StudentNearbyScreen(vm: AppViewModel) {
    val requestPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) {
        vm.openStudentNearby()
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("Hello, ${vm.studentProfile?.name ?: "Student"}", style = MaterialTheme.typography.titleLarge)
                Text("ID: ${vm.studentProfile?.id ?: ""}", style = MaterialTheme.typography.bodySmall)
            }
            TextButton(onClick = vm::openStudentProfileEdit) { Text("Edit Profile") }
        }
        Spacer(Modifier.height(8.dp))
        BleStatusBadge(vm.bleStatus)
        Spacer(Modifier.height(12.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Nearby Active Classes", style = MaterialTheme.typography.titleMedium)
            IconButton(onClick = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    requestPermissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.BLUETOOTH_SCAN,
                            Manifest.permission.BLUETOOTH_CONNECT
                        )
                    )
                } else {
                    vm.openStudentNearby()
                }
            }) {
                Text("🔄", fontSize = 16.sp)
            }
        }
        Text("Join a class and submit the session credential. Attendance is confirmed by the teacher session.", style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(12.dp))

        if (vm.busy) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (vm.nearbySessions.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No active class sessions found nearby.")
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(vm.nearbySessions) { s ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { vm.selectNearbySession(s) },
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(s.courseCode, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                AssistChip(onClick = { vm.selectNearbySession(s) }, label = { Text("Join") })
                            }
                            Text(s.courseName, style = MaterialTheme.typography.bodyMedium)
                            Spacer(Modifier.height(4.dp))
                            Text("Section ${s.section} | ${s.room} | Teacher: ${s.teacherName}", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun StudentCodeEntryScreen(vm: AppViewModel) {
    var credential by remember { mutableStateOf("") }
    val session = vm.selectedSession

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Join Class Session", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        session?.let { s ->
            Text("${s.courseCode} - ${s.courseName}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text("Section ${s.section} | ${s.room} | Teacher: ${s.teacherName}", style = MaterialTheme.typography.bodySmall)
        }
        Spacer(Modifier.height(24.dp))
        Text("Enter the session credential shared by the teacher:", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = credential,
            onValueChange = { if (it.length <= 64) credential = it },
            label = { Text("Session credential") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        vm.studentError?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = { vm.submitAttendanceCredential(credential) },
            enabled = credential.isNotBlank() && !vm.busy,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (vm.busy) "Waiting for teacher..." else "Request Attendance")
        }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = vm::back, modifier = Modifier.fillMaxWidth()) {
            Text("Cancel")
        }
    }
}

@Composable
fun StudentSuccessScreen(vm: AppViewModel) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("🎉 Success!", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(16.dp))
        Text(
            vm.studentSuccessMessage ?: "Attendance marked successfully!",
            style = MaterialTheme.typography.bodyLarge,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Student: ${vm.studentProfile?.name} (${vm.studentProfile?.id})",
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(32.dp))
        Button(
            onClick = vm::openStudentNearby,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Back to Classes")
        }
    }
}
