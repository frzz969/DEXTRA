/* Cek cakupan kamus.
 *
 * Memindai app/ dan components/ untuk setiap pemanggilan t("...") lalu
 * melaporkan teks yang belum punya terjemahan di salah satu kamus. Teks yang
 * belum diterjemahkan TIDAK menggagalkan render — ia tampil apa adanya — jadi
 * tanpa alat ini kekurangannya tidak terlihat sampai ada yang membaca halaman
 * dalam bahasa Inggris.
 *
 * Pemakaian, dari apps/web:
 *   node scripts/check-i18n.mjs          # ringkas
 *   node scripts/check-i18n.mjs --all    # tampilkan semua kunci yang hilang
 *
 * Selalu keluar dengan kode 0: laporan ini untuk dibaca manusia, bukan gerbang.
 * Teks berbahasa Inggris yang "hilang dari kamus en" memang normal — ia jatuh
 * ke dirinya sendiri. Yang perlu diperhatikan adalah teks berbahasa Indonesia
 * yang belum punya entri en, karena itulah yang tampil sebagai bahasa campur
 * pada mode default. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components"];
const DICT_DIR = join(ROOT, "lib", "i18n");
const SHOW_ALL = process.argv.includes("--all");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      out.push(...walk(full));
    } else if (/\.(tsx|ts)$/.test(entry) && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/* Ambil isi kamus dari berkas .ts: baris berbentuk `kunci: "nilai"` atau
 * `"kunci": "nilai"`. Cukup untuk kamus datar yang kita tulis tangan; bukan
 * parser TypeScript dan tidak perlu jadi. */
function loadKeys(file) {
  const source = readFileSync(file, "utf8");
  const keys = new Set();
  const re = /^\s{2}(?:"((?:[^"\\]|\\.)*)"|([A-Za-z_$][\w$]*))\s*:/gm;
  let match;
  while ((match = re.exec(source)) !== null) {
    keys.add(match[1] !== undefined ? match[1].replace(/\\"/g, '"') : match[2]);
  }
  return keys;
}

const en = loadKeys(join(DICT_DIR, "en.ts"));
const id = loadKeys(join(DICT_DIR, "id.ts"));

/* Teks sumber yang dipakai di kode. */
const used = new Map(); // key -> Set(path)
for (const dir of SCAN_DIRS) {
  let files;
  try {
    files = walk(join(ROOT, dir));
  } catch {
    continue;
  }
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const re = /\bt\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g;
    let match;
    while ((match = re.exec(source)) !== null) {
      const key = match[1].replace(/\\"/g, '"');
      if (!used.has(key)) used.set(key, new Set());
      used.get(key).add(relative(ROOT, file).replace(/\\/g, "/"));
    }
  }
}

/* Teks berbahasa Indonesia yang wajib punya entri Inggris, dan teks berbahasa
 * Inggris yang wajib punya entri Indonesia. Menebak bahasa dari bentuk kata
 * tidak mungkin akurat, jadi dilaporkan terpisah: kunci yang hilang di en
 * adalah yang paling merusak (bahasa default), kunci yang hilang di id hanya
 * membuat sebagian teks tetap Inggris saat pengguna memilih Indonesia. */
const missingEn = [];
const missingId = [];
for (const key of used.keys()) {
  if (!en.has(key)) missingEn.push(key);
  if (!id.has(key)) missingId.push(key);
}

const total = used.size;
console.log(`kunci dipakai di kode : ${total}`);
console.log(`entri kamus en        : ${en.size}`);
console.log(`entri kamus id        : ${id.size}`);
console.log(`belum ada di en       : ${missingEn.length}`);
console.log(`belum ada di id       : ${missingId.length}`);

const print = (label, list) => {
  if (list.length === 0) return;
  const shown = SHOW_ALL ? list : list.slice(0, 25);
  console.log(`\n${label}${SHOW_ALL ? "" : ` (25 pertama dari ${list.length})`}:`);
  for (const key of shown) console.log(`  · ${key}`);
};

print("Tanpa terjemahan Inggris", missingEn.sort());
print("Tanpa padanan Indonesia", missingId.sort());

process.exit(0);
