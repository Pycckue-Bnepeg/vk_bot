'use strict';

const VKBot = require('./vk_bot');
const child_process = require('child_process');
const request = require('request');
const cleanup = require('./wiki_cleanup');
const UserList = require('./lists');
const randomlib = require('./random');
const dns = require('dns');
const cheerio = require('cheerio');
const fs = require('fs');
const downloadFile = require('./file_downloader');
const fork = require('child_process').fork;
const dice = require('./scripts/__dice');
const Pawn = require('./pawn');
const get_code_from_gist = require('./gist');

const account = {
	login: 'fuckgg',
	password: 'fuuuuuu',
	key: 'what the hell'
};

const bot = new VKBot(account);

setDescription(bot);

bot.on('who', function(info, args, query) {
	const MEMES = ['Это ...', 'это ...', 'ЭТО ...'];

	if (info.peer >= 2e9)
		this.getListOfChatUsers(info.peer, (error, users) => {
			if (error)
				return this.response(this.peer, 'Ошибка какая-то ...', null, [ info.message ]);

			const user = randomlib.random_element(users);

			this.response(info.peer, `${randomlib.random_element(MEMES)} ${user.first_name} ${user.last_name}`, null, [ info.message ]);
		});
	else
		this.response(info.peer, 'Команда закрыта на технические работы ...');
});

bot.on('ping', function(info, args, query) {
	const type = (args[0] !== undefined) ? args[0] : 'site';

	if (type === 'site') {
		child_process.exec(`ping "${query}" | find "Average"`, (error, stdout, stderr) => {
			if (error || stderr.length !== 0)
				return this.response(info.peer, 'Неверный адрес.');
			this.response(info.peer, `Ping ${query}:\n${stdout.trim()}`);
		});
	}
	else
		this.response(info.peer, 'Ты глупый что ли?');
});

bot.on('wiki', function(info, args, query) {
	const lang = (args[0] !== undefined) ? args[0] : 'ru';
	const count = (args[1] !== undefined) ? args[1] : 1;

	request({
		uri: `https://${lang}.wikipedia.org/w/api.php`,
		qs: {
			action: 'query',
			srlinit: count,
			list: 'search',
			srsearch: query,
			format: 'json'
		}
	}, (err, response, body) => {
		if (err !== null)
			return;

		const result = JSON.parse(body);
		let message = new String();

		for (let i = 0; i < count; i++) {
			if (result.query !== undefined && result.query.search !== undefined && result.query.search[i] !== undefined)
				message += `https://${lang}.wikipedia.org/wiki/${result.query.search[i].title.replace(/\s/g, '_')}\n`;
		}

		this.response(info.peer, message);
	});
});

bot.on('def', function(info, args, query) {
	if (query === undefined)
		return this.response(info.peer, 'Команда @def должна принимать значение. Подробнее @help.');

	request({
		uri: 'https://ru.wiktionary.org/w/api.php',
		qs: {
			action: 'query',
			titles: query,
			rvprop: 'content',
			prop: 'revisions',
			format: 'json'
		}
	}, (err, response, body) => {
		if (err !== null)
			return this.response(info.peer, 'Дети-404. Not found!', null, info.message);

		const result = JSON.parse(body);
		
		if (result == void(0) || result.query == void(0) || result.query.pages == void(0))
			return;

		const keys = Object.keys(result.query.pages);

		if (keys.length === 0)
			return;

		if (result.query.pages[keys[0]].revisions === undefined || result.query.pages[keys[0]].revisions.length === 0)
			return;

		const defs = cleanup(result.query.pages[keys[0]].revisions[0]["*"]);
		if (defs === null)
			return;

		this.response(info.peer, defs.map((def, index) => (def.length > 1) ? `${index + 1}. ${def}` : void(0)).join('\n'), null, [ info.message ]);
	});
});

