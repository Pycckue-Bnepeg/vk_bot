'use strict';

const AMX = require('../node-amx/amx').AMX;
const randlib = require('./random');
const fs = require('fs');
const child_process = require('child_process');
const EventEmitter = require('events');

class Pawn extends EventEmitter {
	constructor(code) {
		super();
		this.source = code;
	}

	compile(callback) {
		if (callback == void(0))
			return;

		this.pwnSourceFile = `./pawno/scripts/source_${randlib.random(0, 1000)}`;
		
		fs.writeFile(`${this.pwnSourceFile}.p`, this.source, error => {
			if (error)
				return callback(error);

			child_process.exec(`${process.cwd()}/pawno/bin/pawncc ${this.pwnSourceFile}`, (error, stdout, stderr) => {
				const errors = stderr.split('\r\n');
				errors.pop();

				if (error)
					return callback(errors);
				
				return callback(null, errors);
			});
		});
	}

	run(callback) {
		if (callback == void(0))
			return;

		if (this.pwnSourceFile === undefined)
			return callback(new Error(`Сначала нужно скомпилировать код.`));

		AMX.fromFile(`${this.pwnSourceFile}.amx`, (error, amx) => {
			if (error)
				return callback(error);

			this.amx = amx;

			this.amx.callback = (pri, stk) => {
				const count = stk.readUInt32LE(0);
				const args = new Array();

				//console.log(stk);

				for (let i = 1; i <= (count >> 2); i++)
					args.push(stk.readUInt32LE(i << 2));

				return {
					num: 0,
					pri: this.emit(this.amx.natives[pri].name, args)
				};
			};

			const main = this.amx.publics.find(element => element.name === 'main');

			callback(null, this.amx.exec(main.index));
		});
	}

	getString(offset) {
		if (this.amx === undefined)
			return null;

		const buffer = this.amx.buffer.slice(this.amx.base.dat + offset);
		let string = new String();
	
		for (let i = 0; i < buffer.length; i += 4) {
			const char = buffer.readUInt32LE(i);

			if (char === 0)
				break;
		
			string += String.fromCharCode(char);
		}
	
		return string;
	}
}

module.exports = Pawn;