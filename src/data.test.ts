import { describe, expect, it } from "vitest";
import { BAHASA, DAERAH, cariBahasa, hitungStatus, namaAsli, namaTampil, rumpunOf, rumpunTeratas, terdekat } from "./data";

const bahasa = (nama: string) => BAHASA.find((b) => b.nama === nama)!;

describe("data Glottolog", () => {
  it("727 bahasa ibu lisan di Indonesia, semuanya berkoordinat", () => {
    expect(BAHASA).toHaveLength(727);
    expect(BAHASA.every((b) => Number.isFinite(b.lat) && Number.isFinite(b.lon))).toBe(true);
    expect(BAHASA.every((b) => b.negara.includes("ID"))).toBe(true);
  });

  it("jumlah per status sama dengan jumlah bahasa", () => {
    const n = hitungStatus(BAHASA);
    expect(Object.values(n).reduce((a, b) => a + b, 0)).toBe(BAHASA.length);
    expect(n[6]).toBeGreaterThan(0);
  });

  it("Jawa, Sunda, dan Indonesia aman; Minangkabau rentan", () => {
    expect(bahasa("Javanese").status).toBe(1);
    expect(bahasa("Sundanese").status).toBe(1);
    expect(bahasa("Standard Indonesian").status).toBe(1);
    expect(bahasa("Minangkabau").status).toBe(2);
  });

  it("rumpun: Austronesia terbanyak, bahasa Papua mayoritas di wilayah Papua", () => {
    expect(rumpunTeratas(1)[0].nama).toBe("Austronesian");
    const papua = BAHASA.filter((b) => b.wilayah === "Papua");
    expect(papua.filter((b) => rumpunOf(b) === "papua").length).toBeGreaterThan(papua.length / 2);
    expect(rumpunOf(bahasa("Javanese"))).toBe("austronesia");
  });
});

describe("nama dan pencarian", () => {
  it("nama Indonesia untuk bahasa yang dikenal, nama Glottolog untuk yang lain", () => {
    expect(namaTampil(bahasa("Javanese"))).toBe("Jawa");
    expect(namaAsli(bahasa("Javanese"))).toBe("Javanese");
    expect(namaTampil(bahasa("Gayo"))).toBe("Gayo");
    expect(namaAsli(bahasa("Gayo"))).toBeNull();
  });

  it("cari dengan nama Indonesia, nama Glottolog, atau kode ISO", () => {
    expect(namaTampil(cariBahasa("jawa")[0])).toBe("Jawa");
    expect(cariBahasa("Javanese")[0].nama).toBe("Javanese");
    expect(cariBahasa("jav")[0].iso).toBe("jav");
    expect(cariBahasa("")).toEqual([]);
  });

  it("bahasa terdekat terurut menurut jarak", () => {
    const d = DAERAH.find((x) => x.id === "kota-yogyakarta")!;
    const dekat = terdekat(d, 10);
    expect(dekat).toHaveLength(10);
    for (let i = 1; i < dekat.length; i++) expect(dekat[i].jarak).toBeGreaterThanOrEqual(dekat[i - 1].jarak);
  });
});
