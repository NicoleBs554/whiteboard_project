function cargarPeerJS() {
  if (typeof Peer !== "undefined") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar la librería PeerJS."));
    document.head.appendChild(script);
  });
}

export function crearVideollamada(socket, callbacks) {
  const llamadas = new Map();
  let streamLocal = null;
  let peer = null;
  let salaLista = false;

  function reportarError(error) {
    callbacks.alError(error instanceof Error ? error.message : String(error));
  }

  function cerrarLlamada(idPeer) {
    const llamada = llamadas.get(idPeer);
    if (llamada) {
      llamada.close();
      llamadas.delete(idPeer);
      callbacks.alDesconectar(idPeer);
    }
  }

  function cerrarLlamadas() {
    for (const idPeer of llamadas.keys()) {
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
  }

  function conectarPeer(idPeer) {
    if (!peer || !streamLocal || !salaLista || llamadas.has(idPeer)) return;

    if (socket.id && socket.id.localeCompare(idPeer) >= 0) return;

    const llamada = peer.call(idPeer, streamLocal);
    if (llamada) {
      registrarLlamada(idPeer, llamada);
    }
  }

  function anunciarListo() {
    if (!streamLocal || !salaLista || !socket.connected || !peer) return;

    socket.emit("webrtc-ready");
    socket.emit("obtener-pares", (pares) => {
      if (Array.isArray(pares)) {
        pares.forEach((idPeer) => conectarPeer(idPeer));
      }
    });
  }

  socket.on("peer-ready", (idPeer) => {
    conectarPeer(idPeer);
  });

  socket.on("peer-disconnected", (idPeer) => {
    cerrarLlamada(idPeer);
  });

  socket.on("disconnect", () => {
    cerrarLlamadas();
  });

  async function iniciar() {
    if (streamLocal) return true;

    if (!navigator.mediaDevices?.getUserMedia) {
      reportarError("El navegador no permite acceso a cámara y micrófono.");
      return false;
    }

    try {
      await cargarPeerJS();
      streamLocal = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      callbacks.alStreamLocal(streamLocal);

      const puerto = location.port ? Number(location.port) : (location.protocol === "https:" ? 443 : 80);
      peer = new Peer(socket.id, {
        host: location.hostname || "localhost",
        port: puerto,
        path: "/peerjs",
      });

      peer.on("open", () => {
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
    } catch (error) {
      if (streamLocal) {
        streamLocal.getTracks().forEach((t) => t.stop());
        streamLocal = null;
      }
      reportarError(error);
      return false;
    }
  }

  function alternarAudio() {
    if (!streamLocal) return false;
    const track = streamLocal.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      return track.enabled;
    }
    return false;
  }

  function alternarVideo() {
    if (!streamLocal) return false;
    const track = streamLocal.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      return track.enabled;
    }
    return false;
  }

  function entrarSala() {
    salaLista = true;
    anunciarListo();
  }

  function detener() {
    cerrarLlamadas();
    if (streamLocal) {
      streamLocal.getTracks().forEach((t) => t.stop());
      streamLocal = null;
    }
    if (peer) {
      peer.destroy();
      peer = null;
    }
    salaLista = false;
  }

  globalThis.addEventListener?.("pagehide", detener);

  return { iniciar, entrarSala, detener, alternarAudio, alternarVideo };
}
