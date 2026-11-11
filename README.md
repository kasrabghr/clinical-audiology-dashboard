# Clinical Audiology AI Dashboard

Audiologists lose hours every week to administrative burnout, manually typing up diagnoses from audiograms, speech evaluations, and tympanometry data. This is an AI-assisted reporting tool designed to help audiologists spend less time writing reports after an assessment. 
1️- Users input symptoms and test results into a streamlined clinical UI.

2️- The backend triggers an LLM agent. Unlike a generic LLM, this agent is constrained by strict clinical tools (Pure Tone Evaluation, Speech Validation, and Symptom Correlation), forcing it to follow actual diagnostic rules instead of just guessing.

3️- The agent evaluates the raw data, connects the clinical dots, and outputs a medically accurate, formatted medical report.

The goal is to turn test results into a clinically grounded report in seconds, reducing repetitive documentation work while keeping the final interpretation safe from AI hallucinations. 


Its approach combines **backend calculations with a guardrailed LLM**:

- **Python handles the calculations.** Pure-tone averages, hearing-loss type and degree, audiogram configuration, symmetry, and selected consistency checks are computed in the backend before the model is called.
- **The model receives the assessment and calculated results.** It uses this context to draft findings, differential diagnostic considerations, and next steps.
- **Audiologic instructions guide interpretation.** The prompt includes conditions for suggesting particular diagnostic possibilities, such as using the calculated symmetry classification and patient age when considering certain causes of hearing loss.
- **Reporting instructions shape the output.** The model is asked for a concise, two-paragraph narrative linking test findings to clinical context and recommendations.

These guardrails are implemented through backend calculations and model instructions. They support consistent reporting, but do not guarantee a medically correct diagnosis or enforce every generated claim. The audiologist reviews the draft before using it.

## Features

- **Interactive bilateral audiograms** : plot air- and bone-conduction thresholds from 250 to 8000 Hz, with masking controls and click-to-enter measurements.
- **Structured assessments** : capture speech reception thresholds (SRT), word recognition scores (WRS), tympanogram types, otoscopy findings, symptoms, and clinical notes.
- **Example cases** : load built-in assessments to explore different hearing profiles without entering every measurement manually.
- **AI-assisted reports** : generate narrative findings, differential considerations, and recommendations using Claude through a Python API.
- **Printable reports** : review the draft in a report view, then print or save it as a PDF using the browser.

## How it works

1. Enter assessment details or load an example case.
2. Adjust thresholds on the audiograms and add speech, middle-ear, and symptom information.
3. Generate a report. The backend validates the request and calculates pure-tone averages, hearing-loss classifications, symmetry, and consistency checks.
4. These calculated summaries and the assessment are supplied to Claude to draft the narrative.
5. Review the report before printing or saving it.

## Technical highlights

- **Custom SVG audiograms:** React components map pointer positions to frequency and threshold values, with 5 dB input steps and distinct ear/conduction symbols.
- **Calculations before generation:** Python computes assessment summaries before the model call, giving the narrative explicit numerical and classification context.
- **Typed data flow:** TypeScript models the frontend assessment state, while Pydantic validates the API payload.
- **Server-side AI integration:** The browser calls a relative API route; the provider key stays in the backend environment.

```text
React assessment form + SVG audiograms
                  |
       POST /api/generate-report
                  |
      FastAPI / Pydantic validation
                  |
    Python calculations + consistency checks
                  |
          LiteLLM -> Claude
                  |
       Report view -> Print / PDF
```

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, CSS, SVG |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| AI integration | Anthropic Claude via LiteLLM |
| Hosting configuration | Vercel frontend and Python API |

## Run locally

Use Node.js 22.12+ and Python 3.10+ with `pip` and `venv`. Python dependencies are pinned in `requirements.txt`.

Clone the repository and run the following commands from its root:

```bash
git clone https://github.com/kasrabghr/clinical-audiology-dashboard.git
cd clinical-audiology-dashboard
```

### 1. Start the API

In PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Set your credentials in `.env`:

```dotenv
ANTHROPIC_API_KEY="your-anthropic-api-key"
ALLOW_ORIGINS="http://localhost:5173"
```

Start the server:

```powershell
.\.venv\Scripts\python.exe -m uvicorn api.index:app --reload --host 127.0.0.1 --port 8000
```

On macOS/Linux, create the environment with `python3 -m venv .venv`, use `.venv/bin/python` for the install and server commands, and copy `.env.example` to `.env` if it does not already exist.

Interactive API documentation is available at [localhost:8000/docs](http://localhost:8000/docs).

### 2. Start the frontend

In a second terminal:

```bash
npm ci
npm run dev
```

Open the URL printed by Vite, normally [localhost:5173](http://localhost:5173). Vite proxies `/api` requests to the Python server on port 8000; keep both processes running for report generation.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the frontend development server |
| `npm run build` | Type-check and build the frontend |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Preview the frontend build; does not start or proxy the API |

Report generation requires a valid Anthropic API key and access to the model configured in `api/index.py`. If the provider request fails, the app displays an unavailable state.

## Deployment

The repository includes a Vercel configuration that serves the frontend and routes `/api/*` requests to `api/index.py`.

- Frontend build command: `npm run build`
- Frontend output directory: `dist`
- Python dependencies: `requirements.txt`
- Server environment: `ANTHROPIC_API_KEY` and `ALLOW_ORIGINS` (comma-separated permitted browser origins)

Keep API keys in server environment variables, never in a `VITE_` variable or source control. Set environment variables separately for Preview and Production as needed.

## Project structure

```text
src/
  App.tsx                        Assessment state, form, example cases, API requests
  components/AudiogramChart.tsx   Interactive SVG audiograms
  components/ReportModal.tsx      Report rendering and print controls
  App.css                        Dashboard styles
api/
  index.py                       API, assessment calculations, AI integration
  app_utils/                     Supporting backend utilities
.env.example                     Environment variable template
requirements.txt                 Python dependencies
vite.config.ts                   Frontend build and development proxy
vercel.json                      API routing for deployment
```

##  Tech Stack
- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Python 3.12, FastAPI, Uvicorn
- **AI Integration:** LiteLLM (Anthropic API)

## Development

Developed with assistance from Google Antigravity.
