import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

interface SetupGuardProps {
  children: React.ReactNode;
}

export default function SetupGuard({ children }: SetupGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/setup/status`);
      const { isComplete } = response.data;

      setSetupComplete(isComplete);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Failed to check setup status:', err);
      setError('Failed to verify setup status');
      setIsLoading(false);
    }
  };

  // While loading, show a spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking setup status...</p>
        </div>
      </div>
    );
  }

  // If there was an error, show it but allow access (fail open for safety)
  if (error) {
    console.warn('Setup guard error:', error);
    return <>{children}</>;
  }

  // If setup is complete, redirect to dashboard
  if (setupComplete) {
    return <Navigate to="/" replace />;
  }

  // Setup not complete, allow access to setup wizard
  return <>{children}</>;
}