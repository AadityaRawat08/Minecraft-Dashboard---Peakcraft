# ⛏️ PeakCraft --- Minecraft Server Management Dashboard

A modern web dashboard for managing and monitoring Minecraft servers
from one place.

PeakCraft is designed to make Minecraft server administration easier by
providing a clean web interface for server controls, monitoring, player
management, backups, and other administration features.

## ✨ Features

-   Minecraft server management
-   Server status monitoring
-   Start, stop, and restart controls
-   Web-based server console
-   Player management
-   Server overview and monitoring
-   File management
-   Backup management
-   Plugin and mod management
-   Authentication and role-based access
-   Admin and normal-user access
-   PostgreSQL database integration
-   Docker-based development setup
-   Responsive dashboard interface

## 🛠️ Tech Stack

### Frontend

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS

### Backend

-   Next.js / Node.js
-   TypeScript

### Database

-   PostgreSQL
-   Drizzle ORM

### Infrastructure

-   Docker

## 📁 Project Structure

``` text
minecraft-server-management-dashboard/
├── src/
│   ├── app/
│   ├── components/
│   ├── db/
│   └── lib/
├── public/
├── package.json
├── package-lock.json
├── next.config.ts
├── drizzle.config.json
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── .gitignore
└── README.md
```

> Local Minecraft server data is intentionally excluded from this
> repository.

## 🚀 Getting Started

### 1. Clone the repository

``` bash
git clone https://github.com/AadityaRawat08/Minecraft-Dashboard---Peakcraft.git
cd Minecraft-Dashboard---Peakcraft
```

### 2. Install dependencies

``` bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root.

Example:

``` env
DATABASE_URL=your_postgresql_connection_string
```

Add any other environment variables required by your local setup.

**Never commit `.env` or other secrets to GitHub.**

### 4. Start PostgreSQL

If PostgreSQL is running in the project's Docker container:

``` bash
docker start peakcraft-postgres
```

Make sure PostgreSQL is available on port `5432`.

### 5. Start the development server

``` bash
npm run dev
```

Open:

``` text
http://localhost:3000
```

## 🗄️ Database

PeakCraft uses PostgreSQL with Drizzle ORM.

Depending on the project's current database configuration, Drizzle
commands may include:

``` bash
npx drizzle-kit push
```

or:

``` bash
npx drizzle-kit migrate
```

Use the command that matches the project's configured migration
workflow.

## 🏗️ Architecture

``` text
                    ┌──────────────────┐
                    │   User / Admin   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   PeakCraft UI   │
                    │     Next.js      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Backend / APIs  │
                    │ Node.js / Next.js│
                    └───────┬───┬──────┘
                            │   │
                 ┌──────────┘   └──────────┐
                 ▼                         ▼
        ┌─────────────────┐       ┌─────────────────┐
        │   PostgreSQL    │       │ Minecraft Server│
        │  + Drizzle ORM  │       │ Process / Files │
        └─────────────────┘       └─────────────────┘
```

## 🔐 Security

The following local files are excluded from Git:

``` text
.env
node_modules/
.next/
data/
*.log
```

Do not expose:

-   Database passwords
-   API keys
-   JWT/authentication secrets
-   Private tokens
-   Production credentials

## 🔄 Git Workflow

After making changes:

``` bash
git status
git add .
git commit -m "Describe your changes"
git push
```

## 📸 Screenshots

Add dashboard screenshots here when available.

Example:

``` markdown
Welcome
C:\Users\aadit\Desktop\All Codes\Template\minecraft-server-management-dashboard\screenshots\Screenshot (189).png
Dashboard
C:\Users\aadit\Desktop\All Codes\Template\minecraft-server-management-dashboard\screenshots\Screenshot (190).png
Other ScreenShots what are available Right now:
C:\Users\aadit\Desktop\All Codes\Template\minecraft-server-management-dashboard\screenshots\Screenshot (191).png
C:\Users\aadit\Desktop\All Codes\Template\minecraft-server-management-dashboard\screenshots\Screenshot (192).png
C:\Users\aadit\Desktop\All Codes\Template\minecraft-server-management-dashboard\screenshots\Screenshot (193).png
C:\Users\aadit\Desktop\All Codes\Template\minecraft-server-management-dashboard\screenshots\Screenshot (194).png
C:\Users\aadit\Desktop\All Codes\Template\minecraft-server-management-dashboard\screenshots\Screenshot (195).png
```

## 🗺️ Future Improvements

-   [ ] Real-time server metrics
-   [ ] Advanced player management
-   [ ] Scheduled automated backups
-   [ ] Real-time log streaming
-   [ ] Multiple server support
-   [ ] Advanced permissions
-   [ ] Remote server management
-   [ ] Server performance analytics
-   [ ] Notification system

## 👨‍💻 Author

**Aaditya Rawat**

BTech CSE\
KCCITM, Noida

## 📄 License

This project is licensed under the MIT License.

See the `LICENSE` file for details.
