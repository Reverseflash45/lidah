import type { Feature, FeatureCollection, Geometry, MultiLineString } from "geojson";
import { geoMercator, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { type Bahasa, type BahasaDekat, BAHASA, type Daerah, NAMA_RUMPUN, NAMA_STATUS, type Status, URUT_STATUS, WILAYAH, namaTampil, rumpunOf, statusOf } from "./data";

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const angka = (n: number) => n.toLocaleString("id-ID");
const persen = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;

export function buatTip(wadah: HTMLElement) {
  const el = document.createElement("div");
  el.className = "tip";
  el.hidden = true;
  wadah.append(el);
  return {
    tampil(x: number, y: number, html: string) {
      el.innerHTML = html;
      el.hidden = false;
      const w = el.offsetWidth;
      const kiri = x + 14 + w > wadah.clientWidth ? x - 14 - w : x + 14;
      el.style.left = `${Math.max(0, kiri)}px`;
      el.style.top = `${Math.max(0, y - el.offsetHeight - 10)}px`;
    },
    sembunyi() {
      el.hidden = true;
    },
  };
}

export const kelasWarna = (b: Bahasa, warna: "status" | "rumpun") => (warna === "status" ? `s-${statusOf(b)}` : `r-${rumpunOf(b)}`);
export const isiTip = (b: Bahasa) =>
  `<b>${esc(namaTampil(b))}</b><br>${NAMA_STATUS[statusOf(b)]} · ${esc(b.rumpun === "Austronesian" ? "Austronesia" : b.rumpun)}<br><span class="redup">${esc(b.wilayah)}</span>`;

/* ---------- peta ---------- */
type Prop = { id: string };
export type Peta = { darat: FeatureCollection<Geometry, Prop>; batas: MultiLineString };

export async function muatPeta(): Promise<Peta> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/peta.json`);
  const topo = (await r.json()) as Topology<{ daerah: GeometryCollection<Prop> }>;
  return {
    darat: feature(topo, topo.objects.daerah) as FeatureCollection<Geometry, Prop>,
    batas: mesh(topo, topo.objects.daerah, (a, b) => a !== b) as MultiLineString,
  };
}

/** Titik bahasa terdekat dengan penunjuk dalam radius tertentu. */
function titikTerdekat(pos: Map<string, [number, number]>, px: number, py: number, radius: number): string | null {
  let hasil: string | null = null;
  let jarak = radius;
  for (const [id, [x, y]] of pos) {
    const d = Math.hypot(x - px, y - py);
    if (d < jarak) [hasil, jarak] = [id, d];
  }
  return hasil;
}

export function gambarPetaBesar(wadah: HTMLElement, peta: Peta, warna: "status" | "rumpun", terpilih: string | null, pilih: (id: string) => void): void {
  const lebar = Math.max(300, wadah.clientWidth);
  const hp = lebar < 600;
  const tepi = hp ? 10 : 20;
  // Peta dipaskan ke wilayah Indonesia. Titik yang jauh di luarnya (misalnya Ternateño, yang oleh Glottolog
  // ditaruh di Filipina) tetap dihitung, tetapi jatuh di luar bingkai.
  const diDalam = BAHASA.filter((b) => b.lat > -11.5 && b.lat < 6.5 && b.lon > 94 && b.lon < 142);
  const semua: FeatureCollection = {
    type: "FeatureCollection",
    features: [...peta.darat.features, { type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates: diDalam.map((b) => [b.lon, b.lat]) } }],
  };
  const proyeksi = geoMercator().fitWidth(lebar - 2 * tepi, semua);
  const [[x0, y0], [, y1]] = geoPath(proyeksi).bounds(semua);
  const [tx, ty] = proyeksi.translate();
  proyeksi.translate([tx - x0 + tepi, ty - y0 + tepi]);
  const tinggi = Math.ceil(y1 - y0 + 2 * tepi);
  const jalur = geoPath(proyeksi);
  const r = hp ? 2.6 : 3.8;
  const pos = new Map<string, [number, number]>();
  // Bahasa yang lebih terancam digambar belakangan supaya tidak tertutup.
  const urut = [...BAHASA].sort((a, b) => (warna === "status" ? statusOf(a) - statusOf(b) : rumpunOf(a).localeCompare(rumpunOf(b))));
  const titik = urut
    .map((b) => {
      const [x, y] = proyeksi([b.lon, b.lat])!;
      pos.set(b.id, [x, y]);
      return `<circle class="titik ${kelasWarna(b, warna)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`;
    })
    .join("");
  const pilihan = terpilih ? pos.get(terpilih) : null;
  wadah.style.height = `${tinggi}px`;
  wadah.innerHTML = `<svg viewBox="0 0 ${lebar} ${tinggi}" width="${lebar}" height="${tinggi}" overflow="hidden">
    <path class="darat" d="${jalur(peta.darat) ?? ""}"/>
    <g>${titik}</g>
    ${pilihan ? `<circle class="cincin-pilih" cx="${pilihan[0]}" cy="${pilihan[1]}" r="${r + 6}"/>` : ""}
  </svg>`;
  const svg = wadah.querySelector("svg")!;
  const tip = buatTip(wadah);
  const indeks = new Map(BAHASA.map((b) => [b.id, b]));
  const temukan = (e: PointerEvent | MouseEvent) => {
    const k = svg.getBoundingClientRect();
    return titikTerdekat(pos, e.clientX - k.left, e.clientY - k.top, hp ? 16 : 10);
  };
  svg.addEventListener("pointermove", (e) => {
    const id = temukan(e);
    svg.style.cursor = id ? "pointer" : "";
    if (!id) return tip.sembunyi();
    const [x, y] = pos.get(id)!;
    tip.tampil(x, y, isiTip(indeks.get(id)!));
  });
  svg.addEventListener("pointerleave", () => tip.sembunyi());
  svg.addEventListener("click", (e) => {
    const id = temukan(e);
    if (id) pilih(id);
  });
}

