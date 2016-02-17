'use strict';

const randlib = require('./random');

module.exports = class List {
	constructor(users) {
		this.users = users;
	}
	
	get() {
		const index = randlib.random(0, this.users.length - 1);
		const user = this.users[index];
		this.users = this.users.slice(0, index).concat(this.users.slice(index + 1, this.users.length));
		return user;
	}

	getOnlyName() {
		const user = this.get();
		return `${user.first_name} ${user.last_name}`;
	}
};