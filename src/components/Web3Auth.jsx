import React, { useState } from 'react';
import { Wallet, User, LogOut, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Web3Auth presentational component.
 * Receives all state and handlers via props. Does not use hooks internally.
 */
const Web3Auth = ({
  onAuthSuccess,
  // Auth/web3 state from parent
  isConnected,
  account,
  ensName,
  isConnecting,
  user,
  isMetaMaskInstalled,
  // Handlers from parent
  connectWallet,
  authenticate,
  logout
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    setError(null);
    try {
      await connectWallet();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAuthenticate = async () => {
    setError(null);
    setIsAuthenticating(true);
    try {
      const userData = await authenticate();
      onAuthSuccess?.(userData);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const formatAddress = (address) => {
    if (!address || typeof address !== 'string' || address.length < 8) {
      return '';
    }
    try {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    } catch {
      return '';
    }
  };

  // Not authenticated - show login options
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
        <div className="w-full max-w-md">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">SecWeb3</h1>
            <p className="text-gray-400">AI-Powered Smart Contract Security Auditor</p>
          </div>

          {/* Auth Card */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
            {!isMetaMaskInstalled ? (
              // MetaMask not installed
              <div className="text-center">
                <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">MetaMask Required</h2>
                <p className="text-gray-400 mb-4">
                  Please install MetaMask to continue with Web3 authentication.
                </p>
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                >
                  Install MetaMask
                </a>
              </div>
            ) : !isConnected ? (
              // Not connected to wallet
              <div className="text-center">
                <Wallet className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h2>
                <p className="text-gray-400 mb-4">
                  Connect your MetaMask wallet to start using SecWeb3
                </p>
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
                >
                  {isConnecting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  ) : (
                    <Wallet className="w-5 h-5 mr-2" />
                  )}
                  {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                </button>
              </div>
            ) : (
              // Connected but not authenticated
              <div className="text-center">
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-green-400 font-medium">Wallet Connected</p>
                  <p className="text-gray-400 text-sm">
                    {ensName || (account ? formatAddress(account) : '')}
                  </p>
                </div>

                <h2 className="text-xl font-semibold text-white mb-2">Sign to Authenticate</h2>
                <p className="text-gray-400 mb-4">
                  Sign a message with your wallet to complete authentication
                </p>

                <button
                  onClick={handleAuthenticate}
                  disabled={isAuthenticating}
                  className="w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg transition-colors"
                >
                  {isAuthenticating ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  ) : (
                    <User className="w-5 h-5 mr-2" />
                  )}
                  {isAuthenticating ? 'Signing...' : 'Sign & Authenticate'}
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Info */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500 text-center">
                SecWeb3 uses cryptographic signatures for secure, passwordless authentication.
                Your private keys never leave your wallet.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated - show user info (this will be rendered in the main app)
  return (
    <div className="flex items-center space-x-3">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="hidden md:block">
          <p className="text-sm font-medium text-white">
            {user?.ensName || (user?.walletAddress ? formatAddress(user.walletAddress) : 'Unknown User')}
          </p>
          <p className="text-xs text-gray-400">
            {user?.apiCallsCount || 0}/{user?.apiCallsLimit || 0} API calls
          </p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        title="Logout"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Web3Auth;
