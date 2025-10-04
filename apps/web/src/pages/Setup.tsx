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
      <h2 className="text-3xl font-bold text-white mb-4">
        Welcome to SpinUp Setup
      </h2>
      <p className="text-slate-300 dark:text-slate-400 mb-8 max-w-2xl mx-auto text-lg">
        SpinUp makes it easy to manage game servers for your Discord community.
        This wizard will help you connect your Discord server and configure permissions.
      </p>
      <div className="pixel-corners bg-game-purple-600 hover:shadow-lg hover:shadow-game-purple-600/30 transition-all duration-200">
        <button
          onClick={onNext}
          className="pixel-corners-content px-8 py-4 bg-gradient-to-r from-game-purple-600 to-game-purple-700 text-white font-bold hover:from-game-purple-700 hover:to-game-purple-800 transition-all hover:scale-105 active:scale-95"
          aria-label="Start setup wizard"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

// Complete Step Component
function CompleteStep() {
  const navigate = useNavigate();

  return (
    <div className="text-center py-8">
      <div className="text-6xl mb-6">✅</div>
      <h2 className="text-3xl font-bold text-white mb-4">
        Setup Complete!
      </h2>
      <p className="text-slate-300 dark:text-slate-400 mb-8 text-lg">
        Your SpinUp instance is now configured and ready to use.
      </p>
      <div className="pixel-corners bg-game-purple-600 hover:shadow-lg hover:shadow-game-purple-600/30 transition-all duration-200">
        <button
          onClick={() => navigate('/')}
          className="pixel-corners-content px-8 py-4 bg-gradient-to-r from-game-purple-600 to-game-purple-700 text-white font-bold hover:from-game-purple-700 hover:to-game-purple-800 transition-all hover:scale-105 active:scale-95"
          aria-label="Navigate to dashboard"
        >
          Go to Dashboard
        </button>
      </div>
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
    // Check if we're returning from OAuth callback (unified backend flow)
    const urlParams = new URLSearchParams(window.location.search);
    const sessionTokenParam = urlParams.get('sessionToken');
    const userId = urlParams.get('userId');
    const username = urlParams.get('username');
    const guildId = urlParams.get('guildId');

    if (sessionTokenParam && userId && username) {
      // Returning from unified OAuth callback
      const user: DiscordUser = {
        id: userId,
        username: username,
        discriminator: '0', // Discord removed discriminators
        avatar: null
      };

      // Store session data
      handleOAuthComplete(sessionTokenParam, user, guildId || undefined);

      // Clear URL parameters while keeping current path
      window.history.replaceState({}, '', window.location.pathname);

      // Set to guild selection step if no guild, otherwise roles step
      setCurrentStepIndex(guildId ? 4 : 3);
      setLoading(false);
    } else {
      // Not returning from OAuth, fetch status normally
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 dark:from-slate-950 dark:via-game-dark-900 dark:to-slate-950 relative overflow-hidden">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              repeating-linear-gradient(90deg, transparent, transparent 35px, rgba(59, 130, 246, 0.3) 35px, rgba(59, 130, 246, 0.3) 36px),
              repeating-linear-gradient(0deg, transparent, transparent 35px, rgba(59, 130, 246, 0.3) 35px, rgba(59, 130, 246, 0.3) 36px)
            `,
            backgroundSize: '36px 36px'
          }}></div>
        </div>

        {/* Gradient orbs */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-game-green-600 rounded-full filter blur-[128px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-game-purple-600 rounded-full filter blur-[128px] opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="text-center relative z-10">
          <div className="w-16 h-16 border-4 border-game-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-bold text-white">Loading setup wizard...</p>
        </div>
      </div>
    );
  }

  const CurrentStepComponent = steps[currentStepIndex].component;
  const currentStep = steps[currentStepIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 dark:from-slate-950 dark:via-game-dark-900 dark:to-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            repeating-linear-gradient(90deg, transparent, transparent 35px, rgba(59, 130, 246, 0.3) 35px, rgba(59, 130, 246, 0.3) 36px),
            repeating-linear-gradient(0deg, transparent, transparent 35px, rgba(59, 130, 246, 0.3) 35px, rgba(59, 130, 246, 0.3) 36px)
          `,
          backgroundSize: '36px 36px'
        }}></div>
      </div>

      {/* Gradient orbs for depth */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-game-green-600 rounded-full filter blur-[128px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-game-purple-600 rounded-full filter blur-[128px] opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
            <span className="bg-gradient-to-r from-game-green-400 to-game-purple-400 bg-clip-text text-transparent">SpinUp</span> Setup
          </h1>
          <p className="text-lg text-slate-300 dark:text-slate-400">Configure your game server platform</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex gap-2 items-center">
            {steps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              const isFuture = index > currentStepIndex;

              return (
                <div
                  key={step.id}
                  className={`
                    relative overflow-hidden
                    transition-all duration-500 ease-in-out
                    border-2 rounded h-12
                    ${isActive ? 'flex-grow' : 'w-16'}
                    ${isCompleted ? 'bg-game-purple-500 border-game-purple-600' : ''}
                    ${isActive ? 'bg-gradient-to-r from-game-purple-500 to-game-purple-600 border-game-purple-700 shadow-lg shadow-game-purple-600/30' : ''}
                    ${isFuture ? 'bg-gray-700 border-gray-600' : ''}
                  `}
                >
                  {/* Shimmer effect for active step */}
                  {isActive && (
                    <div className="absolute inset-0 shimmer-bg"></div>
                  )}

                  {/* Content */}
                  <div className="relative z-10 px-4 h-full flex items-center justify-center gap-2">
                    {/* Checkmark for completed */}
                    {isCompleted && (
                      <span className="text-white text-xs font-bold">✓</span>
                    )}

                    {/* Active step shows full title */}
                    {isActive && (
                      <span className="text-white font-pixel text-xs whitespace-nowrap">
                        {step.title}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="pixel-corners bg-game-purple-600/20 backdrop-blur-sm shadow-2xl shadow-game-purple-600/20">
          <div className="pixel-corners-content bg-gradient-to-br from-slate-900/95 to-slate-800/95 dark:from-slate-950/95 dark:to-game-dark-900/95 overflow-hidden">
          <div className="bg-gradient-to-r from-game-purple-600 to-game-purple-700 px-8 py-6 border-b-4 border-game-purple-800">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {currentStep.title}
            </h1>
            <p className="text-purple-100 mt-2">
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
        <div className="text-center mt-6 mb-8 text-slate-400 font-semibold">
          Step {currentStepIndex + 1} of {steps.length}
        </div>
        </div>

        {/* Footer note */}
        <div className="text-center mt-8">
          <p className="text-slate-500 dark:text-slate-600 text-sm">
            Powered by Docker · Secured by Discord OAuth · Built for gaming communities
          </p>
        </div>
      </div>
    </div>
  );
}
