import React from 'react';



interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientAge: number | '';
  clinicianName: string;
  symptomNoiseExposure: boolean;
  symptomBackgroundNoise: boolean;
  symptomHyperacusis: boolean;
  symptomVertigo: boolean;
  symptomTinnitus: boolean;
  symptomTinnitusLocation: 'left' | 'right' | 'both' | '';
  aiReport: string | null;
}

// Helper to parse **bold** text inline
const renderFormattedText = (text: string) => {
  const parts = text.split('**');
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return <strong key={i} style={{ color: '#0f172a' }}>{part}</strong>;
    }
    return part;
  });
};

// Helper to parse basic Markdown elements into React elements
const parseMarkdown = (mdText: string) => {
  return mdText.split('\n').map((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return <h1 key={idx} style={{ fontSize: '22px', color: '#0f172a', margin: '24px 0 12px 0', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>{trimmed.slice(2)}</h1>;
    }
    if (trimmed.startsWith('## ')) {
      return <h2 key={idx} style={{ fontSize: '18px', color: '#1e293b', margin: '20px 0 10px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>{trimmed.slice(3)}</h2>;
    }
    if (trimmed.startsWith('### ')) {
      return <h3 key={idx} style={{ fontSize: '15px', color: '#334155', margin: '16px 0 8px 0', fontWeight: 600 }}>{trimmed.slice(4)}</h3>;
    }
    if (trimmed.startsWith('#### ')) {
      return <h4 key={idx} style={{ fontSize: '14px', color: '#475569', margin: '14px 0 6px 0', fontWeight: 600 }}>{trimmed.slice(5)}</h4>;
    }
    if (trimmed === '---') {
      return <hr key={idx} style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />;
    }
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      return (
        <li key={idx} style={{ margin: '6px 0 6px 20px', fontSize: '13.5px', lineHeight: '1.6' }}>
          {renderFormattedText(trimmed.slice(2))}
        </li>
      );
    }
    if (trimmed === '') {
      return <div key={idx} style={{ height: '8px' }} />;
    }
    return <p key={idx} style={{ margin: '10px 0', fontSize: '13.5px', lineHeight: '1.6' }}>{renderFormattedText(trimmed)}</p>;
  });
};

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  patientName,
  patientAge,
  clinicianName,
  symptomNoiseExposure,
  symptomBackgroundNoise,
  symptomHyperacusis,
  symptomVertigo,
  symptomTinnitus,
  symptomTinnitusLocation,
  aiReport,
}) => {
  if (!isOpen) return null;

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
      }} className="report-modal-content">
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Generated Clinical Report
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#64748b',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body / Report Document */}
        <div id="printable-report-area" style={{ padding: '32px 40px', flex: 1, color: '#334155', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          
          {/* Header Clinic / Patient Details (Always rendered) */}
          <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', color: '#0f172a', margin: '0 0 16px 0', textAlign: 'center', letterSpacing: '-0.5px' }}>
              AUDIOLOGICAL ASSESSMENT REPORT
            </h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
              <div>
                <p style={{ margin: '4px 0' }}><strong>Patient Name:</strong> {patientName || 'Not Specified'}</p>
                <p style={{ margin: '4px 0' }}><strong>Patient Age:</strong> {patientAge !== '' ? `${patientAge} years` : 'Not Specified'}</p>
                <p style={{ margin: '4px 0' }}><strong>Date of Exam:</strong> {new Date().toLocaleDateString()}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '4px 0' }}><strong>Clinician:</strong> {clinicianName || 'Not Specified'}</p>
                <p style={{ margin: '4px 0' }}><strong>Clinic:</strong> Clinical Audiology Services</p>
              </div>
            </div>

            {/* Symptoms Checklist Panel */}
            <div style={{ marginTop: '12px', borderTop: '1px dashed #e2e8f0', paddingTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
              <strong style={{ alignSelf: 'center', fontSize: '13px', color: '#475569' }}>Reported Symptoms:</strong>
              {!(symptomNoiseExposure || symptomBackgroundNoise || symptomHyperacusis || symptomVertigo || symptomTinnitus) && (
                <span style={{ color: '#94a3b8', fontStyle: 'italic', alignSelf: 'center' }}>None reported</span>
              )}
              {symptomNoiseExposure && (
                <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>Noise exposure history</span>
              )}
              {symptomBackgroundNoise && (
                <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>Background noise difficulty</span>
              )}
              {symptomHyperacusis && (
                <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>Hyperacusis</span>
              )}
              {symptomVertigo && (
                <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>Dizziness/Vertigo</span>
              )}
              {symptomTinnitus && (
                <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                  Tinnitus ({symptomTinnitusLocation === 'left' ? 'Left Ear' : symptomTinnitusLocation === 'right' ? 'Right Ear' : 'Bilateral'})
                </span>
              )}
            </div>
          </div>

          {aiReport === "UNAVAILABLE" ? (
            <div style={{
              textAlign: 'center', 
              padding: '40px 20px', 
              margin: '30px 0',
              border: '2px solid #fee2e2', 
              borderRadius: '12px', 
              backgroundColor: '#fef2f2',
              color: '#991b1b'
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '16px', color: '#ef4444' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0' }}>AI Agent Temporarily Offline</h3>
              <p style={{ fontSize: '14.5px', lineHeight: '1.6', margin: 0, color: '#b91c1c' }}>
                The Claude language model is currently experiencing high traffic or undergoing maintenance. 
                The application interface is fully functional, but automated report generation is temporarily paused. 
                Please try again later.
              </p>
            </div>
          ) : aiReport ? (
            <div style={{ textAlign: 'left' }} className="ai-report-body">
              {parseMarkdown(aiReport)}
            </div>
          ) : null}
        </div>

        {/* Modal Footer Controls */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          backgroundColor: '#f8fafc',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '16px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontWeight: 500,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              fontWeight: 500,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0f172a')}
          >
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
};
