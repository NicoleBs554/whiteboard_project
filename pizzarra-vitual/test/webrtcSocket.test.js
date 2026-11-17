import test from "node:test";
import assert from "node:assert/strict";
import { registrarWebRTC } from "../src/sockets/webrtcSocket.js";
import { crearVideollamada } from "../public/js/webrtc.js";

function crearEspacio() {
  const emisiones = [];
  let alConectar;
  const nsp = {
    adapter: {
      rooms: new Map([
        ["sala-a", new Set(["a", "b"])],
        ["sala-b", new Set(["c"])],
      ]),
    },
    sockets: new Map(),
    on(_evento, listener) {
      alConectar = listener;
    },
    to(destino) {
      return {
        emit(evento, datos) {
          emisiones.push({ destino, evento, datos });
        },
      };
    },
  };

  function agregarSocket(id, sala, webrtcReady = false) {
    const listeners = new Map();
    const socket = {
      id,
      data: { sala, webrtcReady },
      on(evento, listener) {
        listeners.set(evento, listener);
      },
      to(destino) {
        return {
          emit(evento, datos) {
            emisiones.push({ destino, evento, datos, emisor: id });
          },
        };
      },
      recibir(evento, ...datos) {
        listeners.get(evento)?.(...datos);
      },
    };
    nsp.sockets.set(id, socket);
    alConectar(socket);
    return socket;
  }

  registrarWebRTC(nsp);
  return { agregarSocket, emisiones };
}

test("solo devuelve pares con medios activos de la misma sala", () => {
  const { agregarSocket } = crearEspacio();
  const socket = agregarSocket("a", "sala-a", true);
  const peer = agregarSocket("b", "sala-a");
  agregarSocket("c", "sala-b", true);

  let pares;
  socket.recibir("obtener-pares", (resultado) => {
    pares = resultado;
  });

  assert.deepEqual(pares, []);
  peer.data.webrtcReady = true;
  socket.recibir("obtener-pares", (resultado) => {
    pares = resultado;
  });
  assert.deepEqual(pares, ["b"]);
});

test("reenvía señalización solo a un peer activo de la misma sala", () => {
  const { agregarSocket, emisiones } = crearEspacio();
  const emisor = agregarSocket("a", "sala-a", true);
  agregarSocket("b", "sala-a", true);
  agregarSocket("c", "sala-b", true);
  const sdp = { type: "offer", sdp: "v=0\r\n" };

  emisor.recibir("webrtc-offer", { to: "b", sdp });
  assert.deepEqual(emisiones, [
    { destino: "b", evento: "webrtc-offer", datos: { from: "a", sdp } },
  ]);

  emisor.recibir("webrtc-offer", { to: "c", sdp });
  emisor.recibir("webrtc-answer", { to: "b", sdp });
  assert.equal(emisiones.length, 1);
});

test("admite 3 participantes simultaneos en la misma sala para obtener pares e intercambiar senales", () => {
  const emisiones = [];
  let alConectar;
  const nsp = {
    adapter: {
      rooms: new Map([["sala-3", new Set(["a", "b", "c"])]]),
    },
    sockets: new Map(),
    on(_evento, listener) {
      alConectar = listener;
    },
    to(destino) {
      return {
        emit(evento, datos) {
          emisiones.push({ destino, evento, datos });
        },
      };
    },
  };

  function crearSocketEnSala(id) {
    const listeners = new Map();
    const socket = {
      id,
      data: { sala: "sala-3", webrtcReady: true },
      on(evento, listener) {
        listeners.set(evento, listener);
      },
      to(destino) {
        return {
          emit(evento, datos) {
            emisiones.push({ destino, evento, datos, emisor: id });
          },
        };
      },
      recibir(evento, ...datos) {
        listeners.get(evento)?.(...datos);
      },
    };
    nsp.sockets.set(id, socket);
    alConectar(socket);
    return socket;
  }

  registrarWebRTC(nsp);
  const sA = crearSocketEnSala("a");
  const sB = crearSocketEnSala("b");
  const sC = crearSocketEnSala("c");

  let paresA;
  let paresB;
  let paresC;
  sA.recibir("obtener-pares", (res) => { paresA = res; });
  sB.recibir("obtener-pares", (res) => { paresB = res; });
  sC.recibir("obtener-pares", (res) => { paresC = res; });

  assert.deepEqual(paresA, ["b", "c"]);
  assert.deepEqual(paresB, ["a", "c"]);
  assert.deepEqual(paresC, ["a", "b"]);

  const oferta = { type: "offer", sdp: "v=0\r\noffer" };
  const respuesta = { type: "answer", sdp: "v=0\r\nanswer" };
  const candidato = { candidate: "candidate:1 1 udp 1 127.0.0.1 3478 typ relay", sdpMid: "0" };

  sA.recibir("webrtc-offer", { to: "b", sdp: oferta });
  sA.recibir("webrtc-offer", { to: "c", sdp: oferta });
  sB.recibir("webrtc-answer", { to: "a", sdp: respuesta });
  sC.recibir("webrtc-ice-candidate", { to: "b", candidate: candidato });

  assert.equal(emisiones.length, 4);
  assert.deepEqual(emisiones[0], { destino: "b", evento: "webrtc-offer", datos: { from: "a", sdp: oferta } });
  assert.deepEqual(emisiones[1], { destino: "c", evento: "webrtc-offer", datos: { from: "a", sdp: oferta } });
  assert.deepEqual(emisiones[2], { destino: "a", evento: "webrtc-answer", datos: { from: "b", sdp: respuesta } });
  assert.deepEqual(emisiones[3].destino, "b");
  assert.equal(emisiones[3].evento, "webrtc-ice-candidate");
});

