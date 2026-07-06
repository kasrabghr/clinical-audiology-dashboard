# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import litellm

from api.app_utils.typing import Feedback

load_dotenv(override=True)

# Setup logging
logging.basicConfig(level=logging.INFO)

logger = logging.getLogger("AudioReportBackend")

allow_origins = (
    os.getenv("ALLOW_ORIGINS", "").split(",") if os.getenv("ALLOW_ORIGINS") else ["*"]
)

# -------------------------------------------------------------
# Pydantic Request Models matching the Frontend JSON Payload
# -------------------------------------------------------------

class AirBoneMeasurement(BaseModel):
    threshold_db: Optional[float] = None
    masked: bool = False

class FrequencyMeasurement(BaseModel):
    air: AirBoneMeasurement
    bone: AirBoneMeasurement

class Metadata(BaseModel):
    patient_name_or_id: Optional[str] = Field(None, max_length=100)
    patient_age: Optional[int] = Field(None, ge=0, le=130)
    examining_audiologist: Optional[str] = Field(None, max_length=100)
    assessment_date: str
    app_version: str

class SpeechValues(BaseModel):
    right: Optional[float] = None
    left: Optional[float] = None

class SpeechAudiometry(BaseModel):
    srt_db_hl: SpeechValues
    wrs_percentage: SpeechValues

class Tympanometry(BaseModel):
    type_right: Optional[str] = None
    type_left: Optional[str] = None

class TinnitusSymptom(BaseModel):
    present: bool
    location: Optional[str] = None

class SymptomsPayload(BaseModel):
    noise_exposure: bool = False
    background_noise_difficulty: bool = False
    hyperacusis: bool = False
    vertigo_balance: bool = False
    otalgia: bool = False
    otorrhea: bool = False
    sudden_fluctuating_loss: bool = False
    history_ear_infections_surgeries: bool = False
    aural_fullness: bool = False
    tinnitus: TinnitusSymptom

class EarOtoscopy(BaseModel):
    normal: bool = False
    perforation: bool = False
    canal_redness: bool = False
    impacted_cerumen: bool = False

class OtoscopyPayload(BaseModel):
    right: EarOtoscopy
    left: EarOtoscopy

class AudiologyPayload(BaseModel):
    metadata: Metadata
    audiogram: Dict[str, Dict[str, FrequencyMeasurement]]
    speech_audiometry: SpeechAudiometry
    tympanometry: Tympanometry
    otoscopy: OtoscopyPayload
    symptoms: SymptomsPayload
    clinical_notes: Optional[str] = Field(None, max_length=3000)

# -------------------------------------------------------------
# Deterministic fallback methods in case Gemini is offline/no key
# -------------------------------------------------------------

