# Deployment Guide

This document details how to deploy the Local Vendor Marketplace.

## Deployment Architecture

* **Frontend**: React (Vite) static build hosted on **Vercel** or Nginx.
* **Backend**: Node.js Express server with SQLite database hosted on **Railway** (or Render).

---

## 1. Backend Deployment (Railway)

Railway automatically detects the backend `package.json` or `Dockerfile` and deploys it.

### Required Environment Variables
You must set the following environment variables on the Railway project dashboard:

| Variable | Description | Example / Recommended Value |
| --- | --- | --- |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Listening Port | `3000` |
| `JWT_SECRET` | Secret key for signing session tokens | `generate-a-strong-random-key-here` |
| `DATABASE_PATH` | Path to the SQLite database file | `ecommerce.sqlite` |
| `FRONTEND_URL` | Normalized URL of the deployed frontend | `https://your-frontend-domain.vercel.app` |
| `GMAIL_USER` | Gmail address for sending emails | `example@gmail.com` |
| `GMAIL_PASS` | App password generated from Gmail settings | `xxxx xxxx xxxx xxxx` |
| `MAIL_RECEIVER` | Target email for notification copies | `example@gmail.com` |

### Database Persistence
SQLite stores data in a local file. To prevent losing data on container rebuilds/redeploys:
1. Go to your backend service settings in Railway.
2. Under **Volumes**, add a new Volume (e.g. named `data`).
3. Set the mount path to `/app/backups` or configure `DATABASE_PATH` to point to a persistent volume path, e.g., `/app/data/ecommerce.sqlite`.

---

## 2. Frontend Deployment (Vercel)

Vercel hosts the static frontend application.

### Build Configuration
Set these configurations on the Vercel project setup page:
* **Framework Preset**: `Vite`
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Install Command**: `npm install`

### Environment Variables
Configure the following variable on Vercel:

| Variable | Description | Example Value |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Absolute URL of your Railway backend service | `https://your-backend-service.railway.app` |

---

## 3. Containerized Deployment (Docker)

To run the entire system locally or on a VPS using Docker:

1. Build and start containers:
   ```bash
   docker-compose up --build -d
   ```
2. Verify running containers:
   ```bash
   docker ps
   ```
3. Stop containers:
   ```bash
   docker-compose down
   ```
