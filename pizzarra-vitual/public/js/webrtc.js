const STUN_POR_DEFECTO = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function cargarPeerJS(entorno) {
  if (typeof entorno.Peer === "function") return Promise.resolve();
  const doc = entorno.document ?? globalThis.document;
  if (!doc) {
    return Promise.reject(new Error("No se encontró PeerJS en este entorno."));
  }
  return new Promise((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar la librería PeerJS."));
    doc.head.appendChild(script);
  });
}

async function solicitarMediosDisponibles(mediaDevices) {
  const opciones = [
    { video: true, audio: true },
    { video: true, audio: false },
    { video: false, audio: true },
  ];
  let ultimoError;

  for (const restriccion of opciones) {
    try {
      return await mediaDevices.getUserMedia(restriccion);
    } catch (error) {
      ultimoError = error;
      if (error?.name !== "NotFoundError") {
        throw error;
      }
    }
  }

  throw ultimoError;
}

function alternarPistas(pistas, activo) {
  if (!Array.isArray(pistas) || pistas.length === 0) return false;
  const nuevoEstado = typeof activo === "boolean" ? activo : !pistas[0].enabled;
  pistas.forEach((pista) => {
    pista.enabled = nuevoEstado;
  });
  return nuevoEstado;
}

export function crearVideollamada(socket, callbacks, entorno = globalThis) {
  const llamadas = new Map();
  let streamLocal = null;
  let peer = null;
  let peerAbierto = false;
  let salaLista = false;
  let preparacion = null;

  function reportarError(error) {
    callbacks.alError(error instanceof Error ? error.message : String(error));
  }

  function cerrarLlamada(idPeer) {
    const llamada = llamadas.get(idPeer);
    if (llamada) {
      llamadas.delete(idPeer);
      try {
        llamada.close();
      } catch {
        // ignorar si ya estaba cerrada
      }
      callbacks.alDesconectar(idPeer);
    }
  }

  function cerrarLlamadas() {
    for (const idPeer of Array.from(llamadas.keys())) {
      cerrarLlamada(idPeer);
    }
    llamadas.clear();
  }

  function registrarLlamada(idPeer, llamada) {
    llamadas.set(idPeer, llamada);

    llamada.on("stream", (streamRemoto) => {
      callbacks.alRecibirStream(idPeer, streamRemoto);
    });

    llamada.on("close", () => {
      cerrarLlamada(idPeer);
    });

    llamada.on("error", (error) => {
      reportarError(error);
      cerrarLlamada(idPeer);
    });

    const pc = llamada.peerConnection;
    pc?.addEventListener?.("iceconnectionstatechange", () => {
      const estado = pc.iceConnectionState;
      if (estado === "failed") {
        reportarError("No se pudo atravesar el NAT/firewall (configura un servidor TURN/Coturn en RTC_ICE_SERVERS).");
      } else if (estado === "connected" || estado === "completed") {
        callbacks.alEstado?.("Videollamada P2P conectada.");
      }
    });
  }

  function conectarPeer(idPeer) {
    if (!peer || !peerAbierto || !streamLocal || !salaLista || llamadas.has(idPeer)) return;
    if (socket.id && socket.id.localeCompare(idPeer) >= 0) return;

    const llamada = peer.call(idPeer, streamLocal);
    if (llamada) {
      registrarLlamada(idPeer, llamada);
    }
  }

  function anunciarListo() {
    if (!streamLocal || !salaLista || !socket.connected || !peer || !peerAbierto) return;

    socket.emit("webrtc-ready");
    socket.emit("obtener-pares", (pares) => {
      if (!Array.isArray(pares)) {
        reportarError("El servidor devolvió una lista de participantes inválida.");
        return;
      }
      pares.forEach((idPeer) => {
        if (typeof idPeer === "string") {
          conectarPeer(idPeer);
        }
      });
    });
  }

  socket.on("peer-ready", (idPeer) => {
    if (typeof idPeer === "string") {
      conectarPeer(idPeer);
    }
  });

  socket.on("peer-disconnected", (idPeer) => {
    cerrarLlamada(idPeer);
  });

  socket.on("disconnect", () => {
    cerrarLlamadas();
  });

  async function cargarConfiguracion() {
    const fetchFn = entorno.fetch ?? globalThis.fetch;
    if (typeof fetchFn !== "function") return [];
    const respuesta = await fetchFn("/rtc-config");
    if (!respuesta.ok) throw new Error("No se pudo cargar la configuración de ICE.");
    const configuracion = await respuesta.json();
    if (!configuracion || !Array.isArray(configuracion.iceServers)) {
      throw new Error("La configuración de ICE del servidor no es válida.");
    }
    return configuracion.iceServers;
  }

  async function iniciar() {
    if (streamLocal) return true;
    if (preparacion) return preparacion;

    preparacion = (async () => {
      const mediaDevices = entorno.navigator?.mediaDevices;
      if (!mediaDevices?.getUserMedia) {
        throw new Error("El navegador no permite acceso a cámara y micrófono.");
      }

      let stream;
      let iceServers;
      try {
        stream = await solicitarMediosDisponibles(mediaDevices);
        await cargarPeerJS(entorno);
        const configurados = await cargarConfiguracion();
        iceServers = configurados.length > 0 ? configurados : STUN_POR_DEFECTO;
      } catch (error) {
        stream?.getTracks().forEach((track) => track.stop());
        throw error;
      }

      streamLocal = stream;
      callbacks.alStreamLocal(streamLocal);

      const loc = entorno.location ?? { hostname: "localhost", port: "3000", protocol: "http:" };
      const puerto = loc.port ? Number(loc.port) : (loc.protocol === "https:" ? 443 : 80);
      const PeerCtor = entorno.Peer;
      peerAbierto = false;
      peer = new PeerCtor(socket.id, {
        host: loc.hostname || "localhost",
        port: puerto,
        path: "/peerjs",
        secure: loc.protocol === "https:",
        config: { iceServers },
      });

      peer.on("open", () => {
        peerAbierto = true;
        anunciarListo();
      });

      peer.on("call", (llamada) => {
        llamada.answer(streamLocal);
        registrarLlamada(llamada.peer, llamada);
      });

      peer.on("error", (error) => {
        reportarError(error);
      });

      return true;
    })();

    try {
      return await preparacion;
    } catch (error) {
      preparacion = null;
      reportarError(error);
      return false;
    }
  }

  function alternarCamara(activo) {
    return alternarPistas(streamLocal?.getVideoTracks(), activo);
  }

  function alternarMicrofono(activo) {
    return alternarPistas(streamLocal?.getAudioTracks(), activo);
  }

  function obtenerTotalConexiones() {
    return llamadas.size;
  }

  function entrarSala() {
    salaLista = true;
    anunciarListo();
  }

  function detener(abandonarSala = false) {
    cerrarLlamadas();
    if (streamLocal) {
      streamLocal.getTracks().forEach((t) => t.stop());
      streamLocal = null;
    }
    if (peer) {
      peer.destroy();
      peer = null;
    }
    peerAbierto = false;
    preparacion = null;
    if (abandonarSala) {
      salaLista = false;
    }
  }

  entorno.addEventListener?.("pagehide", () => detener(true));

  return {
    iniciar,
    entrarSala,
    detener,
    alternarCamara,
    alternarMicrofono,
    alternarVideo: alternarCamara,
    alternarAudio: alternarMicrofono,
    obtenerTotalConexiones,
  };
}
