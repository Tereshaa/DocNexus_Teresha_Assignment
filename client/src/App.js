import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Container } from '@mui/material';

// Layout Components
import Layout from './components/Layout/Layout';

// Page Components
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Transcripts from './pages/Transcripts';
import TranscriptDetail from './pages/TranscriptDetail';
import TranscriptEditor from './pages/TranscriptEditor';
import Analytics from './pages/Analytics';
import CRM from './pages/CRM';
import Documents from './pages/Documents';

// Context
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
        <Layout>
          <Container maxWidth="xl" sx={{ py: 3 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/transcripts" element={<Transcripts />} />
              <Route path="/transcripts/:id" element={<TranscriptDetail />} />
              <Route path="/transcripts/:id/edit" element={<TranscriptEditor />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/crm" element={<CRM />} />
              <Route path="/documents" element={<Documents />} />
            </Routes>
          </Container>
        </Layout>
      </Box>
    </AuthProvider>
  );
}

export default App; 