def calculate_pta_and_type_fallback(audiogram: dict) -> dict:
    results = {}
    for ear in ['right_ear', 'left_ear']:
        ear_data = audiogram.get(ear, {})
        air_db_values = []
        bone_db_values = []
        abg_values = []
        for freq in [500, 1000, 2000]:
            freq_str = str(freq)
            freq_data = ear_data.get(freq_str, {})
            if freq_data:
                air_val = freq_data.get('air', {}).get('threshold_db')
                bone_val = freq_data.get('bone', {}).get('threshold_db')
                if air_val is not None:
                    air_db_values.append(air_val)
                if bone_val is not None:
                    bone_db_values.append(bone_val)
        frequencies_to_check = [250, 500, 1000, 2000, 4000, 8000]
        for freq in frequencies_to_check:
            freq_str = str(freq)
            freq_data = ear_data.get(freq_str)
            if freq_data:
                air_val = freq_data.get('air', {}).get('threshold_db')
                bone_val = freq_data.get('bone', {}).get('threshold_db')
                if air_val is not None and bone_val is not None:
                    abg_values.append(air_val - bone_val)
        pta = sum(air_db_values) / len(air_db_values) if air_db_values else None
        avg_abg = sum(abg_values) / len(abg_values) if abg_values else 0
        avg_bone = sum(bone_db_values) / len(bone_db_values) if bone_db_values else None
        degree = "Incomplete data"
        hl_type = "Incomplete data"
        if pta is not None:
            if pta <= 20:
                degree = "Normal Hearing"
            elif pta <= 40:
                degree = "Mild Hearing Loss"
            elif pta <= 55:
                degree = "Moderate Hearing Loss"
            elif pta <= 70:
                degree = "Moderately-Severe Hearing Loss"
            elif pta <= 90:
                degree = "Severe Hearing Loss"
            else:
                degree = "Profound Hearing Loss"
            if pta <= 20:
                hl_type = "Normal"
            else:
                if avg_abg >= 15:
                    if avg_bone is not None and avg_bone <= 20:
                        hl_type = "Conductive"
                    else:
                        hl_type = "Mixed"
                else:
                    hl_type = "Sensorineural"
                    
        # Collect air conduction thresholds for configuration classification
        config_thresholds = {}
        for freq in [250, 500, 1000, 2000, 4000, 8000]:
            val = ear_data.get(str(freq), {}).get('air', {}).get('threshold_db')
            if val is not None:
                config_thresholds[freq] = val

        config_class = "Flat"
        if len(config_thresholds) >= 3:
            vals_list = sorted(config_thresholds.items())
            has_precipitous = False
            for i in range(len(vals_list) - 1):
                if vals_list[i+1][1] - vals_list[i][1] >= 20:
                    has_precipitous = True
                    break
            
            low_vals = [v for f, v in config_thresholds.items() if f <= 500]
            high_vals = [v for f, v in config_thresholds.items() if f >= 4000]
            if low_vals and high_vals:
                low_avg = sum(low_vals) / len(low_vals)
                high_avg = sum(high_vals) / len(high_vals)
                diff = high_avg - low_avg
                
                if has_precipitous:
                    config_class = "Precipitously Sloping"
                elif diff >= 20:
                    config_class = "Gradually Sloping"
                elif diff <= -20:
                    config_class = "Rising"
                else:
                    all_vals = list(config_thresholds.values())
                    if max(all_vals) - min(all_vals) < 20:
                        config_class = "Flat"
                    else:
                        mid_vals = [v for f, v in config_thresholds.items() if 1000 <= f <= 2000]
                        if mid_vals:
                            mid_avg = sum(mid_vals) / len(mid_vals)
                            if mid_avg - low_avg >= 15 and mid_avg - high_avg >= 15:
                                config_class = "Trough-Shaped (Cookie Bite)"
                            else:
                                config_class = "Gradually Sloping" if diff > 0 else "Flat"
                    
        results[ear] = {
            "pta_db_hl": round(pta, 1) if pta is not None else None,
            "average_air_bone_gap_db": round(avg_abg, 1) if abg_values else 0,
            "degree": degree,
            "type": hl_type,
            "configuration": config_class
        }

    # Calculate symmetry mathematically (clinical definition: difference of >= 20 dB at 2 or more contiguous frequencies)
    consecutive_asymmetrical = 0
    max_consecutive = 0
    frequencies = [250, 500, 1000, 2000, 4000, 8000]
    for freq in frequencies:
        freq_str = str(freq)
        val_r = audiogram.get('right_ear', {}).get(freq_str, {}).get('air', {}).get('threshold_db')
        val_l = audiogram.get('left_ear', {}).get(freq_str, {}).get('air', {}).get('threshold_db')
        
        if val_r is not None and val_l is not None:
            diff = abs(val_r - val_l)
            if diff >= 20:
                consecutive_asymmetrical += 1
                if consecutive_asymmetrical > max_consecutive:
                    max_consecutive = consecutive_asymmetrical
            else:
                consecutive_asymmetrical = 0
        else:
            consecutive_asymmetrical = 0
            
    symmetry_status = "asymmetrical" if max_consecutive >= 2 else "symmetrical"
        
    return {
        "right_ear": results['right_ear'],
        "left_ear": results['left_ear'],
        "symmetry": symmetry_status
    }

def cross_check_validity_fallback(pta_results: dict, speech_audiometry: dict, tympanometry: dict) -> dict:
    inconsistencies = []
    def get_val(container, category, key):
        if not container:
            return None
        cat_data = container.get(category, {})
        if isinstance(cat_data, dict):
            return cat_data.get(key)
        return getattr(cat_data, key, None)
    for ear_key, label in [('right_ear', 'Right'), ('left_ear', 'Left')]:
        short_key = 'right' if ear_key == 'right_ear' else 'left'
        srt = get_val(speech_audiometry, 'srt_db_hl', short_key)
        pta = pta_results.get(ear_key, {}).get('pta_db_hl')
        abg = pta_results.get(ear_key, {}).get('average_air_bone_gap_db', 0)
        tymp_type = tympanometry.get(f'type_{short_key}') if isinstance(tympanometry, dict) else getattr(tympanometry, f'type_{short_key}', None)
        if srt is not None and pta is not None:
            if abs(pta - srt) > 15:
                inconsistencies.append(
                    f"{label} Ear: SRT ({srt} dB) and PTA ({pta} dB) differ by more than 15 dB. "
                    "This indicates poor test reliability or potential non-organic hearing loss."
                )
        if tymp_type == "B" and abg < 15:
            inconsistencies.append(
                f"{label} Ear: Type B (flat) tympanogram is present, indicating middle ear effusion or stiffness, "
                f"but the average Air-Bone Gap is only {abg} dB (conductive component should be >= 15 dB)."
            )
    return {
        "status": "success",
        "has_inconsistencies": len(inconsistencies) > 0,
        "inconsistencies": inconsistencies
    }

