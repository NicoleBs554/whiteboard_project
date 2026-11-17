import express from "express";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { ExpressPeerServer } from "peer";
import { registrarPizarra } from "./src/sockets/pizarraSocket.js";
import { registrarWebRTC } from "./src/sockets/webrtcSocket.js";

const app = express();
const server = http.createServer(app);

const peerServer = ExpressPeerServer(server, { path: "/" });
app.use("/peerjs", peerServer);

const publicDirectory = fileURLToPath(new URL("./public/", import.meta.url));
app.use(express.static(publicDirectory));

const io = new Server(server);
const pizarra = io.of("/pizarra");
registrarPizarra(pizarra);
registrarWebRTC(pizarra);

export function iniciarServidor(port = Number(process.env.PORT) || 3000) {
  return server.listen(port, () => {
    console.info(`Servidor en http://localhost:${port}`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  iniciarServidor();
}
