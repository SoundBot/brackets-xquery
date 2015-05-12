define(function (require, exports, module) {
	'use strict';
	var LanguageManager = brackets.getModule("language/LanguageManager");
	
	LanguageManager.defineLanguage("xquery", {
		name: "XQuery",
		mode: "xquery",
		fileExtensions: ["xqy"],
		lineComment: ["(:", ":)"],
		blockComment: ["(:",":)"]
	});

});
