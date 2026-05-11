# Redis Server Setup Guide

This guide explains how to set up Redis for the Aegis notification system using BullMQ.

---

## Prerequisites

Redis is required for:

- **BullMQ Queue** - Processing notification jobs asynchronously
- **Session Storage** - Caching and session management
- **Real-time Features** - Future Socket.IO integration

---

## Installation

### **Windows**

#### Option 1: Using Windows Subsystem for Linux (WSL) - **Recommended**

1. **Enable WSL2**:

   ```bash
   wsl --install
   ```

2. **Install Redis in WSL Ubuntu**:

   ```bash
   # Update package manager
   sudo apt update

   # Install Redis
   sudo apt install redis-server
   ```

3. **Start Redis**:
   ```bash
   # Inside WSL terminal
   redis-server
   ```

#### Option 2: Using Docker - **Easiest for Development**

1. **Install Docker Desktop** from https://www.docker.com/products/docker-desktop

2. **Pull and Run Redis Container**:

   ```bash
   docker run -d -p 6379:6379 --name redis-aegis redis:latest
   ```

3. **Verify it's running**:
   ```bash
   docker ps | grep redis-aegis
   ```

#### Option 3: Direct Windows Binary

1. **Download from GitHub**:
   - Go to https://github.com/microsoftarchive/redis/releases
   - Download `Redis-x64-X.X.X.msi` (latest version)

2. **Run Installer**:
   - Execute the `.msi` file
   - Accept default installation path
   - Choose to install as a service (recommended)

3. **Start Redis**:
   ```cmd
   # If installed as service, it will start automatically
   # Or manually start:
   redis-server
   ```

---

### **macOS**

```bash
# Install using Homebrew
brew install redis

# Start Redis
brew services start redis

# Or run in foreground
redis-server
```

---

### **Linux (Ubuntu/Debian)**

```bash
# Update package manager
sudo apt update

# Install Redis
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server

# Enable auto-start on boot
sudo systemctl enable redis-server

# Check status
sudo systemctl status redis-server
```

---

## Configuration

### **Default Connection Settings**

The Aegis notification system connects to Redis at:

- **Host**: `localhost` (or `127.0.0.1`)
- **Port**: `6379`
- **Database**: `0` (default)

These are configured in:

- `backend/notifications/queues/notification.queue.js`
- `backend/notifications/workers/notification.worker.js`

### **Production Configuration**

For production, create a Redis config file:

**File**: `/etc/redis/redis.conf` (Linux) or `redis.conf` (Windows)

```conf
# Bind to specific interface
bind 127.0.0.1

# Port
port 6379

# Password (set a strong password)
requirepass your_secure_password_here

# Persistence (automatic saves)
save 900 1           # Save after 900 sec if 1 key changed
save 300 10          # Save after 300 sec if 10 keys changed
save 60 10000        # Save after 60 sec if 10000 keys changed

# Max memory policy
maxmemory 256mb
maxmemory-policy allkeys-lru

# Slow log
slowlog-log-slower-than 10000  # Log queries slower than 10ms
slowlog-max-len 128
```

### **Development Configuration** (Using Default)

For local development, default settings are fine. No additional configuration needed.

---

## Starting Redis

### **Development**

```bash
# Windows (WSL or Command Prompt)
redis-server

# macOS
brew services start redis

# Linux
sudo systemctl start redis-server

# Docker
docker start redis-aegis
```

### **Verify Redis is Running**

```bash
# Check connection
redis-cli ping

# Expected output:
# PONG
```

### **Common Issues**

| Issue                                          | Solution                                                        |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `Could not connect to Redis at 127.0.0.1:6379` | Ensure Redis server is running                                  |
| `Address already in use`                       | Another process is using port 6379; change port or kill process |
| `Connection refused`                           | Redis is not listening on localhost; check bind setting         |
| `NOAUTH Authentication required`               | Redis requires password; add to connection config               |

---

## Integration with Aegis

### **How Notification System Uses Redis**

