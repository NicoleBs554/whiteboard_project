import {
  iniciarCanvas,
  limpiarCanvas,
  pintarHistorial,
  pintarTrazo,
} from "./canvas.js";
import { crearConexionPizarra } from "./socket.js";
import { crearVideollamada } from "./webrtc.js";

const pantallaSala = document.getElementById("pantalla-sala");
const pantallaPizarra = document.getElementById("pantalla-pizarra");
const formSala = document.getElementById("form-sala");
const inputSala = document.getElementById("id-sala");
const errorSala = document.getElementById("error-sala");
const nombreSala = document.getElementById("nombre-sala");
const errorVideo = document.getElementById("estado-video");
const botonVideo = document.getElementById("btn-activar-video");
const botonCamara = document.getElementById("btn-toggle-camara");
const botonMicrofono = document.getElementById("btn-toggle-microfono");
const botonDetenerVideo = document.getElementById("btn-detener-video");
const videoLocal = document.getElementById("video-local");
const videoLocalContenedor = document.getElementById("video-local-contenedor");
const videosRemotos = document.getElementById("videos-remotos");
const participantes = document.getElementById("participantes");
const estadosConexion = [
  document.getElementById("estado-conexion"),
  document.getElementById("estado-conexion-barra"),
];
let salaPreparada = false;
let videollamada;
const elementosRemotos = new Map();

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

function reiniciarInterfazVideo() {
  videoLocal.srcObject = null;
  videoLocalContenedor.hidden = true;
  botonCamara.hidden = true;
  botonMicrofono.hidden = true;
  botonDetenerVideo.hidden = true;
  botonVideo.hidden = false;
  elementosRemotos.forEach((elemento) => elemento.figura.remove());
  elementosRemotos.clear();
  errorVideo.textContent = "Videollamada desactivada.";
}

const conexion = crearConexionPizarra({
  alRecibirHistorial(lista) {
    salaPreparada = true;
    limpiarCanvas();
    pintarHistorial(lista);
    videollamada.entrarSala();
    actualizarEstadoConexion("conectado");
  },
  alRecibirTrazo: pintarTrazo,
  alLimpiar: limpiarCanvas,
  alCambiarEstado: actualizarEstadoConexion,
  alErrorSala(mensaje) {
    salaPreparada = false;
    videollamada.detener(true);
    reiniciarInterfazVideo();
    pantallaPizarra.hidden = true;
    pantallaSala.hidden = false;
    errorSala.textContent = mensaje;
    errorSala.hidden = false;
  },
  alCambiarUsuarios(total) {
    if (!Number.isInteger(total) || total < 0) return;
    participantes.textContent = `${total} ${total === 1 ? "participante" : "participantes"}`;
  },
});

videollamada = crearVideollamada(conexion.socket, {
  alStreamLocal(stream) {
    videoLocal.srcObject = stream;
    videoLocalContenedor.hidden = false;
    botonVideo.hidden = true;
    const tieneCamara = stream.getVideoTracks().length > 0;
    const tieneMicrofono = stream.getAudioTracks().length > 0;
    botonCamara.hidden = !tieneCamara;
    botonCamara.textContent = "Cámara: ON";
    botonCamara.classList.toggle("activo", tieneCamara);
    botonMicrofono.hidden = !tieneMicrofono;
    botonMicrofono.textContent = "Micrófono: ON";
    botonMicrofono.classList.toggle("activo", tieneMicrofono);
    botonDetenerVideo.hidden = false;
    errorVideo.textContent = tieneCamara && tieneMicrofono
      ? "Cámara y micrófono activos."
      : tieneCamara
        ? "Solo cámara activa (no se detectó micrófono)."
        : "Solo micrófono activo (no se detectó cámara).";
  },
  alRecibirStream(idPeer, stream) {
    let elemento = elementosRemotos.get(idPeer);
    if (!elemento) {
      const figura = document.createElement("figure");
      const etiqueta = document.createElement("figcaption");
      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      etiqueta.textContent = `Participante ${idPeer}`;
      figura.append(video, etiqueta);
      videosRemotos.append(figura);
      elemento = { figura, video };
      elementosRemotos.set(idPeer, elemento);
    }
    elemento.video.srcObject = stream;
  },
  alDesconectar(idPeer) {
    const elemento = elementosRemotos.get(idPeer);
    if (elemento) {
      elemento.figura.remove();
      elementosRemotos.delete(idPeer);
    }
  },
  alError(mensaje) {
    errorVideo.textContent = `Videollamada: ${mensaje}`;
    botonVideo.hidden = false;
  },
});

botonVideo.addEventListener("click", async () => {
  if (!salaPreparada) {
    errorVideo.textContent = "Espera a que la sala termine de sincronizarse.";
    return;
  }
  botonVideo.disabled = true;
  errorVideo.textContent = "Solicitando acceso a cámara y micrófono...";
  const iniciado = await videollamada.iniciar();
  botonVideo.disabled = false;
  if (!iniciado) botonVideo.hidden = false;
});

botonCamara.addEventListener("click", () => {
  const activa = videollamada.alternarCamara();
  botonCamara.textContent = `Cámara: ${activa ? "ON" : "OFF"}`;
  botonCamara.classList.toggle("activo", activa);
});

botonMicrofono.addEventListener("click", () => {
  const activo = videollamada.alternarMicrofono();
  botonMicrofono.textContent = `Micrófono: ${activo ? "ON" : "OFF"}`;
  botonMicrofono.classList.toggle("activo", activo);
});

botonDetenerVideo.addEventListener("click", () => {
  videollamada.detener();
  reiniciarInterfazVideo();
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
