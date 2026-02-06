import { socket } from "./socket.js";


let pc;

const iceConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

window.startStudent = () => {
  console.log("🎒 Student joined");
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
};

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
