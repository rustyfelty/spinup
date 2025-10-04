#!/usr/bin/env tsx
/**
 * Backfill game backgrounds for existing servers
 * Run with: npx tsx src/scripts/backfill-backgrounds.ts
 */

import { PrismaClient } from '@prisma/client';
import { rawgApi } from '../services/rawg-api';

const prisma = new PrismaClient();

async function backfillBackgrounds() {
  console.log('[Backfill] Starting background image backfill...');

  try {
    // Find servers without background images
    const servers = await prisma.server.findMany({
      where: {
        backgroundImageUrl: null
      },
      select: {
        id: true,
        gameKey: true,
        name: true
      }
    });

    if (servers.length === 0) {
      console.log('[Backfill] No servers need background images. All done!');
      return;
    }

    console.log(`[Backfill] Found ${servers.length} servers without backgrounds`);

    let successCount = 0;
    let failCount = 0;

    for (const server of servers) {
      console.log(`[Backfill] Fetching background for ${server.name} (${server.gameKey})...`);

      try {
        const backgroundUrl = await rawgApi.getBackgroundByGameKey(server.gameKey);

        if (backgroundUrl) {
          await prisma.server.update({
            where: { id: server.id },
            data: { backgroundImageUrl: backgroundUrl }
          });
          console.log(`[Backfill] ✓ Updated ${server.name}: ${backgroundUrl}`);
          successCount++;
        } else {
          console.log(`[Backfill] ✗ No background found for ${server.name} (${server.gameKey})`);
          failCount++;
        }

        // Wait 100ms between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`[Backfill] ✗ Error for ${server.name}:`, error.message);
        failCount++;
      }
    }

    console.log('\n[Backfill] Complete!');
    console.log(`[Backfill] Success: ${successCount}`);
    console.log(`[Backfill] Failed: ${failCount}`);
    console.log(`[Backfill] Total: ${servers.length}`);

  } catch (error) {
    console.error('[Backfill] Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  backfillBackgrounds()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[Backfill] Fatal error:', error);
      process.exit(1);
    });
}

export { backfillBackgrounds };
