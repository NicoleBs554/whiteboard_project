import test from "node:test";
import assert from "node:assert/strict";
import { registrarWebRTC } from "../src/sockets/webrtcSocket.js";

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
