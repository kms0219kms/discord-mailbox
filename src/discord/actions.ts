/**
 * Share command metadata from a common spot to be used for both runtime and registration.
 */

import { InteractionResponseType, MessageFlags, APIModalSubmitInteraction, APIInteractionResponse } from 'discord-api-types/v10';

import { MailParams, MailBox } from '../types/mailbox';
import { SendMailService } from '../services/sendmail.service';

async function _getMemberProfile(userId: string, avatarHash: string | null) {
	if (!avatarHash) {
		return `https://cdn.discordapp.com/embed/avatars/${(Number(userId) >> 22) % 6}.png`;
	}

	const image = await fetch(
		avatarHash.startsWith('a_')
			? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.gif?size=256`
			: `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=256`,
	);

	if (!image.ok) {
		return `https://cdn.discordapp.com/embed/avatars/${(Number(userId) >> 22) % 6}.png`;
	}

	const arrayBuffer = await image.arrayBuffer();

	const base64String = btoa(String.fromCodePoint(...new Uint8Array(arrayBuffer)));
	return `data:${avatarHash.startsWith('a_') ? 'image/gif' : 'image/png'};base64,${base64String}`;
}

export const replyAction = {
	name: 'reply',
	description: '메일 답변을 전송합니다.',
	execute: async (interaction: APIModalSubmitInteraction, env: Env): Promise<APIInteractionResponse> => {
		const sendMailService = new SendMailService(env);

		if (!interaction.channel?.name?.split('#')[1]?.split(':')[0]) {
			return {
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: ':warning: 메일함 채널이 아닙니다.',
					flags: MessageFlags.Ephemeral,
				},
			};
		}

		if (!interaction.member?.user) {
			return {
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: ':warning: 메시지 처리 중 오류가 발생했습니다. (interaction.member.user is undefined)',
					flags: MessageFlags.Ephemeral,
				},
			};
		}

		const mailBoxData = await env.DB.prepare('SELECT * FROM Tickets WHERE Id = ?')
			.bind(interaction.channel.name.split('#')[1].split(':')[0])
			.first<MailBox>();

		if (!mailBoxData) {
			return {
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: ':warning: 해당 메일이 존재하지 않습니다.',
					flags: MessageFlags.Ephemeral,
				},
			};
		}

		const mailParams: MailParams = {
			id: mailBoxData.Id,
			subject: mailBoxData.Subject,

			content:
				interaction.data.components.find((x) => x.type === 1)?.components.find((x) => x.type === 4 && x.custom_id === 'content')?.value ??
				'',

			from: {
				name: interaction.member.user.global_name ?? interaction.member.user.username,
				avatar: await _getMemberProfile(interaction.member.user.id, interaction.member.user.avatar),
				address: mailBoxData.Receiver,
			},
			to: {
				address: mailBoxData.Author,
			},
		};

		console.log(`[Reply Actions] Sending Email: ${JSON.stringify(mailParams)}`);
		await sendMailService.sendMail(mailParams);

		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				embeds: [
					{
						title: '티켓이 업데이트 되었습니다.',
						description: mailParams.content,
						footer: {
							text: `#${mailBoxData.Id} (${mailBoxData.Receiver} -> ${mailBoxData.Author})`,
						},
					},
				],
			},
		};
	},
};
