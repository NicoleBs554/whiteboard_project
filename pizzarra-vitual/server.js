import express from "express";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { registrarPizarra } from "./src/sockets/pizarraSocket.js";
import { registrarWebRTC } from "./src/sockets/webrtcSocket.js";

function cargarIceServers() {
  const configuracion = process.env.RTC_ICE_SERVERS;
  if (!configuracion) return [];

  const iceServers = JSON.parse(configuracion);
  if (!Array.isArray(iceServers) || iceServers.some((servidor) => (
    !servidor
    || typeof servidor !== "object"
    || !(typeof servidor.urls === "string"
      || (Array.isArray(servidor.urls)
        && servidor.urls.length > 0
        && servidor.urls.every((url) => typeof url === "string" && url.length > 0)))
    || (servidor.username !== undefined && typeof servidor.username !== "string")
    || (servidor.credential !== undefined && typeof servidor.credential !== "string")
  ))) {
    throw new Error("RTC_ICE_SERVERS debe ser un arreglo JSON de servidores ICE válidos.");
  }

  return iceServers;
}

const iceServers = cargarIceServers();
const app = express();
const publicDirectory = fileURLToPath(new URL("./public/", import.meta.url));
app.get("/rtc-config", (_req, res) => {
  res.json({ iceServers });
});
app.use(express.static(publicDirectory));

const server = http.createServer(app);
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
