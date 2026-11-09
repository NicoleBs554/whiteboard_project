import test from "node:test";
import assert from "node:assert/strict";
import { crearConexionPizarra } from "../public/js/socket.js";

function crearSocketFalso(conectado = false) {
  const listeners = new Map();
  return {
    connected: conectado,
    emisiones: [],
    on(evento, listener) {
      listeners.set(evento, listener);
    },
    emit(evento, ...datos) {
      this.emisiones.push([evento, ...datos]);
    },
    recibir(evento, ...datos) {
      listeners.get(evento)?.(...datos);
    },
  };
}

test("conecta al namespace acordado y une la sala al conectarse", () => {
  const socket = crearSocketFalso();
  const estados = [];
  const acciones = crearConexionPizarra({
    alRecibirHistorial() {},
    alRecibirTrazo() {},
    alLimpiar() {},
    alCambiarEstado(estado) {
      estados.push(estado);
    },
  }, (namespace) => {
    assert.equal(namespace, "/pizarra");
    return socket;
  });

  acciones.unirseSala("sala1");
  assert.deepEqual(socket.emisiones, []);

  socket.connected = true;
  socket.recibir("connect");
  assert.deepEqual(socket.emisiones, [["unirseSala", "sala1"]]);
  assert.deepEqual(estados, ["conectando", "conectado"]);
});

test("conserva la limpieza durante una desconexion y la envia despues de unirse", () => {
  const socket = crearSocketFalso();
  const estados = [];
  const acciones = crearConexionPizarra({
    alRecibirHistorial() {},
    alRecibirTrazo() {},
    alLimpiar() {},
    alCambiarEstado(estado, detalle) {
      estados.push([estado, detalle]);
    },
  }, () => socket);
  const trazo = { x: [0.1], y: [0.2], color: "#0000ff", grosor: 4 };

  acciones.unirseSala("sala1");
  acciones.enviarTrazo(trazo);
  acciones.pedirLimpiar();

  socket.connected = true;
  socket.recibir("connect");
  assert.deepEqual(socket.emisiones, [
    ["unirseSala", "sala1"],
    ["limpiar"],
  ]);
  assert.ok(estados.some(([estado, detalle]) => (
    estado === "desconectado"
    && detalle === "El trazo no se envio; espera la reconexion para dibujar."
  )));
});

test("vuelve a unirse a la sala activa despues de reconectar", () => {
  const socket = crearSocketFalso();
  const acciones = crearConexionPizarra({
    alRecibirHistorial() {},
    alRecibirTrazo() {},
    alLimpiar() {},
    alCambiarEstado() {},
  }, () => socket);
  acciones.unirseSala("sala1");

  socket.connected = true;
  socket.recibir("connect");
  socket.emisiones.length = 0;
  socket.connected = false;
  socket.recibir("disconnect");
  socket.connected = true;
  socket.recibir("connect");

  assert.deepEqual(socket.emisiones, [["unirseSala", "sala1"]]);
});

test("entrega al cliente los eventos definidos por el contrato", () => {
  const socket = crearSocketFalso();
  const historial = [];
  const trazos = [];
  let limpiezas = 0;
  crearConexionPizarra({
    alRecibirHistorial(lista) {
      historial.push(lista);
    },
    alRecibirTrazo(trazo) {
      trazos.push(trazo);
    },
    alLimpiar() {
      limpiezas += 1;
    },
    alCambiarEstado() {},
  }, () => socket);

  const lista = [{ x: [0.1], y: [0.2], color: "#0000ff", grosor: 4 }];
  socket.recibir("historial", lista);
  socket.recibir("dibujar", lista[0]);
  socket.recibir("limpiar");

  assert.deepEqual(historial, [lista]);
  assert.deepEqual(trazos, [lista[0]]);
  assert.equal(limpiezas, 1);
});
