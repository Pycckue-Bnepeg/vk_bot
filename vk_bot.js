'use strict';

const request = require('request');
const EventEmitter = require('events');
const VKAPIWrapper = require('./vk_api.js');
const logger = require('./logger');
const fs = require('fs');

const COMMAND_PATTERN = /^@(\w+)(\((.*)\))?(\s(.*))?/;

class VKBot extends EventEmitter {
	constructor(account) {
		super();
		this.vk = new VKAPIWrapper(account);
		this.vk.auth(this.onAuth.bind(this));
		this.commands = new Map();
		this.vars = new Object();
	}

	onAuth(error, result) {
		if (!error) {
			logger.info('Success auth. Bot id %d', result.user_id);
			this.bot_id = result.user_id;
			this.vk.longPoll((event, args) => {
				if (event !== 4)
					return;
				else this.onNewMessage({
					id: args[0],
					flags: args[1],
					from: args[2],
					timestamp: args[3],
					subject: args[4],
					text: args[5],
					attachments: args[6]
				});
			});

			this.on('help', function(info, args, query) {
				logger.info('help request from %d', info.peer, query);

				const separator = '\n--------------------------------\n';

				if (query !== undefined) {
					if (!this.commands.has(query))
						return this.response(info.peer, 'Такой команды не существует.');
					
					const command = this.commands.get(query);
					let response = `Описание команды @${query}:`;

					response += `${separator}@${command.syntax} — ${command.description}`; 
					if (command.args)
						response += `${separator}Параметры:\n${command.args.map(arg => `${arg.name} — ${arg.description}`).join('\n')}`;
					if (command.examples)
						response += `${separator}Примеры:\n${command.examples.join('\n')}`;

					this.response(info.peer, response, null, [ info.message ]);
				} else {
					let response = 'Список команд:\nДля более подробной информации введите @help command.\n';
					this.commands.forEach((value, key) => {
						response += `${separator}@${value.syntax} — ${value.description}`;
					});
					this.response(info.peer, response);
				}
			});
		}
	}

	onNewMessage(message) {
		/*if (message.from === this.bot_id || (message.from >= 2000000000 && message.attachments['from'] === this.bot_id))
			return;*/

		const text = message.text;
		const matches = text.match(COMMAND_PATTERN);
		
		if (matches === null)
			return;

		const command = matches[1];
		let command_args = matches[3];
		const query = matches[5];

		const sender = (message.from >= 2e9) ? message.attachments['from'] : message.from;
		const chat_id = message.from;

		if (command_args !== undefined)
			command_args = command_args.split(',').map(string => string.trim());
		else
			command_args = new Array();

		logger.info('recieved command "%s" from %d (sender %d): %s', command, chat_id, sender, query, command_args);

		this.emit(command, { peer: chat_id, sender: sender, message: message.id }, command_args, query);
	}

	response(to, message, attachments, forward_messages) {
		logger.info('response to %d with message "%s"', to, message, attachments, forward_messages);

		this.vk.call('messages.send', {
			peer_id: to,
			message: message,
			attachment: (attachments != void(0)) ? attachments.join(',') : 0,
			forward_messages: (forward_messages != void(0)) ? forward_messages.join(',') : 0
		}, (err) => (err != void(0)) ? logger.error(err) : 0);
	}

	getListOfChatUsers(chat, callback) {
		if (callback === undefined)
			return;

		this.vk.call('messages.getChat', {
			chat_id: chat - 2e9,
			fields: 'first_name, last_name'
		}, (error, result) => {
			if (error != void(0)) {
				logger.warn('cannot get info about chat_id %d', chat - 2e9);
				return callback(error);
			}
			callback(null, result.users);
		});
	}

	uploadImage(image, callback) {
		if (callback === undefined)
			return;

		this.vk.call('photos.getMessagesUploadServer', {}, (error, result) => {
			if (error) {
				logger.warn('cannot get upload server', error);
				return callback(error);
			}

			logger.info('start uploading to', result);

			request.post({
				uri: result.upload_url,
				formData: {
					photo: fs.createReadStream(image)
				}
			}, (error, response, body) => {
				if (error || response.statusCode !== 200) {
					logger.warn('cannot upload image', error, response.statusCode);
					return callback(error);
				}

				const result = JSON.parse(body);

				logger.info('success upload photo', result);

				this.vk.call('photos.saveMessagesPhoto', result, (error, result) => {
					if (error) {
						logger.warn('cannot save message photo', error);
						return callback(error);
					}

					logger.info('success save photo', result);
					return callback(null, result);
				});
			});
		});
	}

	resolveScreenName(name, callback) {
		if (callback === undefined)
			return;

		this.vk.call('utils.resolveScreenName', { screen_name: name }, callback);
	}

	setDescriptionForCmd(command, description) {
		this.commands.set(command, description);
	}
}

module.exports = VKBot;