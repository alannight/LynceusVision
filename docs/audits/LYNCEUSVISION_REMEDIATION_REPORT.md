# LynceusVision Remediation Report

Tanggal Implementasi: 20 Oktober 2026

## Ringkasan Eksekutif

Seluruh perbaikan langsung (*direct implementation*) terhadap defect fungsional, kelemahan keamanan, kelemahan reliabilitas, dan efisiensi database telah berhasil diterapkan pada codebase LynceusVision. Perbaikan diverifikasi melalui eksekusi pengujian riil di seluruh layer aplikasi:

- **Frontend:** 25/25 pengujian query-builder lulus (`node --test`), TypeScript compile check lulus (`tsc --noEmit`), ESLint lulus, dan production build Next.js 16 (`next build --webpack`) berhasil membuat static prerender tanpa error.
- **Backend:** 64/64 pengujian backend lulus (`pytest` pada Python 3.12.15), linter statis Ruff lulus (`ruff check app tests alembic`) dengan 0 error, dan migrasi Alembic 001–004 terverifikasi bersih.

---

## 1. Modul dan File yang Diubah

Berikut adalah daftar file yang dimodifikasi beserta tujuannya:

1. **`frontend/src/lib/search-query-builder.ts`**:
   - Memperbarui `validateDomain` dan `validateFiletype` dengan regex berbasis kelas Unicode (`\p{L}`, `\p{N}`) sehingga mendukung Internationalized Domain Names (IDN) dan Unicode hostnames (misal `münchen.de`, `россия.рф`) tanpa menolak karakter internasional yang valid.
   - Mempertahankan integritas input, isolasi operator, serta pelaporan peringatan operator yang tidak didokumentasikan oleh provider target.

2. **`frontend/src/lib/search-query-builder.test.mjs`**:
   - Menambahkan 3 suite pengujian regresi baru (total meningkat dari 22 menjadi 25 pengujian): pengujian domain Unicode/IDN, kesamaan query efektif antara Preview, Copy, Open, dan Save, serta retensi struktur filter saat berganti search provider.

3. **`backend/app/config.py`**:
   - Menambahkan penegakan konfigurasi produksi: lingkungan `production` menolak keras database SQLite (`sqlite+aiosqlite://`) dan mewajibkan PostgreSQL (`postgresql+asyncpg://`), mencegah penggantian database secara diam-diam.

4. **`backend/app/api/v1/investigations.py`**:
   - **Eliminasi N+1 Query**: Mengganti loop per-investigation count query dengan single subquery outer join (`Entity.investigation_id`), mereduksi puluhan query individual menjadi 1 SQL query efisien.
   - **Pagination**: Menambahkan parameter `limit` (1–100, default 50) dan `offset` (>= 0) pada endpoint `GET /api/v1/investigations`.

5. **`backend/app/api/v1/entities.py`**:
   - **Eliminasi N+1 Query**: Mengganti loop count observasi dengan subquery outer join pada `GET /api/v1/investigations/{id}/entities`.
   - **Pagination**: Menambahkan parameter `limit` dan `offset` pada `list_entities` dan `list_observations`.

6. **`backend/app/api/v1/search_queries.py`**:
   - **Validasi Enum Ketat**: Menambahkan validasi Pydantic (`@field_validator`) untuk `provider`, `category`, dan `status` agar input di luar set yang diizinkan ditolak dengan HTTP 422.
   - **Pagination**: Menambahkan parameter `limit` dan `offset` pada `GET /api/v1/search-queries`.

7. **`backend/tests/test_api_investigations.py`**:
   - Menambahkan `test_investigation_pagination` dan `test_production_config_rejects_sqlite`.

8. **`backend/tests/test_api_entities.py`**:
   - Menambahkan `test_entity_pagination` dan `test_entity_cross_user_isolation` (memastikan User B tidak dapat membaca, mengedit, atau menghapus entitas User A).

9. **`backend/tests/test_api_search_queries.py`**:
   - Menambahkan `test_search_query_rejects_invalid_enums`, `test_search_query_pagination`, dan `test_search_query_cross_user_isolation`.

---

## 2. Perbaikan Dorking Studio

### Representasi Terstruktur & Semantik Query
Query builder menggunakan representasi filter terorganisasi (`StructuredFilters`) sebagai *single source of truth*. Operator dan keyword tidak lagi dirangkai secara acak:
- Keyword tunggal dan alternatif keyword tidak diduplikasi di sekitar operator `site:` atau `filetype:`.
- Alternatif beberapa site dikelompokkan dalam kurung dengan `OR`: `(site:domain-a.test OR site:domain-b.test) KATA_KUNCI`.
- Alternatif tipe file dikelompokkan dengan `OR`: `(filetype:pdf OR filetype:docx) KATA_KUNCI`.
- Exclude terms menggunakan prefix `-` yang ditempatkan secara teratur di akhir query.
- Filter kosong (array kosong, spasi putih) diabaikan dan tidak menghasilkan query cacat.

### Contoh Perbandingan Semantik Query

| Skenario | Format Lama / Bermasalah | Format Bersih & Terstandarisasi Saat Ini |
|---|---|---|
| **Satu term, dua site** | `KATA_KUNCI site:domain-a OR KATA_KUNCI site:domain-b` | `(site:domain-a.test OR site:domain-b.test) KATA_KUNCI` |
| **Satu site, alternatif term** | Duplikasi keyword atau format tidak teratur | `site:upnvj.ac.id (cybersecurity OR "keamanan siber")` |
| **Dua filetype + keyword** | `filetype:pdf OR filetype:docx keyword` | `(filetype:pdf OR filetype:docx) keyword` |
| **Domain internasional (Unicode)** | Ditolak oleh validator domain | `site:münchen.de stadtverwaltung` (Diterima) |
| **Exact phrase + exclude** | Tanda kutip ganda rusak saat serialisasi | `"incident response" "security operations center" -job -vacancy` |

