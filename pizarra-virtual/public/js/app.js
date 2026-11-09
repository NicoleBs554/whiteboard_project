import {
  iniciarCanvas,
  limpiarCanvas,
  pintarHistorial,
  pintarTrazo,
} from "./canvas.js";
import { crearConexionPizarra } from "./socket.js";

const pantallaSala = document.getElementById("pantalla-sala");
const pantallaPizarra = document.getElementById("pantalla-pizarra");
const formSala = document.getElementById("form-sala");
const inputSala = document.getElementById("id-sala");
const errorSala = document.getElementById("error-sala");
const nombreSala = document.getElementById("nombre-sala");
const estadosConexion = [
  document.getElementById("estado-conexion"),
  document.getElementById("estado-conexion-barra"),
];
let salaPreparada = false;

function actualizarEstadoConexion(estado, detalle) {
  if (estado === "desconectado" || estado === "error") salaPreparada = false;
  const mensajes = {
    conectando: "Conectando al servidor...",
    conectado: salaPreparada ? "Sala sincronizada" : "Conectado",
    desconectado: "Conexion interrumpida; reintentando...",
    error: `No se pudo conectar: ${detalle || "error de red"}`,
  };
  const mensaje = detalle || mensajes[estado];
  estadosConexion.forEach((elemento) => {
    elemento.textContent = mensaje;
    elemento.dataset.estado = estado;
  });
}

const conexion = crearConexionPizarra({
  alRecibirHistorial(lista) {
    salaPreparada = true;
    limpiarCanvas();
    pintarHistorial(lista);
    actualizarEstadoConexion("conectado");
  },
  alRecibirTrazo: pintarTrazo,
  alLimpiar: limpiarCanvas,
  alCambiarEstado: actualizarEstadoConexion,
});

formSala.addEventListener("submit", (e) => {
  e.preventDefault();
  const idSala = inputSala.value.trim();

  if (idSala.length === 0 || idSala.length > 30) {
    errorSala.textContent = "El ID debe tener entre 1 y 30 caracteres.";
    errorSala.hidden = false;
    return;
  }

  errorSala.hidden = true;
  salaPreparada = false;
  conexion.unirseSala(idSala);
  nombreSala.textContent = "Sala: " + idSala;
  pantallaSala.hidden = true;
  pantallaPizarra.hidden = false;
});

const COLOR_FONDO = "#ffffff";
const btnLapiz = document.getElementById("btn-lapiz");
const btnBorrador = document.getElementById("btn-borrador");
const inputColor = document.getElementById("color");
const inputGrosor = document.getElementById("grosor");
let herramienta = "lapiz"; // "lapiz" | "borrador"

function elegirHerramienta(nombre) {
  herramienta = nombre;
  btnLapiz.classList.toggle("activo", nombre === "lapiz");
  btnBorrador.classList.toggle("activo", nombre === "borrador");
}
btnLapiz.addEventListener("click", () => elegirHerramienta("lapiz"));
btnBorrador.addEventListener("click", () => elegirHerramienta("borrador"));

const getColor = () => (herramienta === "borrador" ? COLOR_FONDO : inputColor.value);
const getGrosor = () => Math.min(
  20,
  Number(inputGrosor.value) * (herramienta === "borrador" ? 4 : 1),
);

document.getElementById("btn-limpiar").addEventListener("click", conexion.pedirLimpiar);

iniciarCanvas(conexion.enviarTrazo, getColor, getGrosor, () => salaPreparada);
