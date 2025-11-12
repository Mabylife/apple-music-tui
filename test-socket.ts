import { io } from "socket.io-client";

const socket = io("http://localhost:10767", {
  transports: ["websocket", "polling"],
  reconnection: true,
});

socket.on("connect", () => {
  console.log("✅ Socket.IO connected");
});

socket.on("disconnect", () => {
  console.log("❌ Socket.IO disconnected");
});

socket.on("API:Playback", (data) => {
  console.log("\n📡 Received API:Playback event:");
  console.log(JSON.stringify(data, null, 2));
});

console.log("🎵 Listening for Socket.IO events from Cider...");
console.log("Press Ctrl+C to exit");

// Keep process alive
setInterval(() => {}, 1000);
