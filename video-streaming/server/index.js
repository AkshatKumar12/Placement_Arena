import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
console.log("Starting signaling server...");

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

let teacherSocketId = null;
const studentSocketIds = new Set();

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join-as-teacher", () => {
    teacherSocketId = socket.id;
    console.log("Teacher joined:", socket.id);
  });

  socket.on("join-as-student", () => {
    studentSocketIds.add(socket.id);
    if (teacherSocketId) {
      io.to(teacherSocketId).emit("student-joined", {
        studentId: socket.id
      });
    }
  });

  socket.on("offer", ({ offer, studentId }) => {
    io.to(studentId).emit("offer", { offer });
  });

  socket.on("answer", ({ answer }) => {
    io.to(teacherSocketId).emit("answer", {
      answer,
      studentId: socket.id
    });
  });

  socket.on("ice-candidate", ({ candidate, target }) => {
    const resolvedTarget = target ?? teacherSocketId;
    if (resolvedTarget) {
      io.to(resolvedTarget).emit("ice-candidate", {
        candidate,
        from: socket.id
      });
    }
  });

  socket.on("whiteboard-draw", (payload) => {
    if (socket.id !== teacherSocketId) {
      return;
    }
    studentSocketIds.forEach((studentId) => {
      io.to(studentId).emit("whiteboard-draw", payload);
    });
  });

  socket.on("whiteboard-clear", () => {
    if (socket.id !== teacherSocketId) {
      return;
    }
    studentSocketIds.forEach((studentId) => {
      io.to(studentId).emit("whiteboard-clear");
    });
  });

  socket.on("student-code", ({ code }) => {
    if (!teacherSocketId) {
      return;
    }
    io.to(teacherSocketId).emit("student-code", {
      code,
      studentId: socket.id,
      submittedAt: Date.now()
    });
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    if (socket.id === teacherSocketId) {
      teacherSocketId = null;
    }
    studentSocketIds.delete(socket.id);
  });
});

httpServer.listen(5000, () => {
  console.log("Signaling server running on http://localhost:5000");
});

