'use strict';

const request = require('request');
const base32 = require('thirty-two');
const notp = require('notp');

const winston = require('winston');

const logger = new winston.Logger({
	transports: [
		new winston.transports.File({
			name: 'vk-api-file',
			filename: 'vk-api-wrapper.log',
			level: 'info',
			timestamp: true,
			json: false
		}),
		new winston.transports.Console({
			name: 'vk-api-console',
			level: 'error',
			timestamp: true,
			colorize: true
		})
	]
});

// https://oauth.vk.com/access_token?client_id=2274003&client_secret=hHbZxrka2uZ6jB1inYsH&v=5.41&grant_type=client_credentials

const urls = {
	auth: 'https://oauth.vk.com/token',
	api: 'https://api.vk.com/method/'
};

class MethodBuilder {
	constructor() {
		this.m_method = new Object();
	}

	getMethodInfo() {
		return this.m_method;
	}

	setMethodName(uri) {
		this.m_method.uri = urls.api + uri;
	}

	setApiVersion(version) {
		this.m_version = version;
	}

	setToken(token) {
		this.m_token = token;
	}

	setCallback(callback) {
		this.m_method.callback = callback;
	}

	setParams(params) {
		this.m_method.params = JSON.parse(JSON.stringify(params));
		this.m_method.params.access_token = this.m_token;
		this.m_method.params.v = this.m_version;
	}
}

class VKAPIWrapper {
	constructor(settings) {
		if (settings === undefined)
			throw new Error(`'settings' is undefined`);
		if (settings.token !== undefined)
			this.setToken(settings.token);
		else if (settings.login !== undefined && settings.password !== undefined)
			this.setLoginAndPassword(settings.login, settings.password);
		else
			throw new Error(`Object 'settings' has not a property of login or password or token`);

		if (settings.version !== undefined)
			this.setApiVersion(settings.version);
		else
			this.setApiVersion("5.41");

		if (settings.key !== undefined)
			this.setTotpKey(settings.key);

		this.m_blocked = false;
		this.m_fromReg = false;
		this.m_queue = new Array();
		this.m_polling = new Object();

		Array.observe(this.m_queue, this.queueObserver.bind(this));
	}

	auth(onAuth, code) {
		if (this.m_login === undefined || this.m_password === undefined && this.m_token !== undefined) {
			logger.info('VKAPI auth via token.');
			onAuth(null, this.m_token);
		}
		else if (this.m_login !== undefined && this.m_password !== undefined) {
			logger.info('Auth via login and password. API version %s', this.m_version);
			let query = {
				grant_type: 'password',
				client_id: 2274003,
				client_secret: 'hHbZxrka2uZ6jB1inYsH',
				username: this.m_login,
				password: this.m_password,
				'2fa_supported': 1,
				v: this.m_version
			};

			if (code !== undefined)
				query.code = code;

			request({ uri: urls.auth, qs: query }, (error, response, body) => {
				logger.info('response from auth server (code %d).', response.statusCode, query);
				logger.info(body);

				if (!error && response.statusCode == 200) {
					let res = JSON.parse(body);
					this.m_token = res.access_token;
					this.m_userid = res.user_id;

					//this.putTokenToReg(this.m_login, this.m_token);
					logger.info('success auth');
					onAuth(null, res);
				}
				else if (response.statusCode == 401) {
					let res = JSON.parse(body);

					if (res.error == 'need_validation') {
							if (res.validation_type == '2fa_app') {
								if (this.m_key !== undefined) {
									let code = notp.totp.gen(this.m_key);
									logger.warn('need 2fa_app validation. code %s. will try again.', code);
									this.auth(onAuth, code);
								}
							else
								onAuth({ error: 'has_not_2fa_key' });
						}
						else
							onAuth({ error: 'unsupported_validation_type' });
					}
					else 
						onAuth(res);
				}
				else
					onAuth(error);
			});
		}
		else
			throw new Error(`Wrapper has not a login or password`);
	}

