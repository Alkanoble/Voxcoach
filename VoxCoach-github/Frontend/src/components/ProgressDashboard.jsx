import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';

export default function ProgressDashboard({ recordings }) {
  const chartData = useMemo(() => {
    // Sort oldest to newest for chronological left-to-right flow
    const sorted = [...recordings].sort((a, b) => {
      const tA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
      const tB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
      return tA - tB;
    });

    return sorted.map(r => {
      const dateObj = typeof r.created_at?.toDate === 'function' ? r.created_at.toDate() : new Date(r.created_at || Date.now());
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        name: dateStr,
        score: r.overall_score || null, // null line drops gracefully
        fillers: r.filler_words_count || 0,
        wpm: r.speaking_pace_wpm || 0,
      };
    });
  }, [recordings]);

  const totalRecordings = recordings.length;
  // Calculate average only over scores that exist
  const scoredData = chartData.filter(d => d.score !== null);
  const avgScore = scoredData.length > 0 
    ? Math.round(scoredData.reduce((acc, curr) => acc + curr.score, 0) / scoredData.length)
    : 0;

  const totalTimeStr = useMemo(() => {
    const totalSecs = recordings.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0);
    const mins = Math.floor(totalSecs / 60);
    return `${mins}m ${Math.round(totalSecs % 60)}s`;
  }, [recordings]);

  if (recordings.length === 0) {
    return (
      <div className="empty-tab">
        <p>No analytics available yet. Record some sessions to see your progress!</p>
      </div>
    );
  }

  // Consistent brand colors
  const chartColors = {
    score: '#C9973A',  // Gold brand
    fillers: '#C0392B', // Danger
    wpm: '#3B82F6'      // Blue
  };

  return (
    <div className="progress-dashboard">
      <div className="metrics-tiles" style={{ marginBottom: '32px' }}>
        <div className="metric-tile">
          <span className="metric-tile-value">{totalRecordings}</span>
          <span className="metric-tile-label">Total Recordings</span>
        </div>
        <div className="metric-tile">
          <span className="metric-tile-value">{totalTimeStr}</span>
          <span className="metric-tile-label">Total Speaking Time</span>
        </div>
        <div className="metric-tile">
          <span className="metric-tile-value">{avgScore > 0 ? avgScore : '--'}</span>
          <span className="metric-tile-label">Average Score</span>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <h4 className="chart-card-title">Overall Score Trend</h4>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(201, 168, 90, 0.2)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-dim)' }} dy={10} />
                <YAxis domain={['auto', 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-dim)' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface-raised)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text)' }}
                  itemStyle={{ fontWeight: 600 }}
                />
                <Line type="monotone" dataKey="score" name="Score" stroke={chartColors.score} strokeWidth={3} dot={{ r: 4, fill: chartColors.score, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <h4 className="chart-card-title">Filler Words Trend</h4>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(201, 168, 90, 0.2)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-dim)' }} dy={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-dim)' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface-raised)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text)' }}
                />
                <Area type="monotone" dataKey="fillers" name="Filler Words" stroke={chartColors.fillers} fill={chartColors.fillers} fillOpacity={0.15} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
