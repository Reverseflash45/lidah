import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/hanken-grotesk";
import "./gaya.css";
import {
  type Bahasa,
  BAHASA,
  DAERAH,
  type Daerah,
  NAMA_DOKUMENTASI,
  NAMA_STATUS,
  PENJELASAN_STATUS,
  SITASI,
  VERSI,
  WILAYAH,
  cariBahasa,
  cariDaerah,
  hitungStatus,
  namaAsli,
  namaTampil,
  rumpunOf,
  rumpunTeratas,
  statusOf,
  terdekat,
} from "./data";
import { type Peta, esc, gambarBatangStatus, gambarPetaBesar, gambarPetaKecil, gambarRumpun, gambarWilayah, legendaRumpun, legendaStatus, muatPeta } from "./vis";

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends Element = HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];
const angka = (n: number) => n.toLocaleString("id-ID");

/* ---------- keadaan ---------- */
const hash = new URLSearchParams(location.hash.slice(1));
const cariId = (id: string | null) => BAHASA.find((b) => b.id === id) ?? null;
let bahasaTerpilih: Bahasa = cariId(hash.get("bahasa")) ?? BAHASA.find((b) => b.nama === "Javanese")!;
let daerahTerpilih: Daerah = DAERAH.find((d) => d.id === hash.get("daerah")) ?? DAERAH.find((d) => d.id === "kota-jayapura")!;
let warna: "status" | "rumpun" = "status";
let terpilihPeta: string | null = null;
let peta: Peta | null = null;

function simpanHash() {
  history.replaceState(null, "", `#bahasa=${bahasaTerpilih.id}&daerah=${daerahTerpilih.id}`);
}

/* ---------- kartu bahasa ---------- */
const NEGARA: Record<string, string> = {
  ID: "Indonesia",
  PG: "Papua Nugini",
  TL: "Timor Leste",
  MY: "Malaysia",
  BN: "Brunei",
  SG: "Singapura",
  PH: "Filipina",
  NL: "Belanda",
  US: "Amerika Serikat",
  SA: "Arab Saudi",
  AU: "Australia",
  TH: "Thailand",
};

function isiKartu(b: Bahasa): string {
  const s = statusOf(b);
  const asli = namaAsli(b);
  const jalur = b.jalur.map((n, i) => (i === 0 && n === "Austronesian" ? "Austronesia" : n));
  const lain = b.negara.filter((n) => n !== "ID");
  const d = DAERAH[b.daerah];
  return `
    <div class="kartu-kepala">
      <h3>${esc(namaTampil(b))}</h3>
      <span class="pil"><i class="s-${s}"></i>${NAMA_STATUS[s]}</span>
    </div>
    <p class="kode">${asli ? `Glottolog: ${esc(asli)} · ` : ""}${b.iso ? `ISO 639-3 <b>${b.iso}</b> · ` : ""}glottocode <b>${b.id}</b></p>
    <p class="penjelasan">${PENJELASAN_STATUS[s]}</p>
    <p class="label">Silsilah</p>
    <ol class="silsilah">${jalur.length ? jalur.map((n) => `<li>${esc(n)}</li>`).join("") : `<li>${b.rumpun === "Isolat" ? "Isolat: tidak punya kerabat yang diketahui" : esc(b.rumpun)}</li>`}<li class="ujung">${esc(namaTampil(b))}</li></ol>
    <dl class="fakta">
      <div><dt>Wilayah</dt><dd>${esc(b.wilayah)}, dekat ${esc(d.nama)}</dd></div>
      <div><dt>Dokumentasi terlengkap</dt><dd>${b.dokumentasi != null ? NAMA_DOKUMENTASI[b.dokumentasi] : "—"}</dd></div>
      ${lain.length ? `<div><dt>Juga dituturkan di</dt><dd>${lain.map((n) => NEGARA[n] ?? n).join(", ")}</dd></div>` : ""}
    </dl>
    <p class="tautan-luar"><a href="https://glottolog.org/resource/languoid/id/${b.id}" rel="noopener">Lihat di Glottolog →</a></p>`;
}

function tampilKartuBahasa(b: Bahasa) {
  bahasaTerpilih = b;
  $("[data-kartu]").innerHTML = isiKartu(b);
  masukBahasa.value = namaTampil(b);
  simpanHash();
}

/* ---------- pembuka ---------- */
function gambarPembuka() {
  const n = hitungStatus(BAHASA);
  $("[data-total]").textContent = angka(BAHASA.length);
  $("[data-aman]").textContent = angka(n[1]);
  $("[data-versi]").textContent = VERSI.replace(/^v/, "");
  gambarBatangStatus($("[data-batang-status]"), n, BAHASA.length);
}

