import {
  agregarTrazo,
  cargarHistorial,
  limpiarSala,
} from "../services/salaService.js";
import { validarTrazo, validarSala } from "../utils/validador.js";
import { log } from "../utils/logger.js";

function notificarUsuarios(nsp, idSala) {
  if (!idSala) return;
  const total = nsp.adapter.rooms.get(idSala)?.size || 0;
  nsp.to(idSala).emit("usuarios", total);
}

export function registrarPizarra(nsp) {
  nsp.on("connection", (socket) => {
    log.info(`Conectado: ${socket.id}`);

    socket.on("unirseSala", async (idSala) => {
      if (!validarSala(idSala)) {
        log.warning(`ID de sala invalido desde ${socket.id}`);
        return;
      }

      const salaAnterior = socket.data.sala;
      if (salaAnterior && salaAnterior !== idSala) {
        socket.leave(salaAnterior);
        notificarUsuarios(nsp, salaAnterior);
      }

      socket.join(idSala);
      socket.data.sala = idSala;

      const historial = await cargarHistorial(idSala);
      socket.emit("historial", historial);
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
      log.info(`Desconectado: ${socket.id}`);
      const sala = socket.data.sala;
      if (sala) {
        notificarUsuarios(nsp, sala);
      }
    });
  });
}
