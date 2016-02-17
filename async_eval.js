'use strict';

const vm = require('vm');

const query = process.argv[2] || '';
const args = (process.argv[3] !== undefined) ? JSON.parse(process.argv[3]) : new Array();
const fixedCode = query.replace(/&quot;/g, '"').replace(/<br>/g, '\n').replace(/«/g, '<<').replace(/»/g, '>>');

/*const context = {
	hex: value => `0x${value.toString(16)}`,
	bin: value => value.toString(2),
	args: args
};*/

let context = Math;
context.hex = value => `0x${value.toString(16)}`;
context.bin = value => value.toString(2);
context.args = args;

const options = {
	timeout: 5000
};

try {
	const script = new vm.Script(`'use strict'; (function() { ${fixedCode} })();`, options);
	const result = script.runInNewContext(context, options);
	process.send({ success: true, result: result });
} catch (error) {
	process.send({ success: false, error: error });
}