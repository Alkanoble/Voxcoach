import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer,
} from 'recharts';
import api from '../api/client';
import { getReport } from '../api/recordings';

/* ─────────────────────────────────────────
   Animated counter for score reveal
───────────────────────────────────────── */
function AnimatedNumber({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value == null) return;
    let start = 0;
    const step = Math.ceil(value / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display}</>;
}

/* ─────────────────────────────────────────
   Score Gauge — warm cinnamon palette
───────────────────────────────────────── */
function ScoreGauge({ score }) {
  const size = 160;
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score != null ? (score / 100) * circumference : 0;
  const color = score >= 75 ? '#3A6B50' : score >= 50 ? '#A8721A' : '#A8353B';
  const trackColor = 'rgba(185, 88, 42, 0.12)';

  return (
    <div className="score-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={trackColor} strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="score-gauge-text">
        <span className="score-gauge-number" style={{ color }}>
          <AnimatedNumber value={score ?? 0} />
        </span>
        <span className="score-gauge-label">Overall</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Radar — cinnamon strokes
───────────────────────────────────────── */
function SkillRadar({ report }) {
  const data = [
    { skill: 'Grammar',       value: report.score_grammar ?? 0 },
    { skill: 'Pronunciation', value: report.score_pronunciation ?? 0 },
    { skill: 'Vocabulary',    value: report.score_vocabulary ?? 0 },
    { skill: 'Confidence',    value: report.score_confidence ?? 0 },
    { skill: 'Fluency',       value: report.score_fluency ?? 0 },
  ];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
        <PolarGrid stroke="rgba(185,88,42,0.15)" />
        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12, fill: '#C97848', fontFamily: 'Jost, sans-serif', fontWeight: 500 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="value" stroke="#9B4520" fill="#9B4520" fillOpacity={0.15} strokeWidth={2} dot={{ fill: '#9B4520', r: 3 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ─────────────────────────────────────────
   Score Breakdown bar chart
───────────────────────────────────────── */
function ScoreBreakdown({ report }) {
  const data = [
    { name: 'Grammar',       score: report.score_grammar ?? 0 },
    { name: 'Pronunciation', score: report.score_pronunciation ?? 0 },
    { name: 'Vocabulary',    score: report.score_vocabulary ?? 0 },
    { name: 'Confidence',    score: report.score_confidence ?? 0 },
    { name: 'Fluency',       score: report.score_fluency ?? 0 },
  ];
  const getColor = (s) => s >= 75 ? '#3A6B50' : s >= 50 ? '#A8721A' : '#A8353B';

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(185,88,42,0.1)" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#C97848' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#7A3318', fontFamily: 'Jost, sans-serif' }} width={95} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v) => [`${v}/100`, 'Score']}
          contentStyle={{ background: '#FEFAF3', border: '1px solid rgba(185,88,42,0.2)', borderRadius: 8, fontFamily: 'Jost, sans-serif', fontSize: 13 }}
        />
        <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={16}>
          {data.map((entry, i) => <Cell key={i} fill={getColor(entry.score)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ─────────────────────────────────────────
   Transcript with filler word highlighting
   + word-hover interactions
───────────────────────────────────────── */
function HighlightedTranscript({ transcript, fillerWords, lowConfidenceWords }) {
  const [hoveredFiller, setHoveredFiller] = useState(null);
  const [showLegend, setShowLegend] = useState(true);

  if (!transcript) return <p className="transcript-empty">No transcript available.</p>;

  // Build a set of filler words (lowercase)
  const fillerSet = new Set(
    (fillerWords || []).map(f => f.word.toLowerCase().replace(/['"]/g, ''))
  );
  const fillerCounts = {};
  (fillerWords || []).forEach(f => {
    fillerCounts[f.word.toLowerCase().replace(/['"]/g, '')] = f.count;
  });

  // Build a set of low confidence words
  const lowConfSet = new Set(
    (lowConfidenceWords || []).map(w => w.word.toLowerCase())
  );

  // Tokenize transcript into words + punctuation/spaces
  const tokens = transcript.match(/[\w']+|[^\w']+/g) || [];

  return (
    <div className="transcript-interactive">
      {showLegend && (
        <div className="transcript-legend">
          <span className="legend-item">
            <span className="legend-dot filler-dot"></span>Filler word
          </span>
          <span className="legend-item">
            <span className="legend-dot lowconf-dot"></span>Low confidence
          </span>
          <button className="legend-close" onClick={() => setShowLegend(false)}>×</button>
        </div>
      )}
      <p className="transcript-text">
        {tokens.map((token, i) => {
          const clean = token.toLowerCase().replace(/['".,!?;:]/g, '');
          const isFiller = fillerSet.has(clean);
          const isLowConf = lowConfSet.has(clean);

          if (isFiller) {
            const count = fillerCounts[clean];
            return (
              <span
                key={i}
                className={`word-filler ${hoveredFiller === clean ? 'word-filler--active' : ''}`}
                onMouseEnter={() => setHoveredFiller(clean)}
                onMouseLeave={() => setHoveredFiller(null)}
                title={`Filler word — used ${count}x`}
              >
                {token}
                <span className="filler-badge-inline">{count}×</span>
              </span>
            );
          }
          if (isLowConf) {
            return (
              <span key={i} className="word-lowconf" title="Low transcription confidence">
                {token}
              </span>
            );
          }
          return <span key={i}>{token}</span>;
        })}
      </p>
      {hoveredFiller && (
        <div className="transcript-tooltip">
          <strong>"{hoveredFiller}"</strong> — used {fillerCounts[hoveredFiller]}× in this speech
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Collapsible section wrapper
───────────────────────────────────────── */
function ReportSection({ title, count, children, defaultOpen = true, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`report-section-elegant ${open ? 'is-open' : ''}`} style={accent ? { '--section-accent': accent } : {}}>
      <button className="section-header" onClick={() => setOpen(o => !o)}>
        <span className="section-header-left">
          <span className="section-accent-bar"></span>
          <span className="section-title">{title}</span>
          {count != null && <span className="section-count">{count}</span>}
        </span>
        <span className={`section-chevron ${open ? 'up' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      <div className="section-body">
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Status Banner
───────────────────────────────────────── */
function StatusBanner({ report }) {
  const allOk = report.whisper_ok && report.audio_ok && report.gemini_ok;
  if (allOk) return null;
  return (
    <div className="status-banner">
      <h4>Analysis Status</h4>
      <div className="status-items">
        <span className={report.whisper_ok ? 'status-ok' : 'status-fail'}>{report.whisper_ok ? 'Transcription OK' : 'Transcription failed'}</span>
        <span className={report.audio_ok ? 'status-ok' : 'status-fail'}>{report.audio_ok ? 'Audio OK' : 'Audio failed'}</span>
        <span className={report.gemini_ok ? 'status-ok' : 'status-fail'}>{report.gemini_ok ? 'AI Analysis OK' : 'AI failed'}</span>
      </div>
      {report.errors?.length > 0 && (
        <div className="status-errors">{report.errors.map((e, i) => <p key={i} className="status-error-msg">{e}</p>)}</div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Rephrase Panel
───────────────────────────────────────── */
const REPHRASE_STYLES = [
  { value: 'natural', label: 'Natural' },
  { value: 'formal', label: 'Formal' },
  { value: 'confident', label: 'Confident' },
  { value: 'concise', label: 'Concise' },
  { value: 'simple', label: 'Simple' },
];

function RephrasePanel({ transcript }) {
  const [text, setText] = useState(transcript || '');
  const [style, setStyle] = useState('natural');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRephrase() {
    if (!text.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await api.post('/analysis/rephrase', { text: text.trim(), style, count: 3 });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Rephrase failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rephrase-panel">
      <p className="rephrase-hint">Paste or type any sentence from your speech to get cleaner alternatives.</p>
      <textarea
        className="rephrase-input"
        rows={3}
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null); }}
        placeholder="Type or paste a sentence here..."
      />
      <div className="rephrase-controls">
        <div className="rephrase-style-group">
          <label>Style</label>
          <div className="rephrase-style-pills">
            {REPHRASE_STYLES.map((s) => (
              <button key={s.value}
                className={`rephrase-pill ${style === s.value ? 'active' : ''}`}
                onClick={() => { setStyle(s.value); setResult(null); }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleRephrase} disabled={loading || !text.trim()}>
          {loading ? 'Rephrasing…' : 'Rephrase'}
        </button>
      </div>
      {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}
      {result && (
        <div className="rephrase-results">
          <div className="rephrase-original">
            <span className="rephrase-label">Original</span>
            <p>"{result.original}"</p>
          </div>
          <div className="rephrase-alternatives">
            <span className="rephrase-label">Alternatives</span>
            {result.rephrased.map((option, i) => (
              <div key={i} className="rephrase-option">
                <span className="rephrase-option-num">{i + 1}</span>
                <p>"{option}"</p>
              </div>
            ))}
          </div>
          {result.tip && <div className="rephrase-tip"><span>Tip:</span> {result.tip}</div>}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Metric Card with animated bar
───────────────────────────────────────── */
function MetricTile({ value, label, unit, max }) {
  const pct = max ? Math.min((parseFloat(value) / max) * 100, 100) : null;
  return (
    <div className="metric-tile">
      <span className="metric-tile-value">{value ?? '--'}{unit && value ? <span className="metric-tile-unit">{unit}</span> : ''}</span>
      <span className="metric-tile-label">{label}</span>
      {pct != null && (
        <div className="metric-tile-bar-track">
          <div className="metric-tile-bar-fill" style={{ width: `${pct}%` }}></div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Download Report
───────────────────────────────────────── */
function downloadReportAsText(report, filename) {
  const content = `
VOXCOACH SPEECH ANALYSIS REPORT
================================================

OVERALL SCORE: ${report.overall_score != null ? report.overall_score : 'N/A'}/100

------------------------------------------------
SKILL BREAKDOWN
------------------------------------------------
Grammar:       ${report.score_grammar ?? 'N/A'}/100
Pronunciation: ${report.score_pronunciation ?? 'N/A'}/100
Vocabulary:    ${report.score_vocabulary ?? 'N/A'}/100
Confidence:    ${report.score_confidence ?? 'N/A'}/100
Fluency:       ${report.score_fluency ?? 'N/A'}/100

------------------------------------------------
LANGUAGE & AUDIO METRICS
------------------------------------------------
Speech Tone:      ${report.sentiment_label || 'N/A'}
Vocabulary Level: ${report.readability_score || 'N/A'}
Speaking Pace:    ${report.speaking_pace_wpm ? Math.round(report.speaking_pace_wpm) : 'N/A'} WPM
Avg Pitch:        ${report.avg_pitch_hz ? Math.round(report.avg_pitch_hz) : 'N/A'} Hz
Duration:         ${report.duration_seconds ? Math.round(report.duration_seconds) : 'N/A'} seconds
Total Pauses:     ${report.pauses?.length || 0}

------------------------------------------------
COACHING FEEDBACK
------------------------------------------------
${report.gemini_feedback || 'No feedback available.'}

------------------------------------------------
FLUENCY NOTES
------------------------------------------------
${report.fluency_notes || 'No fluency notes available.'}

------------------------------------------------
GRAMMAR ISSUES
------------------------------------------------
${report.grammar_issues?.length > 0 
  ? report.grammar_issues.map(i => `* "${i.original}" -> "${i.correction}"\n  ${i.explanation}`).join('\n\n')
  : 'No grammar issues detected!'}

------------------------------------------------
PRONUNCIATION ISSUES
------------------------------------------------
${report.pronunciation_issues?.length > 0 
  ? report.pronunciation_issues.map(i => `* "${i.word}" (${i.issue})\n  Suggestion: ${i.suggestion}`).join('\n\n')
  : 'No pronunciation issues detected!'}

------------------------------------------------
FILLER WORDS
------------------------------------------------
${report.filler_words?.length > 0 
  ? report.filler_words.map(f => `* "${f.word}" (Used ${f.count} times)`).join('\n')
  : 'No filler words detected!'}

------------------------------------------------
FULL TRANSCRIPT
------------------------------------------------
${report.transcript || '(No transcript available)'}
================================================
Generated by VoxCoach
  `;

  const blob = new Blob([content.trim()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `VoxCoach_Report_${filename}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────
   Main Report Page
───────────────────────────────────────── */
export default function ReportPage() {
  const { recordingId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const heroRef = useRef(null);

  useEffect(() => {
    getReport(recordingId)
      .then((res) => {
        if (!res) throw new Error('Report not found or not ready yet');
        setReport(res);
      })
      .catch((err) => setError(err.message || 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [recordingId]);

  if (loading) return <div className="loading">Loading report…</div>;
  if (error) return <div className="error-page"><p>{error}</p><Link to="/dashboard">← Back to Dashboard</Link></div>;
  if (!report) return null;

  const hasScore = report.overall_score != null;
  const hasSubScores = report.score_grammar != null;
  const scoreColor = report.overall_score >= 75 ? '#3A6B50' : report.overall_score >= 50 ? '#A8721A' : '#A8353B';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'transcript', label: 'Transcript' },
    { id: 'issues', label: 'Issues' },
    { id: 'rephrase', label: 'Rephrase' },
  ];

  return (
    <div className="report-elegant">

      {/* ── Hero header ── */}
      <div className="report-hero" ref={heroRef}>
        <div className="report-hero-left">
          <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "16px" }}>
            <Link to="/dashboard" className="back-link" style={{ marginBottom: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Dashboard
            </Link>
            <button onClick={() => downloadReportAsText(report, recordingId)} className="btn btn-secondary btn-sm" style={{ padding: "6px 12px", fontSize: "13px", display: "flex", alignItems: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Download Text Report
            </button>
          </div>
          <h1 className="report-hero-title">Speech Analysis</h1>
          <p className="report-hero-sub">Your personalised coaching report</p>
        </div>
        {hasScore && (
          <div className="report-hero-score">
            <ScoreGauge score={report.overall_score} />
          </div>
        )}
      </div>

      <StatusBanner report={report} />

      {/* ── Tab bar ── */}
      <div className="report-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`report-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════ OVERVIEW TAB ══════════════ */}
      {activeTab === 'overview' && (
        <div className="tab-panel tab-panel--enter">

          {/* Score strip */}
          {hasScore && report.gemini_feedback && (
            <div className="feedback-strip">
              <span className="feedback-strip-icon">✦</span>
              <p className="feedback-strip-text">{report.gemini_feedback}</p>
            </div>
          )}

          {/* Charts row */}
          {hasSubScores && (
            <div className="charts-row">
              <div className="chart-card">
                <p className="chart-card-title">Skill Balance</p>
                <SkillRadar report={report} />
              </div>
              <div className="chart-card">
                <p className="chart-card-title">Score Breakdown</p>
                <ScoreBreakdown report={report} />
              </div>
            </div>
          )}

          {/* Language Analytics */}
          {report.readability_score && (
            <ReportSection title="Language Analytics" defaultOpen={true} accent="#3A6B50">
              <div className="metrics-tiles">
                <MetricTile value={report.sentiment_label} label="Speech Tone" />
                <MetricTile value={report.readability_score} label="Vocabulary Level" />
              </div>
            </ReportSection>
          )}

          {/* Audio metrics */}
          {report.audio_ok && (
            <ReportSection title="Audio Metrics" defaultOpen={true} accent="#9B4520">
              <div className="metrics-tiles">
                <MetricTile value={report.speaking_pace_wpm ? Math.round(report.speaking_pace_wpm) : null} label="Words / min" max={200} />
                <MetricTile value={report.avg_pitch_hz ? Math.round(report.avg_pitch_hz) : null} label="Avg Pitch" unit=" Hz" max={400} />
                <MetricTile value={report.pitch_variability ? Math.round(report.pitch_variability) : null} label="Pitch Variability" max={100} />
                <MetricTile value={report.duration_seconds ? Math.round(report.duration_seconds) : null} label="Duration" unit="s" max={300} />
                <MetricTile value={report.total_speaking_time ? Math.round(report.total_speaking_time) : null} label="Speaking Time" unit="s" max={300} />
                <MetricTile value={report.pauses?.length ?? 0} label="Pauses" max={20} />
              </div>
            </ReportSection>
          )}

          {/* Fluency notes */}
          {report.gemini_ok && report.fluency_notes && (
            <ReportSection title="Fluency Notes" defaultOpen={true} accent="#A8721A">
              <p className="fluency-notes-text">{report.fluency_notes}</p>
            </ReportSection>
          )}

          {/* Filler summary */}
          {report.gemini_ok && (
            <ReportSection title="Filler Words" count={report.filler_words?.length || 0} defaultOpen={true} accent="#C97848">
              {report.filler_words?.length > 0 ? (
                <div className="filler-list">
                  {report.filler_words.map((filler, i) => (
                    <div key={i} className="filler-card">
                      <span className="filler-word">"{filler.word}"</span>
                      <span className="filler-count">×{filler.count}</span>
                      {filler.context_examples?.length > 0 && (
                        <div className="filler-examples">
                          {filler.context_examples.map((ex, j) => (
                            <p key={j} className="filler-example">"{ex}"</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : <p className="no-issues">No filler words detected. Excellent!</p>}
            </ReportSection>
          )}

          {/* Pauses */}
          {report.audio_ok && report.pauses?.length > 0 && (
            <ReportSection title="Pause Map" count={report.pauses.length} defaultOpen={false} accent="#DBA07A">
              <p className="pauses-summary">Total pause time: <strong>{report.total_pause_time?.toFixed(1)}s</strong></p>
              <div className="pauses-list">
                {report.pauses.map((pause, i) => (
                  <div key={i} className="pause-item">
                    <span>{pause.start}s – {pause.end}s</span>
                    <span className="pause-duration">{pause.duration}s</span>
                  </div>
                ))}
              </div>
            </ReportSection>
          )}
        </div>
      )}

      {/* ══════════════ TRANSCRIPT TAB ══════════════ */}
      {activeTab === 'transcript' && (
        <div className="tab-panel tab-panel--enter">
          {report.whisper_ok ? (
            <ReportSection title="Full Transcript" defaultOpen={true} accent="#9B4520">
              <HighlightedTranscript
                transcript={report.transcript}
                fillerWords={report.filler_words}
                lowConfidenceWords={report.low_confidence_words}
              />
              {report.low_confidence_words?.length > 0 && (
                <div className="low-confidence-section">
                  <h4>Unclear Words</h4>
                  <div className="low-confidence-words">
                    {report.low_confidence_words.map((w, i) => (
                      <span key={i} className="low-conf-word">
                        "{w.word}" <small>({(w.confidence * 100).toFixed(0)}% · {w.start}s)</small>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </ReportSection>
          ) : (
            <div className="empty-tab">Transcription was not available for this recording.</div>
          )}
        </div>
      )}

      {/* ══════════════ ISSUES TAB ══════════════ */}
      {activeTab === 'issues' && (
        <div className="tab-panel tab-panel--enter">
          {report.gemini_ok && (
            <ReportSection title="Grammar Issues" count={report.grammar_issues?.length || 0} defaultOpen={true} accent="#A8353B">
              {report.grammar_issues?.length > 0 ? (
                <div className="issues-list">
                  {report.grammar_issues.map((issue, i) => (
                    <div key={i} className="issue-card issue-grammar">
                      <div className="issue-original">"{issue.original}"</div>
                      <div className="issue-arrow">→</div>
                      <div className="issue-correction">"{issue.correction}"</div>
                      <div className="issue-explanation">{issue.explanation}</div>
                    </div>
                  ))}
                </div>
              ) : <p className="no-issues">No grammar issues detected. Great job!</p>}
            </ReportSection>
          )}

          <ReportSection title="Pronunciation Issues" count={report.pronunciation_issues?.length || 0} defaultOpen={true} accent="#A8721A">
            {report.pronunciation_issues?.length > 0 ? (
              <div className="issues-list">
                {report.pronunciation_issues.map((issue, i) => (
                  <div key={i} className="issue-card issue-pronunciation">
                    <div className="issue-word">"{issue.word}"</div>
                    <div className="issue-detail">{issue.issue}</div>
                    <div className="issue-suggestion">Suggestion: {issue.suggestion}</div>
                  </div>
                ))}
              </div>
            ) : <p className="no-issues">No pronunciation issues detected. Well done!</p>}
          </ReportSection>
        </div>
      )}

      {/* ══════════════ REPHRASE TAB ══════════════ */}
      {activeTab === 'rephrase' && (
        <div className="tab-panel tab-panel--enter">
          {report.whisper_ok ? (
            <ReportSection title="Sentence Rephraser" defaultOpen={true} accent="#9B4520">
              <RephrasePanel transcript={report.transcript} />
            </ReportSection>
          ) : (
            <div className="empty-tab">Rephrasing requires a successful transcription.</div>
          )}
        </div>
      )}

    </div>
  );
}
