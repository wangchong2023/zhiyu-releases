/**
 * @file Smart Cleaner plugin for ZhiYu.
 * @author  ZhiYu Team
 * @version 1.0.0
 * @description
 *   Cleans up Markdown content automatically before it is persisted:
 *     - Collapses 3+ consecutive blank lines down to a single blank line.
 *     - Trims trailing spaces / tabs on every line.
 *     - Strips leading and trailing blank lines from the document.
 *     - Normalizes all line endings to `\n`.
 *   Exposes a ribbon item that shows running statistics (total runs and the
 *   total number of redundant lines removed).
 *
 *   Required permissions (see manifest.json):
 *     - writeContent
 *     - log
 *
 * @license MIT
 */

// ── Persistent statistics ──────────────────────────────────────────────
var stats = {
    totalRuns: 0,
    totalLinesRemoved: 0,
    lastRunTime: null
};

/**
 * Clean a Markdown document by collapsing redundant blank lines, trimming
 * trailing whitespace, normalizing line endings and stripping outer blank
 * lines. Updates {@link stats} in place.
 *
 * @param {string} text Raw document content.
 * @returns {string} Cleaned document content (or the input unchanged when
 *                   it is not a string).
 */
function cleanContent(text) {
    if (!text || typeof text !== 'string') return text;

    var originalLines = text.split('\n').length;

    // 1. Normalize line endings to '\n'.
    var cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2. Strip trailing spaces and tabs from each line.
    cleaned = cleaned.replace(/[ \t]+$/gm, '');

    // 3. Collapse 3+ consecutive blank lines into a single blank line.
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // 4. Strip leading / trailing blank lines.
    cleaned = cleaned.replace(/^\n+/, '').replace(/\n+$/, '');

    // Ensure the document always ends with a single newline.
    if (cleaned.length > 0 && !cleaned.endsWith('\n')) {
        cleaned += '\n';
    }

    var newLines = cleaned.split('\n').length;
    var removed = originalLines - newLines;

    // Update running statistics.
    stats.totalRuns++;
    if (removed > 0) {
        stats.totalLinesRemoved += removed;
    }
    stats.lastRunTime = new Date().toISOString();

    ZhiYu.log('[SmartCleaner] Cleaned: removed ' + removed + ' line(s), total runs ' + stats.totalRuns);

    return cleaned;
}

// ── Ribbon callback ────────────────────────────────────────────────────

/**
 * Ribbon item handler: shows running statistics in the application log.
 */
function showStats() {
    var msg = 'Smart Cleaner Statistics\n' +
              'Total runs: ' + stats.totalRuns + '\n' +
              'Total lines removed: ' + stats.totalLinesRemoved + '\n' +
              'Last run: ' + (stats.lastRunTime || 'N/A');
    ZhiYu.log(msg);
}

// ── Lifecycle hooks ────────────────────────────────────────────────────

/**
 * Plugin lifecycle hook invoked by ZhiYu when the plugin is loaded.
 * Registers the ribbon item and restores persisted statistics.
 */
function onLoad() {
    ZhiYu.log('[SmartCleaner] v1.0.0 loaded');

    // Expose a ribbon button to inspect the running statistics.
    ZhiYu.registerRibbonItem('sparkles', 'Smart Cleaner', 'showStats');

    // Restore persisted statistics if any.
    var saved = ZhiYu.loadData('stats');
    if (saved) {
        try {
            stats = JSON.parse(saved);
            ZhiYu.log('[SmartCleaner] Statistics restored');
        } catch (e) {
            ZhiYu.log('[SmartCleaner] Statistics restore failed, using defaults');
        }
    }
}

/**
 * Plugin lifecycle hook invoked by ZhiYu when the plugin is unloaded.
 * Persists the running statistics to disk.
 */
function onUnload() {
    ZhiYu.saveData('stats', JSON.stringify(stats));
    ZhiYu.log('[SmartCleaner] unloaded, statistics persisted');
}

// ── Content interception hooks ─────────────────────────────────────────

/**
 * ZhiYu pre-process hook. Cleans the content before it is saved.
 *
 * @param {string} content Document content.
 * @returns {string} Cleaned document content.
 */
function preProcess(content) {
    return cleanContent(content);
}

/**
 * ZhiYu post-process hook. No-op: cleaning already ran in preProcess.
 *
 * @param {string} content Document content.
 * @returns {string} The document, unchanged.
 */
function postProcess(content) {
    return content;
}
