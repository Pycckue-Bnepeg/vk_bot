'use strict';

module.exports = function cleanup(text) {
	const ZNACHENIE_ZNAESH_EBANUTIY_CUSOK = /====\s?Значение\s?====/;
	
	const index = text.search(ZNACHENIE_ZNAESH_EBANUTIY_CUSOK);
	if (index === -1)
		return null;

	const OBRUBOK = text.substring(text.indexOf('\n', index));
	const ESHE_OBRUBOK_EVANIY = OBRUBOK.substring(0, OBRUBOK.indexOf('===='));
	
	return ESHE_OBRUBOK_EVANIY.split('#')
		.slice(1)
		.map(value => value.slice(0, value.search('{{пример'))
			.trim()
			.replace(/\[\[(([^\]]+\|)?([^\]]+|[^\]]+))\]\]/g, '$3')
			.replace(/\{\{=\|([^\{\}]+)\}\}/g, 'то же, что и $1')
			.replace(/\{\{([^\{\}]+)\|(ru|lang=ru)\}\}/g, '$1')
			.replace(/\{\{(помета|выдел)\|([^\{\}]+)\}\}/g, '$2')
			.replace(/\{\{свойство\|(((.+)\|(.+))|(.+))\}\}/g, 'свойство от прилагательного $5$3;$4')
			.replace(/\{\{([^\{\}]+)\}\}/g, '$1'));
}