function gambarPeta() {
  $("[data-legenda]").innerHTML = warna === "status" ? legendaStatus() : legendaRumpun();
  $$<HTMLButtonElement>("[data-warna]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.warna === warna)));
  if (!peta) return;
  gambarPetaBesar($("#peta"), peta, warna, terpilihPeta, (id) => {
    terpilihPeta = id;
    const b = cariId(id)!;
    const kartu = $("[data-kartu-peta]");
    kartu.hidden = false;
    kartu.innerHTML = isiKartu(b);
    gambarPeta();
  });
}
$$<HTMLButtonElement>("[data-warna]").forEach((b) =>
  b.addEventListener("click", () => {
    warna = b.dataset.warna as typeof warna;
    gambarPeta();
  }),
);

/* ---------- wilayah ---------- */
function gambarBagianWilayah() {
  const papua = BAHASA.filter((b) => b.wilayah === "Papua");
  const persenTerancam = (w: string) => {
    const d = BAHASA.filter((b) => b.wilayah === w);
    return d.filter((b) => statusOf(b) >= 3).length / d.length;
  };
  const paling = [...WILAYAH].sort((a, b) => persenTerancam(b) - persenTerancam(a))[0];
  $("[data-pengantar-wilayah]").textContent =
    `Papua sendiri punya ${angka(papua.length)} bahasa, ${Math.round((papua.length / BAHASA.length) * 100)}% dari seluruh bahasa di Indonesia. ` +
    `Bagian yang terancam atau sudah punah paling besar di ${paling}: ${Math.round(persenTerancam(paling) * 100)}% bahasanya. ` +
    `Jawa dan Bali hanya punya sedikit bahasa, tetapi di antaranya ada Jawa dan Sunda, yang masing-masing dituturkan puluhan juta orang.`;
  gambarWilayah($("[data-wilayah]"), hitungStatus);
}

/* ---------- daerahmu ---------- */
function gambarDaerah() {
  const dekat = terdekat(daerahTerpilih, 8);
  $("[data-dekat]").innerHTML = dekat
    .map(
      (b) => `<li><button type="button" class="tautan" data-buka="${b.id}">${esc(namaTampil(b))}</button>
        <span class="rinci"><i class="s-${statusOf(b)}"></i>${NAMA_STATUS[statusOf(b)]} · ${b.rumpun === "Austronesian" ? "Austronesia" : esc(b.rumpun)} · ${angka(Math.round(b.jarak))} km</span></li>`,
    )
    .join("");
  if (peta) gambarPetaKecil($("#peta-kecil"), peta, daerahTerpilih, dekat);
  masukDaerah.value = daerahTerpilih.nama;
}
$("[data-dekat]").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-buka]");
  if (!b) return;
  tampilKartuBahasa(cariId(b.dataset.buka!)!);
  $("#cari").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});

/* ---------- rumpun ---------- */
function gambarBagianRumpun() {
  const austronesia = BAHASA.filter((b) => rumpunOf(b) === "austronesia").length;
  const papua = BAHASA.length - austronesia;
  const keluargaPapua = new Set(BAHASA.filter((b) => rumpunOf(b) === "papua" && b.rumpun !== "Isolat" && b.rumpun !== "Tidak terklasifikasi").map((b) => b.rumpun)).size;
  const isolat = BAHASA.filter((b) => b.rumpun === "Isolat").length;
  $("[data-rumpun-teks]").innerHTML = `
    <p class="angka-besar r-austronesia-teks">${angka(austronesia)}</p>
    <p>bahasa termasuk rumpun <strong>Austronesia</strong>, keluarga bahasa yang tersebar dari Madagaskar sampai Pulau Paskah. Jawa, Sunda, Bugis, Bali, dan Indonesia sendiri termasuk di dalamnya.</p>
    <p class="angka-besar r-papua-teks">${angka(papua)}</p>
    <p>sisanya bukan Austronesia. "Bahasa Papua" bukan satu rumpun, melainkan <strong>${keluargaPapua} rumpun</strong> yang tidak terbukti berkerabat satu sama lain, ditambah <strong>${isolat} bahasa isolat</strong> yang tidak punya kerabat sama sekali. Sebagian besar ada di Papua, tetapi juga di Halmahera, Timor, Alor, dan Pantar.</p>`;
  gambarRumpun(
    $("[data-rumpun]"),
    rumpunTeratas(30)
      .filter((r) => r.rumpun === "papua" && r.nama !== "Isolat" && r.nama !== "Tidak terklasifikasi")
      .slice(0, 10),
  );
}