bot.on('listof', function(info, args, query) {
	let count = (args[0] !== undefined) ? args[0] : 5;

	if (info.peer < 2e9)
		return this.response(info.peer, 'Команда на реконструкции ...');

	this.getListOfChatUsers(info.peer, (err, users) => {
		if (err)
			return;

		if (count > users.length)
			count = users.length;

		const list = new UserList(users);
		let message = `Лист ${query}:`;

		for (let i = 1; i <= count; i++)
			message += `\n${i}. ${list.getOnlyName()}`;

		this.response(info.peer, message);
	});
});

bot.on('resolve', function(info, args, query) {
	if (query === undefined)
		return this.response(info.peer, 'Необходимы параметры для команды @resolve. Введите @help.');

	dns.lookup(query, (error, address, family) => {		
		if (error)
			return this.response(info.peer, 'Ошибка получения адреса.');
		this.response(info.peer, `${query} имеет адрес ${address}`, null, [ info.message ]);
	});
});

bot.on('eoff', function(info, args, query) {
	request({
		uri: 'http://www.russki-mat.net/e/mat_slovar.htm',
		method: 'GET'
	}, (error, response, body) => {
		if (error || response.statusCode !== 200)
			return;

		const MEMES = cheerio.load(body)('.art > .lem');
		const who = randomlib.random_element(['денисов', 'аакерманова-шлюха']);
		
		this.response(info.peer, `${who} ты ${randomlib.random_element(MEMES).children[0].data}!!`);
	});
});

bot.on('meme', function(info, args, query) {
	const type = (args[0] !== undefined) ? args[0] : '1001mem';
	
	const callback = (error, result) => {
		if (error)
			return this.response(info.peer, 'Не удалось получить мем, прости ...');

		if (result.type == 'attachment')
			return this.response(info.peer, '', [ result.content ], [ info.message ]);
		
		if (result.type == 'text')
			return this.response(info.peer, result.content, null, [ info.message ]);
		
		if (result.type == 'image') {
			const uri = result.content;
			const filename = `./upload/${randomlib.random(0, 1000)}_${uri.slice(uri.lastIndexOf('\/') + 1, uri.length)}`;

			downloadFile(uri, filename, (error, result) => {
				if (error)
					return this.response(info.peer, 'Ошибка ...');
				this.uploadImage(filename, (error, result) => {
					fs.unlink(filename, () => void(0));
						
					if (error || result.length === 0)
						return;
						
					const picture = result[0];
					return this.response(info.peer, '', [ `photo${picture.owner_id}_${picture.id}` ], [ info.message ]);
				});
			});
		}
	};

	switch(type) {
		case '1001mem': 
			getMemeFrom1001Mem(callback);
			break;
		case 'yandex':
			getMemeFromYandexRu(args[1] || 1, callback);
			break;
		case 'vk':
			const publicName = (args[1] !== undefined) ? args[1] : null;
			const fromId = (!isNaN(parseInt(args[2]))) ? parseInt(args[2]) : 0;

			if (publicName == null)
				return this.response(info.peer, 'Неизвестный мемоконтент источник!');

			this.vk.call('wall.get', { domain: publicName, count: 1 }, (error, result) => {
				if (error || result.count === 0)
					return this.response(info.peer, 'Здесь нет мемов!', null, [ info.message ]);

				const index = randomlib.random(fromId, result.count - 1);

				this.vk.call('wall.get', { domain: publicName, count: 1, offset: index }, (error, result) => {
					if (error || result.items === undefined || result.items.length === 0)
						return this.response(info.peer, 'Здесь нет мемов!', null, [ info.message ]);

					const post = result.items[0]; 
					return this.response(info.peer, '', [ `wall${post.owner_id}_${post.id}` ]);
				});
			});

			break;
		default:
			args.unshift('vk');
			this.emit('meme', info, args, query);
			//this.response(info.peer, 'Неизвестный мемоконтент источник!');
	}
});