export function gambarPetaKecil(wadah: HTMLElement, peta: Peta, d: Daerah, dekat: BahasaDekat[]): void {
  const lebar = Math.max(280, wadah.clientWidth);
  const tinggi = Math.round(Math.min(lebar, 420) * 0.85);
  const titikDaerah = d.titik as [number, number];
  const kumpulan: FeatureCollection = {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates: [titikDaerah, ...dekat.map((b) => [b.lon, b.lat])] } }],
  };
  const proyeksi = geoMercator().fitExtent(
    [
      [36, 30],
      [lebar - 36, tinggi - 30],
    ],
    kumpulan,
  );
  // Jangan memperbesar berlebihan bila semua titik berdekatan.
  if (proyeksi.scale() > 40000) proyeksi.scale(40000).center(titikDaerah).translate([lebar / 2, tinggi / 2]);
  const jalur = geoPath(proyeksi);
  const wilayah = peta.darat.features.find((f) => f.properties.id === d.id) as Feature | undefined;
  const [cx, cy] = proyeksi(titikDaerah)!;
  wadah.innerHTML = `<svg viewBox="0 0 ${lebar} ${tinggi}" width="${lebar}" height="${tinggi}" aria-hidden="true">
    <defs><clipPath id="potong"><rect width="${lebar}" height="${tinggi}"/></clipPath></defs>
    <g clip-path="url(#potong)">
      <path class="darat" d="${jalur(peta.darat) ?? ""}"/>
      <path class="batas" d="${jalur(peta.batas) ?? ""}"/>
      ${wilayah ? `<path class="wilayah-pilih" d="${jalur(wilayah) ?? ""}"/>` : ""}
      ${dekat
        .map((b, i) => {
          const [x, y] = proyeksi([b.lon, b.lat])!;
          return `<line class="garis-dekat" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><circle class="titik besar ${kelasWarna(b, "status")}" cx="${x}" cy="${y}" r="9"/><text class="nomor" x="${x}" y="${y - 13}" text-anchor="middle">${i + 1}</text>`;
        })
        .join("")}
      <rect class="pusat" x="${cx - 5}" y="${cy - 5}" width="10" height="10" transform="rotate(45 ${cx} ${cy})"/>
    </g>
  </svg>`;
}

