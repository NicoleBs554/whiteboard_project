import { log } from "../utils/logger.js";

const MAX_SDP_LENGTH = 100_000;
const MAX_CANDIDATE_LENGTH = 10_000;

function esDescripcionValida(sdp, tipo) {
  return sdp !== null
    && typeof sdp === "object"
    && sdp.type === tipo
    && typeof sdp.sdp === "string"
    && sdp.sdp.length > 0
    && sdp.sdp.length <= MAX_SDP_LENGTH;
}

function esCandidatoValido(candidate) {
  return candidate !== null
    && typeof candidate === "object"
    && typeof candidate.candidate === "string"
    && candidate.candidate.length > 0
    && candidate.candidate.length <= MAX_CANDIDATE_LENGTH
    && (candidate.sdpMid === undefined
      || candidate.sdpMid === null
      || (typeof candidate.sdpMid === "string" && candidate.sdpMid.length <= 256))
    && (candidate.sdpMLineIndex === undefined
      || candidate.sdpMLineIndex === null
      || (Number.isInteger(candidate.sdpMLineIndex) && candidate.sdpMLineIndex >= 0))
    && (candidate.usernameFragment === undefined
      || candidate.usernameFragment === null
      || (typeof candidate.usernameFragment === "string"
        && candidate.usernameFragment.length <= 256));
}

export function registrarWebRTC(nsp) {
  nsp.on("connection", (socket) => {
    socket.on("webrtc-ready", () => {
      const sala = socket.data.sala;
      if (!sala) return;

      socket.data.webrtcReady = true;
      socket.to(sala).emit("peer-ready", socket.id);
    });

    socket.on("obtener-pares", (responder) => {
      const sala = socket.data.sala;
      if (!sala || typeof responder !== "function") return;

      const participantes = nsp.adapter.rooms.get(sala) ?? new Set();
      const pares = [...participantes].filter((id) => (
        id !== socket.id && nsp.sockets.get(id)?.data.webrtcReady
      ));
      responder(pares);
    });

    function reenviar(evento, payload, esValido) {
      const sala = socket.data.sala;
      const destino = payload?.to;
      const socketDestino = typeof destino === "string"
        ? nsp.sockets.get(destino)
        : null;

      if (!sala
          || !socket.data.webrtcReady
          || !socketDestino
          || socketDestino.data.sala !== sala
          || !socketDestino.data.webrtcReady
          || !esValido(payload)) {
        log.warning(`Senal WebRTC invalida desde ${socket.id}`);
        return;
      }

      const campo = evento === "webrtc-ice-candidate" ? "candidate" : "sdp";
      const datos = campo === "candidate"
        ? {
          candidate: payload.candidate.candidate,
          sdpMid: payload.candidate.sdpMid,
          sdpMLineIndex: payload.candidate.sdpMLineIndex,
          usernameFragment: payload.candidate.usernameFragment,
        }
        : payload.sdp;
      nsp.to(destino).emit(evento, { from: socket.id, [campo]: datos });
    }

    socket.on("webrtc-offer", (payload) => {
      reenviar("webrtc-offer", payload, (data) => esDescripcionValida(data?.sdp, "offer"));
    });

    socket.on("webrtc-answer", (payload) => {
      reenviar("webrtc-answer", payload, (data) => esDescripcionValida(data?.sdp, "answer"));
    });

    socket.on("webrtc-ice-candidate", (payload) => {
      reenviar("webrtc-ice-candidate", payload, (data) => esCandidatoValido(data?.candidate));
    });
  });
}
