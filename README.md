# Discord Quest Notifier

Discord Quest Notifier adalah pure Discord bot backend. Project ini tidak menyediakan website, dashboard, HTTP server, atau localhost endpoint.

Bot ini akan memberitahukan pengguna mengenai Quest baru berdasarkan data dari Quest API (akan diimplementasikan pada phase berikutnya).

## Tech Stack
- Node.js (ES Modules)
- discord.js
- MongoDB & Mongoose

## Instalasi
1. Clone repositori ini
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy file environment dan isi konfigurasi:
   ```bash
   cp .env.example .env
   ```
   (Isi token bot dan konfigurasi database di file `.env`)

## Menjalankan Bot
Untuk development dengan auto-reload (watch mode):
```bash
npm run dev
```

Untuk production:
```bash
npm run bot
```

Setelah `npm run bot` dijalankan, bot akan langsung login ke Discord dan tetap online selama process Node.js berjalan. Tidak ada server port yang dibuka dan tidak ada alamat localhost.

## Deployment

Project ini adalah Discord worker yang berjalan terus-menerus, bukan web service. Gunakan tipe layanan **Background Worker** atau layanan container/VM yang mendukung proses persistent; jangan gunakan deployment web/serverless yang mewajibkan HTTP port atau mematikan proses setelah request selesai.

Perintah build/start:

```bash
npm ci
npm run bot
```

Tambahkan `DISCORD_TOKEN` dan `MONGODB_URI` sebagai environment variables pada provider. File `.env` sengaja tidak di-commit oleh `.gitignore`; `.env.example` hanya menjadi template dan tidak berisi nilai rahasia.

File dump/debug dan asset sementara juga diabaikan oleh `.gitignore`. Aturan ignore tidak menghapus file yang sudah terlanjur tracked, jadi file-file tersebut perlu dihapus dari index secara terpisah bila ingin mengecilkan source bundle deployment.
