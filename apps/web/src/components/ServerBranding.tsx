import { Organization } from '@spinup/shared'

interface ServerBrandingProps {
  org: Organization
}

// Helper to construct Discord CDN URLs
const getDiscordIconUrl = (guildId: string, iconHash: string, size: number = 128) => {
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${iconHash.startsWith('a_') ? 'gif' : 'png'}?size=${size}`
}

const getDiscordBannerUrl = (guildId: string, bannerHash: string, size: number = 600) => {
  return `https://cdn.discordapp.com/banners/${guildId}/${bannerHash}.${bannerHash.startsWith('a_') ? 'gif' : 'png'}?size=${size}`
}

export default function ServerBranding({ org }: ServerBrandingProps) {
  const guildId = org.discordGuildId || org.discordGuild
  const iconUrl = org.discordIconHash && guildId
    ? getDiscordIconUrl(guildId, org.discordIconHash, 80)
    : null

  return (
    <div className="flex items-center gap-3">
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={org.discordGuildName || org.name}
          className="w-10 h-10 rounded-full ring-2 ring-game-green-500/20"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-game-green-500 to-game-green-700 flex items-center justify-center text-white font-bold text-lg border-2 border-game-green-600">
          {(org.discordGuildName || org.name).charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex flex-col">
        <h1 className="text-lg font-pixel dark:text-white text-gray-900">
          {org.discordGuildName || org.name}
        </h1>
        {org.discordDescription && (
          <p className="text-xs dark:text-gray-400 text-gray-500 truncate max-w-md">
            {org.discordDescription}
          </p>
        )}
      </div>
    </div>
  )
}
