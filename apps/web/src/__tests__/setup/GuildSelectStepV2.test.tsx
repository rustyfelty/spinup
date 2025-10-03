import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import GuildSelectStepV2 from '../../pages/setup/GuildSelectStepV2';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GuildSelectStepV2 Component - Strict Mode Compliance', () => {
  const mockOnNext = vi.fn();
  const mockOnBack = vi.fn();
  const mockRefreshStatus = vi.fn();
  const mockOnGuildSelected = vi.fn();

  const mockUser = {
    id: '123',
    username: 'testuser',
    discriminator: '0001',
    avatar: null
  };

  const mockGuilds = [
    {
      id: '111',
      name: 'Test Server 1',
      icon: 'icon1',
      owner: true,
      permissions: '8'
    },
    {
      id: '222',
      name: 'Test Server 2',
      icon: null,
      owner: false,
      permissions: '8'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Guild Fetching', () => {
    it('should fetch guilds only once in strict mode', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { guilds: mockGuilds }
      });

      // Render component twice to simulate strict mode
      const { rerender } = render(
        <GuildSelectStepV2
          onNext={mockOnNext}
          onBack={mockOnBack}
          refreshStatus={mockRefreshStatus}
          sessionToken="test-token"
          user={mockUser}
          onGuildSelected={mockOnGuildSelected}
        />
      );

      // Re-render to simulate strict mode double mount
      rerender(
        <GuildSelectStepV2
          onNext={mockOnNext}
          onBack={mockOnBack}
          refreshStatus={mockRefreshStatus}
          sessionToken="test-token"
          user={mockUser}
          onGuildSelected={mockOnGuildSelected}
        />
      );

      await waitFor(() => {
        // Should only call API once despite double render
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/setup/discord/guilds'),
          { sessionToken: 'test-token' }
        );
      });

      // Should display guilds
      expect(screen.getByText('Test Server 1')).toBeInTheDocument();
      expect(screen.getByText('Test Server 2')).toBeInTheDocument();
    });

    it('should use cleanup function to cancel in-flight requests', async () => {
      let resolvePromise: any;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockedAxios.post.mockReturnValueOnce(promise as any);

      const { unmount } = render(
        <GuildSelectStepV2
          onNext={mockOnNext}
          onBack={mockOnBack}
          refreshStatus={mockRefreshStatus}
          sessionToken="test-token"
          user={mockUser}
          onGuildSelected={mockOnGuildSelected}
        />
      );

      // Unmount before API completes
      unmount();

      // Resolve the promise after unmount
      resolvePromise({ data: { guilds: mockGuilds } });

      // Re-mount component
      mockedAxios.post.mockResolvedValueOnce({
        data: { guilds: mockGuilds }
      });

      render(
        <GuildSelectStepV2
          onNext={mockOnNext}
          onBack={mockOnBack}
          refreshStatus={mockRefreshStatus}
          sessionToken="test-token"
          user={mockUser}
          onGuildSelected={mockOnGuildSelected}
        />
      );

      await waitFor(() => {
        // Should handle cleanup properly
        expect(screen.getByText('Test Server 1')).toBeInTheDocument();
      });
    });

    it('should handle rate limiting errors with user-friendly message', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 429,
          data: {
            message: 'Rate limited',
            retryAfter: 30
          }
        }
      });

      render(
        <GuildSelectStepV2
          onNext={mockOnNext}
          onBack={mockOnBack}
          refreshStatus={mockRefreshStatus}
          sessionToken="test-token"
          user={mockUser}
          onGuildSelected={mockOnGuildSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Discord API rate limit reached/i)).toBeInTheDocument();
        expect(screen.getByText(/30 seconds/i)).toBeInTheDocument();
      });
    });
  });

  describe('Guild Selection', () => {
    it('should handle guild selection correctly', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { guilds: mockGuilds }
      });

      render(
        <GuildSelectStepV2
          onNext={mockOnNext}
          onBack={mockOnBack}
          refreshStatus={mockRefreshStatus}
          sessionToken="test-token"
          user={mockUser}
          onGuildSelected={mockOnGuildSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Server 1')).toBeInTheDocument();
      });

      // Select first guild
      fireEvent.click(screen.getByText('Test Server 1').closest('button')!);

      // Mock successful guild selection
      mockedAxios.post.mockResolvedValueOnce({ data: {} });

      // Click continue
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/setup/select-guild'),
          {
            guildId: '111',
            installerDiscordId: '123'
          }
        );
      });

      expect(mockOnGuildSelected).toHaveBeenCalledWith('111');
      expect(mockRefreshStatus).toHaveBeenCalled();
      expect(mockOnNext).toHaveBeenCalled();
    });

    it('should handle manual guild ID entry when no guilds available', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { guilds: [] }
      });

      render(
        <GuildSelectStepV2
          onNext={mockOnNext}
          onBack={mockOnBack}
          refreshStatus={mockRefreshStatus}
          sessionToken="test-token"
          user={mockUser}
          onGuildSelected={mockOnGuildSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Discord Server ID/i)).toBeInTheDocument();
      });

      // Enter manual guild ID
      const input = screen.getByPlaceholderText(/Discord Server ID/i);
      fireEvent.change(input, { target: { value: '999888777' } });

      // Mock successful guild selection
      mockedAxios.post.mockResolvedValueOnce({ data: {} });

      // Click continue
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/setup/select-guild'),
          {
            guildId: '999888777',
            installerDiscordId: '123'
          }
        );
      });

      expect(mockOnGuildSelected).toHaveBeenCalledWith('999888777');
    });
  });

  describe('Error Handling', () => {
    it('should display error message on guild fetch failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Failed to fetch guilds'
          }
        }
      });

      render(
        <GuildSelectStepV2
          onNext={mockOnNext}
          onBack={mockOnBack}
          refreshStatus={mockRefreshStatus}
          sessionToken="test-token"
          user={mockUser}
          onGuildSelected={mockOnGuildSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch guilds/i)).toBeInTheDocument();
      });
    });

    it('should display error when no guild selected', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { guilds: mockGuilds }
      });

      render(
        <GuildSelectStepV2
          onNext={mockOnNext}
          onBack={mockOnBack}
          refreshStatus={mockRefreshStatus}
          sessionToken="test-token"
          user={mockUser}
          onGuildSelected={mockOnGuildSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Server 1')).toBeInTheDocument();
      });

      // Click continue without selecting
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/Please select a Discord server/i)).toBeInTheDocument();
      });
    });
  });
});