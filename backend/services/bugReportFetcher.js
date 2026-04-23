const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

/**
 * Fetch bug report content from URL and extract text
 * @param {string} url - URL to fetch bug report from
 * @returns {Promise<string>} - Extracted text content
 */
async function fetchBugReport(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        };

        const req = protocol.request(options, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchBugReport(res.headers.location).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }

            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    // Extract text from HTML using platform-specific selectors
                    const $ = cheerio.load(data);
                    let content = '';

                    // GitHub Issues - Extract clean bug report content
                    if (url.includes('github.com')) {
                        const title = $('.js-issue-title, .gh-header-title').first().text().trim();

                        // Get the first comment body (original issue description)
                        const description = $('.comment-body').first().text().trim();

                        if (title || description) {
                            content = `Title: ${title}\n\nDescription:\n${description}`;
                        }
                    }

                    // SourceForge Tickets - Extract bug report content
                    else if (url.includes('sourceforge.net')) {
                        const title = $('.artifact_title, h2.dark').first().text().trim();

                        // Try multiple selectors for description
                        const description = $('.markdown_content, .display_post, .ticket-description')
                            .first().text().trim();

                        if (title || description) {
                            content = `Title: ${title}\n\nDescription:\n${description}`;
                        }
                    }

                    // Fallback: Generic extraction if platform not recognized
                    if (!content) {
                        // Remove script, style, and navigation elements
                        $('script, style, nav, header, footer, .nav, .header, .footer, .sidebar, .menu').remove();

                        // Get main content area or body text
                        const mainContent = $('main, article, .content, .main, #content').first();
                        content = mainContent.length > 0
                            ? mainContent.text().trim()
                            : $('body').text().trim();
                    }

                    // Clean up whitespace
                    content = content
                        .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
                        .replace(/\n+/g, '\n')     // Replace multiple newlines with single newline
                        .replace(/\t+/g, ' ')      // Replace tabs with spaces
                        .trim();

                    resolve(content);
                } catch (error) {
                    reject(new Error(`Failed to parse HTML: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout - URL took too long to respond'));
        });

        req.end();
    });
}

/**
 * Fetch multiple bug reports with error tracking
 * @param {Array} items - Array of items with bug_url field
 * @returns {Promise<Object>} - Results with content and errors
 */
async function fetchBugReportsBatch(items) {
    const results = {
        fetched: [],
        errors: []
    };

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (!item.bug_url) {
            results.fetched.push({ index: i, content: null });
            continue;
        }

        try {
            const content = await fetchBugReport(item.bug_url);
            results.fetched.push({ index: i, content, url: item.bug_url });
        } catch (error) {
            results.errors.push({
                index: i,
                url: item.bug_url,
                defects4j_id: item.defects4j_id || `Item ${i + 1}`,
                error: error.message
            });
            results.fetched.push({ index: i, content: null });
        }

        // Small delay to avoid overwhelming servers
        if (i < items.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return results;
}

module.exports = {
    fetchBugReport,
    fetchBugReportsBatch
};
