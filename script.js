if (localStorage.getItem("eduManageLoggedIn") !== "true") {
    window.location.href = "login.html";
}

const form = document.getElementById("studentForm");
const studentIdInput = document.getElementById("studentId");
const studentTable = document.getElementById("studentTable");
const message = document.getElementById("message");
const searchInput = document.getElementById("searchInput");
const courseFilter = document.getElementById("courseFilter");
const yearFilter = document.getElementById("yearFilter");
const logoutButton = document.getElementById("logoutButton");
let students = [];
let selectedStudentId = "";

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers }
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "The request could not be completed.");
    }

    return result;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function displayId(id) {
    return `STU-${id.slice(-6).toUpperCase()}`;
}

function updateDashboard() {
    const total = students.length;
    const average = field => total
        ? (students.reduce((sum, student) => sum + student[field], 0) / total).toFixed(1)
        : "0";

    document.getElementById("totalStudents").textContent = total;
    document.getElementById("averageMarks").textContent = `${average("marks")}%`;
    document.getElementById("averageAttendance").textContent = `${average("attendance")}%`;
    document.getElementById("totalCourses").textContent = new Set(students.map(student => student.course)).size;
}

function getInitials(name) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join("") || "NA";
}

function getCourseColor(course) {
    const palette = {
        BCA: "#4f46e5",
        "B.Sc Computer Science": "#0f766e",
        "B.Com": "#ea580c",
        BBA: "#db2777",
        "B.E Computer Science": "#2563eb",
        Other: "#7c3aed"
    };

    return palette[course] || "#4f46e5";
}

function renderStudentProfile(student) {
    const name = student ? student.name : "No student selected";
    const course = student ? student.course : "-";
    const accentColor = getCourseColor(course === "-" ? "Other" : course);

    document.getElementById("profileName").textContent = name;
    document.getElementById("profileCourse").textContent = course;
    document.getElementById("profileEmail").textContent = student ? student.email : "-";
    document.getElementById("profilePhone").textContent = student ? student.phone : "-";
    document.getElementById("profileYear").textContent = student ? `Year ${student.year}` : "-";
    document.getElementById("profileMarks").textContent = student ? `${student.marks}%` : "-";
    document.getElementById("profileAttendance").textContent = student ? `${student.attendance}%` : "-";
    document.getElementById("profileBadge").textContent = student ? "Profile" : "Awaiting selection";
    const initials = document.getElementById("profileInitials");
    const photo = document.getElementById("profilePhoto");
    const photoData = student ? localStorage.getItem(`eduManagePhoto-${student.id}`) : null;
    initials.textContent = student ? getInitials(student.name) : "NA";
    initials.hidden = Boolean(photoData);
    photo.hidden = !photoData;
    photo.src = photoData || "";
    document.getElementById("profileCard").style.setProperty("--profile-accent", accentColor);
    document.getElementById("profileAvatar").style.background = `linear-gradient(135deg, ${accentColor}, #1e293b)`;
    document.getElementById("profileBadge").style.background = `${accentColor}22`;
    document.getElementById("profileBadge").style.color = accentColor;
}

document.getElementById("profilePhotoInput").addEventListener("change", event => {
    const file = event.target.files[0];
    const student = students.find(item => item.id === selectedStudentId);
    event.target.value = "";
    if (!file) return;
    if (!student) {
        message.textContent = "Select a student before uploading a photo.";
        return;
    }
    if (!file.type.startsWith("image/")) {
        message.textContent = "Choose an image file.";
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        message.textContent = "Choose an image smaller than 5 MB.";
        return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
        const image = new Image();
        image.addEventListener("load", () => {
            const canvas = document.createElement("canvas");
            canvas.width = 256;
            canvas.height = 256;
            const context = canvas.getContext("2d");
            const cropSize = Math.min(image.width, image.height);
            context.drawImage(image, (image.width - cropSize) / 2, (image.height - cropSize) / 2, cropSize, cropSize, 0, 0, 256, 256);
            try {
                localStorage.setItem(`eduManagePhoto-${student.id}`, canvas.toDataURL("image/jpeg", 0.8));
                renderStudentProfile(student);
                message.textContent = "Student photo updated.";
            } catch (error) {
                message.textContent = "Could not save the photo in this browser.";
            }
        });
        image.addEventListener("error", () => {
            message.textContent = "Could not read that image. Try another file.";
        });
        image.src = reader.result;
    });
    reader.addEventListener("error", () => {
        message.textContent = "Could not read that image file.";
    });
    reader.readAsDataURL(file);
});

