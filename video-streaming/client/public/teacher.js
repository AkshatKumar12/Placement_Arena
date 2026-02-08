import { socket } from "./socket.js";

let localStream;
const peerConnections = {};

const iceConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const boardState = {
  penSize: 3,
  color: "#0f766e"
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

const setupTeacherBoard = () => {
  const canvas = document.getElementById("teacherBoard");
  const clearButton = document.getElementById("teacherClearBoard");
  const sizeInput = document.getElementById("teacherPenSize");
  if (!canvas || !clearButton || !sizeInput) {
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

  sizeInput.addEventListener("input", (event) => {
    boardState.penSize = Number(event.target.value);
  });

  clearButton.addEventListener("click", () => {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    socket.emit("whiteboard-clear");
  });

  let drawing = false;
  let lastPoint = null;

  const getPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      nx: (event.clientX - rect.left) / rect.width,
      ny: (event.clientY - rect.top) / rect.height
    };
  };

  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    const point = getPoint(event);
    lastPoint = point;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing || !lastPoint) {
      return;
    }
    const point = getPoint(event);
    drawLine(ctx, lastPoint, point, boardState.penSize, boardState.color);
    socket.emit("whiteboard-draw", {
      from: { x: lastPoint.nx, y: lastPoint.ny },
      to: { x: point.nx, y: point.ny },
      size: boardState.penSize,
      color: boardState.color
    });
    lastPoint = point;
  });

  const stopDrawing = () => {
    drawing = false;
    lastPoint = null;
  };

  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointerleave", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);
};

window.startTeacher = async () => {
  console.log("Teacher started");
  socket.emit("join-as-teacher");

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    document.getElementById("teacherVideo").srcObject = localStream;
    const startBtn = document.getElementById("startTeacherBtn");
    const leaveBtn = document.getElementById("leaveTeacherBtn");
    if (startBtn && leaveBtn) {
      startBtn.hidden = true;
      leaveBtn.hidden = false;
    }
  } catch (error) {
    console.error("Error accessing media devices:", error);
    alert("Could not access camera/microphone. Please ensure permissions are granted.");
  }
};

window.leaveTeacher = () => {
  Object.values(peerConnections).forEach((pc) => pc.close());
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  socket.disconnect();
  const startBtn = document.getElementById("startTeacherBtn");
  const leaveBtn = document.getElementById("leaveTeacherBtn");
  if (startBtn && leaveBtn) {
    startBtn.hidden = false;
    leaveBtn.hidden = true;
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupTeacherBoard();
  });
} else {
  setupTeacherBoard();
}

socket.on("student-joined", async ({ studentId }) => {
  const notice = document.getElementById("teacherNotice");
  if (notice) {
    notice.textContent = `Student joined: ${studentId}`;
  }
  const pc = new RTCPeerConnection(iceConfig);
  peerConnections[studentId] = pc;

  localStream.getTracks().forEach(track =>
    pc.addTrack(track, localStream)
  );

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        candidate: event.candidate,
        target: studentId
      });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("offer", { offer, studentId });
});

socket.on("student-left", ({ studentId }) => {
  const notice = document.getElementById("teacherNotice");
  if (notice) {
    notice.textContent = `Student left: ${studentId}`;
  }
  const pc = peerConnections[studentId];
  if (pc) {
    pc.close();
    delete peerConnections[studentId];
  }
});

socket.on("answer", async ({ answer, studentId }) => {
  const pc = peerConnections[studentId];
  if (pc) {
    await pc.setRemoteDescription(answer);
  }
});

socket.on("ice-candidate", async ({ candidate, from }) => {
  const pc = peerConnections[from];
  if (pc && candidate) {
    await pc.addIceCandidate(candidate);
  }
});
