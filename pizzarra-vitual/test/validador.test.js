import test from "node:test";
import assert from "node:assert/strict";
import { validarSala, validarTrazo } from "../src/utils/validador.js";

test("validarSala acepta IDs de 1 a 30 caracteres", () => {
  assert.equal(validarSala("sala1"), true);
  assert.equal(validarSala("a".repeat(30)), true);
  assert.equal(validarSala(" "), false);
  assert.equal(validarSala("a".repeat(31)), false);
});

test("validarTrazo acepta el ejemplo del contrato", () => {
  assert.equal(validarTrazo({
    x: [0.1, 0.5, 0.9],
    y: [0.1, 0.5, 0.1],
    color: "#0000ff",
    grosor: 4,
  }), true);
});

test("validarTrazo rechaza coordenadas, color y grosor invalidos", () => {
  const base = { x: [0.1], y: [0.2], color: "#0000ff", grosor: 4 };
  assert.equal(validarTrazo({ ...base, y: [] }), false);
  assert.equal(validarTrazo({ ...base, x: [1.01] }), false);
  assert.equal(validarTrazo({ ...base, color: "blue" }), false);
  assert.equal(validarTrazo({ ...base, grosor: 21 }), false);
});
