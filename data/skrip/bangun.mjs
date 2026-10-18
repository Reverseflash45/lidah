// Bangun data bahasa dari Glottolog (CLDF, rilis v5.2.1, CC BY 4.0).
//
//   node data/skrip/bangun.mjs           pakai data/mentah/glottolog-id.json yang ada
//   node data/skrip/bangun.mjs --unduh   unduh ulang languages.csv dan values.csv lebih dulu
//
// Yang diambil: languoid tingkat "language" berkategori bahasa ibu lisan (Spoken L1 Language) yang
// tercatat dituturkan di Indonesia (kode negara ID). Keluaran src/data/bahasa.json.
import { readFileSync, writeFileSync } from "node:fs";

const VERSI = "v5.2.1";
const AKAR = `https://raw.githubusercontent.com/glottolog/glottolog-cldf/${VERSI}/cldf`;
const SITASI =
  "Hammarström, Harald & Forkel, Robert & Haspelmath, Martin & Bank, Sebastian. 2025. Glottolog 5.2.1. Leipzig: Max Planck Institute for Evolutionary Anthropology.";

/** Pengurai CSV RFC 4180 sederhana (kolom bertanda kutip boleh berisi koma dan baris baru). */
function bacaCsv(teks) {
  const baris = [];
  let kolom = [];
  let sel = "";
  let kutip = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (kutip) {
      if (c === '"' && teks[i + 1] === '"') {
        sel += '"';
        i++;
      } else if (c === '"') kutip = false;
      else sel += c;
    } else if (c === '"') kutip = true;
    else if (c === ",") {
      kolom.push(sel);
      sel = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && teks[i + 1] === "\n") i++;
      kolom.push(sel);
      baris.push(kolom);
      kolom = [];
      sel = "";
    } else sel += c;
  }
  if (sel || kolom.length) {
    kolom.push(sel);
    baris.push(kolom);
  }
  const [kepala, ...isi] = baris;
  return isi.filter((b) => b.length === kepala.length).map((b) => Object.fromEntries(kepala.map((k, i) => [k, b[i]])));
}

if (process.argv.includes("--unduh")) {
  const ambil = async (f) => {
    const r = await fetch(`${AKAR}/${f}`);
    if (!r.ok) throw new Error(`${f}: ${r.status}`);
    return bacaCsv(await r.text());
  };
  const bahasa = await ambil("languages.csv");
  const nilai = await ambil("values.csv");
  const semua = Object.fromEntries(bahasa.map((b) => [b.ID, b]));
  const kategori = Object.fromEntries(nilai.filter((v) => v.Parameter_ID === "category").map((v) => [v.Language_ID, v.Value]));
  const pilih = bahasa.filter((b) => b.Level === "language" && b.Countries.split(";").includes("ID") && kategori[b.ID] === "Spoken_L1_Language" && b.Latitude);
  const ids = new Set(pilih.map((b) => b.ID));
  const per = {};
  for (const v of nilai) {
    if (!ids.has(v.Language_ID)) continue;
    if (v.Parameter_ID === "aes") (per[v.Language_ID] ??= {}).aes = Number(v.Value);
    if (v.Parameter_ID === "med") (per[v.Language_ID] ??= {}).med = v.Value;
    if (v.Parameter_ID === "classification") (per[v.Language_ID] ??= {}).jalur = v.Value ? v.Value.split("/") : [];
  }
  // Nama semua leluhur yang muncul di jalur klasifikasi.
  const leluhur = new Set(Object.values(per).flatMap((p) => p.jalur ?? []));
  const nama = Object.fromEntries([...leluhur].map((id) => [id, semua[id]?.Name ?? id]));
  const mentah = {
    versi: VERSI,
    sitasi: SITASI,
    bahasa: pilih.map((b) => ({
      id: b.ID,
      nama: b.Name,
      iso: b.ISO639P3code || null,
      lat: Number(b.Latitude),
      lon: Number(b.Longitude),
      negara: b.Countries.split(";"),
      isolat: b.Is_Isolate === "true",
      ...per[b.ID],
    })),
    nama,
  };
  writeFileSync("data/mentah/glottolog-id.json", JSON.stringify(mentah));
}

const mentah = JSON.parse(readFileSync("data/mentah/glottolog-id.json", "utf8"));
const { daerah } = JSON.parse(readFileSync("data/mentah/daerah.json", "utf8"));

const rad = (d) => (d * Math.PI) / 180;
const jarakKm = (a, b, c, d) => {
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Wilayah dari provinsi daerah terdekat; Maluku dan Papua dipisah karena Papua sendiri punya ratusan bahasa. */
const wilayah = (d) => (d.prov.startsWith("Papua") ? "Papua" : d.prov.startsWith("Maluku") ? "Maluku" : d.pulau);

const bahasa = mentah.bahasa
  .map((b) => {
    let iDaerah = 0;
    let terbaik = Infinity;
    daerah.forEach((d, i) => {
      const j = jarakKm(b.lat, b.lon, d.titik[1], d.titik[0]);
      if (j < terbaik) [terbaik, iDaerah] = [j, i];
    });
    const jalur = (b.jalur ?? []).map((id) => mentah.nama[id]);
    return {
      id: b.id,
      nama: b.nama,
      iso: b.iso,
      lat: Math.round(b.lat * 1e4) / 1e4,
      lon: Math.round(b.lon * 1e4) / 1e4,
      status: b.aes ?? 0,
      rumpun: jalur[0] ?? (b.isolat ? "Isolat" : "Tidak terklasifikasi"),
      jalur,
      // Deskripsi terlengkap: 0 tata bahasa panjang, 1 tata bahasa, 2 sketsa, 3 fonologi/teks, 4 daftar kata atau kurang.
      dokumentasi: b.med != null && b.med !== "" ? Number(b.med) : null,
      negara: b.negara,
      daerah: iDaerah,
      wilayah: wilayah(daerah[iDaerah]),
    };
  })
  .sort((a, b) => a.nama.localeCompare(b.nama));

writeFileSync("src/data/bahasa.json", JSON.stringify({ versi: mentah.versi, sitasi: mentah.sitasi, bahasa }));
writeFileSync("src/data/daerah.json", JSON.stringify({ daerah }));

const hitung = (f) => bahasa.reduce((m, b) => ((m[f(b)] = (m[f(b)] ?? 0) + 1), m), {});
console.log(`${bahasa.length} bahasa`);
console.log("status:", hitung((b) => b.status));
console.log("wilayah:", hitung((b) => b.wilayah));
console.log("rumpun teratas:", Object.entries(hitung((b) => b.rumpun)).sort((a, b) => b[1] - a[1]).slice(0, 8));
console.log("dokumentasi:", hitung((b) => b.dokumentasi));
