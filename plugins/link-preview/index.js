/**
 * @file Link Preview plugin for ZhiYu.
 * @author  ZhiYu Team
 * @version 1.0.0
 * @description
 *   Scans Markdown documents for plain HTTP(S) URLs and appends a visual
 *   preview card (title, description and cover image) for the first link
 *   encountered. Metadata is extracted from OpenGraph / standard `<meta>`
 *   tags of the remote page. Results are cached to avoid repeated fetches.
 *
 *   Required permissions (see manifest.json):
 *     - writeContent
 *     - log
 *     - network
 *
 * @license MIT
 */

var cache = {};

/**
 * Fetch a link preview for the given URL, using the in-memory cache when
 * available.
 *
 * @param {string} url Absolute HTTP(S) URL to preview.
 * @returns {?{url:string,title:string,description:string,image:string}}
 *          Preview object, or `null` when the page could not be fetched.
 */
function fetchLinkPreview(url) {
    // Cache hit short-circuit.
    if (cache[url]) {
        ZhiYu.log('[Link Preview] Cache hit: ' + url);
        return cache[url];
    }

    ZhiYu.log('[Link Preview] Fetching: ' + url);

    // Use ZhiYu.fetch to retrieve the raw HTML of the page.
    var html = ZhiYu.fetch(url);
    if (!html) {
        return null;
    }

    // Parse meta tags: prefer OpenGraph, fall back to standard meta / title.
    var title = extractMeta(html, 'og:title') || extractMeta(html, 'title') || url;
    var description = extractMeta(html, 'og:description') || extractMeta(html, 'description') || '';
    var image = extractMeta(html, 'og:image') || '';

    var preview = {
        url: url,
        title: title,
        description: description,
        image: image
    };

    // Cache the result for subsequent renders.
    cache[url] = preview;

    return preview;
}

/**
 * Extract the content of a `<meta>` tag by its `property` or `name` attribute.
 * Tries three patterns to support different attribute orderings.
 *
 * @param {string} html     Raw HTML document.
 * @param {string} property Meta property/name to look up (e.g. "og:title").
 * @returns {?string} The meta content if found, otherwise `null`.
 */
function extractMeta(html, property) {
    var patterns = [
        new RegExp('<meta[^>]+property=["\']' + property + '["\'][^>]+content=["\']([^"\']+)["\']', 'i'),
        new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']' + property + '["\']', 'i'),
        new RegExp('<meta[^>]+name=["\']' + property + '["\'][^>]+content=["\']([^"\']+)["\']', 'i')
    ];

    for (var i = 0; i < patterns.length; i++) {
        var match = html.match(patterns[i]);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Build a Markdown preview card for the supplied preview object.
 *
 * @param {{url:string,title:string,description:string,image:string}} preview
 *        Preview payload returned by {@link fetchLinkPreview}.
 * @returns {string} Markdown snippet representing the card.
 */
function generatePreviewCard(preview) {
    if (!preview) return '';

    var card = '\n\n---\n\n';
    card += 'Link Preview\n\n';
    card += '**' + preview.title + '**\n\n';

    if (preview.description) {
        card += preview.description.substring(0, 150);
        if (preview.description.length > 150) card += '...';
        card += '\n\n';
    }

    if (preview.image) {
        card += '![' + preview.title + '](' + preview.image + ')\n\n';
    }

    card += '[Open link](' + preview.url + ')\n\n';
    card += '---\n\n';

    return card;
}

/**
 * Plugin lifecycle hook invoked by ZhiYu when the plugin is loaded.
 * Registers commands, ribbon items and restores the persisted cache.
 */
function onLoad() {
    ZhiYu.log('[Link Preview] v1.0.0 loaded');

    ZhiYu.registerCommand('preview-link', 'previewLinkCommand');
    ZhiYu.registerRibbonItem('link', 'Link Preview', 'previewCurrentLink');

    var saved = ZhiYu.loadData('cache');
    if (saved) {
        try {
            cache = JSON.parse(saved);
            ZhiYu.log('[Link Preview] Cache restored: ' + Object.keys(cache).length + ' entries');
        } catch (e) {
            ZhiYu.log('[Link Preview] Cache restore failed, starting empty');
        }
    }
}

/**
 * Plugin lifecycle hook invoked by ZhiYu when the plugin is unloaded.
 * Persists the preview cache to disk.
 */
function onUnload() {
    ZhiYu.saveData('cache', JSON.stringify(cache));
    ZhiYu.log('[Link Preview] unloaded, cache persisted');
}

/**
 * ZhiYu post-process hook. Detects the first HTTP(S) URL in the document and
 * appends a preview card for it (unless one was already inserted previously).
 *
 * @param {string} content Document content.
 * @returns {string} Document with a preview card appended when applicable.
 */
function postProcess(content) {
    // Match the first plain URL (avoid matching inside angle brackets / code).
    var urlPattern = /\bhttps?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    var urls = content.match(urlPattern);

    if (!urls || urls.length === 0) return content;

    // Only the first URL is previewed, mirroring the original behavior.
    var firstUrl = urls[0];
    if (!content.includes('<!-- link-preview:' + firstUrl + ' -->')) {
        var preview = fetchLinkPreview(firstUrl);
        if (preview) {
            var card = '<!-- link-preview:' + firstUrl + ' -->' + generatePreviewCard(preview);
            content += '\n' + card;
            ZhiYu.log('[Link Preview] Preview card appended');
        }
    }

    return content;
}

/**
 * Command handler: shows a hint about how the link preview works.
 */
function previewLinkCommand() {
    ZhiYu.showMessage('Add an HTTP(S) URL to the document and save; a preview card will be appended automatically.');
}

/**
 * Ribbon item handler: shows the current cache size in a modal message.
 */
function previewCurrentLink() {
    var cacheSize = Object.keys(cache).length;
    ZhiYu.showMessage('Link Preview Cache\n\nCached links: ' + cacheSize);
}