function updateCourseFilter() {
    const selectedCourse = courseFilter.value;
    const courses = [...new Set(students.map(student => student.course))].sort();
    courseFilter.innerHTML = '<option value="">All Courses</option>' + courses
        .map(course => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`)
        .join("");
    courseFilter.value = courses.includes(selectedCourse) ? selectedCourse : "";
}

function renderStudents() {
    const search = searchInput.value.trim().toLowerCase();
    const filtered = students.filter(student => {
        const matchesSearch = [student.name, student.email, displayId(student.id)]
            .some(value => value.toLowerCase().includes(search));
        return matchesSearch &&
            (!courseFilter.value || student.course === courseFilter.value) &&
            (!yearFilter.value || student.year === Number(yearFilter.value));
    });

    if (!filtered.length) {
        studentTable.innerHTML = '<tr><td colspan="7">No student records found.</td></tr>';
        if (selectedStudentId) {
            const profileStudent = students.find(student => student.id === selectedStudentId);
            renderStudentProfile(profileStudent || null);
        }
    } else {
        studentTable.innerHTML = filtered.map(student => `
            <tr data-id="${student.id}" class="${selectedStudentId === student.id ? "selected-row" : ""}">
                <td>${displayId(student.id)}</td>
                <td><div class="student-name">${escapeHtml(student.name)}</div>
                    <div class="student-email">${escapeHtml(student.email)}</div></td>
                <td>${escapeHtml(student.course)}</td>
                <td>${student.year}</td>
                <td>${student.marks}%</td>
                <td>${student.attendance}%</td>
                <td>
                    <button class="btn-view" data-action="view" data-id="${student.id}">View</button>
                    <button class="btn-edit" data-action="edit" data-id="${student.id}">Edit</button>
                    <button class="btn-delete" data-action="delete" data-id="${student.id}">Delete</button>
                </td>
            </tr>`).join("");

        if (!selectedStudentId) {
            const firstStudent = filtered[0];
            selectedStudentId = firstStudent.id;
        }

        const currentStudent = students.find(student => student.id === selectedStudentId) || filtered[0];
        if (currentStudent) {
            selectedStudentId = currentStudent.id;
        }
        renderStudentProfile(currentStudent || null);
    }

    document.getElementById("recordCount").textContent =
        `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;
}

async function loadStudents() {
    studentTable.innerHTML = '<tr><td colspan="7">Loading student records...</td></tr>';
    try {
        students = await apiRequest("/api/students");
        updateDashboard();
        updateCourseFilter();
        renderStudents();
    } catch (error) {
        studentTable.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
        message.textContent = `Could not connect to the student database: ${error.message}`;
    }
}

function resetForm() {
    form.reset();
    studentIdInput.value = "";
    document.getElementById("formTitle").textContent = "Register New Student";
    document.getElementById("saveButton").textContent = "Save Student";
    document.getElementById("cancelButton").hidden = true;
}

form.addEventListener("submit", async event => {
    event.preventDefault();
    const student = Object.fromEntries(
        ["name", "email", "phone", "course", "year", "marks", "attendance"]
            .map(id => [id, document.getElementById(id).value.trim()])
    );
    student.year = Number(student.year);
    student.marks = Number(student.marks);
    student.attendance = Number(student.attendance);

    const id = studentIdInput.value;
    try {
        const result = await apiRequest(id ? `/api/students/${id}` : "/api/students", {
            method: id ? "PUT" : "POST",
            body: JSON.stringify(student)
        });
        message.textContent = result.message;
        resetForm();
        await loadStudents();
    } catch (error) {
        message.textContent = error.message;
    }
});

studentTable.addEventListener("click", async event => {
    const row = event.target.closest("tr[data-id]");
    const button = event.target.closest("button[data-action]");

    if (row && !button) {
        const student = students.find(item => item.id === row.dataset.id);
        if (student) {
            selectedStudentId = student.id;
            renderStudentProfile(student);
            row.classList.add("selected-row");
        }
        return;
    }

    if (!button) return;

    const student = students.find(item => item.id === button.dataset.id);
    if (!student) return;

    if (button.dataset.action === "view") {
        selectedStudentId = student.id;
        renderStudentProfile(student);
        return;
    }

    if (button.dataset.action === "edit") {
        studentIdInput.value = student.id;
        for (const field of ["name", "email", "phone", "course", "year", "marks", "attendance"]) {
            document.getElementById(field).value = student[field];
        }
        document.getElementById("formTitle").textContent = "Edit Student";
        document.getElementById("saveButton").textContent = "Update Student";
        document.getElementById("cancelButton").hidden = false;
        document.getElementById("student-form").scrollIntoView({ behavior: "smooth" });
        return;
    }

    if (!window.confirm(`Delete ${student.name}'s record?`)) return;
    try {
        const result = await apiRequest(`/api/students/${student.id}`, { method: "DELETE" });
        message.textContent = result.message;
        await loadStudents();
    } catch (error) {
        message.textContent = error.message;
    }
});

function exportCsv() {
    const headers = ["Student ID", "Name", "Email", "Phone", "Course", "Year", "Marks", "Attendance"];
    const rows = students.map(student => [
        displayId(student.id), student.name, student.email, student.phone,
        student.course, student.year, student.marks, student.attendance
    ]);
    const csv = [headers, ...rows].map(row => row.map(value =>
        `"${String(value).replace(/"/g, '""')}"`
    ).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "students.csv";
    link.click();
    URL.revokeObjectURL(link.href);
}

searchInput.addEventListener("input", renderStudents);
courseFilter.addEventListener("change", renderStudents);
yearFilter.addEventListener("change", renderStudents);
document.getElementById("refreshButton").addEventListener("click", loadStudents);
document.getElementById("cancelButton").addEventListener("click", resetForm);
document.getElementById("exportButton").addEventListener("click", exportCsv);
logoutButton.addEventListener("click", () => {
    localStorage.removeItem("eduManageLoggedIn");
    localStorage.removeItem("eduManageUser");
    window.location.href = "login.html";
});

loadStudents();
