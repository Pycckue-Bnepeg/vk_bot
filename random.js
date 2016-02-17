'use strict';

module.exports = {
	random_element: function(array) {
		return array[this.random(0, array.length - 1)];
	},
	random: function(min, max) {
		return Math.round(min + Math.random() * (max - min));
	}
};