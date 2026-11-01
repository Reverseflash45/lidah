// Daratan Indonesia untuk peta besar di pembuka: semua daerah digabung jadi satu (tanpa batas antardaerah)
// lalu disederhanakan setengah piksel pada lebar 1200 px. Peta lengkap (public/data/peta.json) tetap dipakai
// peta kecil di bagian "daerahmu", yang memperbesar sampai skala kabupaten.
//
// node data/skrip/darat.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { merge } from "topojson-client";

const TOLERANSI = 0.015; // derajat; ±0,4 piksel pada lebar 1200 px
const LUAS_MIN = 0.0004; // derajat persegi; pulau lebih kecil dari sekitar satu piksel dibuang

const topo = JSON.parse(readFileSync("public/data/peta.json", "utf8"));
const gabung = merge(topo, topo.objects.daerah.geometries);

function jarakKeGaris([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l)) : 0;
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function dp(titik, toleransi) {
  const simpan = new Uint8Array(titik.length);
  simpan[0] = simpan[titik.length - 1] = 1;
  const tumpuk = [[0, titik.length - 1]];
  while (tumpuk.length) {
    const [a, b] = tumpuk.pop();
    let maks = 0;
    let i = -1;
    for (let k = a + 1; k < b; k++) {
      const d = jarakKeGaris(titik[k], titik[a], titik[b]);
      if (d > maks) [maks, i] = [d, k];
    }
    if (maks > toleransi) {
      simpan[i] = 1;
      tumpuk.push([a, i], [i, b]);
    }
  }
  return titik.filter((_, k) => simpan[k]);
}

const luas = (r) => Math.abs(r.reduce((s, [x, y], i) => s + x * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * y, 0)) / 2;
const bulat = (n) => Math.round(n * 1000) / 1000;

let sebelum = 0;
let sesudah = 0;
const poligon = [];
for (const p of gabung.coordinates) {
  if (luas(p[0]) < LUAS_MIN) continue;
  const cincin = [];
  for (const r of p) {
    sebelum += r.length;
    if (luas(r) < LUAS_MIN) continue;
    const s = dp(r, TOLERANSI);
    if (s.length < 4) continue;
    sesudah += s.length;
    cincin.push(s.map(([x, y]) => [bulat(x), bulat(y)]));
  }
  if (cincin.length) poligon.push(cincin);
}

writeFileSync("public/data/darat.json", JSON.stringify({ type: "MultiPolygon", coordinates: poligon }));
console.log(`${gabung.coordinates.length} → ${poligon.length} poligon, ${sebelum} → ${sesudah} titik`);
