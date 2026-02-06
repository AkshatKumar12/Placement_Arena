import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

export const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("✅ Socket connected:", socket.id);
});
