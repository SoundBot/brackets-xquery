/**
 * Hint functionlity based on the Less plugin by Konstantin Kobs: https://github.com/konstantinkobs/brackets-LESShints
 */
define(function (require, exports, module) {
	'use strict';

var AppInit = brackets.getModule("utils/AppInit"),
    CodeHintManager = brackets.getModule("editor/CodeHintManager"),
    DocumentManager = brackets.getModule("document/DocumentManager"),
    LanguageManager = brackets.getModule("language/LanguageManager"),
    ProjectManager = brackets.getModule("project/ProjectManager"),
    FileUtils = brackets.getModule("file/FileUtils"),
    Async = brackets.getModule("utils/Async");

    // All file extensions that are supported
    var fileextensions = ["xqy"];

	LanguageManager.defineLanguage("xquery", {
		name: "XQuery",
		mode: "xquery",
		fileExtensions: fileextensions,
		lineComment: ["(:", ":)"],
		blockComment: ["(:", ":)"]
	});

    /**
     * @constructor
     */
    function Hint() {

        // Some settings
        this.implicitChar = ":";
        this.regex = /([\w\-:]+)/ig;
        this.chars = /[@\w\-]/i;
        this.space = /[\s\n\t\(\)\[\]]/i;
        // Array with hints and the visual list in HTML
        this.hints = [];
        this.hintsHTML = [];

        // String which was written since the hinter is active
        this.writtenSinceStart = "";

        // Startposition of cursor
        this.startPos = null;

    }

    /**
     * Checks if it is possible to give hints.
     *
     * @param   {Object}  editor       The editor object
     * @param   {String}  implicitChar The written character
     * @returns {Boolean} whether it is possible to give hints
     */
    Hint.prototype.hasHints = function (editor, implicitChar) {
        // The editor instance
        this.editor = editor;

        // Set the start position for calculating the written text later
        if (!implicitChar || this.space.test(implicitChar)) {
            this.startPos = editor.getCursorPos();
        }

        // Check if the written character is the trigger
        return this.regex.test(implicitChar);

    };

    /**
     * Gets the hints in case there are any
     *
     * @param   {String} implicitChar The last written character
     * @returns {Object} The list of hints like brackets wants it
     */
    Hint.prototype.getHints = function (implicitChar) {
        // We don't want to give hints if the cursor is out of range

        if (!this.validPosition(implicitChar)) {
            return null;
        }

        // Create the Deferred object to return later
        var result = new $.Deferred();

        // Inside the "done" function we need access to this,
        // so we rename it to that.
        var that = this;

        // Get the text in the file
        this.getText().done(function (text) {
            // Get all matches for the RegExp set earlier
            var matches = that.getAll(that.regex, text);

            // Filter the results by everything the user wrote before
            matches = that.filterHints(matches);

            // Prepare the hint arrays
            that.processHints(matches);

            // Send hints to caller
            result.resolve({
                hints: that.hintsHTML,
                match: null,
                selectInitial: true,
                handleWideResults: false
            });

        });

        return result;

    };

    /**
     * Inserts a chosen hint into the document
     *
     * @param {String} hint the chosen hint
     */
    Hint.prototype.insertHint = function (hint) {

        // We showed the HTML array. Now we need the clean hint.
        // Get index from list
        var index = this.hintsHTML.indexOf(hint);
        // Get hint from index
        hint = this.hints[index];

        // Document instance
        var document = DocumentManager.getCurrentDocument();

        // Endpoint to replace
        var pos = this.editor.getCursorPos();

        // Add text in our document
        document.replaceRange(hint, this.startPos, pos);

    };

    /**
     * Checks if it still is possible to give hints.
     * It is not possible to give hints anymore if:
     * - the cursor is before the position of the starting position
     * - the user typed some character which is not usable in a variable name
     *
     * @param   {String}  implicitChar The last written character
     * @returns {Boolean} True, if the cursor has a valid position
     */
    Hint.prototype.validPosition = function (implicitChar) {

        // If the written char is not in a valid
        // set of characters for a variable.
        if (!implicitChar.match(this.regex)) {
            return false;
        }

        // Document instance
        var document = DocumentManager.getCurrentDocument();
        // Current cursor position
        var cursorPos = this.editor.getCursorPos();

        this.writtenSinceStart = document.getRange(this.startPos, cursorPos);

        return true;

    };

    /**
     * Gets the text of all relevant documents.
     *
     * @returns {String} Text of all relevant documents (concatenated)
     */
    Hint.prototype.getText = function () {

        // Promise for getHints method
        var result = new $.Deferred();
        // Contents of all relevant files
        var texts = [];

        // Get all relevant files (will be a promise)
        ProjectManager.getAllFiles(function (file) {
            // Check if file extension is in the set of supported ones
            return (fileextensions.indexOf(FileUtils.getFileExtension(file.fullPath)) !== -1);

        }).done(function (files) {

            // Read all files and push the contents to the texts array
            Async.doInParallel(files, function (file) {

                var parallelResult = new $.Deferred();

                DocumentManager.getDocumentText(file)
                    .done(function (content) {

                        texts.push(content);

                    }).always(function () {

                        parallelResult.resolve();

                    });

                return parallelResult.promise();

                // Give the contents back to caller
            }).always(function () {

                result.resolve(texts.join("\n\n"));

            });

            // If something goes wrong, don't crash! Just do nothing!
        }).fail(function () {

            result.resolve("");

        }).fail(function () {

            result.resolve("");

        });


        return result.promise();

    };

    /**
     * Returns all matches of the RegExp in the text
     * @param   {RegExp} regex The RegExp which should be used
     * @param   {String} text  The searchable string
     * @returns {Array}  All matches of the RegExp in the string
     */
    Hint.prototype.getAll = function (regex, text) {

        // We start empty
        var matches = [];

        // For every match
        var match;
        while ((match = regex.exec(text)) !== null) {

            // Push it to the array
            matches.push(match);

        }

        // Return the match array
        return matches;

    };

    /**
     * Filters the list of hints by the already written part
     *
     * @param   {Array} matches Array of matches
     * @returns {Array} the filtered Array
     */
    Hint.prototype.filterHints = function (matches) {

    var basic =
            ['after','ancestor','ancestor-or-self','and','as','ascending','assert','attribute','before',
        'by','case','cast','child','comment','declare','default','define','descendant','descendant-or-self',
        'descending','document','document-node','element','else','eq','every','except','external','following',
        'following-sibling','follows','for','function','if','import','in','instance','intersect','item',
        'let','module','namespace','node','node','of','only','or','order','parent','precedes','preceding',
        'preceding-sibling','processing-instruction','ref','return','returns','satisfies','schema','schema-element',
        'self','some','sortby','stable','text','then','to','treat','typeswitch','union','variable','version','where',
        'xquery', 'empty-sequence'];

    var types =
            ['xs:string', 'xs:float', 'xs:decimal', 'xs:double', 'xs:integer', 'xs:boolean', 'xs:date', 'xs:dateTime',
        'xs:time', 'xs:duration', 'xs:dayTimeDuration', 'xs:time', 'xs:yearMonthDuration', 'numeric', 'xs:hexBinary',
        'xs:base64Binary', 'xs:anyURI', 'xs:QName', 'xs:byte','xs:boolean','xs:anyURI','xf:yearMonthDuration'];

    var operators = ['eq', 'ne', 'lt', 'le', 'gt', 'ge', 'and', 'or', 'div', 'idiv', 'mod'];

    var axis_specifiers =
       ["self::", "attribute::", "child::", "descendant::", "descendant-or-self::", "parent::",
    "ancestor::", "ancestor-or-self::", "following::", "preceding::", "following-sibling::", "preceding-sibling::"];

        matches = matches.concat(basic, types, operators, axis_specifiers);

        // Split it up/convert to array for fuzzy search
        var written = this.writtenSinceStart.toLowerCase().split(" ");

        if (written === '') {
            return [];
        }

        // Filter the matches array
        matches = matches.filter(function (match) {
            // Get the hint
            var hint = match.toLowerCase();

                var index = hint.indexOf(written[0]);

                if (index === 0) {
                    return true;
                } else {
                    return false;
                }

        });

        // Return the filtered array
        return matches;

    };

    /**
     * Processes all the matches and prepares the hints and hintsHTML arrays
     *
     * @param   {Array}    matches All the matches (already filtered)
     */
    Hint.prototype.processHints = function (matches) {

        // Sort all filtered matches alphabetically
        matches = matches.sort(function (match1, match2) {

            var var1 = match1.toLowerCase();
            var var2 = match2.toLowerCase();

            if (var1 > var2) {
                return 1;
            } else if (var1 < var2) {
                return -1;
            } else {
                return 0;
            }

        });

        // Put every hint for insertion in the hints array
        this.hints = matches.map(function (match) {
            return match;
        });

        // Create the hintsHTML array which will be shown to the
        // user. It has a preview of what the variable is set to.
        this.hintsHTML = matches.map(function (match) {
            return match + "<span style='color:#a0a0a0; margin-left: 10px'>" + match + "</span>";
        });

    };

    /**
     * Register the HintProvider
     */
    AppInit.appReady(function () {
        var hints = new Hint();
        CodeHintManager.registerHintProvider(hints, ['xquery'], 0);
    });

});
