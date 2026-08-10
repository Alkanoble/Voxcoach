import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { uploadAudio, createRecording } from '../api/recordings';
import AudioRecorder from '../components/AudioRecorder';
import FileUploader from '../components/FileUploader';
import AnalysisProgress from '../components/AnalysisProgress';

const INTERVIEW_QUESTIONS = [
  "Tell me about a time you had to handle a difficult project deadline.",
  "Describe a situation where you had a conflict with a coworker and how you resolved it.",
  "What is your greatest professional achievement so far?",
  "Tell me about a time you failed and what you learned from it.",
  "How do you prioritize your work when you have multiple urgent tasks?",
  "Describe a time when you had to adapt to a significant change at work.",
  "Tell me about a time you took the initiative to improve a process or system.",
  "Why do you want to work for this company?",
  "Give an example of a time you showed leadership skills.",
  "Tell me about a time you made a mistake. How did you handle it?"
];

export default function RecordPage() {
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [stepResults, setStepResults] = useState({});
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  
  // Interview Mode States
  const [recordingMode, setRecordingMode] = useState('freestyle');
  const [interviewQuestion, setInterviewQuestion] = useState('');
  const [isReading, setIsReading] = useState(false);

  const navigate = useNavigate();

  const startInterviewRound = () => {
    const q = INTERVIEW_QUESTIONS[Math.floor(Math.random() * INTERVIEW_QUESTIONS.length)];
    setInterviewQuestion(q);
    setIsReading(true);

    const utterance = new SpeechSynthesisUtterance(q);
    utterance.rate = 0.9;
    utterance.onend = () => setIsReading(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleRecordingComplete = (blob) => {
    setAudioBlob(blob);
    setUploadedFile(null);
    setError('');
  };

  const handleFileSelected = (file) => {
    setUploadedFile(file);
    setAudioBlob(null);
    setError('');
  };

  const updateResult = (key, result, errorMsg) => {
    setStepResults((prev) => ({
      ...prev,
      [key]: result,
      ...(errorMsg ? { [`${key}_error`]: errorMsg } : {}),
    }));
  };

  const handleAnalyze = async () => {
    const fileToUpload = audioBlob || uploadedFile;
    if (!fileToUpload) {
      setError('Please record audio or upload a file first.');
      return;
    }

    setAnalyzing(true);
    setError('');
    setStepResults({});
    setTranscript('');

    let recordingId;

    // Step 1: Upload directly to backend
    setCurrentStep('upload');
    try {
      // First create the Firestore document but without a storagePath/downloadURL
      recordingId = await createRecording({
        filename: fileToUpload.name || 'recording.webm',
        durationSeconds: 0,
        mode: recordingMode,
        question: recordingMode === 'interview' ? interviewQuestion : null
      });
      
      const formData = new FormData();
      formData.append('file', fileToUpload);
      await api.post(`/analysis/${recordingId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      updateResult('upload', 'ok');
    } catch (err) {
      updateResult('upload', 'fail', err.message || 'Upload failed');
      setCurrentStep('');
      return;
    }

    // Step 2: Transcribe (Whisper)
    setCurrentStep('transcribe');
    try {
      const res = await api.post(`/analysis/${recordingId}/step/transcribe`);
      if (res.data.whisper_ok) {
        updateResult('transcribe', 'ok');
        setTranscript(res.data.transcript || '');
      } else {
        const errMsg = res.data.errors?.find((e) => e.startsWith('Transcription')) || 'Unknown error';
        updateResult('transcribe', 'fail', errMsg);
      }
    } catch (err) {
      updateResult('transcribe', 'fail', err.response?.data?.detail || 'Transcription failed');
    }

    // Step 3: Audio analysis
    setCurrentStep('audio');
    try {
      const res = await api.post(`/analysis/${recordingId}/step/audio`);
      if (res.data.audio_ok) {
        updateResult('audio', 'ok');
      } else {
        const errMsg = res.data.errors?.find((e) => e.startsWith('Audio')) || 'Unknown error';
        updateResult('audio', 'fail', errMsg);
      }
    } catch (err) {
      updateResult('audio', 'fail', err.response?.data?.detail || 'Audio analysis failed');
    }

    // Step 4: Gemini AI analysis
    setCurrentStep('gemini');
    try {
      const res = await api.post(`/analysis/${recordingId}/step/gemini`);
      if (res.data.gemini_ok) {
        updateResult('gemini', 'ok');
      } else {
        const errMsg = res.data.errors?.find((e) => e.startsWith('AI')) || 'Unknown error';
        updateResult('gemini', 'fail', errMsg);
      }
    } catch (err) {
      updateResult('gemini', 'fail', err.response?.data?.detail || 'AI analysis failed');
    }

    // Done — navigate to report
    setCurrentStep('');
    navigate(`/report/${recordingId}`);
  };

  if (analyzing) {
    return (
      <AnalysisProgress
        currentStep={currentStep}
        stepResults={stepResults}
        transcript={transcript}
      />
    );
  }

  return (
    <div className="record-page">
      <h2>Record or Upload Speech</h2>
      <p>Record yourself speaking in English, or upload an existing audio file for analysis.</p>

      {/* Mode Toggle */}
      <div className="mode-toggle" style={{ display: 'flex', gap: '12px', marginBottom: '24px', marginTop: '24px' }}>
        <button 
          className={`btn ${recordingMode === 'freestyle' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => {
            setRecordingMode('freestyle');
            setInterviewQuestion('');
            window.speechSynthesis.cancel();
          }}
        >
          Freestyle Mode
        </button>
        <button 
          className={`btn ${recordingMode === 'interview' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setRecordingMode('interview')}
        >
          Interview Practice
        </button>
      </div>

      {recordingMode === 'interview' && (
        <div className="interview-panel" style={{ background: 'var(--surface-raised)', padding: '32px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginBottom: '32px' }}>
          {!interviewQuestion ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: '16px', color: 'var(--text)' }}>Ready to practice? We will read you a behavioral question out loud.</p>
              <button className="btn btn-primary" onClick={startInterviewRound}>Start Interview Round</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ color: 'var(--ch-800)', fontSize: '24px', marginBottom: '16px', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: '500' }}>"{interviewQuestion}"</h3>
              {isReading ? (
                <p style={{ color: 'var(--ch-600)', fontWeight: '500' }}>Listening to question...</p>
              ) : (
                <p style={{ color: 'rgba(39, 174, 96, 1)', fontWeight: '600' }}>Now start recording your answer below!</p>
              )}
              <button className="btn btn-outline btn-sm" onClick={startInterviewRound} style={{ marginTop: '24px' }}>Get Another Question</button>
            </div>
          )}
        </div>
      )}

      <div className="record-sections">
        <div className="record-section">
          <h3>Record Audio</h3>
          <AudioRecorder onRecordingComplete={handleRecordingComplete} />
        </div>

        <div className="record-divider">
          <span>OR</span>
        </div>

        <div className="record-section">
          <h3>Upload Audio File</h3>
          <FileUploader onFileSelected={handleFileSelected} />
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <button
        onClick={handleAnalyze}
        className="btn btn-primary btn-analyze"
        disabled={!audioBlob && !uploadedFile}
      >
        Analyze Speech
      </button>
    </div>
  );
}
