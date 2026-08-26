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