```
┌─────────────────────────────────────────────────────────────┐
│                     Aegis Backend                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Event Emitted                                              │
│  (OUTPASS_APPROVED / OUTPASS_REJECTED)                     │
│          ↓                                                   │
│  Notification Queue (BullMQ)                                │
│  (Redis-backed)                                             │
│          ↓                                                   │
│  Job Processor                                              │
│  (Notification Worker)                                     │
│          ↓                                                   │
│  Send Push Notification                                    │
│  (To Student's Device)                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### **Queue Connection**

**File**: `backend/notifications/queues/notification.queue.js`

```javascript
import { Queue } from "bullmq"

const notificationQueue = new Queue("notifications", {
  connection: {
    host: "localhost", // Redis host
    port: 6379, // Redis port
    // password: "your_password_here"  // Uncomment if using Redis password
  },
})

export { notificationQueue }
```

### **Worker Connection**

**File**: `backend/notifications/workers/notification.worker.js`

```javascript
import { Worker } from "bullmq"
import { createNotification } from "../services/notification.service.js"

const worker = new Worker(
  "notifications",
  async (job) => {
    await createNotification(job.data)
  },
  {
    connection: {
      host: "localhost", // Redis host
      port: 6379, // Redis port
      // password: "your_password_here"  // Uncomment if using Redis password
    },
  },
)

export { worker }
```

---

## Testing Redis Connection

### **Using Redis CLI**

```bash
# Connect to Redis
redis-cli

# Test commands
127.0.0.1:6379> ping
PONG

127.0.0.1:6379> set test_key "Hello Redis"
OK

127.0.0.1:6379> get test_key
"Hello Redis"

127.0.0.1:6379> del test_key
(integer) 1

127.0.0.1:6379> exit
```

### **Using Node.js**

```javascript
// test-redis.js
import { createClient } from "redis"

const client = createClient({
  host: "localhost",
  port: 6379,
})

client.on("error", (err) => console.log("Redis Client Error", err))

await client.connect()
console.log("✅ Connected to Redis")

await client.set("test", "Hello Redis")
const value = await client.get("test")
console.log("Value:", value)

await client.disconnect()
```

Run:

```bash
node test-redis.js
```

---

## Advanced: Using with Authentication

### **Set Redis Password**

#### **Windows**

Edit `redis.conf`:

```conf
requirepass mySecurePassword123
```

#### **Linux**

```bash
sudo nano /etc/redis/redis.conf
# Add line: requirepass mySecurePassword123
sudo systemctl restart redis-server
```

#### **macOS**

```bash
# Edit config
nano /usr/local/etc/redis.conf
# Add line: requirepass mySecurePassword123
brew services restart redis
```

### **Update Connection Config**

**File**: `backend/notifications/queues/notification.queue.js`

```javascript
const notificationQueue = new Queue("notifications", {
  connection: {
    host: "localhost",
    port: 6379,
    password: "mySecurePassword123", // Add this
  },
})
```

**File**: `backend/notifications/workers/notification.worker.js`

```javascript
const worker = new Worker(
  "notifications",
  async (job) => {
    await createNotification(job.data)
  },
  {
    connection: {
      host: "localhost",
      port: 6379,
      password: "mySecurePassword123", // Add this
    },
  },
)
```

---

## Monitoring Redis

### **Real-time Monitor**

```bash
# Open another terminal
redis-cli monitor

# Now perform operations in your app
# You'll see all Redis commands in real-time
```

### **Check Memory Usage**

```bash
redis-cli info memory
```

### **Check Connected Clients**

```bash
redis-cli info clients
```

### **Get Queue Stats**

```bash
redis-cli

# View all keys
127.0.0.1:6379> keys *

# View queue-specific keys
127.0.0.1:6379> keys bull:notifications*

# Get queue info
127.0.0.1:6379> llen bull:notifications:jobs
127.0.0.1:6379> zcard bull:notifications:completed
```

---

## Docker Setup (Recommended for Development)

### **Using Docker Compose**

Create `docker-compose.yml` in project root:

```yaml
version: "3.8"

