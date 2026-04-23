# RitHub

An AI-integrated, blind-evaluation platform for conducting rigorous, unbiased human-subject studies on software engineering artifacts.

[Read the detailed project description here](./description.md)

## Table of Contents

- [Requirements](#requirements)
- [First-Time Setup](#first-time-setup)
- [Running the Project](#running-the-project)
- [Verification](#verification)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Requirements

- Docker and Docker Compose
- Node.js (for local development outside of Docker, optional)

## First-Time Setup

1. Clone the repository to your local machine.
2. Ensure you have Docker and Docker Compose installed and running.
3. **Configure Environment Variables:**
   - In the `backend/` directory, copy `.env.example` to `.env` and fill in your actual `OPENAI_API_KEY`.
   - In the `docker-compose.yml` file, update the generic placeholders under the `backend` service (like `JWT_SECRET`, `EMAIL_USER`, and `EMAIL_PASSWORD`) with your real credentials.
4. No manual database setup is required; the Docker Compose file will initialize the PostgreSQL database and run migrations automatically upon startup.

## Running the Project

The application is fully containerized. To start the backend, frontend, and database, run the following command in the root directory:

```bash
docker-compose build
docker-compose up -d
```

This will build the necessary images and start the containers in detached mode.

## Verification

Once the containers are running, you can verify everything works by navigating to the frontend application:

- **Frontend URL:** `http://localhost:3000`
- **Backend API:** `http://localhost:5000`

### Admin Login

You can log in to the platform using the built-in admin account:

- **Username:** `admin`
- **Password:** `Admin@2024`

## Project Structure

```text
.
├── backend/            # Node.js + Express backend API
├── database/           # Database initialization scripts and migrations
├── frontend/           # React.js frontend application
├── description.md      # Detailed project architecture and features
├── docker-compose.yml  # Docker Compose configuration
├── package.json        # Main project dependencies and scripts
└── README.md           # Project documentation (this file)
```

## Troubleshooting

- **Ports already in use:** Ensure ports `3000`, `5000`, and `5432` are not being used by other applications.
- **Database Connection Issues:** Sometimes the backend starts before the database is fully initialized. The backend is configured to retry, but if it fails, simply restart the backend container: `docker-compose restart backend`.
- **Viewing Logs:** If something goes wrong, you can view the logs of the services by running `docker-compose logs -f`.
