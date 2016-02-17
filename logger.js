'use strict';

const winston = require('winston');

module.exports = new winston.Logger({
	transports: [
		new winston.transports.File({
			name: 'info-file',
			filename: 'vk-bot.log',
			level: 'info',
			timestamp: true,
			json: false
		}),
		new winston.transports.Console({
			name: 'info-console',
			level: 'error',
			timestamp: true,
			colorize: true
		})
	]
});