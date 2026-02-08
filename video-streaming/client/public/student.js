import { socket } from "./socket.js";

let pc;

const iceConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const drawLine = (ctx, from, to, size, color) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
};

const setupStudentBoard = () => {
  const canvas = document.getElementById("studentBoard");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const resizeCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
  };

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  socket.on("whiteboard-draw", ({ from, to, size, color }) => {
    const rect = canvas.getBoundingClientRect();
    drawLine(
      ctx,
      { x: from.x * rect.width, y: from.y * rect.height },
      { x: to.x * rect.width, y: to.y * rect.height },
      size,
      color
    );
  });

  socket.on("whiteboard-clear", () => {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  });
};

window.startStudent = () => {
  console.log("Student joined");
  socket.emit("join-as-student");

  pc = new RTCPeerConnection(iceConfig);

  pc.ontrack = (event) => {
    const video = document.getElementById("studentVideo");
    video.srcObject = event.streams[0];
    video.play().catch(err => {
      console.log("Autoplay blocked:", err);
    });
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        candidate: event.candidate,
        target: null // teacher inferred
      });
    }
  };

  const startBtn = document.getElementById("startStudentBtn");
  const leaveBtn = document.getElementById("leaveStudentBtn");
  if (startBtn && leaveBtn) {
    startBtn.hidden = true;
    leaveBtn.hidden = false;
  }
};

window.leaveStudent = () => {
  if (pc) {
    pc.close();
  }
  socket.disconnect();
  const startBtn = document.getElementById("startStudentBtn");
  const leaveBtn = document.getElementById("leaveStudentBtn");
  if (startBtn && leaveBtn) {
    startBtn.hidden = false;
    leaveBtn.hidden = true;
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupStudentBoard();
  });
} else {
  setupStudentBoard();
}

socket.on("offer", async ({ offer }) => {
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("answer", { answer });
});

socket.on("ice-candidate", async ({ candidate }) => {
  if (candidate) {
    await pc.addIceCandidate(candidate);
  }
});