def generate_deterministic_fallback_report(raw_data: dict, pta_results: dict, cross_check_results: dict) -> str:
    metadata = raw_data.get('metadata', {})
    speech = raw_data.get('speech_audiometry', {})
    tymp = raw_data.get('tympanometry', {})
    notes = raw_data.get('clinical_notes')
    if notes is None:
        notes = ''

    def fmt_val(obj, key):
        val = obj.get(key) if isinstance(obj, dict) else getattr(obj, key, None)
        return f"{val}" if val is not None else "—"

    def fmt_tymp_type(obj, side):
        val = obj.get(f'type_{side}') if isinstance(obj, dict) else getattr(obj, f'type_{side}', None)
        if not val:
            return "Not Tested"
        if val == 'An': return 'Aₙ'
        if val == 'As': return 'Aₛ'
        return val

    # Extract findings for easy formatting
    pta_r = pta_results.get('right_ear', {}).get('pta_db_hl', '—')
    deg_r = pta_results.get('right_ear', {}).get('degree', '—')
    typ_r = pta_results.get('right_ear', {}).get('type', '—')

    pta_l = pta_results.get('left_ear', {}).get('pta_db_hl', '—')
    deg_l = pta_results.get('left_ear', {}).get('degree', '—')
    typ_l = pta_results.get('left_ear', {}).get('type', '—')

    tymp_r = fmt_tymp_type(tymp, 'right')
    tymp_l = fmt_tymp_type(tymp, 'left')

    srt_r = fmt_val(speech.get('srt_db_hl', {}), 'right')
    wrs_r = fmt_val(speech.get('wrs_percentage', {}), 'right')
    srt_l = fmt_val(speech.get('srt_db_hl', {}), 'left')
    wrs_l = fmt_val(speech.get('wrs_percentage', {}), 'left')

    # Build paragraph-style report using clinical description rather than raw scores
    tymp_desc = "normal middle ear function"
    if tymp_r == "B" or tymp_l == "B":
        tymp_desc = "fluid/stiffness"
    elif tymp_r == "C" or tymp_l == "C":
        tymp_desc = "negative pressure"
    elif tymp_r == "Aₛ" or tymp_l == "Aₛ":
        tymp_desc = "reduced compliance"

    # Symmetrical or asymmetrical
    symmetry = pta_results.get('symmetry', 'symmetrical')
    article = "an" if symmetry == "asymmetrical" else "a"

    deg_clean_r = deg_r.lower().replace(" hearing loss", "").replace(" hearing", "").strip()
    deg_clean_l = deg_l.lower().replace(" hearing loss", "").replace(" hearing", "").strip()

    if deg_clean_r == "normal" and deg_clean_l == "normal":
        hearing_desc = "normal hearing sensitivity bilaterally"
    elif deg_clean_r == deg_clean_l:
        hearing_desc = f"{article} {symmetry}, {deg_clean_r} {typ_r.lower()} hearing loss"
    else:
        desc_r = "normal hearing" if deg_clean_r == "normal" else f"a {deg_clean_r} {typ_r.lower()} loss"
        desc_l = "normal hearing" if deg_clean_l == "normal" else f"a {deg_clean_l} {typ_l.lower()} loss"
        hearing_desc = f"an asymmetrical profile showing {desc_r} (R) and {desc_l} (L)"

    para_findings = f"The patient presents with {hearing_desc} and {tymp_desc}."

    # Speech clarity brief note
    try:
        wrs_val_r = float(wrs_r) if wrs_r not in ("—", None) else None
        wrs_val_l = float(wrs_l) if wrs_l not in ("—", None) else None
    except ValueError:
        wrs_val_r = None
        wrs_val_l = None

    if wrs_val_r is not None and wrs_val_l is not None:
        wrs_avg = (wrs_val_r + wrs_val_l) / 2
        clarity = "excellent" if wrs_avg >= 90 else "fair" if wrs_avg >= 70 else "poor"
        para_findings += f" Speech clarity is {clarity}."

    if notes:
        para_findings += f" Observation: {notes}."

    # Generate dynamic differential diagnosis based on clinical facts
    diff_diagnoses = []
    recommendations = []
    
    # Extract symptoms
    symptoms = raw_data.get('symptoms', {})
    has_noise = symptoms.get('noise_exposure', False)
    has_bg_noise = symptoms.get('background_noise_difficulty', False)
    has_hyperacusis = symptoms.get('hyperacusis', False)
    has_vertigo = symptoms.get('vertigo_balance', False)
    tinnitus_data = symptoms.get('tinnitus', {})
    has_tinnitus = tinnitus_data.get('present', False)
    tinnitus_loc = tinnitus_data.get('location', '')

    # Analyze Age
    age = metadata.get('patient_age')
    is_elderly = isinstance(age, int) and age >= 50
    
    # Analyze Type and Asymmetry
    primary_type = typ_r if typ_r != "Normal" else typ_l
    is_asymmetrical = (symmetry == "asymmetrical")

    # Weave Symptoms into Diagnosis
    if has_noise:
        diff_diagnoses.append("noise trauma")
        recommendations.append("hearing protection")
    
    if has_bg_noise:
        recommendations.append("communication strategies")
        
    if has_hyperacusis:
        diff_diagnoses.append("hyperacusis")
        recommendations.append("desensitization counseling")

    if has_vertigo or "vertigo" in notes.lower() or "dizziness" in notes.lower():
        diff_diagnoses.append("vestibular dysfunction")
        recommendations.append("vestibular evaluation")

    if has_tinnitus or "tinnitus" in notes.lower():
        loc_str = f" ({tinnitus_loc})" if tinnitus_loc else ""
        diff_diagnoses.append(f"tinnitus{loc_str}")
        recommendations.append("tinnitus counseling/masking")

    # Add core audiometric diagnoses
    if primary_type == "Sensorineural":
        if is_asymmetrical:
            diff_diagnoses.append("retrocochlear pathology")
            recommendations.append("ENT and MRI referral")
        elif is_elderly:
            diff_diagnoses.append("presbycusis")
            recommendations.append("hearing aid evaluation")
        else:
            if not has_noise:
                diff_diagnoses.append("sensorineural hearing loss")
            
    elif primary_type == "Conductive":
        diff_diagnoses.append("otitis media or Eustachian tube dysfunction")
        recommendations.append("ENT evaluation")
            
    elif primary_type == "Mixed":
        diff_diagnoses.append("mixed hearing loss")
        recommendations.append("ENT evaluation")
        
    else:
        if not (has_noise or has_hyperacusis or has_tinnitus or has_vertigo):
            diff_diagnoses.append("subclinical dysfunction")
            recommendations.append("audiometric monitoring")

    diff_text = ", ".join(list(dict.fromkeys(diff_diagnoses))) if diff_diagnoses else "hearing changes"
    rec_text = ", ".join(list(dict.fromkeys(recommendations))) if recommendations else "monitoring"
    
    para_recommendations = (
        f"Differential Diagnosis: {diff_text.capitalize()}. "
        f"Recommendations: {rec_text.capitalize()}."
    )

    report = f"{para_findings}\n\n{para_recommendations}"
    return report

