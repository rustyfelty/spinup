import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DomainStep from './setup/DomainStep';
import OAuthStep from './setup/OAuthStep';
import GuildSelectStepV2 from './setup/GuildSelectStepV2';
import RolesStep from './setup/RolesStep';

export interface SetupStatus {
  isComplete: boolean;
  currentStep: string;
  steps: {
    systemConfigured: boolean;
    discordConfigured: boolean;
    guildSelected: boolean;
    rolesConfigured: boolean;
  };
  selectedGuildId?: string;
  installerUserId?: string;
}

interface StepConfig {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<StepProps>;
}

export interface StepProps {
  onNext: () => void;
  onBack: () => void;
  setupStatus: SetupStatus | null;
  refreshStatus: () => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || '';

// Welcome Step Component
function WelcomeStep({ onNext }: StepProps) {
  return (
    <div className="text-center py-8">
      <div className="text-6xl mb-6">🚀</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Welcome to SpinUp Setup
      </h2>
      <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
        SpinUp makes it easy to manage game servers for your Discord community.
        This wizard will help you connect your Discord server and configure permissions.
      </p>
      <button
        onClick={onNext}
        className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}

// Complete Step Component
function CompleteStep() {
  const navigate = useNavigate();

  return (
    <div className="text-center py-8">
      <div className="text-6xl mb-6">✅</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Setup Complete!
      </h2>
      <p className="text-gray-600 mb-8">
        Your SpinUp instance is now configured and ready to use.
      </p>
      <button
        onClick={() => navigate('/')}
        className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  );
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export default function SetupWizard() {
  const navigate = useNavigate();
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // OAuth session state - restore from sessionStorage if available
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    const stored = sessionStorage.getItem('setup_session_token');
    return stored && stored !== 'undefined' ? stored : null;
  });
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(() => {
    const stored = sessionStorage.getItem('setup_discord_user');
    if (!stored || stored === 'undefined') return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(() => {
    const stored = sessionStorage.getItem('setup_selected_guild_id');
    return stored && stored !== 'undefined' ? stored : null;
  });

  const steps: StepConfig[] = [
    {
      id: 'welcome',
      title: 'Welcome to SpinUp',
      description: 'Let\'s get your game server platform configured',
      component: WelcomeStep
    },
    {
      id: 'domain',
      title: 'Configure Domains',
      description: 'Set up your domain settings',
      component: DomainStep
    },
    {
      id: 'oauth',
      title: 'Login with Discord',
      description: 'Authenticate with your Discord account',
      component: OAuthStep
    },
    {
      id: 'guild-select',
      title: 'Select Server',
      description: 'Choose your Discord server',
      component: GuildSelectStepV2
    },
    {
      id: 'roles',
      title: 'Configure Roles',
      description: 'Map Discord roles to permissions',
      component: RolesStep
    },
    {
      id: 'complete',
      title: 'Setup Complete',
      description: 'You\'re all set!',
      component: CompleteStep
    }
  ];

  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/setup/status`);
      setSetupStatus(response.data);

      // If setup is complete, only allow access with reset token
      if (response.data.isComplete) {
        const resetToken = sessionStorage.getItem('setup_reset_token');
        if (!resetToken) {
          // No reset token, redirect to dashboard
          navigate('/');
          return;
        }
        // Clear the reset token so it can only be used once
        sessionStorage.removeItem('setup_reset_token');
        // Also clear setup session data since we're starting fresh
        sessionStorage.removeItem('setup_session_token');
        sessionStorage.removeItem('setup_discord_user');
        sessionStorage.removeItem('setup_selected_guild_id');
      }
    } catch (error) {
      console.error('Failed to fetch setup status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if we're returning from OAuth callback (setup flow)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      // Stay on OAuth step (step 2) to let OAuthStep handle the callback
      setCurrentStepIndex(2);
      setLoading(false);
    } else {
      fetchStatus();
    }
  }, []);

  const handleOAuthComplete = (token: string, user: DiscordUser, guildId?: string) => {
    // Persist to sessionStorage
    sessionStorage.setItem('setup_session_token', token);
    sessionStorage.setItem('setup_discord_user', JSON.stringify(user));

    setSessionToken(token);
    setDiscordUser(user);

    // If we got a guild ID from OAuth (bot was added), skip guild selection
    if (guildId) {
      sessionStorage.setItem('setup_selected_guild_id', guildId);
      setSelectedGuildId(guildId);
      // Skip to roles step (index 4) instead of guild select (index 3)
      // Steps: 0=welcome, 1=domain, 2=oauth, 3=guild-select, 4=roles, 5=complete
      setCurrentStepIndex(4);
    }
  };

  const handleGuildSelected = (guildId: string) => {
    sessionStorage.setItem('setup_selected_guild_id', guildId);
    setSelectedGuildId(guildId);
  };

  const handleNext = async () => {
    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);

      // If moving to the complete step (last step), fetch status and redirect
      if (nextIndex === steps.length - 1) {
        await fetchStatus();

        // Clear setup session data
        sessionStorage.removeItem('setup_session_token');
        sessionStorage.removeItem('setup_discord_user');
        sessionStorage.removeItem('setup_selected_guild_id');

        // Redirect to dashboard after a short delay to show completion
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        fetchStatus();
      }
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl">Loading setup wizard...</p>
        </div>
      </div>
    );
  }

  const CurrentStepComponent = steps[currentStepIndex].component;
  const currentStep = steps[currentStepIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 ${index !== 0 ? 'ml-2' : ''}`}
              >
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index <= currentStepIndex
                      ? 'bg-white'
                      : 'bg-white bg-opacity-30'
                  }`}
                />
                <p
                  className={`text-sm mt-2 text-center ${
                    index <= currentStepIndex
                      ? 'text-white font-medium'
                      : 'text-white text-opacity-60'
                  }`}
                >
                  {step.title}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6">
            <h1 className="text-3xl font-bold text-white">
              {currentStep.title}
            </h1>
            <p className="text-indigo-100 mt-2">
              {currentStep.description}
            </p>
          </div>

          <div className="p-8">
            {currentStep.id === 'oauth' ? (
              <CurrentStepComponent
                onNext={handleNext}
                onBack={handleBack}
                setupStatus={setupStatus}
                refreshStatus={fetchStatus}
                onOAuthComplete={handleOAuthComplete}
              />
            ) : currentStep.id === 'guild-select' && sessionToken && discordUser ? (
              <CurrentStepComponent
                onNext={handleNext}
                onBack={handleBack}
                setupStatus={setupStatus}
                refreshStatus={fetchStatus}
                sessionToken={sessionToken}
                user={discordUser}
                onGuildSelected={handleGuildSelected}
              />
            ) : currentStep.id === 'roles' && sessionToken && selectedGuildId ? (
              <CurrentStepComponent
                onNext={handleNext}
                onBack={handleBack}
                setupStatus={setupStatus}
                refreshStatus={fetchStatus}
                sessionToken={sessionToken}
                selectedGuildId={selectedGuildId}
              />
            ) : (
              <CurrentStepComponent
                onNext={handleNext}
                onBack={handleBack}
                setupStatus={setupStatus}
                refreshStatus={fetchStatus}
              />
            )}
          </div>
        </div>

        {/* Step Counter */}
        <div className="text-center mt-6 text-white text-opacity-80">
          Step {currentStepIndex + 1} of {steps.length}
        </div>
      </div>
    </div>
  );
}
