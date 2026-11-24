import { agregarTrazo, obtenerHistorial, limpiarSala } from "../services/salaService.js";
import { validarTrazo, validarSala } from "../utils/validador.js";
import { log } from "../utils/logger.js";

const MAX_PARTICIPANTES = 3;

function notificarUsuarios(nsp, idSala) {
  const total = nsp.adapter.rooms.get(idSala)?.size ?? 0;
  nsp.to(idSala).emit("usuarios", total);
}

export function registrarPizarra(nsp) {
  nsp.on("connection", (socket) => {
    log.info(`Conectado: ${socket.id}`);

    socket.on("unirseSala", (idSala) => {
      if (!validarSala(idSala)) {
        log.warning(`ID de sala invalido desde ${socket.id}`);
        return;
      }

      const salaAnterior = socket.data.sala;
      const yaEstabaEnSala = salaAnterior === idSala;
      const participantes = nsp.adapter.rooms.get(idSala);
      if (!yaEstabaEnSala && participantes?.size >= MAX_PARTICIPANTES) {
        socket.emit("sala-error", "La sala ya tiene el máximo de 3 participantes.");
        return;
      }

      if (salaAnterior && salaAnterior !== idSala) {
        socket.to(salaAnterior).emit("peer-disconnected", socket.id);
        socket.leave(salaAnterior);
        notificarUsuarios(nsp, salaAnterior);
      }

      socket.join(idSala);
      socket.data.sala = idSala;
      socket.data.webrtcReady = false;
      socket.emit("historial", obtenerHistorial(idSala));
      if (!yaEstabaEnSala) socket.to(idSala).emit("peer-joined", socket.id);
      notificarUsuarios(nsp, idSala);
    });

    socket.on("dibujar", (trazo) => {
      const sala = socket.data.sala;
      if (!sala) return;
      if (!validarTrazo(trazo)) {
        log.warning(`Trazo invalido desde ${socket.id}`);
        return;
      }

      agregarTrazo(sala, trazo);
      socket.to(sala).emit("dibujar", trazo);
    });

    socket.on("limpiar", () => {
      const sala = socket.data.sala;
      if (!sala) return;

      limpiarSala(sala);
      nsp.to(sala).emit("limpiar");
    });

    socket.on("disconnect", () => {
      const sala = socket.data.sala;
      if (sala) {
        socket.to(sala).emit("peer-disconnected", socket.id);
        notificarUsuarios(nsp, sala);
      }
      log.info(`Desconectado: ${socket.id}`);
    });
  });
}