### Konsistensi Output
Nilai `queryText` efektif digunakan secara identik untuk:
1. Preview di antarmuka
2. Salin ke clipboard (`handleCopyQuery`)
3. Membuka URL provider eksternal (`handleOpenSearch` via parameter `q`)
4. Penyimpanan ke database (`handleSaveToInvestigation`)

---

## 3. Autentikasi, Otorisasi, dan Isolasi Data

- **Algoritma Hashing**: Menggunakan Argon2id via `pwdlib` untuk keamanan password tingkat tinggi.
- **Token JWT**: HS256 Bearer token dengan masa kedaluwarsa 30 menit.
- **Isolasi Row-Level**: Seluruh query database untuk `Investigation`, `Entity`, `Observation`, dan `SearchQuery` difilter berdasarkan `owner_id == user.id`. Percobaan akses lintas akun mengembalikan status HTTP 404 tanpa membocorkan eksistensi data milik pengguna lain.
- **Pengujian Keamanan**: Teruji lewat `test_investigation_isolated_between_accounts`, `test_entity_cross_user_isolation`, dan `test_search_query_cross_user_isolation`.

---

## 4. Perlindungan SSRF dan Pembatasan Ukuran Respons

- **Penyaringan Jaringan**: Modul `backend/app/security/ssrf.py` memblokir seluruh rentang IP privat RFC 1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.0/8, ::1/128), link-local (169.254.0.0/16, fe80::/10), cloud metadata (169.254.169.254), IPv6 ULA, dan IPv4-mapped IPv6.
- **Resolusi DNS Asinkron**: Menggunakan `validate_target_async` dengan timeout resolusi 5 detik untuk menghindari blocking pada event loop.
- **Streaming Byte Cap**: Modul `backend/app/connectors/base.py` menerapkan `get_limited_response` yang menghitung byte terdekompresi aktual secara incremental. Jika ukuran melampaui `connector_response_max_bytes` (default 5 MiB), pembacaan stream segera dihentikan dengan exception `ConnectorResponseTooLargeError` tanpa menyimpan payload parsial.
- **Redirects Disabled**: HTTP client menonaktifkan pengikutan redirect otomatis (`follow_redirects=False`) guna mencegah kerentanan DNS rebinding / TOCTOU.

---

## 5. Reliabilitas Collection & Optimasi Query Database

1. **Validasi Koleksi**:
   - Jika `investigation_id` tidak valid atau tidak dimiliki pengguna, proses dihentikan sebelum memanggil koneksi eksternal.
   - Connector ID yang tidak dikenal langsung ditolak dengan HTTP 422.
   - Daftar connector `null` berarti seluruh connector aktif; daftar kosong `[]` ditolak dengan pesan error yang jelas.
2. **Eliminasi N+1 Query**:
   - Query daftar investigasi dan entitas telah dioptimasi menggunakan SQL subquery outer join sehingga menghasilkan 1 query gabungan berkinerja tinggi.
3. **Pagination Konsisten**:
   - Seluruh endpoint list (`/investigations`, `/entities`, `/observations`, `/search-queries`) mendukung parameter `limit` dan `offset` dengan validasi rentang.

---

## 6. Hasil Pengujian Aktual

Seluruh pengujian dijalankan langsung pada environment proyek:

| Komponen / Suite | Perintah Eksekusi | Hasil Aktual | Catatan |
|---|---|---|---|
| **Frontend Tests** | `npm test` | **PASS (25/25)** | Mencakup `tsc --noEmit`, ESLint, dan 25 query builder tests |
| **Frontend Production Build** | `./node_modules/.bin/next build --webpack` | **PASS (Exit 0)** | Static prerendering 4/4 pages berhasil tanpa error |
| **Backend Tests** | `python -m pytest` (Python 3.12.15) | **PASS (64/64)** | 64 passed, 1 warning (cache warning non-fatal) |
| **Backend Linter** | `ruff check app tests alembic` | **PASS (Exit 0)** | 0 linting errors |
| **Database Migrations** | `alembic upgrade head` | **PASS (Exit 0)** | Migrasi 001 hingga 004 bersih pada database baru |

---

## 7. Pengujian yang Belum Dijalankan dan Alasannya

- **Pengujian Headless Browser Otomatis (E2E Playwright/Cypress)**: Repository saat ini belum memiliki test suite berbasis browser automation (semua pengujian frontend berbasis unit test dan component compilation).
- **Pengujian Live Network Provider (Shodan, Censys, RDAP Live)**: Sesuai aturan pengujian unit/integrasi terisolasi, connector diuji menggunakan synthetic mock HTTP responses (`respx`) untuk mencegah flakiness, rate limit eksternal, dan paparan network publik saat test suite berjalan.

---

## 8. Risiko yang Tersisa dan Rekomendasi Tahap Lanjutan

1. **Rate Limiting Endpoint Autentikasi**: Endpoint `/api/v1/auth/login` dan `/register` belum dilengkapi rate limiter tingkat aplikasi (seperti Redis/token bucket). Disarankan menambahkan rate limiting pada reverse proxy (Nginx/Traefik) atau middleware sebelum eksposur publik.
2. **Connector Tambahan**: Shodan, VirusTotal, Censys, dan Hunter.io masih berada dalam status planned dan membutuhkan API key terkonfigurasi saat diimplementasikan kelak.
3. **Data Lama Tanpa Pemilik**: Migrasi database mempertahankan data legacy dengan `owner_id = NULL`. Administrator perlu menetapkan akun pemilik secara eksplisit jika data lama hendak diakses kembali.
