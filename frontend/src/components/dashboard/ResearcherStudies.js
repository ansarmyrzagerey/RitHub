import React from 'react';
import { Link } from 'react-router-dom';

export default function ResearcherStudies({ studies, loading }) {
  if (loading) return <div>Loading studies...</div>;
  if (!studies || studies.length === 0) return <div>No studies found</div>;

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8 }}>Title</th>
            <th style={{ padding: 8 }}>Participants</th>
            <th style={{ padding: 8 }}>Completion</th>
            <th style={{ padding: 8 }}>Start</th>
            <th style={{ padding: 8 }}>End</th>
          </tr>
        </thead>
        <tbody>
          {studies.map(s => (
            <tr key={s.id} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: 8 }}><Link to={`/researcher/studies/${s.id}`}>{s.title}</Link></td>
              <td style={{ padding: 8, textAlign: 'center' }}>{s.participant_count}</td>
              <td style={{ padding: 8, textAlign: 'center' }}>{s.completion_pct}%</td>
              <td style={{ padding: 8 }}>{s.start_date ? new Date(s.start_date).toLocaleDateString() : '-'}</td>
              <td style={{ padding: 8 }}>{s.end_date ? new Date(s.end_date).toLocaleDateString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
