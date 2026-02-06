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

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join-as-teacher", () => {
    teacherSocketId = socket.id;
    console.log("Teacher joined:", socket.id);
  });

  socket.on("join-as-student", () => {
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

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    if (socket.id === teacherSocketId) {
      teacherSocketId = null;
    }
  });
});

httpServer.listen(5000, () => {
  console.log("Signaling server running on http://localhost:5000");
});