/* ---------- batang status ---------- */
export function gambarBatangStatus(wadah: HTMLElement, n: Record<Status, number>, total: number): void {
  wadah.innerHTML = `<div class="segmen">${URUT_STATUS.filter((s) => n[s] > 0)
    .map((s) => `<span class="s-${s}" style="flex:${n[s]}" title="${NAMA_STATUS[s]}: ${n[s]}"></span>`)
    .join("")}</div>
    <ul class="label-segmen">${URUT_STATUS.filter((s) => n[s] > 0)
      .map((s) => `<li><i class="s-${s}"></i><strong>${angka(n[s])}</strong> ${NAMA_STATUS[s].toLowerCase()}</li>`)
      .join("")}</ul>`;
  wadah.setAttribute("aria-label", `${total} bahasa menurut status: ${URUT_STATUS.map((s) => `${NAMA_STATUS[s]} ${n[s]}`).join(", ")}`);
}

/* ---------- per wilayah ---------- */
export function gambarWilayah(wadah: HTMLElement, hitung: (b: readonly Bahasa[]) => Record<Status, number>): void {
  const baris = WILAYAH.map((w) => {
    const daftar = BAHASA.filter((b) => b.wilayah === w);
    return { w, total: daftar.length, n: hitung(daftar) };
  });
  const maks = Math.max(...baris.map((b) => b.total));
  wadah.innerHTML = baris
    .map(
      ({ w, total, n }) => `<div class="baris-wilayah">
        <div class="nama-wilayah"><strong>${w}</strong><span>${angka(total)} bahasa</span></div>
        <div class="jalur-wilayah" style="--lebar:${(total / maks) * 100}%">
          ${URUT_STATUS.filter((s) => n[s] > 0)
            .map((s) => `<span class="s-${s}" style="flex:${n[s]}" data-tip="${esc(`<b>${w}</b><br>${NAMA_STATUS[s]}: ${n[s]} bahasa (${persen(n[s], total)})`)}"></span>`)
            .join("")}
        </div>
        <div class="angka-wilayah">${persen(n[3] + n[4] + n[5] + n[6], total)} <span>terancam atau punah</span></div>
      </div>`,
    )
    .join("");
  const tip = buatTip(wadah);
  wadah.addEventListener("pointermove", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (!el) return tip.sembunyi();
    const k = wadah.getBoundingClientRect();
    tip.tampil(e.clientX - k.left, e.clientY - k.top, el.dataset.tip!);
  });
  wadah.addEventListener("pointerleave", () => tip.sembunyi());
}

/* ---------- rumpun ---------- */
export function gambarRumpun(wadah: HTMLElement, daftar: { nama: string; jumlah: number }[]): void {
  const maks = Math.max(...daftar.map((d) => d.jumlah));
  wadah.innerHTML = `<p class="label">Rumpun non-Austronesia terbesar</p><ol class="batang-rumpun">${daftar
    .map(
      (d) => `<li><span class="nama-rumpun">${esc(d.nama)}</span><span class="jalur-rumpun"><span class="isi r-papua" style="width:${(d.jumlah / maks) * 100}%"></span><span class="nilai">${d.jumlah}</span></span></li>`,
    )
    .join("")}</ol>`;
}

export const legendaRumpun = () => (["austronesia", "papua"] as const).map((r) => `<li><i class="r-${r}"></i>${NAMA_RUMPUN[r]}</li>`).join("");
export const legendaStatus = () => URUT_STATUS.map((s) => `<li><i class="s-${s}"></i>${NAMA_STATUS[s]}</li>`).join("");
