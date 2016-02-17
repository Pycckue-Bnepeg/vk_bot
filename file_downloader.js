const fs = require('fs');
const http = require('http');

module.exports = function(url, dest, cb) {
	const file = fs.createWriteStream(dest);
	const request = http.get(url, function(response) {

		// check if response is success
		if (response.statusCode !== 200) {
			return cb('Response status was ' + response.statusCode);
		}

		response.pipe(file);

		file.on('finish', function() {
			file.close(cb);  // close() is async, call cb after close completes.
		});
	});

	// check for request error too
	request.on('error', function (err) {
		fs.unlink(dest);

		if (cb) {
			return cb(err.message);
		}
	});

	file.on('error', function(err) { // Handle errors
		fs.unlink(dest); // Delete the file async. (But we don't check the result)

		if (cb) {
			return cb(err.message);
		}
	});
};