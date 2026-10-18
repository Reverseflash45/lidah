import dataBahasa from "./data/bahasa.json";
import dataDaerah from "./data/daerah.json";

export type Daerah = (typeof dataDaerah.daerah)[number];
export const DAERAH: readonly Daerah[] = dataDaerah.daerah;

export type Bahasa = (typeof dataBahasa.bahasa)[number];
export const BAHASA: readonly Bahasa[] = dataBahasa.bahasa;
export const VERSI = dataBahasa.versi;
export const SITASI = dataBahasa.sitasi;

/* ---------- status keterancaman (Agglomerated Endangerment Status Glottolog) ---------- */
export type Status = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** Padanan istilah UNESCO. 0 = tidak ada data. */
export const NAMA_STATUS: Record<Status, string> = {
  0: "Tidak ada data",
  1: "Aman",
  2: "Rentan",
  3: "Terancam",
  4: "Sangat terancam",
  5: "Kritis",
  6: "Punah",
};
export const PENJELASAN_STATUS: Record<Status, string> = {
  0: "Glottolog belum punya data keterancaman untuk bahasa ini.",
  1: "Dituturkan semua generasi dan diwariskan ke anak-anak.",
  2: "Sebagian besar anak masih menuturkannya, tetapi di ranah terbatas, misalnya di rumah.",
  3: "Anak-anak tidak lagi belajar bahasa ini sebagai bahasa ibu.",
  4: "Hanya dituturkan generasi kakek-nenek; orang tua mengerti tetapi tidak memakainya ke anak.",
  5: "Penutur termuda sudah kakek-nenek, dan mereka pun jarang memakainya.",
  6: "Tidak ada lagi penutur.",
};
export const URUT_STATUS: Status[] = [1, 2, 3, 4, 5, 6, 0];
export const statusOf = (b: Bahasa) => b.status as Status;

/* ---------- rumpun ---------- */
export type Rumpun = "austronesia" | "papua";
/** Austronesia lawan semua yang lain: rumpun-rumpun Papua, isolat, dan yang belum terklasifikasi. */
export const rumpunOf = (b: Bahasa): Rumpun => (b.rumpun === "Austronesian" ? "austronesia" : "papua");
export const NAMA_RUMPUN: Record<Rumpun, string> = { austronesia: "Austronesia", papua: "Papua (non-Austronesia)" };

/* ---------- wilayah ---------- */
export const WILAYAH = ["Sumatra", "Jawa & Bali", "Kalimantan", "Nusa Tenggara", "Sulawesi", "Maluku", "Papua"] as const;
export type Wilayah = (typeof WILAYAH)[number];

/* ---------- nama ---------- */
/** Padanan Indonesia untuk nama Glottolog yang umum dikenal; selebihnya memakai nama Glottolog. */
const NAMA_INDONESIA: Record<string, string> = {
  "Standard Indonesian": "Indonesia",
  Javanese: "Jawa",
  Sundanese: "Sunda",
  Madurese: "Madura",
  Balinese: "Bali",
  Buginese: "Bugis",
  Makasar: "Makassar",
  Acehnese: "Aceh",
  "Toraja-Sa'dan": "Toraja Sa'dan",
  Kawi: "Kawi (Jawa Kuno)",
  "Old Malay": "Melayu Kuno",
  "Ambonese Malay": "Melayu Ambon",
  "Papuan Malay": "Melayu Papua",
  "Manado Malay": "Melayu Manado",
  "Kupang Malay": "Melayu Kupang",
  "Jambi Malay": "Melayu Jambi",
  "Central Malay": "Melayu Tengah",
  "Makassar Malay": "Melayu Makassar",
  "North Moluccan Malay": "Melayu Maluku Utara",
  "Larantuka Malay": "Melayu Larantuka",
  "Banda Malay": "Melayu Banda",
  "Bacanese Malay": "Melayu Bacan",
  "Berau Malay": "Melayu Berau",
  "Western Dani": "Dani Barat",
};
export const namaTampil = (b: Bahasa) => NAMA_INDONESIA[b.nama] ?? b.nama;
/** Nama Glottolog bila berbeda dari nama tampilan. */
export const namaAsli = (b: Bahasa) => (NAMA_INDONESIA[b.nama] ? b.nama : null);

export const NAMA_DOKUMENTASI = ["Tata bahasa panjang", "Tata bahasa", "Sketsa tata bahasa", "Fonologi atau teks", "Daftar kata atau kurang"];

/* ---------- jarak ---------- */
const rad = (d: number) => (d * Math.PI) / 180;
export function jarakKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type BahasaDekat = Bahasa & { jarak: number };
/** Bahasa diurutkan dari yang titiknya paling dekat ke titik tengah daerah. */
export function terdekat(d: Daerah, n = 8): BahasaDekat[] {
  const [lon, lat] = d.titik;
  return BAHASA.map((b) => ({ ...b, jarak: jarakKm(lat, lon, b.lat, b.lon) }))
    .sort((a, b) => a.jarak - b.jarak)
    .slice(0, n);
}

/* ---------- ringkasan ---------- */
export function hitungStatus(daftar: readonly Bahasa[]): Record<Status, number> {
  const n = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<Status, number>;
  for (const b of daftar) n[statusOf(b)]++;
  return n;
}

/** Rumpun teratas menurut jumlah bahasa (nama Glottolog tingkat teratas). */
export function rumpunTeratas(n: number): { nama: string; jumlah: number; rumpun: Rumpun }[] {
  const m = new Map<string, number>();
  for (const b of BAHASA) m.set(b.rumpun, (m.get(b.rumpun) ?? 0) + 1);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([nama, jumlah]) => ({ nama, jumlah, rumpun: nama === "Austronesian" ? "austronesia" : "papua" }));
}

/* ---------- cari ---------- */
export const normal = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(kabupaten|kab\.?|kota|bahasa)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function cari<T>(daftar: readonly T[], q: string, kunci: (x: T) => string[], batas: number): T[] {
  const k = normal(q);
  if (!k) return [];
  const nilai = (x: T) => {
    let terbaik = 9;
    for (const s of kunci(x).map(normal)) terbaik = Math.min(terbaik, s === k ? 0 : s.startsWith(k) ? 1 : s.includes(k) ? 2 : 9);
    return terbaik;
  };
  return daftar
    .map((x) => [x, nilai(x)] as const)
    .filter(([, v]) => v < 9)
    .sort((a, b) => a[1] - b[1])
    .slice(0, batas)
    .map(([x]) => x);
}

export const cariDaerah = (q: string) => cari(DAERAH, q, (d) => [d.nama, d.prov], 8);
export const cariBahasa = (q: string) => cari(BAHASA, q, (b) => [namaTampil(b), b.nama, b.iso ?? "", b.id], 8);
