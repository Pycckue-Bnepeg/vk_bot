'use strict';

const request = require('request');
const url = require('url');

function get_code_from_gist(href, callback) {
	const link = url.parse(href);

	if (link.host !== 'gist.github.com')
		return callback(new Error(`Неверная ссылка.`));

	request({
		uri: `https://api.github.com/gists/${link.path.split('/').pop()}`,
		headers: {
			'User-Agent': 'fuckgg'
		}
	}, (error, response, body) => {
		if (error)
			return callback(new Error(`Не удалось получить исходный текст.`));

		const result = JSON.parse(body);

		if (result.files === undefined || Object.keys(result.files).length === 0)
			return callback(new Error(`Не удалось получить исходный текст.`));

		const file = Object.keys(result.files)[0];
		callback(null, result.files[file].content);
	});
}

module.exports = get_code_from_gist;