services:
  redis:
    image: redis:latest
    container_name: aegis-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    networks:
      - aegis-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis_data:

networks:
  aegis-network:
    driver: bridge
```

### **Start Redis with Docker Compose**

```bash
# Start Redis
docker-compose up -d redis

# Check logs
docker-compose logs -f redis

# Stop Redis
docker-compose down
```

---

## Troubleshooting

### **Port 6379 Already in Use**

```bash
# Windows - Find process using port
netstat -ano | findstr :6379

# Linux/macOS - Find process
lsof -i :6379

# Kill process (if needed)
kill -9 <PID>  # Linux/macOS
taskkill /PID <PID> /F  # Windows
```

### **Connection Timeout**

Check:

1. Redis server is running: `redis-cli ping`
2. Correct host/port in config
3. Firewall not blocking port 6379
4. Redis bind setting allows localhost

### **Memory Issues**

```bash
# Monitor memory growth
redis-cli info memory | grep used_memory_human

# Set max memory limit
redis-cli config set maxmemory 256mb
redis-cli config set maxmemory-policy allkeys-lru
```

### **Slow Performance**

```bash
# Check slow log
redis-cli slowlog get 10

# Clear slow log
redis-cli slowlog reset
```

---

## Production Deployment

### **Recommended Setup**

```
┌─────────────────────────────────────┐
│        Aegis Backend                │
├─────────────────────────────────────┤
│   Notification System (BullMQ)      │
│            ↓                         │
│   ┌─────────────────────────────┐   │
│   │   Redis (Standalone)        │   │
│   │   - Persistence: AOF + RDB  │   │
│   │   - Password Protected      │   │
│   │   - Max Memory: 256MB-1GB   │   │
│   │   - Replication Ready       │   │
│   └─────────────────────────────┘   │
│                                      │
└─────────────────────────────────────┘
```

### **Deployment Steps**

1. **Install Redis**:

   ```bash
   sudo apt update && sudo apt install redis-server
   ```

2. **Configure Redis** (`/etc/redis/redis.conf`):

   ```conf
   bind 127.0.0.1          # Don't expose to internet
   port 6379
   requirepass strong_password_here
   appendonly yes           # Enable AOF persistence
   appendfsync everysec     # Sync every second
   maxmemory 1gb
   maxmemory-policy allkeys-lru
   ```

3. **Enable Service**:

   ```bash
   sudo systemctl enable redis-server
   sudo systemctl restart redis-server
   ```

4. **Verify**:

   ```bash
   redis-cli -a strong_password_here ping
   # PONG
   ```

5. **Update Backend Config**:
   ```javascript
   {
     connection: {
       host: "127.0.0.1",
       port: 6379,
       password: "strong_password_here",
     }
   }
   ```

---

## Quick Start Checklist

- [ ] Redis installed (Windows/macOS/Linux)
- [ ] Redis server running (`redis-cli ping` returns `PONG`)
- [ ] Backend connection config points to correct host/port
- [ ] BullMQ queue and worker configured
- [ ] Test with: `npm run dev` in backend
- [ ] Check Redis via: `redis-cli keys *`
- [ ] Monitor queue: `redis-cli monitor`

---

## Additional Resources

- **Redis Official Docs**: https://redis.io/documentation
- **BullMQ Documentation**: https://docs.bullmq.io/
- **Redis CLI Commands**: https://redis.io/commands/
- **Docker Redis**: https://hub.docker.com/_/redis

---

## Support

For issues with the notification system, check:

1. **Redis Running**: `redis-cli ping`
2. **Connection Config**: `backend/notifications/queues/notification.queue.js`
3. **Worker Active**: Check backend logs for worker initialization
4. **Queue Jobs**: Use `redis-cli keys bull:notifications*` to inspect queue
5. **Database**: Check `Notification` table in PostgreSQL

---

_Last Updated: May 12, 2026_
