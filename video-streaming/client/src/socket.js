import { io } from "socket.io-client";

export const socket = io("http://localhost:5000", {
  reconnectionAttempts: 5,
  timeout: 10000,
});

socket.on("connect", () => {
  console.log("✅ Socket connected:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("❌ Socket connection error:", err);
  alert("Failed to connect to the signaling server. Is it running?");
});
