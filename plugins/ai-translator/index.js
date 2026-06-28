/**
 * @file AI Translator plugin for ZhiYu.
 * @author  ZhiYu Team
 * @version 1.0.0
 * @description
 *   Provides inline AI-powered translation of selected text or marked blocks
 *   in a Markdown document. Recognizes HTML comment markers such as
 *   `<!-- translate:en -->...<!-- /translate -->` in `postProcess`, forwards
 *   the inner content to the configured LLM, and rewrites the block with
 *   the translated result appended.
 *
 *   Required permissions (see manifest.json):
 *     - writeContent
 *     - log
 *     - ai
 *
 * @license MIT
 */

var stats = {
    totalTranslations: 0,
    languages: {}
};

/**
 * Translate a single text string to the target language using the AI service.
 *
 * @param {string} text       Source text to translate.
 * @param {string} targetLang ISO-style language code (e.g. "en", "zh").
 * @returns {string} The translated text, or the original text on failure.
 */
function translateText(text, targetLang) {
    if (!text || !targetLang) return text;

    ZhiYu.log('[AI Translator] Translating to ' + targetLang + ': ' + text.substring(0, 30) + '...');

    // Build a deterministic prompt that asks the model to return only the translation.
    var prompt = 'Translate the following text to ' + targetLang + '. Only return the translation, no explanations:\n\n' + text;

    // Call the AI service exposed by ZhiYu.
    var result = ZhiYu.requestAI(prompt);

    if (result) {
        stats.totalTranslations++;
        stats.languages[targetLang] = (stats.languages[targetLang] || 0) + 1;

        ZhiYu.log('[AI Translator] Translation finished');
        return result;
    }

    ZhiYu.log('[AI Translator] Translation failed');
    return text;
}

/**
 * Detect the dominant language of a piece of text.
 *
 * Uses a simple heuristic: if more than ~30% of the characters are CJK
 * ideographs the text is treated as Chinese, otherwise English.
 *
 * @param {string} text Input text.
 * @returns {("zh"|"en")} Best-guess language code.
 */
function detectLanguage(text) {
    var chineseChars = text.match(/[\u4e00-\u9fa5]/g);
    if (chineseChars && chineseChars.length > text.length * 0.3) {
        return 'zh';
    }
    return 'en';
}

/**
 * Scan the document for `<!-- translate:LANG -->...<!-- /translate -->` blocks
 * and append the translation of each block right below its source content.
 *
 * @param {string} content Full Markdown document.
 * @returns {string} Document with translations appended to each block.
 */
function autoTranslate(content) {
    // Pattern captures the target language and the inner text of each block.
    var pattern = /<!-- translate:(\w+) -->\n([\s\S]+?)\n<!-- \/translate -->/g;
    var match;
    var modified = content;

    while ((match = pattern.exec(content)) !== null) {
        var targetLang = match[1];
        var textToTranslate = match[2];

        var translated = translateText(textToTranslate, targetLang);

        if (translated !== textToTranslate) {
            var replacement = '<!-- translate:' + targetLang + ' -->\n' +
                              textToTranslate + '\n\n' +
                              '**Translation (' + targetLang + '):**\n\n' +
                              translated + '\n' +
                              '<!-- /translate -->';

            modified = modified.replace(match[0], replacement);
        }
    }

    return modified;
}

/**
 * Plugin lifecycle hook invoked by ZhiYu when the plugin is loaded.
 * Registers commands, ribbon items and restores persisted statistics.
 */
function onLoad() {
    ZhiYu.log('[AI Translator] v1.0.0 loaded');

    ZhiYu.registerCommand('translate-to-en', 'translateToEnglish');
    ZhiYu.registerCommand('translate-to-zh', 'translateToChinese');
    ZhiYu.registerRibbonItem('globe', 'AI Translator', 'showTranslationStats');

    var saved = ZhiYu.loadData('stats');
    if (saved) {
        try {
            stats = JSON.parse(saved);
        } catch (e) {
            ZhiYu.log('[AI Translator] Failed to restore stats, using defaults');
        }
    }
}

/**
 * Plugin lifecycle hook invoked by ZhiYu when the plugin is unloaded.
 * Persists translation statistics.
 */
function onUnload() {
    ZhiYu.saveData('stats', JSON.stringify(stats));
    ZhiYu.log('[AI Translator] unloaded');
}

/**
 * ZhiYu post-process hook. Translates any `<!-- translate:LANG -->...`
 * blocks found in the document.
 *
 * @param {string} content Document content.
 * @returns {string} Document with translations appended.
 */
function postProcess(content) {
    return autoTranslate(content);
}

/**
 * Command handler: shows usage instructions for translating to English.
 */
function translateToEnglish() {
    ZhiYu.showMessage('Usage:\n\n<!-- translate:en -->\nYour text\n<!-- /translate -->');
}

/**
 * Command handler: shows usage instructions for translating to Chinese.
 */
function translateToChinese() {
    ZhiYu.showMessage('Usage:\n\n<!-- translate:zh -->\nYour text\n<!-- /translate -->');
}

/**
 * Ribbon item handler: shows translation statistics in a modal message.
 */
function showTranslationStats() {
    var msg = 'AI Translator Statistics\n\n';
    msg += 'Total translations: ' + stats.totalTranslations + '\n\n';
    msg += 'Language distribution:\n';

    for (var lang in stats.languages) {
        msg += '  ' + lang + ': ' + stats.languages[lang] + '\n';
    }

    ZhiYu.showMessage(msg);
}
