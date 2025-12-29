# EasyData Development Setup (PEP 668 Safe)

## Python (Backend)

This project **must** be run using a project-local virtual environment at `./.venv/`.

### 1) Install venv tooling (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install -y python3-full python3-venv
```

### 2) Create the virtual environment (inside the repo)

```bash
python3 -m venv .venv
```

### 3) Activate the venv

```bash
source .venv/bin/activate
```

### 4) Install dependencies (inside the venv)

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 5) Run the backend

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend

Frontend uses Vite.

```bash
npm --prefix frontend install
VITE_API_BASE_URL=http://localhost:8000 npm --prefix frontend run dev
```

## Why this is required

Modern Linux distributions enforce **PEP 668** which prevents running `pip install` against the **system Python**. Using `./.venv/` keeps dependencies isolated and avoids breaking OS-managed Python packages.

