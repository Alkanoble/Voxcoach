import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRecordings, deleteRecording } from '../api/recordings';
import ProgressDashboard from '../components/ProgressDashboard';

export default function DashboardPage() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getRecordings()
      .then((res) => setRecordings(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this recording and its report?')) return;
    try {
      await deleteRecording(id);
      setRecordings((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert('Failed to delete recording.');
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateObj) => {
    if (!dateObj) return '--';
    const date = typeof dateObj.toDate === 'function' ? dateObj.toDate() : new Date(dateObj);
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2>Welcome back, {user?.username}!</h2>
        <Link to="/record" className="btn btn-primary">New Recording</Link>
      </div>

      {recordings.length === 0 ? (
        <div className="empty-state">
          <h3>No recordings yet</h3>
          <p>Record or upload your first speech to get started!</p>
          <Link to="/record" className="btn btn-primary">Get Started</Link>
        </div>
      ) : (
        <div className="dashboard-content">
          <div className="report-tabs">
            <button 
              className={`report-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
            <button 
              className={`report-tab ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
          </div>

          <div className="tab-panel">
            {activeTab === 'history' && (
              <table className="recordings-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Duration</th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Transcript</th>
                    <th>Report</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recordings.map((r) => (
                    <tr key={r.id}>
                      <td>{r.original_filename}</td>
                      <td>{formatDuration(r.duration_seconds)}</td>
                      <td>{formatDate(r.created_at)}</td>
                      <td>{r.overall_score ? `${r.overall_score}/100` : '--'}</td>
                      <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.transcript_preview || '--'}
                      </td>
                      <td>
                        {r.has_report ? (
                          <Link to={`/report/${r.id}`} className="badge badge-success">View Report</Link>
                        ) : (
                          <span className="badge badge-pending">No report</span>
                        )}
                      </td>
                      <td>
                        <button onClick={() => handleDelete(r.id)} className="btn btn-danger btn-sm">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'analytics' && (
              <ProgressDashboard recordings={recordings} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
