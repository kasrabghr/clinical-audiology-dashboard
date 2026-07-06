# Clinical Audiology AI Dashboard

![Audiology Dashboard](https://img.shields.io/badge/Status-Active-brightgreen) ![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue) ![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python-yellow) ![Anthropic](https://img.shields.io/badge/AI-Claude%203-purple)

A professional clinical audiology web application that allows healthcare professionals to input audiometric patient data and generates instant differential diagnostic reports using AI (Anthropic's Claude API).

## 🚀 Features
- **Comprehensive Data Entry:** Input fields for Pure Tone Audiometry (Air & Bone conduction, masked/unmasked).
- **Speech Audiometry & Tympanometry:** Full support for SRT, WRS, and Tympanometry curves.
- **Symptom Tracking:** Integrated clinical symptom checklist.
- **AI-Powered Diagnostics:** The Python backend communicates directly with the Claude LLM to evaluate the audiogram and synthesize a differential diagnosis.
- **Security Protocols:** Built-in rate limiting and strict CORS protections.

## 🛠️ Tech Stack
- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Python 3.12, FastAPI, Uvicorn
- **AI Integration:** LiteLLM (Anthropic API)

## 📦 Local Setup

### 1. Backend Setup
Navigate to the `backend` directory, install requirements, and set your API key:
```bash
cd backend
pip install -r requirements.txt

# Create .env file and add your key:
# ANTHROPIC_API_KEY="sk-ant-..."

python -m app.fast_api_app
```
The API will run on `http://localhost:8000`.

### 2. Frontend Setup
In the project root, install Node dependencies and start the Vite server:
```bash
npm install
npm run dev
```

## 🌐 Production Deployment
To deploy the frontend to a provider like Vercel or Netlify, make sure to set the `VITE_API_URL` environment variable to point to your deployed backend URL. The backend includes a production-ready `Dockerfile` optimized for platforms like Koyeb or Fly.io.

---
*Built for clinical efficiency and AI-assisted diagnostics.*
