import { socket } from "./socket.js";

let localStream;
const peerConnections = {};

const iceConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

window.startTeacher = async () => {
  socket.emit("join-as-teacher");

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  document.getElementById("teacherVideo").srcObject = localStream;
};

socket.on("student-joined", async ({ studentId }) => {
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

socket.on("answer", async ({ answer, studentId }) => {
  const pc = peerConnections[studentId];
  if (pc) {
    await pc.setRemoteDescription(answer);
  }
});

socket.on("ice-candidate", async ({ candidate }) => {
  // Teacher normally won't receive ICE from students in one-way setup
});