# -------------------------------------------------------------
# Rate Limiting & Server Configuration
# -------------------------------------------------------------

app = FastAPI(
    title="AudioReport AI Backend",
    description="Claude-powered Agent Backend for Clinical Audiology",
)

# Add CORS Middleware to ensure frontend can call it directly
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple IP-based rate limiting (in-memory)
MAX_REQUESTS_PER_DAY = 7
ip_request_counts: Dict[str, Dict[str, Any]] = {}
WHITELISTED_IPS = ["127.0.0.1", "::1"]

def check_rate_limit(request: Request):
    # Retrieve true client IP if behind a reverse proxy (like Render/Vercel)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"
    
    if client_ip in WHITELISTED_IPS:
        return True, 0

    now = datetime.now()
    
    if client_ip not in ip_request_counts:
        ip_request_counts[client_ip] = {"count": 1, "reset_time": now + timedelta(days=1)}
    else:
        record = ip_request_counts[client_ip]
        if now > record["reset_time"]:
            # Reset counter after 24 hours
            record["count"] = 1
            record["reset_time"] = now + timedelta(days=1)
        else:
            record["count"] += 1
            if record["count"] > MAX_REQUESTS_PER_DAY:
                raise HTTPException(
                    status_code=429, 
                    detail=f"Rate limit exceeded. You can generate a maximum of {MAX_REQUESTS_PER_DAY} reports per day."
                )
    return False, ip_request_counts[client_ip]["count"]

