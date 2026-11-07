import { agregarTrazo, obtenerHistorial, limpiarSala } from "../services/salaService.js";
import { validarTrazo, validarSala } from "../utils/validador.js";
import { log } from "../utils/logger.js";

export function registrarPizarra(nsp) {
  nsp.on("connection", (socket) => {
    log.info(`Conectado: ${socket.id}`);

    socket.on("unirseSala", (idSala) => {
      if (!validarSala(idSala)) {
        log.warning(`ID de sala invalido desde ${socket.id}`);
        return;
      }

      const salaAnterior = socket.data.sala;
      if (salaAnterior && salaAnterior !== idSala) socket.leave(salaAnterior);

      socket.join(idSala);
      socket.data.sala = idSala;
      socket.emit("historial", obtenerHistorial(idSala));
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
    });
  });
}