bot.on('eval', function(info, args, query) {
	const virtualMachine = fork('./async_eval.js', [ query ]);
	virtualMachine.on('message', message => {
		if (message.success)
			this.response(info.peer, `Result: ${message.result}`);
		else
			this.response(info.peer, 'Не осилил выполнить твой код ...');
	});
});

bot.on('calc', function(info, args, query) {
	this.emit('eval', info, args, `return ${query};`);
});

bot.on('script', function(info, args, query) {
	const command = (args[0] !== undefined) ? args[0] : 'run';

	if (query === undefined)
		return this.response(info.peer, 'Вы не указали имя скрипта для запуска.');

	const filename = `./scripts/${query}.js`;

	switch (command) {
		case 'run':
			if (!fs.existsSync(filename, fs.R_OK))
				return this.response(info.peer, `Скрипта с именем "${query}" не существует.`);

			fs.readFile(filename, (error, text) => {
				if (error)
					return this.response(info.peer, `Произошла ошибка при загрузке скрипта.`);

				const virtualMachine = fork('./async_eval.js', [ text, JSON.stringify(args.slice(1)) ]);
				
				virtualMachine.on('message', message => {
					if (message.success)
						this.response(info.peer, message.result);
					else
						this.response(info.peer, 'Произошла ошибка при исполнении кода.');
				});
			});

			break;
		case 'create':
			break;
		case 'list':
			break;
		default:
	}
});

bot.on('dice', function(info, args, query) {
	if (query === undefined && args.length === 0)
		return this.response(info.peer, 'Для игры в @dice нужно ввести ставку и оппонента.');

	const command = (args[0] !== undefined) ? args[0] : 'bet';

	switch (command) {
		case 'bet': {
			const opponent = (args[1] !== undefined) ? parseInt(args[1]) : 0;
			const bet = parseInt(query);

			const play = (opponent) => {
				if (opponent <= 0 || opponent >= 2e9)
					return this.response(info.peer, 'Вы ввели недействительный ID пользователя.', null, [ info.message ]);
			
				const result = dice.bet(info.sender, opponent, bet);
			
				if (result.success)
					this.response(info.peer, 'Вы успешно выдвинули предложение сыграть с вами.', null, [ info.message ]);
				else
					this.response(info.peer, `Ошибка! ${result.reason}`, null, [ info.message ]);
			};



			if (isNaN(opponent)) {
				this.resolveScreenName(args[1], (error, result) => {
					if (!error && result.type === 'user')
						return play(result.object_id);
					else
						return this.response(info.peer, 'Вы ввели screenname не пользователя.', null, [ info.message ]);
				});
			}
			else
				play(opponent);

			break;
		}
		case 'top': {
			const top = dice.getTop();
		
			this.vk.call('users.get', { user_ids: top.join(',') }, (error, users) => {
				if (error)
					return this.response(info.peer, 'Не удалось получить топ, простите ...', null, [ info.message ]);

				const message = users.map((user, index) => `${index + 1}. ${user.first_name} ${user.last_name} имеет ${dice.getBalance(user.id)}$`).join('\n');

				this.response(info.peer, `Топ @dice:\n${message}`, null, [ info.message ]);
			});

			break;
		}
		case 'balance': {
			const balance = dice.getBalance(info.sender);
			if (balance === null)
				this.response(info.peer, 'Вы не зарегистрированны!', null, [ info.message ]);
			else
				this.response(info.peer, `Ваш балас на данный момент ${balance}$.`, null, [ info.message ]);
			break;
		}
		case 'accept': {
			const result = dice.play(info.sender);
			if (result.success) {
				if (result.winner)
					this.response(info.peer, `Поздравляем, вы победили!\nВаш баланс: ${result.balance}$.`, null, [ info.message ]);
				else
					this.response(info.peer, `Поздравляем, вы проиграли!\nВаш баланс: ${result.balance}$.`, null, [ info.message ]);
			} else
				this.response(info.peer, `Упс, ошибка: ${result.reason}`, null, [ info.message ]);
			break;
		}
		case 'decline': {
			const result = dice.decline(info.sender);
			if (result.success)
				this.response(info.peer, 'Вы успешно отменили встречное предложение.', null, [ info.message ]);
			else
				this.response(info.peer, `Ошибка: ${result.reason}`, null, [ info.message ]);
			break;
		}
		case 'reg':
		case 'reset':
			dice.reset(info.sender);
			this.response(info.peer, 'Теперь на вашем балансе 100$!', null, [ info.message ]);
			break;
		default:
			this.response(info.peer, 'Неизвестная команда для игры в @dice.');
	}
});

