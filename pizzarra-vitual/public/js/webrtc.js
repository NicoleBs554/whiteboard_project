export function crearVideollamada(socket, callbacks) {
  const conexiones = new Map();
  const candidatosPendientes = new Map();
  let streamLocal = null;
  let iceServers = [];
  let salaLista = false;
  let preparacion = null;

  function reportarError(error) {
    callbacks.alError(error instanceof Error ? error.message : String(error));
  }

  function conError(promise) {
    promise.catch(reportarError);
  }

  function cerrarPeer(idPeer) {
    const conexion = conexiones.get(idPeer);
    if (conexion) {
      conexion.close();
      conexiones.delete(idPeer);
      callbacks.alDesconectar(idPeer);
    }
    candidatosPendientes.delete(idPeer);
  }

  function cerrarPeers() {
    for (const idPeer of conexiones.keys()) cerrarPeer(idPeer);
    candidatosPendientes.clear();
  }

  function crearPeerConnection(idPeer) {
    const conexion = new RTCPeerConnection({ iceServers });
    conexiones.set(idPeer, conexion);
    streamLocal.getTracks().forEach((track) => conexion.addTrack(track, streamLocal));

    conexion.onicecandidate = (evento) => {
      if (evento.candidate && socket.connected) {
        socket.emit("webrtc-ice-candidate", {
          to: idPeer,
          candidate: evento.candidate.toJSON(),
        });
      }
    };

    conexion.ontrack = (evento) => {
      const stream = evento.streams[0];
      if (stream) callbacks.alRecibirStream(idPeer, stream);
    };

    conexion.onconnectionstatechange = () => {
      if (conexion.connectionState === "failed" || conexion.connectionState === "closed") {
        cerrarPeer(idPeer);
      }
    };

    return conexion;
  }

  async function aplicarCandidatosPendientes(idPeer, conexion) {
    const candidatos = candidatosPendientes.get(idPeer) ?? [];
    candidatosPendientes.delete(idPeer);
    for (const candidato of candidatos) {
      await conexion.addIceCandidate(candidato);
    }
  }

  async function crearOferta(idPeer) {
    if (!streamLocal || !salaLista || !socket.connected || conexiones.has(idPeer)) return;

    const conexion = crearPeerConnection(idPeer);
    const oferta = await conexion.createOffer();
    await conexion.setLocalDescription(oferta);
    socket.emit("webrtc-offer", { to: idPeer, sdp: conexion.localDescription });
  }

  function puedeIniciarOferta(idPeer) {
    return socket.id && socket.id.localeCompare(idPeer) < 0;
  }

  async function anunciarListo() {
    if (!streamLocal || !salaLista || !socket.connected) return;

    socket.emit("webrtc-ready");
    socket.emit("obtener-pares", (pares) => {
      if (!Array.isArray(pares)) {
        reportarError("El servidor devolvió una lista de participantes inválida.");
        return;
      }
      pares.forEach((idPeer) => {
        if (typeof idPeer === "string" && puedeIniciarOferta(idPeer)) {
          conError(crearOferta(idPeer));
        }
      });
    });
  }

  socket.on("peer-ready", (idPeer) => {
    if (typeof idPeer === "string" && puedeIniciarOferta(idPeer)) {
      conError(crearOferta(idPeer));
    }
  });

  socket.on("webrtc-offer", async ({ from, sdp } = {}) => {
    if (typeof from !== "string" || !streamLocal) return;
    try {
      const conexion = conexiones.get(from) ?? crearPeerConnection(from);
      await conexion.setRemoteDescription(sdp);
      await aplicarCandidatosPendientes(from, conexion);
      const respuesta = await conexion.createAnswer();
      await conexion.setLocalDescription(respuesta);
      socket.emit("webrtc-answer", { to: from, sdp: conexion.localDescription });
    } catch (error) {
      reportarError(error);
    }
  });

  socket.on("webrtc-answer", async ({ from, sdp } = {}) => {
    const conexion = conexiones.get(from);
    if (!conexion) return;
    try {
      await conexion.setRemoteDescription(sdp);
      await aplicarCandidatosPendientes(from, conexion);
    } catch (error) {
      reportarError(error);
    }
  });

  socket.on("webrtc-ice-candidate", async ({ from, candidate } = {}) => {
    if (typeof from !== "string" || !candidate) return;
    const conexion = conexiones.get(from);
    if (!conexion || !conexion.remoteDescription) {
      const pendientes = candidatosPendientes.get(from) ?? [];
      pendientes.push(candidate);
      candidatosPendientes.set(from, pendientes);
      return;
    }
    try {
      await conexion.addIceCandidate(candidate);
    } catch (error) {
      reportarError(error);
    }
  });

  socket.on("peer-disconnected", cerrarPeer);
  socket.on("disconnect", cerrarPeers);

  async function cargarConfiguracion() {
    const respuesta = await fetch("/rtc-config");
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
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este navegador no permite acceso a cámara y micrófono.");
      }
      if (typeof RTCPeerConnection !== "function") {
        throw new Error("Este navegador no es compatible con WebRTC.");
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        iceServers = await cargarConfiguracion();
      } catch (error) {
        stream?.getTracks().forEach((track) => track.stop());
        throw error;
      }

      streamLocal = stream;
      callbacks.alStreamLocal(streamLocal);
      await anunciarListo();
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

  function entrarSala() {
    salaLista = true;
    conError(anunciarListo());
  }

  function detener() {
    cerrarPeers();
    streamLocal?.getTracks().forEach((track) => track.stop());
    streamLocal = null;
    salaLista = false;
  }

  globalThis.addEventListener?.("pagehide", detener);

  return { iniciar, entrarSala, detener };
}