test("malla P2P de 3 clientes con camara, microfono, controles de mute y respaldo de dispositivo", async () => {
  const sala = "sala-malla-3";
  const rooms = new Map([[sala, new Set(["p1", "p2", "p3"])]]);
  const serverSockets = new Map();
  const clientListeners = new Map();
  let alConectar;

  const nsp = {
    adapter: { rooms },
    sockets: serverSockets,
    on(_evento, listener) {
      alConectar = listener;
    },
    to(destino) {
      return {
        emit(evento, datos) {
          queueMicrotask(() => clientListeners.get(destino)?.get(evento)?.(datos));
        },
      };
    },
  };

  registrarWebRTC(nsp);

  function crearPar(id) {
    const serverHandlers = new Map();
    const handlersCliente = new Map();
    clientListeners.set(id, handlersCliente);

    const serverSocket = {
      id,
      data: { sala, webrtcReady: false },
      on(evento, listener) {
        serverHandlers.set(evento, listener);
      },
      to(salaDestino) {
        return {
          emit(evento, datos) {
            for (const miembro of rooms.get(salaDestino) ?? []) {
              if (miembro !== id) {
                queueMicrotask(() => clientListeners.get(miembro)?.get(evento)?.(datos));
              }
            }
          },
        };
      },
    };
    serverSockets.set(id, serverSocket);
    alConectar(serverSocket);

    const clientSocket = {
      id,
      connected: true,
      on(evento, listener) {
        handlersCliente.set(evento, listener);
      },
      emit(evento, ...args) {
        queueMicrotask(() => serverHandlers.get(evento)?.(...args));
      },
    };
    return clientSocket;
  }

  function crearStreamMock(id, conVideo = true, conAudio = true) {
    const videoTracks = conVideo
      ? [{ kind: "video", enabled: true, stopped: false, stop() { this.stopped = true; } }]
      : [];
    const audioTracks = conAudio
      ? [{ kind: "audio", enabled: true, stopped: false, stop() { this.stopped = true; } }]
      : [];
    return {
      id,
      getTracks: () => [...videoTracks, ...audioTracks],
      getVideoTracks: () => videoTracks,
      getAudioTracks: () => audioTracks,
    };
  }

  const instanciasPC = [];
  class MockRTCPeerConnection {
    constructor(config) {
      this.config = config;
      this.tracks = [];
      this.candidatos = [];
      this.localDescription = null;
      this.remoteDescription = null;
      this.connectionState = "new";
      this.onicecandidate = null;
      this.ontrack = null;
      instanciasPC.push(this);
    }

    addTrack(track, stream) {
      this.tracks.push({ track, stream });
    }

    async createOffer() {
      return { type: "offer", sdp: "v=0\r\noffer" };
    }

    async createAnswer() {
      return { type: "answer", sdp: "v=0\r\nanswer" };
    }

    async setLocalDescription(desc) {
      this.localDescription = desc;
      queueMicrotask(() => {
        this.onicecandidate?.({
          candidate: { toJSON: () => ({ candidate: "relay-turn", sdpMid: "0" }) },
        });
      });
    }

    async setRemoteDescription(desc) {
      this.remoteDescription = desc;
      this.connectionState = "connected";
      this.ontrack?.({ streams: [{ id: `remote-${desc.type}` }] });
    }

    async addIceCandidate(candidato) {
      this.candidatos.push(candidato);
    }

    close() {
      this.connectionState = "closed";
    }
  }

  const turnConfig = [{ urls: "turn:turn.ejemplo:3478?transport=udp", username: "u", credential: "p" }];

  const clientes = ["p1", "p2", "p3"].map((id) => {
    const socket = crearPar(id);
    const streamsRemotos = new Map();
    let streamLocal = null;
    const errores = [];

    const entorno = {
      RTCPeerConnection: MockRTCPeerConnection,
      fetch: async () => ({ ok: true, json: async () => ({ iceServers: turnConfig }) }),
      navigator: {
        mediaDevices: {
          getUserMedia: async () => crearStreamMock(`local-${id}`),
        },
      },
    };

    const call = crearVideollamada(socket, {
      alStreamLocal: (s) => { streamLocal = s; },
      alRecibirStream: (peerId, s) => streamsRemotos.set(peerId, s),
      alDesconectar: (peerId) => streamsRemotos.delete(peerId),
      alError: (err) => errores.push(err),
    }, entorno);

    return { id, call, streamsRemotos, getStreamLocal: () => streamLocal, errores };
  });

  for (const c of clientes) {
    c.call.entrarSala();
    const ok = await c.call.iniciar();
    assert.equal(ok, true);
  }

  await new Promise((r) => setTimeout(r, 40));

  for (const c of clientes) {
    assert.deepEqual(c.errores, []);
    assert.equal(c.call.obtenerTotalConexiones(), 2);
    assert.equal(c.streamsRemotos.size, 2);
  }

  assert.ok(instanciasPC.length >= 6);
  assert.ok(instanciasPC.every((pc) => pc.config.iceServers[0].urls.startsWith("turn:")));
  assert.ok(instanciasPC.every((pc) => pc.tracks.length === 2));

  // Controles de cámara y micrófono
  assert.equal(clientes[0].call.alternarCamara(), false);
  assert.equal(clientes[0].getStreamLocal().getVideoTracks()[0].enabled, false);
  assert.equal(clientes[0].call.alternarCamara(true), true);
  assert.equal(clientes[0].getStreamLocal().getVideoTracks()[0].enabled, true);

  assert.equal(clientes[0].call.alternarMicrofono(), false);
  assert.equal(clientes[0].getStreamLocal().getAudioTracks()[0].enabled, false);

  // Respaldo si falta cámara (NotFoundError) y solo hay micrófono
  const socketSoloAudio = crearPar("p4-audio");
  let streamSoloAudio = null;
  const callSoloAudio = crearVideollamada(socketSoloAudio, {
    alStreamLocal: (s) => { streamSoloAudio = s; },
    alRecibirStream() {},
    alDesconectar() {},
    alError() {},
  }, {
    RTCPeerConnection: MockRTCPeerConnection,
    fetch: async () => ({ ok: true, json: async () => ({ iceServers: turnConfig }) }),
    navigator: {
      mediaDevices: {
        async getUserMedia(req) {
          if (req.video) {
            const err = new Error("No se encontró cámara");
            err.name = "NotFoundError";
            throw err;
          }
          return crearStreamMock("solo-mic", false, true);
        },
      },
    },
  });

  const audioIniciado = await callSoloAudio.iniciar();
  assert.equal(audioIniciado, true);
  assert.equal(streamSoloAudio.getVideoTracks().length, 0);
  assert.equal(streamSoloAudio.getAudioTracks().length, 1);
  assert.equal(callSoloAudio.alternarCamara(), false);

  // Detener videollamada limpia pistas y conexiones
  clientes.forEach((c) => c.call.detener());
  callSoloAudio.detener();
  assert.equal(clientes[0].call.obtenerTotalConexiones(), 0);
  assert.equal(clientes[0].getStreamLocal().getVideoTracks()[0].stopped, true);
});
