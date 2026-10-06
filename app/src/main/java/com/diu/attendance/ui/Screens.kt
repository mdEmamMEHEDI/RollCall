package com.diu.attendance.ui

import androidx.activity.compose.BackHandler
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

@Composable
fun AppRoot() {
    val vm: AppViewModel = viewModel()
    BackHandler(enabled = vm.screen != Screen.Role) { vm.back() }
    when (vm.screen) {
        Screen.Role -> RoleScreen(vm)
        Screen.Login -> LoginScreen(vm)
        Screen.Select -> SelectScreen(vm)
        Screen.Attendance -> AttendanceScreen(vm)
        Screen.Student -> StudentPlaceholder(vm)
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
fun AttendanceScreen(vm: AppViewModel) {
    val presentCount = vm.present.values.count { it }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("${vm.course?.code} | Section ${vm.section} | ${vm.room}", style = MaterialTheme.typography.titleMedium)
        Text("Present: $presentCount / ${vm.students.size}")
        vm.sessionCode?.let { code ->
            Card(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Column(Modifier.padding(16.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Write this code on the board")
                    Text(code, fontSize = 56.sp, fontWeight = FontWeight.Bold)
                    Text("Hotspot and BLE start here in the next step", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (vm.sessionCode == null) Button(onClick = vm::startSession) { Text("Start Attendance") }
            else OutlinedButton(onClick = vm::stopSession) { Text("Stop") }
            Button(onClick = vm::save, enabled = !vm.busy) { Text("Save to portal") }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(checked = vm.simulateFailure, onCheckedChange = vm::setSimulateFailure)
            Spacer(Modifier.width(8.dp))
            Text("Simulate upload failure (demo)", style = MaterialTheme.typography.bodySmall)
        }
        vm.message?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
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
fun StudentPlaceholder(vm: AppViewModel) {
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text("Student app", style = MaterialTheme.typography.headlineSmall)
        Text("Nearby class list and Join Class come in the next steps.")
        Spacer(Modifier.height(16.dp))
        TextButton(onClick = vm::back) { Text("Back") }
    }
}
