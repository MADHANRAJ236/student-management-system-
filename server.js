const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/studentDB";
const DATABASE_RETRY_DELAY = 5000;

function startServer(port) {
    const server = app.listen(port, () => {
        process.env.PORT = String(port);
        console.log(`Student Management System: http://localhost:${port}`);
    });

    server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
            console.warn(`Port ${port} is busy. Trying ${port + 1}...`);
            return startServer(port + 1);
        }

        console.error("Server failed to start:", error.message);
        process.exit(1);
    });
}

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 120,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        unique: true,
        sparse: true
    },
    phone: { type: String, trim: true, match: /^\d{10}$/, sparse: true },
    rollNo: { type: String, trim: true, maxlength: 30 },
    course: { type: String, required: true, trim: true, maxlength: 80 },
    year: { type: Number, min: 1, max: 4, validate: Number.isInteger },
    age: { type: Number, min: 0, max: 120, validate: Number.isInteger },
    marks: { type: Number, required: true, min: 0, max: 100 },
    attendance: { type: Number, required: true, min: 0, max: 100 }
}, { timestamps: true });

const Student = mongoose.model("Student", studentSchema);

app.use(express.json({ limit: "100kb" }));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: "Student database is unavailable. Please try again shortly." });
    }

    next();
});

function normalizeStudentPayload(payload = {}) {
    const student = { ...payload };
    const name = typeof student.name === "string" ? student.name.trim() : "";
    const safeCourse = typeof student.course === "string" ? student.course.trim() : "";

    if (!student.name && name) {
        student.name = name;
    }

    if (!student.course && safeCourse) {
        student.course = safeCourse;
    }

    if (!student.course) {
        student.course = "General";
    }

    if (student.year === undefined) {
        student.year = 1;
    }

    if (student.age === undefined) {
        student.age = Number(student.year) > 0 ? 18 : 0;
    }

    if (student.marks === undefined) {
        student.marks = 0;
    }

    if (student.attendance === undefined) {
        student.attendance = 0;
    }

    if (!student.email && name) {
        student.email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "student"}@example.com`;
    }

    if (!student.phone) {
        student.phone = "0000000000";
    }

    if (!student.rollNo && payload.rollNo === undefined && name) {
        student.rollNo = `ST-${String(Date.now()).slice(-6)}`;
    }

    return student;
}

function serializeStudent(student) {
    return {
        id: String(student._id),
        name: student.name,
        email: student.email || "",
        phone: student.phone || "",
        rollNo: student.rollNo || "",
        course: student.course,
        year: student.year ?? 1,
        age: student.age ?? 0,
        marks: student.marks,
        attendance: student.attendance
    };
}

function handleDatabaseError(error, res, fallbackMessage) {
    if (error.code === 11000) {
        return res.status(409).json({ message: "This email is already registered." });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({ message: "Please enter valid student details." });
    }

    console.error(error);
    return res.status(500).json({ message: fallbackMessage });
}

app.get("/api/students", async (req, res) => {
    try {
        const students = await Student.find().sort({ createdAt: -1 });
        res.json(students.map(serializeStudent));
    } catch (error) {
        handleDatabaseError(error, res, "Could not load student records.");
    }
});

app.post("/api/students", async (req, res) => {
    try {
        const student = await Student.create(normalizeStudentPayload(req.body));
        res.status(201).json({
            message: "Student registered successfully.",
            student: serializeStudent(student)
        });
    } catch (error) {
        handleDatabaseError(error, res, "Could not save student.");
    }
});

app.put("/api/students/:id", async (req, res) => {
    try {
        const student = await Student.findByIdAndUpdate(req.params.id, normalizeStudentPayload(req.body), {
            new: true,
            runValidators: true
        });

        if (!student) {
            return res.status(404).json({ message: "Student not found." });
        }

        res.json({
            message: "Student updated successfully.",
            student: serializeStudent(student)
        });
    } catch (error) {
        handleDatabaseError(error, res, "Could not update student.");
    }
});

app.delete("/api/students/:id", async (req, res) => {
    try {
        const student = await Student.findByIdAndDelete(req.params.id);
        if (!student) {
            return res.status(404).json({ message: "Student not found." });
        }

        res.json({ message: "Student deleted successfully." });
    } catch (error) {
        handleDatabaseError(error, res, "Could not delete student.");
    }
});

async function connectToDatabase() {
    while (mongoose.connection.readyState !== 1) {
        try {
            await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
            console.log("MongoDB Connected");
        } catch (error) {
            console.error("MongoDB connection failed:", error.message);
            await new Promise(resolve => setTimeout(resolve, DATABASE_RETRY_DELAY));
        }
    }
}

startServer(DEFAULT_PORT);

connectToDatabase();