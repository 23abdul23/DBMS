# Aegis ID – Your Secure Digital Campus Pass

Aegis ID is a **mobile-first digital identity and access management system** designed to replace traditional college ID cards and manual entry processes. It offers a secure, fast, and modern way for students, wardens, and campus security to interact within the campus ecosystem. Students can simply Scan & Go at all security entry exit oints and library, Students can request OUTPASS from their hostel wardens without going to them physically, Wardens can Approve and DIsapprove the request etc, Late commers gets ping by the system automatcially and other security features like emergency contacts etc.



📥 **Installation Guide:** [Click here to view installation.md](installation.md)

---

## Quick Start

### 1. Install dependencies

```bash
cd backend
npm install
cd ..
cd frontend
npm install
cd ..
```

### 2. Configure the backend

Create `backend/.env` using `backend/.env.example` as the template. The backend now uses PostgreSQL with Prisma, so set these values at minimum:

```env
DB_MODE=sql
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?schema=public
JWT_SECRET=your-secret
JWT_EXPIRE=7d
PORT=3000
FRONTEND_URL=http://localhost:8081
GMAIL_ID=your-email@example.com
GMAIL_PASSWORD=your-app-password
EMERGENCY_MEDICAL_PHONE=9329594882
EMERGENCY_SECURITY_PHONE=7217492629
EMERGENCY_FIRE_PHONE=8618275578
EMERGENCY_OTHER_PHONE=7909069340
```

### 3. Generate Prisma client and apply migrations

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate -- --name init
cd ..
```

If you run the app with Docker, the backend container now syncs the Prisma schema automatically on startup so a fresh Postgres volume gets the `users` table before registration runs.

### 4. Start the backend

```bash
cd backend
npm run dev
```

### 5. Start the mobile app

```bash
cd frontend
npm start
```

---

## Docker Workflow

The repo now includes a root `docker-compose.yml` plus separate Dockerfiles for `backend` and `frontend`.

Run the full stack with:

```bash
docker compose up --build
```

This starts:

- PostgreSQL on port `5432`
- Backend on port `3000`
- Expo web on port `8081`

Expo in Docker is best used for the web target. For native device development, it is usually better to run Expo locally on the host machine and use the backend container separately.

---

## 🚀 What Our App Does

### **1. Digital Campus ID (Dynamic Passkey System)**
Aegis ID generates a **daily encrypted passkey** (QR/NFC) for students.

- Automatically refreshes
- Bound to the student's device
- Screenshot-protected (non-shareable)
- Can be scanned at gates for access validation

This eliminates the need for physical ID cards and reduces misuse or proxy entries.

---

## 🎒 Outpass Management

The app fully digitizes the outpass system:

- Students submit outpass requests  
- Wardens approve or reject with a single tap  
- Students receive instant notifications  
- All actions are logged for transparency  

No more queues, registers, or manual paperwork.

---

## 🚨 Emergency Support

Aegis ID includes a **one-tap emergency alert system**:

- Instantly call security or ambulance  
- App auto-shares GPS location  
- Emergency logged and tracked by campus authorities  

Ensures quick response during critical situations.

---

## 🔒 Secure Authentication & User Management

The system is built with strong security practices:

- JWT-based authentication  
- Bcrypt password hashing  
- SHA-256 encrypted passkeys  
- Role-based access: Student / Warden / Security / Admin  

Admins can manage users, logs, and system policies efficiently.

---

## 📱 Modern Mobile-First UI

Built using **React Native**, the app provides:

- Dashboard (Passkey | Outpass | Scan | Emergency)
- Profile management
- Outpass creation & tracking
- QR scanning interface
- Emergency alert screen

Clean UI, smooth navigation, and fast response time.

---

## ⚙️ Gate Access (QR / NFC)

Security guards can validate entries through:

- Scanning student's QR code  
- Reading NFC tags (supported devices)

Backend verifies:

- Token validity  
- Device ID match  
- Expiry time  
- Student role/status  

Result: Instant **Access Granted / Access Denied** response.

---

## 🧬 Core Features Summary

- ✔️ Daily dynamic encrypted passkeys  
- ✔️ QR & NFC access  
- ✔️ Device-bound, non-shareable tokens  
- ✔️ Digital outpass workflow  
- ✔️ Emergency alerts with live location  
- ✔️ Profile and account management  
- ✔️ Role-based dashboards  
- ✔️ Secure backend with audit logs  

---

## 🏗️ Tech Stack

### **Frontend**
- React Native  
- Figma (UI Design)

### **Backend**
- Node.js / Express  
- PostgreSQL  
- Prisma 7  
- JWT, Bcrypt, SHA-256  
- Optional Blockchain-based logging

### **Hardware**
- NFC Readers  
- QR Scanners  
- Mobile Cameras  

---

## 👥 User Roles

- **Students** – Generate passkeys, request outpasses, emergency alerts  
- **Wardens** – Approve/reject outpasses  
- **Security Staff** – Validate QR/NFC, view emergencies  
- **Admins** – Manage users and system configuration  

---

## 📝 Why Aegis ID?

- Replaces outdated manual systems  
- Eliminates fake entries or ID misuse  
- Faster gate verification  
- Safer campus with emergency tracking  
- Fully digital, highly scalable, and secure  

---

## 📄 License

This project is part of **CS301 – Software Engineering** at **IIIT Allahabad**.

---

## 📬 Contact

For development or contribution queries, reach out to the team.


