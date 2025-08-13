import React, { useState } from 'react';
import { useWeb3Auth } from './hooks/useWeb3Auth';
import Web3Auth from './components/Web3Auth';
import ChatShell from './components/ChatShell';
import PricingModal from './components/PricingModal';

function App() {
  const [showPlansModal, setShowPlansModal] = useState(false);

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

  const handleUpgradeRequest = (requestData) => {
    console.log('Upgrade request submitted:', requestData);
    // Could show success notification here
  };

  return (
    <>
      {isAuthenticated ? (
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
      )}

      <PricingModal
        isOpen={showPlansModal}
        onClose={handleClosePlans}
        currentPlan={user?.plan?.id || 'starter'}
      />
    </>
  );
}

export default App;
