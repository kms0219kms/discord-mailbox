import { type APIChannel, ChannelType, Routes } from 'discord-api-types/v10';

/**
 * A channel rarely changes its type once created, so the lookup result is cached
 * in-memory for the lifetime of the isolate to avoid an extra Discord API call per email.
 */
const channelTypeCache = new Map<string, ChannelType>();

export const getChannelType = async (channelId: string, env: Env): Promise<ChannelType> => {
	const cached = channelTypeCache.get(channelId);
	if (cached !== undefined) return cached;

	const response = await fetch(`https://discord.com/api/v10${Routes.channel(channelId)}`, {
		headers: {
			Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN,
		},
	});

	if (!response.ok) {
		throw new Error(`[Channel] Failed to fetch channel (${channelId}): (${response.status}) ${response.statusText}`);
	}

	const channel = await response.json<APIChannel>();
	channelTypeCache.set(channelId, channel.type);

	return channel.type;
};

export const isForumLikeChannel = (channelType: ChannelType): boolean => {
	return channelType === ChannelType.GuildForum || channelType === ChannelType.GuildMedia;
};
