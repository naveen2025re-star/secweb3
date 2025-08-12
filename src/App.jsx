import React from 'react';
import { useWeb3Auth } from './hooks/useWeb3Auth';
import Web3Auth from './components/Web3Auth';
import ChatShell from './components/ChatShell';

function App() {
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

  return isAuthenticated ? (
    <ChatShell user={user} />
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
  );
}

export default App;
