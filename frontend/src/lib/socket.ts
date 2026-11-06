import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  const token = localStorage.getItem("ll360_token");
  if (!token) return null;
  if (!socket) {
    socket = io("/", { auth: { token }, transports: ["websocket", "polling"] });
  }
  return socket;
}

export function resetSocket() {
  socket?.disconnect();
  socket = null;
}