	setTotpKey(key) {
		this.m_key = base32.decode(key);
	}

	setApiVersion(version) {
		this.m_version = version.toString();
	}

	setLoginAndPassword(login, password) {
		//if (login typeof String && password typeof String)
			this.m_login = login, this.m_password = password;
		//else
			//throw new Error(`Variable 'login' or 'password' is not instance of String class`);
	}

	setToken(token) {
		if (token instanceof String)
			this.m_token = token;
		else
			throw new Error(`'token' is not instance of String class`);
	}

	queueObserver(changes) {
		if (this.m_blocked == true)
			return;

		if (this.m_queue.length > 0) {
			let methodInfo = this.m_queue.shift();

			let wait = () => {
				this.m_blocked = true;
				setTimeout(() => {
					this.m_blocked = false;
					this.m_queue.unshift(methodInfo);
				}, 1000);
			};

			logger.info('calling api ...');

			request({ uri: methodInfo.uri, qs: methodInfo.params }, (error, response, body) => {
				if (!error) {
					if (response.statusCode == 200) {
						let result = JSON.parse(body);

						if (!result.error) {
							logger.info('success api call', methodInfo.uri, methodInfo.params, result.response);
							methodInfo.callback(null, result.response);
						}
						else if (result.error.error_code == 6) {
							logger.info('request limit. wait ...');
							wait();
						}
						else {
							logger.warn('error from %s', methodInfo.uri, methodInfo.params);
							logger.warn(result.error);
							methodInfo.callback(result.error);
						}
					}
					else {
						logger.warn('server responded with status code %d', response.statusCode);
						logger.warn(methodInfo.uri, methodInfo.params);
						methodInfo.callback(new Error(`Server responded with status code ${response.statusCode}`));
					}
				}
				else if (error.code === 'ETIMEDOUT') {
					logger.warn('timeout. wait ...');
					wait();
				}
				else {
					logger.warn(error);
					logger.warn(methodInfo.uri, methodInfo.params);
					methodInfo.callback(error);
				}
			});
		}
	}

	longPoll(callback) {
		this.m_polling = new Object();
		logger.info('getting longpoll server ...');
		this.call('messages.getLongPollServer', { use_ssl: true }, (err, result) => {
			if (err !== null) {
				logger.error('cannot get longpoll server', err);
				return;
			}

			this.m_polling.server = result.server;
			this.m_polling.ts = result.ts;
			this.m_polling.key = result.key;
			this.m_polling.callback = callback;

			logger.info('got longpoll server', result);

			this._poll();
		});
	}

	cancelPoll() {
		logger.info('disable longpolling');
		this.m_polling = null;
	}

	_poll() {
		if (this.m_polling !== null) {
			request({
				uri: `https://${this.m_polling.server}`,
				method: 'GET',
				qs: {
					act: 'a_check',
					key: this.m_polling.key,
					ts: this.m_polling.ts,
					wait: 25, 
					mode: 2 
				},
				timeout: 10 * 60 * 60,
			}, (err, response, body) => {
				if (err !== null || response == undefined || response.statusCode !== 200) {
					logger.warn('longpoll server', err, (response != undefined) ? response.statusCode : void(0));
					return this._poll();
				}
				const result = JSON.parse(body);
				this.m_polling.ts = result.ts;
				result.updates.forEach((event) => this.m_polling.callback(event[0], event.slice(1)));
				this._poll();
			});
		}
	}

	call(name, params, callback) {
		let methodBuilder = new MethodBuilder();

		methodBuilder.setMethodName(name);
		methodBuilder.setToken(this.m_token);
		methodBuilder.setApiVersion(this.m_version);
		methodBuilder.setParams(params);
		methodBuilder.setCallback(callback);

		logger.info('push new request to stack', name, params);

		this.m_queue.push(methodBuilder.getMethodInfo());
	}
}

module.exports = VKAPIWrapper;