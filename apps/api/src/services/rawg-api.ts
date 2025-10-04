import axios from 'axios';

/**
 * RAWG Video Games Database API
 * Free API for game data including screenshots and backgrounds
 * Docs: https://rawg.io/apidocs
 *
 * Note: API key is optional but recommended for higher rate limits
 * Get free key at: https://rawg.io/apidocs
 */

const RAWG_API_KEY = process.env.RAWG_API_KEY || '';
const RAWG_BASE_URL = 'https://api.rawg.io/api';

// Rate limiter - 20 requests per second max
class RawgRateLimiter {
  private lastCallTime: number = 0;
  private readonly minDelayMs: number = 50; // 50ms = 20 req/sec

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    if (timeSinceLastCall < this.minDelayMs) {
      const waitTime = this.minDelayMs - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastCallTime = Date.now();
  }
}

const rateLimiter = new RawgRateLimiter();

interface RawgGame {
  id: number;
  name: string;
  background_image: string | null;
  background_image_additional?: string | null;
}

interface RawgSearchResponse {
  results: RawgGame[];
}

export class RawgApiService {
  /**
   * Search for a game by name and return background image URL
   */
  async getGameBackground(gameName: string): Promise<string | null> {
    // Check if API key is configured
    if (!RAWG_API_KEY) {
      console.warn('[RAWG] API key not configured. Set RAWG_API_KEY env var to enable game backgrounds.');
      console.warn('[RAWG] Get a free API key at: https://rawg.io/apidocs');
      return this.getFallbackImage(gameName);
    }

    await rateLimiter.waitIfNeeded();

    try {
      const params: any = {
        search: gameName,
        page_size: 1,
        key: RAWG_API_KEY,
      };

      const response = await axios.get<RawgSearchResponse>(`${RAWG_BASE_URL}/games`, {
        params,
        timeout: 5000,
      });

      if (response.data.results.length === 0) {
        console.log(`[RAWG] No results found for game: ${gameName}`);
        return this.getFallbackImage(gameName);
      }

      const game = response.data.results[0];
      const backgroundUrl = game.background_image || game.background_image_additional;

      if (!backgroundUrl) {
        console.log(`[RAWG] No background image for game: ${gameName}`);
        return this.getFallbackImage(gameName);
      }

      console.log(`[RAWG] Found background for ${gameName}: ${backgroundUrl}`);
      return backgroundUrl;

    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error('[RAWG] Invalid API key. Get a free key at: https://rawg.io/apidocs');
      } else if (error.response?.status === 429) {
        console.error('[RAWG] Rate limit exceeded');
      } else {
        console.error('[RAWG] Failed to fetch game background:', error.message);
      }
      return this.getFallbackImage(gameName);
    }
  }

  /**
   * Get fallback placeholder image (generic gaming background)
   */
  private getFallbackImage(gameName: string): string | null {
    // Use a generic gaming-themed gradient as fallback
    // You could also use specific game artwork URLs here
    return null; // Return null for now, will use default gradient in UI
  }

  /**
   * Map internal game keys to RAWG-friendly search terms
   */
  private mapGameKeyToSearchTerm(gameKey: string): string {
    const gameMap: Record<string, string> = {
      'minecraft-java': 'Minecraft',
      'minecraft-bedrock': 'Minecraft',
      'valheim': 'Valheim',
      'palworld': 'Palworld',
      'terraria': 'Terraria',
      'rust': 'Rust',
      'ark': 'ARK Survival Evolved',
      'csgo': 'Counter-Strike Global Offensive',
      'tf2': 'Team Fortress 2',
      'satisfactory': 'Satisfactory',
      'factorio': 'Factorio',
      '7-days-to-die': '7 Days to Die',
      'project-zomboid': 'Project Zomboid',
      'space-engineers': 'Space Engineers',
    };

    return gameMap[gameKey] || gameKey.replace(/-/g, ' ');
  }

  /**
   * Get background image for a game by its key
   */
  async getBackgroundByGameKey(gameKey: string): Promise<string | null> {
    const searchTerm = this.mapGameKeyToSearchTerm(gameKey);
    return this.getGameBackground(searchTerm);
  }
}

export const rawgApi = new RawgApiService();
