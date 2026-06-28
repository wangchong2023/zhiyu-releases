/**
 * @file Word Counter plugin for ZhiYu.
 * @author  ZhiYu Team
 * @version 1.0.0
 * @description
 *   Computes lightweight statistics for the current Markdown document on
 *   every render: total words (CJK ideographs + Latin words), characters
 *   (excluding whitespace), paragraphs and lines. Markdown markup is
 *   stripped before counting so the numbers reflect prose only.
 *
 *   Required permissions (see manifest.json):
 *     - log
 *
 * @license MIT
 */

var stats = {
    totalCounts: 0,
    history: []
};

/**
 * Count words, characters, paragraphs and lines in a Markdown document.
 *
 * @param {string} content Full document content.
 * @returns {{words:number,characters:number,paragraphs:number,lines:number}}
 *          Statistics object with zeroed fields when input is empty.
 */
function countWords(content) {
    if (!content || typeof content !== 'string') {
        return {
            words: 0,
            characters: 0,
            paragraphs: 0,
            lines: 0
        };
    }

    // Strip Markdown markup so we count prose only.
    var cleaned = content
        .replace(/```[\s\S]*?```/g, '')    // fenced code blocks
        .replace(/`[^`]+`/g, '')            // inline code
        .replace(/!\[.*?\]\(.*?\)/g, '')    // images
        .replace(/\[.*?\]\(.*?\)/g, '')     // links
        .replace(/[#*_~`]/g, '')            // markdown markers
        .trim();

    // Word count: treat every CJK ideograph as one word and every run of
    // Latin letters as one word, then sum the two.
    var chineseChars = cleaned.match(/[\u4e00-\u9fa5]/g) || [];
    var englishWords = cleaned.match(/[a-zA-Z]+/g) || [];
    var words = chineseChars.length + englishWords.length;

    // Character count excluding whitespace.
    var characters = cleaned.replace(/\s+/g, '').length;

    // Paragraph count: split on blank lines, ignore empty fragments.
    var paragraphs = content.split(/\n\n+/).filter(function(p) {
        return p.trim().length > 0;
    }).length;

    // Line count.
    var lines = content.split('\n').length;

    return {
        words: words,
        characters: characters,
        paragraphs: paragraphs,
        lines: lines
    };
}

/**
 * Plugin lifecycle hook invoked by ZhiYu when the plugin is loaded.
 * Registers ribbon items / commands and restores persisted statistics.
 */
function onLoad() {
    ZhiYu.log('[Word Counter] v1.0.0 loaded');

    ZhiYu.registerRibbonItem('textformat.123', 'Word Counter', 'showWordCount');
    ZhiYu.registerCommand('count-words', 'showWordCountCommand');

    var saved = ZhiYu.loadData('stats');
    if (saved) {
        try {
            stats = JSON.parse(saved);
        } catch (e) {
            ZhiYu.log('[Word Counter] Failed to restore stats, using defaults');
        }
    }
}

/**
 * Plugin lifecycle hook invoked by ZhiYu when the plugin is unloaded.
 * Persists counting statistics.
 */
function onUnload() {
    ZhiYu.saveData('stats', JSON.stringify(stats));
    ZhiYu.log('[Word Counter] unloaded');
}

/**
 * ZhiYu post-process hook. Re-counts the document and records the result
 * (keeping only the 10 most recent snapshots).
 *
 * @param {string} content Document content.
 * @returns {string} The original content, unchanged.
 */
function postProcess(content) {
    var result = countWords(content);
    stats.totalCounts++;
    stats.history.push({
        time: new Date().toISOString(),
        words: result.words,
        characters: result.characters
    });

    // Keep only the last 10 snapshots to bound memory usage.
    if (stats.history.length > 10) {
        stats.history = stats.history.slice(-10);
    }

    return content;
}

/**
 * Ribbon item handler: shows the most recent word-count snapshot.
 */
function showWordCount() {
    var msg = 'Word Counter\n\n';
    msg += 'Total runs: ' + stats.totalCounts + '\n';

    if (stats.history.length > 0) {
        var last = stats.history[stats.history.length - 1];
        msg += '\nMost recent run:\n';
        msg += 'Words: ' + last.words + '\n';
        msg += 'Characters: ' + last.characters + '\n';
        msg += 'Time: ' + last.time.substring(0, 19).replace('T', ' ');
    }

    ZhiYu.showMessage(msg);
}

/**
 * Command handler: alias for {@link showWordCount}.
 */
function showWordCountCommand() {
    showWordCount();
}