bot.on('pawn', function(info, args, query) {
	get_code_from_gist(query, (error, code) => {
		if (error)
			return this.response(info.peer, 'Не удалось получить код по ссылке.', null, [ info.message ]);

		const pawn = new Pawn(code);
		pawn.compile((error, warnings) => {
			if (error)
				return this.response(info.peer, `${error.length} errors:\n${error.join('\n')}`, null, [ info.message ]);

			if (warnings.length > 0)
				this.response(info.peer, `${warnings.length} warnings:\n${warnings.join('\n')}`, null, [ info.message ]);

			pawn.on('say', args => this.response(info.peer, `Message from pawn: ${pawn.getString(args[0])}`));

			pawn.run((error, result) => {
				if (error)
					return this.response(info.peer, 'Ошибка при выполнении кода.');

				return this.response(info.peer, `Результат выполнения: ${result}`);
			});
		});
	});
});

function getMemeFromYandexRu(count, callback) {
	if (callback == undefined)
		return;

	if (count > 20)
		count = 20;

	request.get('http://export.yandex.ru/last/last20x.xml', (error, response, body) => {
		if (error || response.statusCode !== 200)
			return callback(error);

		let message = new String();

		for (let i = 0; i < count; i++) {
			message += `\n${cheerio.load(body)('page > last20x > item').get(i).children[0].data}`;
		}

		callback(null, { type: 'text', content: message });
	});
}

function getMemeFrom1001Mem(callback) {
	if (callback == undefined)
		return;

	const page = randomlib.random(1, 1000);

	request.get(`http://1001mem.ru/best/${page}`, (error, response, body) => {
		if (error || response.statusCode !== 200)
			return callback(error);

		const articles = cheerio.load(body)('.posts > article');
		
		if (articles.length === 0)
			return callback(error);

		const article = randomlib.random_element(articles);
		const uri = article.children[3].children[1].children[1].children[1].attribs.src;

		callback(null, { type: 'image', content: uri });
	});
}

