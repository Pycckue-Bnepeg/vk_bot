'use strict';

const randlib = require('../random');
const fs = require('fs');

const database = {
	filename: './scripts/dice/players.json',
	__base: new Object(),

	open: function() {
		this.__base = JSON.parse(fs.readFileSync(this.filename));
	},

	set: function(user, key, value) {
		if (!this.__base.hasOwnProperty(user))
			this.__base[user] = new Object();
		
		this.__base[user][key] = value;
		this.save();
	},

	get: function(user, key) {
		if (this.__base.hasOwnProperty(user))
			return this.__base[user][key];
		else
			return null;
	},

	save: function() {
		fs.writeFileSync(this.filename, JSON.stringify(this.__base));
	}
};

database.open();

module.exports = {
	getTop: function() {
		return Object.keys(database.__base).sort((a, b) => database.__base[a].balance - database.__base[b].balance).slice(0, 5).reverse();
	},

	getBalance: function(player) {
		return database.get(player, 'balance');
	},

	setBalance: function(player, balance) {
		database.set(player, 'balance', balance);
	},

	inc: function(player, count) {
		this.setBalance(player, this.getBalance(player) + count);
	},

	dec: function(player, count) {
		this.inc(player, -count);
	},

	reset: function(player) {
		this.setBalance(player, 100);
	},

	playerIsFree: function(player) {
		const game = database.get(from, 'game');
		return (game === undefined || game === 0);
	},

	bet: function(from, to, bet) {
		const balanceFirst = this.getBalance(from);
		const balanceTwo = this.getBalance(to);

		if (balanceFirst == null)
			return { success: false, reason: 'Вы не зарегистрированны.' };

		if (from === to)
			return { success: false, reason: 'Нельзя играть с самим собой ...' };

		if (balanceTwo == null)
			return { success: false, reason: 'Оппонент не зарегистрирован.' };

		if (bet < 10)
			return { success: false, reason: 'Ставки от 10$!' };

		if (balanceFirst < bet)
			return { success: false, reason: 'У вас недостаточно денег на счету.' };
		if (balanceTwo < bet)
			return { success: false, reason: 'У оппонента недостаточно денег на счету.' };

		if (!this.playerIsFree(from) || !this.playerIsFree(to))
			return { success: false, reason: 'В данный момент невозможно вызывать этого игрока.' };

		database.set(from, 'game', to);
		database.set(to, 'game', from);
		database.set(from, 'bet', bet);
		database.set(to, 'bet', bet);

		return { success: true };
	},

	play: function(player) {
		const opponent = database.get(player, 'game');
		const bet = database.get(player, 'bet');

		if (opponent === null)
			return { success: false, reason: 'Вы не зарегистрированны.' };

		if (opponent === undefined || opponent === 0)
			return { success: false, reason: 'К вам нет встречных предложений.' };

		const winner = randlib.random(0, 1);

		if (winner) {
			this.inc(player, bet);
			this.dec(opponent, bet);
		} else {
			this.dec(player, bet);
			this.inc(opponent, bet);
		}

		this.clear(player);

		const balance = this.getBalance(player);

		return { success: true, winner: winner, balance: balance };
	},

	decline: function(player) {
		const opponent = database.get(player, 'game');
		
		if (opponent === null)
			return { success: false, reason: 'Вы не зарегистрированны.' };

		if (opponent === undefined || opponent === 0)
			return { success: false, reason: 'Вы не предлагали никому игру.' };

		this.clear(player);

		return { success: true };
	},

	clear: function(player) {
		const opponent = database.get(player, 'game');

		database.set(player, 'game', 0);
		database.set(opponent, 'game', 0);
		database.set(player, 'bet', 0);
		database.set(opponent, 'bet', 0);
	}
};