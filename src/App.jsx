import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useWeb3Auth } from './hooks/useWeb3Auth';
import Web3Auth from './components/Web3Auth';
import ChatShell from './components/ChatShell';
import PricingModal from './components/PricingModal';
import LandingPage from './components/LandingPage';

// Main App Content Component
const AppContent = () => {
  const [showPlansModal, setShowPlansModal] = useState(false);
  const navigate = useNavigate();

  // Single source of truth for web3/auth state
  const {
    user,
    token,
    isConnected,
    account,
    ensName,
    isConnecting,
    isMetaMaskInstalled,
    connectWallet,
    authenticate,
    logout
  } = useWeb3Auth();

  const isAuthenticated = !!user && !!token;

  const handleShowPlans = () => setShowPlansModal(true);
  const handleClosePlans = () => setShowPlansModal(false);

  const handleGetStarted = () => {
    navigate('/app');
  };

  const handleUpgradeRequest = (requestData) => {
    console.log('Upgrade request submitted:', requestData);
    // Could show success notification here
  };

  return (
    <>
      <Routes>
        {/* Landing Page Route */}
        <Route 
          path="/" 
          element={<LandingPage onGetStarted={handleGetStarted} />} 
        />
        
        {/* App Route */}
        <Route
          path="/app"
          element={
            isAuthenticated ? (
              <ChatShell 
                user={user} 
                onShowPlans={handleShowPlans}
                onDisconnect={logout}
              />
            ) : (
              <Web3Auth
                onAuthSuccess={() => {}}
                isConnected={isConnected}
                account={account}
                ensName={ensName}
                isConnecting={isConnecting}
                user={user}
                isMetaMaskInstalled={isMetaMaskInstalled}
                connectWallet={connectWallet}
                authenticate={authenticate}
                logout={logout}
              />
            )
          }
        />
        
        {/* Redirect any unknown routes to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <PricingModal
        isOpen={showPlansModal}
        onClose={handleClosePlans}
        currentPlan={user?.plan?.id || 'starter'}
      />
    </>
  );
};

// Main App Component with Router
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