@app.post("/api/generate-report")
@app.post("/api/index")
@app.post("/")
async def generate_report(payload: AudiologyPayload, request: Request):
    # Enforce rate limits
    is_whitelisted, current_count = check_rate_limit(request)
    remaining_tries = "Unlimited" if is_whitelisted else (MAX_REQUESTS_PER_DAY - current_count)
    
    raw_payload_dict = payload.model_dump()
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    
    if not anthropic_key:
        raise HTTPException(status_code=503, detail="LLM_UNAVAILABLE")

    # ----------------------------------------------------------
    # Claude LLM Generation Path
    # ----------------------------------------------------------
    try:
        # Step 1: Run tools locally
        pta_res = calculate_pta_and_type_fallback(raw_payload_dict.get('audiogram', {}))
        cross_res = cross_check_validity_fallback(
            pta_res,
            raw_payload_dict.get('speech_audiometry', {}),
            raw_payload_dict.get('tympanometry', {})
        )
        
        # Step 2: System prompt with clinical guardrails
        system_prompt = (
            "You are an expert clinical audiologist writing a formal audiological report. "
            "Write a highly professional, narrative report consisting of exactly two paragraphs. "
            "CRITICAL: The entire report must be extremely concise and MUST NOT exceed 100 words in total.\n"
            "CRITICAL: Do NOT include a title, header, or patient metadata (e.g. Name, Age). ONLY output the two paragraphs of clinical text.\n\n"
            
            "Paragraph 1 (Test Findings & Clinical Impression): "
            "Synthesize the audiometric configuration, degree, type, sloping nature, and symmetry of the hearing loss, "
            "integrated with middle ear function (tymp compliance) and speech recognition. "
            "Do NOT write raw threshold numbers or copy tymp letters (e.g., write 'normal middle ear compliance' instead of 'Type A'). "
            "Briefly link the physiological findings to their reported symptoms (like noise exposure, background noise difficulty, or tinnitus).\n\n"
            
            "Paragraph 2 (Differential Diagnosis & Recommendations): "
            "Propose a differential diagnostic assessment (e.g. presbycusis, noise trauma, otitis media, or Eustachian tube issues) "
            "that fits the patient's audiometric profile and symptoms. Suggest 1-2 highly actionable next steps (like hearing protection, amplification, VNG testing, or ENT medical referral).\n\n"
            
            "Clinical Guardrails (Must Adhere Strictly):\n"
            "- Do NOT suggest retrocochlear pathology or vestibular schwannoma unless the symmetry is classified as 'asymmetrical' (requiring an interaural difference of >= 20 dB at two or more contiguous frequencies).\n"
            "- Only suggest age-related presbycusis if the patient is age 50+ and the symmetry is 'symmetrical' and the loss is bilateral sensorineural."
        )
        
        # Step 3: Inject pre-computed tool data
        user_message = (
            f"Here is the structured audiology JSON data:\n"
            f"{json.dumps(raw_payload_dict, indent=2)}\n\n"
            f"PTA and Classification Results:\n"
            f"{json.dumps(pta_res, indent=2)}\n\n"
            f"Cross-Check Validity Results:\n"
            f"{json.dumps(cross_res, indent=2)}\n\n"
            f"Using these pre-computed tool results, generate the narrative report."
        )
        
        model_name = "anthropic/claude-sonnet-5"
        
        # Step 4: Call LiteLlm directly for Claude
        response = await litellm.acompletion(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=800
        )
        
        raw_report_text = response.choices[0].message.content.strip()
        
        # Split into paragraphs and strip whitespace
        paragraphs = [p.strip() for p in raw_report_text.split("\n\n") if p.strip()]
        
        if len(paragraphs) >= 2:
            # If Claude ignored instructions and added headers, the actual text is usually the last two paragraphs
            p1 = paragraphs[-2]
            p2 = paragraphs[-1]
            # Replace the last two with bolded versions
            paragraphs[-2] = f"**Clinical Findings:** {p1}"
            paragraphs[-1] = f"**Differential Diagnosis:** {p2}"
            report_text = "\n\n".join(paragraphs)
        else:
            report_text = f"**Clinical Findings:** {raw_report_text}"
        
        return {
            "status": "success",
            "report": report_text,
            "remaining_tries": remaining_tries,
            "provider": model_name,
        }
        
    except Exception as e:
        logger.error(f"Error calling LiteLlm: {str(e)}")
        raise HTTPException(status_code=503, detail="LLM_UNAVAILABLE")

@app.post("/feedback")
def collect_feedback(feedback: Feedback) -> dict[str, str]:
    """Collect and log feedback."""
    if isinstance(logger, logging.Logger):
        logger.info(f"Feedback collected: {feedback.model_dump()}")
    else:
        logger.log_struct(feedback.model_dump(), severity="INFO")
    return {"status": "success"}

# Main execution
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