/* ---------- combobox ---------- */
function pasangCombo<T>(masuk: HTMLInputElement, daftarEl: HTMLUListElement, cari: (q: string) => T[], label: (x: T) => [string, string], pilih: (x: T) => void, nilaiAwal: () => string) {
  let saran: T[] = [];
  let aktif = -1;
  const tutup = () => {
    daftarEl.hidden = true;
    masuk.setAttribute("aria-expanded", "false");
    masuk.removeAttribute("aria-activedescendant");
  };
  const sorot = () => {
    daftarEl.querySelectorAll("[role=option]").forEach((li, i) => li.setAttribute("aria-selected", String(i === aktif)));
    if (aktif >= 0) masuk.setAttribute("aria-activedescendant", `${daftarEl.id}-${aktif}`);
  };
  const ambil = (x: T) => {
    pilih(x);
    tutup();
    masuk.blur();
  };
  masuk.addEventListener("focus", () => masuk.select());
  masuk.addEventListener("input", () => {
    saran = cari(masuk.value);
    aktif = saran.length ? 0 : -1;
    daftarEl.innerHTML = saran.length
      ? saran
          .map((x, i) => {
            const [a, b] = label(x);
            return `<li role="option" id="${daftarEl.id}-${i}" data-i="${i}" aria-selected="${i === aktif}"><span>${esc(a)}</span><small>${esc(b)}</small></li>`;
          })
          .join("")
      : `<li aria-disabled="true">Tidak ada yang cocok</li>`;
    daftarEl.hidden = !masuk.value.trim();
    masuk.setAttribute("aria-expanded", String(!daftarEl.hidden));
    sorot();
  });
  masuk.addEventListener("keydown", (e) => {
    if (daftarEl.hidden || !saran.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      aktif = (aktif + (e.key === "ArrowDown" ? 1 : -1) + saran.length) % saran.length;
      sorot();
      e.preventDefault();
    } else if (e.key === "Escape") tutup();
  });
  masuk.addEventListener("blur", () =>
    setTimeout(() => {
      tutup();
      masuk.value = nilaiAwal();
    }, 150),
  );
  daftarEl.addEventListener("mousedown", (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
    if (!li) return;
    e.preventDefault();
    ambil(saran[Number(li.dataset.i)]);
  });
  masuk.form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (aktif >= 0 && saran[aktif]) ambil(saran[aktif]);
  });
}

const masukDaerah = $<HTMLInputElement>("#daerah");
const masukBahasa = $<HTMLInputElement>("#bahasa");
pasangCombo(
  masukDaerah,
  $<HTMLUListElement>("#saran-daerah"),
  cariDaerah,
  (d) => [d.nama, d.prov],
  (d) => {
    daerahTerpilih = d;
    simpanHash();
    gambarDaerah();
  },
  () => daerahTerpilih.nama,
);
pasangCombo(
  masukBahasa,
  $<HTMLUListElement>("#saran-bahasa"),
  cariBahasa,
  (b) => [namaTampil(b), `${NAMA_STATUS[statusOf(b)]} · ${b.wilayah}`],
  tampilKartuBahasa,
  () => namaTampil(bahasaTerpilih),
);

/* ---------- ukuran layar & tema ---------- */
let lebarTerakhir = 0;
new ResizeObserver(([e]) => {
  const w = Math.round(e.contentRect.width);
  if (!lebarTerakhir) {
    lebarTerakhir = w;
    return;
  }
  if (w === lebarTerakhir) return;
  lebarTerakhir = w;
  gambarPeta();
  gambarDaerah();
}).observe(document.querySelector("main")!);

/* ---------- mulai ---------- */
$("[data-sitasi]").innerHTML = `Data bahasa: ${esc(SITASI)} (<a href="https://glottolog.org">glottolog.org</a>, CC BY 4.0).`;
gambarPembuka();
gambarPeta();
gambarBagianWilayah();
gambarDaerah();
gambarBagianRumpun();
tampilKartuBahasa(bahasaTerpilih);
muatPeta()
  .then((p) => {
    peta = p;
    gambarPeta();
    gambarDaerah();
  })
  .catch(() => {
    $("#peta").innerHTML = `<p class="gagal">Peta gagal dimuat. Muat ulang halaman.</p>`;
  });
