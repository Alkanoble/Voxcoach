const STEPS = [
  { key: 'upload', label: 'Uploading audio' },
  { key: 'transcribe', label: 'Speech to text (Whisper)' },
  { key: 'audio', label: 'Audio analysis (pitch, pauses)' },
  { key: 'gemini', label: 'AI analysis (grammar, pronunciation, fillers)' },
];

export default function AnalysisProgress({ currentStep, stepResults, transcript }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="analysis-steps">
      <h2>Analyzing your speech...</h2>
      <div className="steps-list">
        {STEPS.map((step, i) => {
          const result = stepResults[step.key];
          let status = 'pending';
          if (result === 'ok') status = 'done';
          else if (result === 'fail') status = 'fail';
          else if (i === currentIdx) status = 'running';

          return (
            <div key={step.key} className={`step-item step-${status}`}>
              <div className="step-icon">
                {status === 'done' && <span className="check">&#10003;</span>}
                {status === 'fail' && <span className="cross">&#10007;</span>}
                {status === 'running' && <div className="spinner-sm"></div>}
                {status === 'pending' && <span className="dot"></span>}
              </div>
              <div className="step-content">
                <div className="step-label">{step.label}</div>
                {status === 'running' && (
                  <div className="step-running-text">Processing...</div>
                )}
                {status === 'fail' && stepResults[`${step.key}_error`] && (
                  <div className="step-error-text">
                    Failed: {stepResults[`${step.key}_error`]}
                  </div>
                )}
                {step.key === 'transcribe' && status === 'done' && transcript && (
                  <div className="step-transcript-preview">
                    <strong>Transcript:</strong> {transcript.length > 200 ? transcript.slice(0, 200) + '...' : transcript}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
