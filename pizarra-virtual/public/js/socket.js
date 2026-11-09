export function crearConexionPizarra(callbacks, crearCliente = globalThis.io) {
  if (typeof crearCliente !== "function") {
    throw new Error("No se encontro el cliente de Socket.IO. Comprueba que el servidor cargue /socket.io/socket.io.js.");
  }

  const socket = crearCliente("/pizarra");
  const eventosPendientes = [];
  let salaActiva = null;

  function emitirSocket(evento, datos) {
    if (typeof datos === "undefined") {
      socket.emit(evento);
    } else {
      socket.emit(evento, datos);
    }
  }

  function enviarPendientes() {
    if (!socket.connected || !salaActiva) return;

    socket.emit("unirseSala", salaActiva);
    while (socket.connected && eventosPendientes.length > 0) {
      const { evento, datos } = eventosPendientes.shift();
      emitirSocket(evento, datos);
    }
  }

  function emitir(evento, datos, encolarSiDesconectado = true) {
    if (!salaActiva) return;
    if (!socket.connected) {
      if (encolarSiDesconectado) {
        eventosPendientes.push({ evento, datos });
      }
      return;
    }
    emitirSocket(evento, datos);
  }

  socket.on("connect", () => {
    callbacks.alCambiarEstado("conectado", "");
    enviarPendientes();
  });
  socket.on("connect_error", (error) => {
    callbacks.alCambiarEstado("error", error.message);
  });
  socket.on("disconnect", () => {
    callbacks.alCambiarEstado("desconectado", "");
  });
  socket.on("historial", (lista) => {
    if (!Array.isArray(lista)) {
      console.warn("El evento historial debe contener una lista de trazos.");
      return;
    }
    callbacks.alRecibirHistorial(lista);
  });
  socket.on("dibujar", callbacks.alRecibirTrazo);
  socket.on("limpiar", callbacks.alLimpiar);

  callbacks.alCambiarEstado(socket.connected ? "conectado" : "conectando", "");
  if (socket.connected) enviarPendientes();

  return {
    unirseSala(idSala) {
      salaActiva = idSala;
      if (socket.connected) socket.emit("unirseSala", idSala);
    },
    enviarTrazo(trazo) {
      if (!socket.connected) {
        callbacks.alCambiarEstado("desconectado", "El trazo no se envio; espera la reconexion para dibujar.");
        return;
      }
      emitir("dibujar", trazo, false);
    },
    pedirLimpiar() {
      emitir("limpiar");
    },
  };
}