function setDescription(bot) {
	bot.setDescriptionForCmd('wiki', {
		description: 'Позволяет получить ссылки на статьи с сайта wikipedia.org.',
		syntax: 'wiki([lang], [count]) %query%',
		args: [{
				name: 'lang', 
				description: 'Язык поиска статьи.'
			}, {
				name: 'count',
				description: 'Количество возвращаемых результатов.'
			}, {
				name: 'query',
				description: 'Запрос, по которому производить поиск статей.'
			}
		],
		examples: ['@wiki Сталин', '@wiki(en) API', '@wiki(ru, 5) 1995']
	});

	bot.setDescriptionForCmd('ping', {
		description: 'Выполнить команду ping с введенным адресом.',
		syntax: 'ping %address%',
		args: [{
				name: 'address',
				description: 'Адрес сайта.'
			}
		],
		examples: ['@ping google.com', '@ping api.vk.com']
	});

	bot.setDescriptionForCmd('who', {
		description: 'Мемная команда, которая говорит кто ...',
		syntax: 'who'
	});

	bot.setDescriptionForCmd('def', {
		description: 'Получить описание слова с сайта wiktionary.org',
		syntax: 'def %query%',
		args: [{
				name: 'query',
				description: 'Слово, которое нужно найти.'
			}
		],
		examples: ['@def насвай', '@def поиск']
	});
	
	bot.setDescriptionForCmd('listof', {
		description: 'Выводит список случайных пользователей конференции.',
		syntax: 'listof([count]) %name%',
		args: [{
				name: 'count',
				description: 'Количество пользователей в списке.'
			}, {
				name: 'name',
				description: 'Название списка.'
			}
		],
		examples: ['@listof МойСписок', '@listof(10) Десять случайных пользователей']
	});

	bot.setDescriptionForCmd('dice', {
		description: 'Игра в кости.',
		syntax: 'dice(%action% [, ..args]) [query]',
		args: [{
				name: 'action',
				description: 'Действие в игре. Доступные: reg, bet, reset, decline, accept, top, balance.'
			}, {
				name: 'args, query',
				description: 'Дополнительные аргументы.'
			}
		],
		examples: [
			'@dice(reg) — регистрация в игре.', 
			'@dice(bet, 86711420) 100 — предложение игры на 100$ (вместо ID можно screenname).', 
			'@dice(reset) — объявить себя банкротом и сбросить баланс.',
			'@dice(decline) — отменить последнее предложение.',
			'@dice(accept) — принять последнее предложение.',
			'@dice(top) — показать топ-5 богачей.',
			'@dice(balance) — вывести свой баланс.'
		]
	});

	bot.setDescriptionForCmd('resolve', {
		description: 'Получает IP адрес к которому прикреплен домен.',
		syntax: 'resolve %domain%',
		args: [{
				name: 'domain',
				description: 'Домен ...'
			}
		],
		examples: [ '@resolve server.rp-skyland.ru' ]
	});

	bot.setDescriptionForCmd('meme', {
		description: 'Получает смешной meme с разных источников',
		syntax: 'meme([source, ..args])',
		args: [{
				name: 'source',
				description: 'Мемоисточник. Доступны: 1001mem (по умолчанию), yandex, vk'
			}
		],
		examples: [
			'@meme — получает мем с 1001mem.',
			'@meme(yandex) — получает мем с яндекса.',
			'@meme(yandex, 10) — получает 10 (десять) мемов с яндекса.',
			'@meme(mdk) — получает мем с MDK ...',
			'@meme(vk, publicname) — получает мем с любого паблика ВКонтакте.',
			'@meme(publicname) — пока что можно и так ...'
		]
	});

	bot.setDescriptionForCmd('eval', {
		description: 'Выполняет JavaScript код online.',
		syntax: 'eval %code%',
		args: [{
				name: 'code',
				description: 'Код, что нужно выполнить.'
			}
		],
		examples: ['@eval return [5, 1, 2, 4, 3].sort((a, b) => a - b)']
	});

	bot.setDescriptionForCmd('calc', {
		description: 'Выполняет математические операции.',
		syntax: 'calc %expression%',
		args: [{
				name: 'expression',
				description: 'Выражение для вычисления.'
			}
		],
		examples: ['@calc 2 * 2 + Math.log2(2 << 3)']
	});

	bot.setDescriptionForCmd('script', {
		description: 'Операции с кастомными скриптами.',
		syntax: 'script(%command% [, ..args]) [query]',
		args: [{
				name: '',
				description: ''
			}
		],
		examples: []
	});

	bot.setDescriptionForCmd('pawn', {
		description: 'Запускает скрипт pawn с gist.github.com.',
		syntax: '@pawn %link%',
		args: [{
				name: 'link',
				description: 'Ссылка на gist.github.com'
			}
		],
		examples: ['@pawn https://gist.github.com/zottce/6c5ec06ed494951790b6 — Запуск скрипта.']
	});

	/*bot.setDescriptionForCmd('', {
		description: '',
		syntax: '',
		args: [{
				name: '',
				description: ''
			}
		],
		examples: []
	});*/
}