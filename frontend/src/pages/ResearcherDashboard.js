import React, { useEffect, useState } from 'react';
import researcherService from '../services/researcherService';
import ResearcherStudies from '../components/dashboard/ResearcherStudies';
import ExportDialog from '../components/dashboard/ExportDialog';
import ResearcherNotifications from '../components/dashboard/ResearcherNotifications';
import ArtifactRankings from '../components/dashboard/ArtifactRankings';

export default function ResearcherDashboard() {
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchStudies = () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;
    researcherService.listStudies(params).then(data => setStudies(data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStudies();
  }, []);

  const handleFilter = () => {
    fetchStudies();
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Researcher (temp dashboard - removing soon)</h2>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <ResearcherNotifications />
        </div>
        <div style={{ width: 420 }}>
          <ArtifactRankings />
        </div>
      </div>
      
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="Search studies..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleFilter()}
          style={{ padding: 8, minWidth: 200 }}
        />
        <input 
          type="date" 
          placeholder="Start date" 
          value={startDate} 
          onChange={(e) => setStartDate(e.target.value)}
          style={{ padding: 8 }}
        />
        <input 
          type="date" 
          placeholder="End date" 
          value={endDate} 
          onChange={(e) => setEndDate(e.target.value)}
          style={{ padding: 8 }}
        />
        <button onClick={handleFilter} style={{ padding: 8 }}>Filter</button>
        <button onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); setTimeout(fetchStudies, 50); }} style={{ padding: 8 }}>Clear</button>
        <button onClick={() => setExportOpen(true)} style={{ padding: 8, marginLeft: 'auto' }}>Export study</button>
      </div>
      
      <ResearcherStudies studies={studies} loading={loading} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} studies={studies} />
    </div>
  );
}
