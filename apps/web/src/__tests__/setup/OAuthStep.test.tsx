import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import OAuthStep from '../../pages/setup/OAuthStep';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OAuthStep Component - Strict Mode Compliance', () => {
  const mockOnNext = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnOAuthComplete = vi.fn();
  const mockRefreshStatus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset URL
    window.history.replaceState({}, '', '/setup');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('OAuth Callback Handling', () => {
    it('should handle OAuth callback only once in strict mode', async () => {
      // Simulate OAuth callback URL
      window.history.replaceState({}, '', '/setup?code=test-code&state=test-state');

      const mockResponse = {
        data: {
          sessionToken: 'test-token',
          user: {
            id: '123',
            username: 'testuser',
            discriminator: '0001',
            avatar: null
          },
          guildId: null
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      // Render component twice to simulate strict mode
      const { rerender } = render(
        <OAuthStep
          onNext={mockOnNext}
          onBack={mockOnBack}
          onOAuthComplete={mockOnOAuthComplete}
          refreshStatus={mockRefreshStatus}
        />
      );

      // Re-render to simulate strict mode double mount
      rerender(
        <OAuthStep
          onNext={mockOnNext}
          onBack={mockOnBack}
          onOAuthComplete={mockOnOAuthComplete}
          refreshStatus={mockRefreshStatus}
        />
      );

      await waitFor(() => {
        // Should only call API once despite double render
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/setup/discord/callback'),
          {
            params: {
              code: 'test-code',
              state: 'test-state'
            }
          }
        );
      });

      // Should call completion callback once
      expect(mockOnOAuthComplete).toHaveBeenCalledTimes(1);
      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });

    it('should use cleanup function to prevent duplicate API calls', async () => {
      window.history.replaceState({}, '', '/setup?code=test-code&state=test-state');

      const mockResponse = {
        data: {
          sessionToken: 'test-token',
          user: {
            id: '123',
            username: 'testuser',
            discriminator: '0001',
            avatar: null
          },
          guildId: null
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const { unmount } = render(
        <OAuthStep
          onNext={mockOnNext}
          onBack={mockOnBack}
          onOAuthComplete={mockOnOAuthComplete}
          refreshStatus={mockRefreshStatus}
        />
      );

      // Unmount before API completes
      unmount();

      // Re-mount component
      render(
        <OAuthStep
          onNext={mockOnNext}
          onBack={mockOnBack}
          onOAuthComplete={mockOnOAuthComplete}
          refreshStatus={mockRefreshStatus}
        />
      );

      await waitFor(() => {
        // Should handle cleanup properly and not cause errors
        expect(mockedAxios.get).toHaveBeenCalled();
      });
    });

    it('should handle OAuth with guild_id parameter', async () => {
      window.history.replaceState({}, '', '/setup?code=test-code&state=test-state&guild_id=987654321');

      const mockResponse = {
        data: {
          sessionToken: 'test-token',
          user: {
            id: '123',
            username: 'testuser',
            discriminator: '0001',
            avatar: null
          },
          guildId: '987654321'
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      render(
        <OAuthStep
          onNext={mockOnNext}
          onBack={mockOnBack}
          onOAuthComplete={mockOnOAuthComplete}
          refreshStatus={mockRefreshStatus}
        />
      );

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/setup/discord/callback'),
          {
            params: {
              code: 'test-code',
              state: 'test-state',
              guild_id: '987654321'
            }
          }
        );
      });

      expect(mockOnOAuthComplete).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({ id: '123' }),
        '987654321'
      );
    });
  });

  describe('Auth Button Interaction', () => {
    it('should handle auth button click correctly', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { url: 'https://discord.com/oauth2/authorize?...' }
      });

      // Mock window.location.href setter
      delete (window as any).location;
      window.location = { href: '' } as any;

      render(
        <OAuthStep
          onNext={mockOnNext}
          onBack={mockOnBack}
          onOAuthComplete={mockOnOAuthComplete}
          refreshStatus={mockRefreshStatus}
        />
      );

      const loginButton = screen.getByRole('button', { name: /login with discord/i });
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/setup/discord/auth-url')
        );
        expect(window.location.href).toBe('https://discord.com/oauth2/authorize?...');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle OAuth callback errors gracefully', async () => {
      window.history.replaceState({}, '', '/setup?code=test-code&state=test-state');

      mockedAxios.get.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Invalid OAuth state'
          }
        }
      });

      render(
        <OAuthStep
          onNext={mockOnNext}
          onBack={mockOnBack}
          onOAuthComplete={mockOnOAuthComplete}
          refreshStatus={mockRefreshStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/invalid oauth state/i)).toBeInTheDocument();
      });

      // Should not call completion handlers on error
      expect(mockOnOAuthComplete).not.toHaveBeenCalled();
      expect(mockOnNext).not.toHaveBeenCalled();
    });
  });
});