import { useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { AudiogramChart } from './components/AudiogramChart';
import type { EarData } from './components/AudiogramChart';

import { ReportModal } from './components/ReportModal';
import logoImg from './assets/logo.png';
import './App.css';

const FREQUENCIES = [250, 500, 1000, 2000, 4000, 8000];

const createEmptyEarData = (): EarData => {
  const data: EarData = {};
  FREQUENCIES.forEach((freq) => {
    data[freq] = {
      air: { db: '', masked: false },
      bone: { db: '', masked: false },
    };
  });
  return data;
};


function App() {
  const [rightData, setRightData] = useState<EarData>(createEmptyEarData());
  const [leftData, setLeftData] = useState<EarData>(createEmptyEarData());
  const [lastLoadedCase, setLastLoadedCase] = useState<number>(-1);

  const [activeInputType, setActiveInputType] = useState<'air' | 'bone'>('air');
  const [activeMasked, setActiveMasked] = useState<boolean>(false);

  // Patient Info State
  const [patientName, setPatientName] = useState<string>('');
  const [patientAge, setPatientAge] = useState<number | ''>('');
  const [clinicianName, setClinicianName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Symptoms Checklist State
  const [symptomNoiseExposure, setSymptomNoiseExposure] = useState<boolean>(false);
  const [symptomBackgroundNoise, setSymptomBackgroundNoise] = useState<boolean>(false);
  const [symptomHyperacusis, setSymptomHyperacusis] = useState<boolean>(false);
  const [symptomVertigo, setSymptomVertigo] = useState<boolean>(false);
  const [symptomOtalgia, setSymptomOtalgia] = useState<boolean>(false);
  const [symptomOtorrhea, setSymptomOtorrhea] = useState<boolean>(false);
  const [symptomSuddenLoss, setSymptomSuddenLoss] = useState<boolean>(false);
  const [symptomEarInfection, setSymptomEarInfection] = useState<boolean>(false);
  const [symptomAuralFullness, setSymptomAuralFullness] = useState<boolean>(false);
  const [symptomTinnitus, setSymptomTinnitus] = useState<boolean>(false);
  const [symptomTinnitusLocation, setSymptomTinnitusLocation] = useState<'left' | 'right' | 'both' | ''>('');

  // Speech Audiometry State
  const [speechData, setSpeechData] = useState({
    srtRight: '' as number | '',
    srtLeft: '' as number | '',
    wrsRight: '' as number | '',
    wrsLeft: '' as number | '',
  });

  // Tympanometry State
  const [tympanometryData, setTympanometryData] = useState({
    typeRight: '' as string,
    typeLeft: '' as string,
  });

  // Otoscopy State
  const [otoscopyData, setOtoscopyData] = useState({
    right: { normal: false, perforation: false, canal_redness: false, impacted_cerumen: false },
    left: { normal: false, perforation: false, canal_redness: false, impacted_cerumen: false }
  });

  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [remainingTries, setRemainingTries] = useState<string | number | null>(null);

  // Validate value is either empty or a valid numeric value
  const isNumeric = (val: unknown): boolean => {
    if (val === '' || val === null || val === undefined) return true;
    const num = Number(val);
    return !isNaN(num) && isFinite(num);
  };

  const handleGenerateReport = () => {
    // 1. Validation check for Speech Audiometry & Tympanometry inputs
    const numericFields = [
      { name: 'SRT Right', value: speechData.srtRight },
      { name: 'SRT Left', value: speechData.srtLeft },
      { name: 'WRS Right', value: speechData.wrsRight },
      { name: 'WRS Left', value: speechData.wrsLeft },
    ];

    const invalidFields = numericFields.filter(f => !isNumeric(f.value));
    if (invalidFields.length > 0) {
      alert(`Validation Error: The following fields must contain numeric values:\n${invalidFields.map(f => `• ${f.name}`).join('\n')}`);
      return;
    }

    // 2. Map Audiogram Data to strict JSON object format (substituting empty values with nulls)
    const mapEarData = (data: EarData) => {
      const frequencies = [250, 500, 1000, 2000, 4000, 8000];
      const result: Record<string, any> = {};
      
      frequencies.forEach(freq => {
        const airDb = data[freq].air.db;
        const boneDb = data[freq].bone.db;

        // Double check validations for audiogram inputs
        if (!isNumeric(airDb) || !isNumeric(boneDb)) {
          throw new Error(`Audiogram database error at ${freq}Hz.`);
        }

        result[freq] = {
          air: {
            threshold_db: airDb === '' ? null : Number(airDb),
            masked: data[freq].air.masked,
          },
          bone: {
            threshold_db: boneDb === '' ? null : Number(boneDb),
            masked: data[freq].bone.masked,
          }
        };
      });
      return result;
    };

      try {
        const payload = {
          metadata: {
            patient_name_or_id: patientName.trim() === '' ? null : patientName.trim(),
            patient_age: patientAge === '' ? null : Number(patientAge),
            examining_audiologist: clinicianName.trim() === '' ? null : clinicianName.trim(),
            assessment_date: new Date().toISOString(),
            app_version: "1.0.0"
          },
          audiogram: {
            right_ear: mapEarData(rightData),
            left_ear: mapEarData(leftData)
          },
          speech_audiometry: {
            srt_db_hl: {
              right: speechData.srtRight === '' ? null : Number(speechData.srtRight),
              left: speechData.srtLeft === '' ? null : Number(speechData.srtLeft)
            },
            wrs_percentage: {
              right: speechData.wrsRight === '' ? null : Number(speechData.wrsRight),
              left: speechData.wrsLeft === '' ? null : Number(speechData.wrsLeft)
            }
          },
          tympanometry: {
            type_right: tympanometryData.typeRight === '' ? null : tympanometryData.typeRight,
            type_left: tympanometryData.typeLeft === '' ? null : tympanometryData.typeLeft
          },
          otoscopy: otoscopyData,
          symptoms: {
            noise_exposure: symptomNoiseExposure,
            background_noise_difficulty: symptomBackgroundNoise,
            hyperacusis: symptomHyperacusis,
            vertigo_balance: symptomVertigo,
            otalgia: symptomOtalgia,
            otorrhea: symptomOtorrhea,
            sudden_fluctuating_loss: symptomSuddenLoss,
            history_ear_infections_surgeries: symptomEarInfection,
            aural_fullness: symptomAuralFullness,
            tinnitus: {
              present: symptomTinnitus,
              location: symptomTinnitus ? (symptomTinnitusLocation === '' ? null : symptomTinnitusLocation) : null
            }
          },
          clinical_notes: notes.trim() === '' ? null : notes.trim()
        };

        const payloadStr = JSON.stringify(payload, null, 2);

        setLoadingReport(true);
        fetch('/api/generate-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: payloadStr
        })
        .then(res => {
          if (res.status === 429) {
            throw new Error("RateLimit");
          }
          if (res.status === 503) {
            throw new Error("Unavailable");
          }
          if (!res.ok) throw new Error("Server error");
          return res.json();
        })
        .then(data => {
          setRemainingTries(data.remaining_tries);
          setAiReport(data.report);
          setIsReportOpen(true);
        })
        .catch(err => {
          if (err.message === "RateLimit") {
            setRemainingTries(0);
            alert("Security Protocol: Your IP address has reached the maximum daily backend limit (7 reports). Please try again tomorrow.");
          } else {
            console.warn("AI Agent unavailable.", err);
            setAiReport("UNAVAILABLE");
            setIsReportOpen(true);
          }
        })
        .finally(() => {
          setLoadingReport(false);
        });

      } catch (e: unknown) {
        if (e instanceof Error) {
          alert(`Critical mapping error: ${e.message}`);
        } else {
          alert(`Critical mapping error: ${String(e)}`);
        }
      }
    };

  const handlePointChange = (
    isRight: boolean,
    frequency: number,
    type: 'air' | 'bone',
    db: number | ''
  ) => {
    const setter = isRight ? setRightData : setLeftData;
    setter((prev) => ({
      ...prev,
      [frequency]: {
        ...prev[frequency],
        [type]: {
          ...prev[frequency][type],
          db,
          masked: activeMasked, // Automatically applies the active masking state when plotted from chart
        },
      },
    }));
  };

  const handleLoadSample = () => {
    const cases = [
      {
        name: 'Timmy', age: 7, clinician: 'Kasra Bagherian',
        speech: { srtRight: 35, srtLeft: 30, wrsRight: 96, wrsLeft: 96 },
        tymp: { typeRight: 'B', typeLeft: 'B' },
        otoscopy: {
          right: { normal: false, perforation: false, canal_redness: true, impacted_cerumen: false },
          left: { normal: false, perforation: false, canal_redness: true, impacted_cerumen: false }
        },
        symptoms: { noise: false, bgNoise: false, hyper: false, vertigo: false, otalgia: true, otorrhea: false, sudden: false, infections: true, fullness: true, tinnitus: false, loc: '' },
        notes: '',
        buildEar: (db: number) => {
          const ear = createEmptyEarData();
          [250,500,1000,2000,4000,8000].forEach(f => {
            ear[f].air = { db: db, masked: false };
            ear[f].bone = { db: 5, masked: false };
          });
          return ear;
        }
      },
      {
        name: 'John', age: 28, clinician: 'Kasra Bagherian',
        speech: { srtRight: 40, srtLeft: 10, wrsRight: 80, wrsLeft: 100 },
        tymp: { typeRight: 'An', typeLeft: 'An' },
        otoscopy: {
          right: { normal: true, perforation: false, canal_redness: false, impacted_cerumen: false },
          left: { normal: true, perforation: false, canal_redness: false, impacted_cerumen: false }
        },
        symptoms: { noise: false, bgNoise: false, hyper: false, vertigo: true, otalgia: false, otorrhea: false, sudden: true, infections: false, fullness: true, tinnitus: true, loc: 'right' },
        notes: '',
        buildEar: (isRight: boolean) => {
          const ear = createEmptyEarData();
          [250,500,1000,2000,4000,8000].forEach(f => {
            if (isRight) {
              ear[f].air = { db: f <= 1000 ? 50 : 20, masked: false };
              ear[f].bone = { db: f <= 1000 ? 50 : 20, masked: true };
            } else {
              ear[f].air = { db: 10, masked: false };
            }
          });
          return ear;
        }
      },
      {
        name: 'Martha', age: 70, clinician: 'Kasra Bagherian',
        speech: { srtRight: 30, srtLeft: 30, wrsRight: 72, wrsLeft: 76 },
        tymp: { typeRight: 'An', typeLeft: 'An' },
        otoscopy: {
          right: { normal: true, perforation: false, canal_redness: false, impacted_cerumen: false },
          left: { normal: true, perforation: false, canal_redness: false, impacted_cerumen: false }
        },
        symptoms: { noise: false, bgNoise: true, hyper: false, vertigo: false, otalgia: false, otorrhea: false, sudden: false, infections: false, fullness: false, tinnitus: true, loc: 'both' },
        notes: '',
        buildEar: () => {
          const ear = createEmptyEarData();
          ear[250] = { air: { db: 20, masked: false }, bone: { db: 20, masked: false } };
          ear[500] = { air: { db: 25, masked: false }, bone: { db: 25, masked: false } };
          ear[1000] = { air: { db: 35, masked: false }, bone: { db: 35, masked: false } };
          ear[2000] = { air: { db: 50, masked: false }, bone: { db: 50, masked: false } };
          ear[4000] = { air: { db: 65, masked: false }, bone: { db: 65, masked: false } };
          ear[8000] = { air: { db: 75, masked: false }, bone: { db: 70, masked: false } };
          return ear;
        }
      },
      {
        name: 'David', age: 45, clinician: 'Kasra Bagherian',
        speech: { srtRight: 10, srtLeft: 45, wrsRight: 100, wrsLeft: 32 },
        tymp: { typeRight: 'An', typeLeft: 'An' },
        otoscopy: {
          right: { normal: true, perforation: false, canal_redness: false, impacted_cerumen: false },
          left: { normal: true, perforation: false, canal_redness: false, impacted_cerumen: false }
        },
        symptoms: { noise: false, bgNoise: false, hyper: false, vertigo: true, otalgia: false, otorrhea: false, sudden: false, infections: false, fullness: false, tinnitus: true, loc: 'left' },
        notes: '',
        buildEar: (isRight: boolean) => {
          const ear = createEmptyEarData();
          [250,500,1000,2000,4000,8000].forEach(f => {
            if (isRight) {
              ear[f].air = { db: 10, masked: false };
            } else {
              ear[f].air = { db: 50, masked: false };
              ear[f].bone = { db: 50, masked: true };
            }
          });
          return ear;
        }
      }
    ];

    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * cases.length);
    } while (nextIndex === lastLoadedCase);
    
    setLastLoadedCase(nextIndex);
    const selected = cases[nextIndex];

    setPatientName(selected.name);
    setPatientAge(selected.age as number);
    setClinicianName(selected.clinician);
    
    if (nextIndex === 0) {
      setRightData((selected.buildEar as any)(35));
      setLeftData((selected.buildEar as any)(30));
    } else if (nextIndex === 1 || nextIndex === 3) {
      setRightData((selected.buildEar as any)(true));
      setLeftData((selected.buildEar as any)(false));
    } else {
      setRightData((selected.buildEar as any)());
      setLeftData((selected.buildEar as any)());
    }

    setSpeechData(selected.speech as any);
    setTympanometryData(selected.tymp);
    setOtoscopyData(selected.otoscopy);
    
    setSymptomNoiseExposure(selected.symptoms.noise);
    setSymptomBackgroundNoise(selected.symptoms.bgNoise);
    setSymptomHyperacusis(selected.symptoms.hyper);
    setSymptomVertigo(selected.symptoms.vertigo);
    setSymptomOtalgia(selected.symptoms.otalgia);
    setSymptomOtorrhea(selected.symptoms.otorrhea);
    setSymptomSuddenLoss(selected.symptoms.sudden);
    setSymptomEarInfection(selected.symptoms.infections);
    setSymptomAuralFullness(selected.symptoms.fullness);
    setSymptomTinnitus(selected.symptoms.tinnitus);
    setSymptomTinnitusLocation(selected.symptoms.loc as any);
    
    setNotes(selected.notes);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all data?')) {
      setRightData(createEmptyEarData());
      setLeftData(createEmptyEarData());
      setPatientName('');
      setPatientAge('');
      setClinicianName('');
      setNotes('');
      setSpeechData({
        srtRight: '',
        srtLeft: '',
        wrsRight: '',
        wrsLeft: '',
      });
      setTympanometryData({
        typeRight: '',
        typeLeft: '',
      });
      setSymptomNoiseExposure(false);
      setSymptomBackgroundNoise(false);
      setSymptomHyperacusis(false);
      setSymptomVertigo(false);
      setSymptomTinnitus(false);
      setSymptomTinnitusLocation('');
      setAiReport(null);
    }
  };

  return (
    <div className="dashboard-container">
      <style>{`
        .btn-sample-load {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13.5px;
          border: 1px solid #eab308;
          cursor: pointer;
          background-color: #fef08a;
          color: #854d0e;
          animation: pulse-glow 2s infinite;
          transition: all 0.2s ease;
        }

        @keyframes pulse-glow {
          0% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(234, 179, 8, 0); }
          100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); }
        }

        .btn-sample-load:hover {
          background-color: #fde047;
          transform: translateY(-1px);
        }
      `}</style>
      {/* Clinic Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="clinic-logo-mark" style={{ background: 'none', boxShadow: 'none', width: '42px', height: '42px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={logoImg} alt="AudioReport AI Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <h1>AudioReport AI</h1>
          </div>
        </div>
        
        <div className="header-actions">
          <button className="btn-sample-load" onClick={handleLoadSample}>
            Load a Sample!
          </button>
          <button className="btn-danger" onClick={handleClearAll}>
            Clear Fields
          </button>
        </div>
      </header>

      {/* Patient & Clinic Details Section */}
      <section className="dashboard-section card-box" style={{ marginTop: '0', borderTop: 'none' }}>
        <h2 className="section-title text-center">Patient Information</h2>
        <div className="patient-inputs">
          <div className="form-group">
            <label htmlFor="patient-name">Patient Name / ID</label>
            <input
              type="text"
              id="patient-name"
              placeholder="e.g. John Doe / Patient #983"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="patient-age">Patient Age</label>
            <input
              type="number"
              id="patient-age"
              placeholder="e.g. 54"
              min={0}
              max={120}
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="clinician-name">Examining Audiologist</label>
            <input
              type="text"
              id="clinician-name"
              placeholder="e.g. Dr. Jane Carter, Au.D."
              value={clinicianName}
              onChange={(e) => setClinicianName(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Patient Symptom Checklist Section */}
      <section className="dashboard-section card-box">
        <h2 className="section-title text-center">Patient Symptom Checklist</h2>
        <div className="symptoms-checklist-grid">
          <div className="checkbox-item">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={symptomNoiseExposure}
                onChange={(e) => setSymptomNoiseExposure(e.target.checked)}
              />
              <span className="checkbox-label">History of noise exposure</span>
            </label>
          </div>
          <div className="checkbox-item">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={symptomBackgroundNoise}
                onChange={(e) => setSymptomBackgroundNoise(e.target.checked)}
              />
              <span className="checkbox-label">Difficulty hearing in background noise</span>
            </label>
          </div>
          <div className="checkbox-item">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={symptomHyperacusis}
                onChange={(e) => setSymptomHyperacusis(e.target.checked)}
              />
              <span className="checkbox-label">Hypersensitivity to loud sounds (Hyperacusis)</span>
            </label>
          </div>
          <div className="checkbox-item">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={symptomVertigo}
                onChange={(e) => setSymptomVertigo(e.target.checked)}
              />
              <span className="checkbox-label">Dizziness, vertigo, or balance concerns</span>
            </label>
          </div>
          <div className="checkbox-item">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={symptomOtalgia}
                onChange={(e) => setSymptomOtalgia(e.target.checked)}
              />
              <span className="checkbox-label">Otalgia (Ear Pain)</span>
            </label>
          </div>
          <div className="checkbox-item">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={symptomOtorrhea}
                onChange={(e) => setSymptomOtorrhea(e.target.checked)}
              />
              <span className="checkbox-label">Otorrhea (Ear Drainage)</span>
            </label>
          </div>
          <div className="checkbox-item">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={symptomSuddenLoss}
                onChange={(e) => setSymptomSuddenLoss(e.target.checked)}
              />
              <span className="checkbox-label">Sudden or Fluctuating Hearing Loss</span>
            </label>
          </div>
          <div className="checkbox-item">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={symptomEarInfection}
                onChange={(e) => setSymptomEarInfection(e.target.checked)}
              />
              <span className="checkbox-label">History of Ear Infections or Surgeries</span>
            </label>
          </div>
          <div className="checkbox-item">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={symptomAuralFullness}
                onChange={(e) => setSymptomAuralFullness(e.target.checked)}
              />
              <span className="checkbox-label">Aural Fullness</span>
            </label>
          </div>
          <div className="checkbox-item tinnitus-section-wrapper">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={symptomTinnitus}
                onChange={(e) => {
                  setSymptomTinnitus(e.target.checked);
                  if (!e.target.checked) setSymptomTinnitusLocation('');
                }}
              />
              <span className="checkbox-label">Tinnitus (ringing in the ears)</span>
            </label>

            {symptomTinnitus && (
              <div className="tinnitus-locations-wrapper">
                <span className="tinnitus-loc-label">Select location:</span>
                <div className="radio-options-row">
                  <label className="radio-container">
                    <input
                      type="radio"
                      name="tinnitus-loc"
                      value="left"
                      checked={symptomTinnitusLocation === 'left'}
                      onChange={() => setSymptomTinnitusLocation('left')}
                    />
                    <span className="radio-label">Left Ear</span>
                  </label>
                  <label className="radio-container">
                    <input
                      type="radio"
                      name="tinnitus-loc"
                      value="right"
                      checked={symptomTinnitusLocation === 'right'}
                      onChange={() => setSymptomTinnitusLocation('right')}
                    />
                    <span className="radio-label">Right Ear</span>
                  </label>
                  <label className="radio-container">
                    <input
                      type="radio"
                      name="tinnitus-loc"
                      value="both"
                      checked={symptomTinnitusLocation === 'both'}
                      onChange={() => setSymptomTinnitusLocation('both')}
                    />
                    <span className="radio-label">Bilateral (Both)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Audiometry Section */}
      <section className="dashboard-section">
        <div className="section-header-row">
          <h2 className="section-title">Pure Tone Audiogram (250Hz - 8000Hz)</h2>
          <div className="chart-mode-controls">
            <span className="control-label">Plot Mode:</span>
            <div className="button-group">
              <button
                className={`mode-btn ${activeInputType === 'air' ? 'active' : ''}`}
                onClick={() => setActiveInputType('air')}
              >
                Air Conduction
              </button>
              <button
                className={`mode-btn ${activeInputType === 'bone' ? 'active' : ''}`}
                onClick={() => setActiveInputType('bone')}
              >
                Bone Conduction
              </button>
            </div>
            <label className="masked-toggle-wrapper">
              <input
                type="checkbox"
                checked={activeMasked}
                onChange={(e) => setActiveMasked(e.target.checked)}
              />
              <span className="toggle-label">Masked Testing</span>
            </label>
          </div>
        </div>

        {/* Interactive Charts Side-By-Side */}
        <div className="audiograms-layout">
          <AudiogramChart
            isRight={true}
            data={rightData}
            onPointChange={(freq, type, db) => handlePointChange(true, freq, type, db)}
            activeInputType={activeInputType}
          />
          <AudiogramChart
            isRight={false}
            data={leftData}
            onPointChange={(freq, type, db) => handlePointChange(false, freq, type, db)}
            activeInputType={activeInputType}
          />
        </div>


      </section>

      {/* Unified Clinical Grid */}
      <section className="dashboard-section card-box unified-clinical-section">
        <h2 className="section-title text-center">Speech, Otoscopy &amp; Tympanometry</h2>
        <div className="unified-clinical-grid">
          
          {/* Right Ear Column */}
          <div className="ear-column right-column">
            <h3 className="column-title right-title">Right Ear</h3>
            
            {/* Right Speech */}
            <div className="ear-field-group right-theme">
              <h4>Speech</h4>
              <div className="field-row">
                <div className="form-group">
                  <label htmlFor="srt-right">SRT (dB HL)</label>
                  <input
                    type="number"
                    id="srt-right"
                    min={0}
                    max={120}
                    step={5}
                    placeholder="—"
                    value={speechData.srtRight}
                    onChange={(e) =>
                      setSpeechData((prev) => ({ ...prev, srtRight: e.target.value === '' ? '' : Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="wrs-right">WRS (%)</label>
                  <input
                    type="number"
                    id="wrs-right"
                    min={0}
                    max={100}
                    step={2}
                    placeholder="—"
                    value={speechData.wrsRight}
                    onChange={(e) =>
                      setSpeechData((prev) => ({ ...prev, wrsRight: e.target.value === '' ? '' : Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Right Otoscopy */}
            <div className="ear-field-group right-theme">
              <h4>Otoscopy</h4>
              <div className="otoscopy-options">
                {['normal', 'perforation', 'canal_redness', 'impacted_cerumen'].map((opt) => (
                  <label key={`right-${opt}`} className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={otoscopyData.right[opt as keyof typeof otoscopyData.right]}
                      onChange={(e) => setOtoscopyData(prev => ({ ...prev, right: { ...prev.right, [opt]: e.target.checked } }))}
                    />
                    <span className="checkbox-label">{opt.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Right Tympanometry */}
            <div className="ear-field-group right-theme">
              <h4>Tympanometry</h4>
              <div className="form-group">
                <label htmlFor="tymp-type-right">Type</label>
                <select
                  id="tymp-type-right"
                  value={tympanometryData.typeRight}
                  onChange={(e) => setTympanometryData((prev) => ({ ...prev, typeRight: e.target.value }))}
                >
                  <option value="">— Not Tested —</option>
                  <option value="An">Aₙ (Normal)</option>
                  <option value="As">Aₛ (Stiff)</option>
                  <option value="B">B (Flat)</option>
                  <option value="C">C (Negative)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Left Ear Column */}
          <div className="ear-column left-column">
            <h3 className="column-title left-title">Left Ear</h3>
            
            {/* Left Speech */}
            <div className="ear-field-group left-theme">
              <h4>Speech</h4>
              <div className="field-row">
                <div className="form-group">
                  <label htmlFor="srt-left">SRT (dB HL)</label>
                  <input
                    type="number"
                    id="srt-left"
                    min={0}
                    max={120}
                    step={5}
                    placeholder="—"
                    value={speechData.srtLeft}
                    onChange={(e) =>
                      setSpeechData((prev) => ({ ...prev, srtLeft: e.target.value === '' ? '' : Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="wrs-left">WRS (%)</label>
                  <input
                    type="number"
                    id="wrs-left"
                    min={0}
                    max={100}
                    step={2}
                    placeholder="—"
                    value={speechData.wrsLeft}
                    onChange={(e) =>
                      setSpeechData((prev) => ({ ...prev, wrsLeft: e.target.value === '' ? '' : Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Left Otoscopy */}
            <div className="ear-field-group left-theme">
              <h4>Otoscopy</h4>
              <div className="otoscopy-options">
                {['normal', 'perforation', 'canal_redness', 'impacted_cerumen'].map((opt) => (
                  <label key={`left-${opt}`} className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={otoscopyData.left[opt as keyof typeof otoscopyData.left]}
                      onChange={(e) => setOtoscopyData(prev => ({ ...prev, left: { ...prev.left, [opt]: e.target.checked } }))}
                    />
                    <span className="checkbox-label">{opt.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Left Tympanometry */}
            <div className="ear-field-group left-theme">
              <h4>Tympanometry</h4>
              <div className="form-group">
                <label htmlFor="tymp-type-left">Type</label>
                <select
                  id="tymp-type-left"
                  value={tympanometryData.typeLeft}
                  onChange={(e) => setTympanometryData((prev) => ({ ...prev, typeLeft: e.target.value }))}
                >
                  <option value="">— Not Tested —</option>
                  <option value="An">Aₙ (Normal)</option>
                  <option value="As">Aₛ (Stiff)</option>
                  <option value="B">B (Flat)</option>
                  <option value="C">C (Negative)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Clinical Notes Section */}
      <section className="dashboard-section notes-card">
        <h2 className="section-title">Clinical Notes &amp; Observations</h2>
        <div className="form-group">
          <textarea
            id="clinical-notes"
            rows={4}
            placeholder="Type observations, diagnostic impressions, or rehabilitation recommendations here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: '100%', resize: 'vertical' }}
          ></textarea>
        </div>
      </section>

      {/* Bottom Generate Report Panel */}
      <footer className="action-footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <button className="btn-primary" onClick={handleGenerateReport} disabled={loadingReport || remainingTries === 0}>
          {loadingReport ? (
            <>
              <span className="loading-spinner"></span>
              Analyzing with AI Agent...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '8px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Generate Report
            </>
          )}
        </button>
        {remainingTries === 0 ? (
          <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '14.5px', marginTop: '4px' }}>Out of tries for today. Please come back tomorrow!</div>
        ) : remainingTries !== null ? (
          <div style={{ color: '#64748b', fontSize: '13.5px', marginTop: '4px' }}>
            {typeof remainingTries === 'string' ? remainingTries : `You have ${remainingTries} free tries left today.`}
          </div>
        ) : null}
      </footer>

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        patientName={patientName}
        patientAge={patientAge}
        clinicianName={clinicianName}
        symptomNoiseExposure={symptomNoiseExposure}
        symptomBackgroundNoise={symptomBackgroundNoise}
        symptomHyperacusis={symptomHyperacusis}
        symptomVertigo={symptomVertigo}
        symptomTinnitus={symptomTinnitus}
        symptomTinnitusLocation={symptomTinnitusLocation}
        aiReport={aiReport}
      />
      <Analytics />
    </div>
  );
}

export default App;
