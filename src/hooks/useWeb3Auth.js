import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const API_BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : (import.meta.env.PROD ? 'https://secweb3-production.up.railway.app' : 'http://localhost:8000'));

export const useWeb3Auth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [ensName, setEnsName] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('secweb3_token'));

  // Check if MetaMask is installed
  const isMetaMaskInstalled = useCallback(() => {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
  }, []);

  // Connect to MetaMask wallet
  const connectWallet = useCallback(async () => {
    if (!isMetaMaskInstalled()) {
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    setIsConnecting(true);

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.');
      }

      const walletAddress = accounts[0];

      // Create provider and signer
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const web3Signer = web3Provider.getSigner();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(walletAddress);

      // Try to get ENS name
      try {
        const ens = await web3Provider.lookupAddress(walletAddress);
        setEnsName(ens);
      } catch (ensError) {
        console.log('No ENS name found for this address');
        setEnsName(null);
      }

      setIsConnected(true);
      return walletAddress;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [isMetaMaskInstalled]);

  // Sign message for authentication
  const signMessage = useCallback(async (message) => {
    if (!signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  }, [signer]);

  // Authenticate with backend
  const authenticate = useCallback(async () => {
    if (!account) {
      throw new Error('No wallet connected');
    }

    try {
      // Step 1: Get nonce from backend
      console.log('Getting nonce for wallet:', account);
      const nonceResponse = await fetch(`${API_BASE_URL}/api/auth/nonce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress: account }),
      });

      if (!nonceResponse.ok) {
        const error = await nonceResponse.json();
        throw new Error(error.error || 'Failed to get nonce');
      }

      const { nonce, message } = await nonceResponse.json();
      console.log('Received nonce:', nonce);

      // Step 2: Sign the message
      console.log('Signing message...');
      const signature = await signMessage(message);
      console.log('Message signed successfully');

      // Step 3: Verify signature with backend
      console.log('Verifying signature...');
      const verifyResponse = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: account,
          signature,
          message,
          ensName,
        }),
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.error || 'Authentication failed');
      }

      const { user: userData, token: authToken } = await verifyResponse.json();

      // Store token and user data
      localStorage.setItem('secweb3_token', authToken);
      setToken(authToken);
      setUser(userData);

      console.log('Authentication successful!');
      return userData;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }, [account, ensName, signMessage]);

  // Logout
  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local state
      localStorage.removeItem('secweb3_token');
      setToken(null);
      setUser(null);
      setIsConnected(false);
      setAccount(null);
      setEnsName(null);
      setProvider(null);
      setSigner(null);
    }
  }, [token]);

  // Check for existing connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (!isMetaMaskInstalled()) return;

      try {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts',
        });

        if (accounts.length > 0 && token) {
          // Verify token is still valid
          const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const responseData = await response.json();
            const userData = responseData?.user;

            if (userData && accounts[0]) {
              const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
              const web3Signer = web3Provider.getSigner();

              setProvider(web3Provider);
              setSigner(web3Signer);
              setAccount(accounts[0]);
              setIsConnected(true);
              setUser(userData);

              // Get ENS name
              try {
                const ens = await web3Provider.lookupAddress(accounts[0]);
                setEnsName(ens);
              } catch (ensError) {
                setEnsName(null);
              }
            } else {
              console.error('Invalid user data received:', responseData);
              localStorage.removeItem('secweb3_token');
              setToken(null);
            }
          } else {
            // Token invalid, clear it
            localStorage.removeItem('secweb3_token');
            setToken(null);
          }
        }
      } catch (error) {
        console.error('Failed to check existing connection:', error);
      }
    };

    checkConnection();
  }, [token, isMetaMaskInstalled]);

  // Listen for account changes
  useEffect(() => {
    if (!isMetaMaskInstalled()) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        logout();
      } else if (accounts[0] !== account) {
        // Account changed, need to re-authenticate
        setAccount(accounts[0]);
        setUser(null);
        localStorage.removeItem('secweb3_token');
        setToken(null);
      }
    };

    const handleChainChanged = () => {
      // Chain changed, reload the page
      window.location.reload();
    };

    window.ethereum?.on('accountsChanged', handleAccountsChanged);
    window.ethereum?.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [account, logout, isMetaMaskInstalled]);

  // Allow components to refresh the user profile after updates
  const refreshProfile = useCallback(async () => {
    try {
      if (!token) return null;
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data?.success && data.user) {
        setUser({
          id: data.user.id,
          walletAddress: data.user.walletAddress || data.user.wallet_address,
          ensName: data.user.ensName || data.user.ens_name,
          subscriptionTier: data.user.subscriptionTier || data.user.subscription_tier,
          apiCallsCount: data.user.apiCallsCount ?? data.user.api_calls_count,
          apiCallsLimit: data.user.apiCallsLimit ?? data.user.api_calls_limit,
        });
        return data.user;
      }
      return null;
    } catch {
      return null;
    }
  }, [token]);

  return {
    isConnected,
    account,
    ensName,
    provider,
    signer,
    isConnecting,
    user,
    token,
    isMetaMaskInstalled: isMetaMaskInstalled(),
    connectWallet,
    authenticate,
    logout,
    refreshProfile,
  };
};
