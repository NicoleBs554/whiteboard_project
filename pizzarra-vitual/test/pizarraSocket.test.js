import test from "node:test";
import assert from "node:assert/strict";
import { registrarPizarra } from "../src/sockets/pizarraSocket.js";

test("rechaza un cuarto participante sin sacarlo de su estado actual", () => {
  const sala = "sala-capacidad-test";
  const miembros = new Set(["uno", "dos", "tres"]);
  const emisiones = [];
  let alConectar;
  const nsp = {
    adapter: { rooms: new Map([[sala, miembros]]) },
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
  const listeners = new Map();
  const socket = {
    id: "cuatro",
    data: {},
    on(evento, listener) {
      listeners.set(evento, listener);
    },
    emit(evento, datos) {
      emisiones.push({ evento, datos });
    },
    join(idSala) {
      const salaActual = nsp.adapter.rooms.get(idSala) ?? new Set();
      salaActual.add(this.id);
      nsp.adapter.rooms.set(idSala, salaActual);
    },
    leave(idSala) {
      nsp.adapter.rooms.get(idSala)?.delete(this.id);
    },
    to(destino) {
      return {
        emit(evento, datos) {
          emisiones.push({ destino, evento, datos });
        },
      };
    },
  };

  registrarPizarra(nsp);
  alConectar(socket);
  listeners.get("unirseSala")(sala);

  assert.equal(socket.data.sala, undefined);
  assert.equal(miembros.size, 3);
  assert.ok(emisiones.some(({ evento }) => evento === "sala-error"));
});
