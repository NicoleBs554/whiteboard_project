import express from "express";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { registrarPizarra } from "./src/sockets/pizarraSocket.js";

const app = express();
const publicDirectory = fileURLToPath(new URL("./public/", import.meta.url));
app.use(express.static(publicDirectory));

const server = http.createServer(app);
const io = new Server(server);
registrarPizarra(io.of("/pizarra"));

export function iniciarServidor(port = Number(process.env.PORT) || 3000) {
  return server.listen(port, () => {
    console.info(`Servidor en http://localhost:${port}`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  iniciarServidor();
}
