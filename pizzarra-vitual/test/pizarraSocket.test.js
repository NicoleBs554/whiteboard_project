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

test("admite hasta 3 participantes en la misma sala y notifica la cantidad", () => {
  const sala = "sala-3-usuarios";
  const emisiones = [];
  let alConectar;
  const nsp = {
    adapter: { rooms: new Map([[sala, new Set()]]) },
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

  registrarPizarra(nsp);

  function crearParticipante(id) {
    const listeners = new Map();
    const s = {
      id,
      data: {},
      on(evento, listener) {
        listeners.set(evento, listener);
      },
      emit(evento, datos) {
        emisiones.push({ destino: id, evento, datos });
      },
      join(idSala) {
        nsp.adapter.rooms.get(idSala).add(id);
      },
      to(destino) {
        return {
          emit(evento, datos) {
            emisiones.push({ destino, evento, datos, emisor: id });
          },
        };
      },
      recibir(evento, ...args) {
        listeners.get(evento)(...args);
      },
    };
    alConectar(s);
    return s;
  }

  const p1 = crearParticipante("p1");
  const p2 = crearParticipante("p2");
  const p3 = crearParticipante("p3");

  p1.recibir("unirseSala", sala);
  p2.recibir("unirseSala", sala);
  p3.recibir("unirseSala", sala);

  assert.equal(nsp.adapter.rooms.get(sala).size, 3);
  const avisosUsuarios = emisiones.filter(({ evento }) => evento === "usuarios");
  assert.equal(avisosUsuarios.length, 3);
  assert.equal(avisosUsuarios.at(-1).datos, 3);
});

test("notifica desconexion y actualiza el contador de usuarios", () => {
  const sala = "sala-desconexion";
  const emisiones = [];
  let alConectar;
  const nsp = {
    adapter: { rooms: new Map([[sala, new Set(["p1", "p2"])]]) },
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

  registrarPizarra(nsp);

  const listeners = new Map();
  const socket = {
    id: "p1",
    data: { sala },
    on(evento, listener) {
      listeners.set(evento, listener);
    },
    to(destino) {
      return {
        emit(evento, datos) {
          emisiones.push({ destino, evento, datos, emisor: "p1" });
        },
      };
    },
  };

  alConectar(socket);
  nsp.adapter.rooms.get(sala).delete("p1");
  listeners.get("disconnect")();

  assert.ok(emisiones.some(({ evento, datos }) => evento === "peer-disconnected" && datos === "p1"));
  assert.ok(emisiones.some(({ evento, datos }) => evento === "usuarios" && datos === 1));
});
