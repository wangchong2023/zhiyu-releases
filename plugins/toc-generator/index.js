/**
 * @file Table of Contents Generator plugin for ZhiYu.
 * @author  ZhiYu Team
 * @version 1.0.0
 * @description
 *   Scans Markdown documents for headings (H1–H6) and inserts (or refreshes)
 *   a clickable Table of Contents at the top of the document. Existing
 *   `<!-- TOC -->...<!-- /TOC -->` blocks are updated in place when present.
 *
 *   Required permissions (see manifest.json):
 *     - writeContent
 *     - log
 *
 * @license MIT
 */

var stats = {
    totalGenerated: 0,
    lastGeneratedTime: null
};

/**
 * Generate or refresh the Table of Contents inside the given Markdown content.
 *
 * Behavior:
 *   - When no headings are found, the content is returned unchanged.
 *   - When an existing `<!-- TOC -->...<!-- /TOC -->` block is present, it is
 *     replaced with a freshly generated TOC.
 *   - Otherwise a new TOC block is inserted just before the first heading.
 *
 * @param {string} content Full document content.
 * @returns {string} Document with a TOC block inserted or updated.
 */
function generateTOC(content) {
    if (!content || typeof content !== 'string') return content;

    var lines = content.split('\n');
    var toc = [];
    var hasHeadings = false;

    // Walk every line and collect headings H1–H6.
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var match = line.match(/^(#{1,6})\s+(.+)$/);

        if (match) {
            hasHeadings = true;
            var level = match[1].length;
            var title = match[2];
            var indent = '  '.repeat(level - 1);
            var slug = title.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-');

            toc.push(indent + '- [' + title + '](#' + slug + ')');
        }
    }

    if (!hasHeadings) {
        ZhiYu.log('[TOC] No headings found, nothing to do');
        return content;
    }

    // Refresh in place if an existing TOC block is detected.
    if (content.indexOf('<!-- TOC -->') > -1) {
        var startIdx = content.indexOf('<!-- TOC -->');
        var endIdx = content.indexOf('<!-- /TOC -->', startIdx);

        if (endIdx > -1) {
            var before = content.substring(0, startIdx);
            var after = content.substring(endIdx + 13);
            var newTOC = '<!-- TOC -->\n\n' + toc.join('\n') + '\n\n<!-- /TOC -->';
            content = before + newTOC + after;
            ZhiYu.log('[TOC] Updated, ' + toc.length + ' heading(s)');
        }
    } else {
        // No existing block: insert a new TOC right before the first heading.
        var firstHeadingIdx = -1;
        for (var j = 0; j < lines.length; j++) {
            if (lines[j].match(/^#{1,6}\s+/)) {
                firstHeadingIdx = j;
                break;
            }
        }

        if (firstHeadingIdx > -1) {
            var newBlock = '<!-- TOC -->\n\n' + toc.join('\n') + '\n\n<!-- /TOC -->\n\n';
            lines.splice(firstHeadingIdx, 0, newBlock);
            content = lines.join('\n');
            ZhiYu.log('[TOC] Generated, ' + toc.length + ' heading(s)');
        }
    }

    stats.totalGenerated++;
    stats.lastGeneratedTime = new Date().toISOString();

    return content;
}

/**
 * Plugin lifecycle hook invoked by ZhiYu when the plugin is loaded.
 * Registers commands, ribbon items and restores persisted statistics.
 */
function onLoad() {
    ZhiYu.log('[TOC Generator] v1.0.0 loaded');

    ZhiYu.registerCommand('generate-toc', 'generateTOCCommand');
    ZhiYu.registerRibbonItem('list.bullet.indent', 'TOC Generator', 'showTOCStats');

    var saved = ZhiYu.loadData('stats');
    if (saved) {
        try {
            stats = JSON.parse(saved);
        } catch (e) {
            ZhiYu.log('[TOC Generator] Failed to restore stats, using defaults');
        }
    }
}

/**
 * Plugin lifecycle hook invoked by ZhiYu when the plugin is unloaded.
 * Persists generation statistics.
 */
function onUnload() {
    ZhiYu.saveData('stats', JSON.stringify(stats));
    ZhiYu.log('[TOC Generator] unloaded');
}

/**
 * ZhiYu pre-process hook. Generates or refreshes the TOC before the document
 * is saved.
 *
 * @param {string} content Document content.
 * @returns {string} Document with an up-to-date TOC block.
 */
function preProcess(content) {
    return generateTOC(content);
}

/**
 * ZhiYu post-process hook. No-op: TOC generation already ran in preProcess.
 *
 * @param {string} content Document content.
 * @returns {string} The document, unchanged.
 */
function postProcess(content) {
    return content;
}

/**
 * Command handler: manual trigger that logs a TOC generation message.
 */
function generateTOCCommand() {
    ZhiYu.log('[TOC] Manual trigger received');
}

/**
 * Ribbon item handler: shows TOC generation statistics in a modal message.
 */
function showTOCStats() {
    var msg = 'Table of Contents Generator\n\n';
    msg += 'Total generations: ' + stats.totalGenerated + '\n';
    msg += 'Last generation: ' + (stats.lastGeneratedTime || 'never');
    ZhiYu.showMessage(msg);
}
