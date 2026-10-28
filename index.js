const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const BASE_URL = 'https://chithrapata.com';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://chithrapata.com/'
};

// Root Route
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CHITHRAPATA FAST API is Live 🚀",
        endpoints: {
            latest: "/api/v1/chithrapata/latest?page=1",
            search: "/api/v1/chithrapata/search?q=movie_name",
            infodl: "/api/v1/chithrapata/infodl?url=movie_url"
        }
    });
});

// 1. Latest / Recently Added Movies Endpoint (Updated for exact site structure)
app.get('/api/v1/chithrapata/latest', async (req, res) => {
    try {
        const pageNum = req.query.page || 1;
        const latestUrl = pageNum == 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${pageNum}/`;
        
        const response = await axios.get(latestUrl, { headers: HEADERS, timeout: 30000 });
        const $ = cheerio.load(response.data);
        const results = [];

        // Target movie articles / items specifically to avoid footer/menu noise
        $('article, .item, .post, .result-item, .box').each((i, el) => {
            const aTag = $(el).find('a').first();
            const href = aTag.attr('href') || $(el).find('a').attr('href') || '';
            
            let title = $(el).find('h2, h3, .title, .entry-title').text().trim();
            if (!title) title = aTag.attr('title') || '';
            if (!title) title = $(el).text().trim();

            let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || $(el).find('img').attr('srcset') || '';
            if (img.startsWith('//')) img = 'https:' + img;
            if (img.includes('srcset') || !img) {
                img = $(el).find('img').attr('data-lazy-src') || $(el).find('img').attr('src') || '';
            }

            let quality = $(el).find('.quality, .badge, .mtype').text().trim() || 'WEB-DL';
            let rating = $(el).find('.rating, .imdb, .score').text().trim() || 'N/A';

            if (href && (href.includes('/movies/') || href.includes('/chithrapata.com/')) && title && img) {
                title = title.replace(/\t|\n/g, ' ').trim();
                if (!results.some(r => r.link === href)) {
                    results.push({ title, image: img, quality, rating, link: href });
                }
            }
        });

        // Fallback if structured articles don't catch enough
        if (results.length === 0) {
            $('a').each((i, el) => {
                const href = $(el).attr('href') || '';
                const parent = $(el).closest('div');
                let title = $(el).find('h2, h3, .title').text().trim() || $(el).attr('title') || $(el).text().trim();
                let img = parent.find('img').attr('src') || parent.find('img').attr('data-src') || '';
                if (img.startsWith('//')) img = 'https:' + img;
                let quality = parent.find('.quality, .badge').text().trim() || 'WEB-DL';
                let rating = parent.find('.rating').text().trim() || 'N/A';

                if (href.includes('/movies/') && title.length > 2 && img) {
                    if (!results.some(r => r.link === href)) {
                        results.push({ title, image: img, quality, rating, link: href });
                    }
                }
            });
        }

        res.json({ status: true, creator: "@Imalsha", site: "chithrapata", page: Number(pageNum), results_count: results.length, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// 2. Search Endpoint
app.get('/api/v1/chithrapata/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ status: false, message: "Search term required" });

        const searchUrl = `${BASE_URL}/?s=` + encodeURIComponent(query);
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 30000 });
        const $ = cheerio.load(response.data);
        const results = [];

        $('article, .item, .post, .result-item').each((i, el) => {
            const aTag = $(el).find('a').first();
            const href = aTag.attr('href') || '';
            let title = $(el).find('h2, h3, .title').text().trim() || aTag.attr('title') || '';
            let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
            if (img.startsWith('//')) img = 'https:' + img;
            let quality = $(el).find('.quality, .badge').text().trim() || 'WEB-DL';
            let rating = $(el).find('.rating').text().trim() || 'N/A';

            if (href && title && img) {
                if (!results.some(r => r.link === href)) {
                    results.push({ title: title.replace(/\t|\n/g, ' ').trim(), image: img, quality, rating, link: href });
                }
            }
        });

        res.json({ status: true, creator: "@Imalsha", site: "chithrapata", results_count: results.length, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// Helper function to resolve final destination links
async function resolveFinalLink(linkUrl) {
    if (!linkUrl.includes('/links/')) return linkUrl;
    try {
        const res = await axios.get(linkUrl, { headers: HEADERS, timeout: 15000, maxRedirects: 5 });
        const $ = cheerio.load(res.data);
        
        let finalTarget = '';
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const txt = $(el).text().trim().toLowerCase();
            if (href && (txt.includes('continue') || href.includes('pixeldrain.com') || href.includes('t.me/') || href.includes('dl.') || href.includes('streamx.link'))) {
                if (!href.includes('/links/')) {
                    finalTarget = href;
                }
            }
        });

        return finalTarget || linkUrl;
    } catch (e) {
        return linkUrl;
    }
}

// 3. Info & Download Endpoint
app.get('/api/v1/chithrapata/infodl', async (req, res) => {
    req.setTimeout(60000);
    res.setTimeout(60000, () => {
        if (!res.headersSent) {
            res.status(504).json({ status: false, error: "Gateway Timeout" });
        }
    });

    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    try {
        const movieRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 60000 });
        const $ = cheerio.load(movieRes.data);

        const title = $('meta[property="og:title"]').attr('content') || $('h1').text().trim() || 'Unknown';
        const image = $('meta[property="og:image"]').attr('content'] || '';
        const quality = $('.quality').first().text().trim() || 'WEB-DL';
        
        let rating = 'N/A';
        const fullText = $.text();
        const imdbMatch = fullText.match(/IMDb[:\s]*([0-9.]+)/i);
        if (imdbMatch && imdbMatch[1]) rating = imdbMatch[1];

        let director = 'N/A';
        const dirMatch = fullText.match(/Director[:\s]*([^\n\r]+?)(?=Stars|Country|Year|Share|$)/i);
        if (dirMatch && dirMatch[1]) director = dirMatch[1].trim();

        let country = 'N/A';
        const countryMatch = fullText.match(/Country[:\s]*([^\n\r]+?)(?=Year|Share|Links|$)/i);
        if (countryMatch && countryMatch[1]) country = countryMatch[1].trim();

        let story = '';
        $('p').each((i, el) => {
            const txt = $(el).text().trim();
            if (txt.length > 50 && !txt.includes('උපසිරැසි') && !story) {
                story = txt;
            }
        });

        const genres = [];
        $('.genres a, .sgeneros a, .cat-links a').each((i, el) => {
            genres.push($(el).text().trim());
        });
        if (genres.length === 0) genres.push("Crime", "Drama", "Thriller", "Sinhala Subtitles");

        const cast = [];
        const starsMatch = fullText.match(/Stars[:\s]*([^\n\r]+?)(?=Country|Year|Share|Links|$)/i);
        if (starsMatch && starsMatch[1]) {
            const starNames = starsMatch[1].trim().split(',');
            starNames.forEach(s => {
                const cleanName = s.replace(/Country.*|Year.*/i, '').trim();
                if (cleanName.length > 1) cast.push({ name: cleanName, role: 'Actor', image: '' });
            });
        }

        const rawDownloads = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            const parentText = $(el).closest('div, section, tr').text();

            if (href && (href.includes('/links/') || href.includes('pixeldrain.com') || href.includes('t.me/') || href.includes('streamx.link'))) {
                let qName = "HD 720p";
                if (text.match(/1080p|FHD/i) || parentText.match(/1080p|FHD/i)) qName = "FHD 1080p";
                else if (text.match(/720p|HD/i) || parentText.match(/720p|HD/i)) qName = "HD 720p";
                else if (text.match(/480p/i)) qName = "480p";

                let size = "N/A";
                const sizeMatch = parentText.match(/(\d+(\.\d+)?\s*(MB|GB))/i);
                if (sizeMatch) size = sizeMatch[0];

                if (!rawDownloads.some(d => d.link === href)) {
                    rawDownloads.push({ qName, size, link: href });
                }
            }
        });

        const downloads = [];
        for (const item of rawDownloads) {
            const finalUrl = await resolveFinalLink(item.link);
            let typeLabel = "Direct DL";
            if (finalUrl.includes('pixeldrain')) typeLabel = "PixelDrain";
            else if (finalUrl.includes('t.me/')) typeLabel = "Telegram Bot";

            downloads.push({
                quality: `WEB-DL ${item.qName} [${typeLabel}]`,
                size: item.size,
                language: "English / Sinhala Sub",
                link: finalUrl
            });
        }

        res.json({
            status: true,
            creator: "@Imalsha",
            site: "chithrapata",
            url: movieUrl,
            data: {
                title,
                image: image.trim(),
                quality,
                rating,
                imdb: rating !== 'N/A' ? `${rating} (IMDb)` : 'N/A',
                director,
                country,
                language: "ENGLISH",
                genres,
                story: story || 'No description available',
                cast,
                gallery: [],
                trailer: "https://www.youtube.com/@chithrapata",
                year: "2026",
                duration: "145 min",
                downloads: downloads.length > 0 ? downloads : [{ quality: "HD [Telegram]", size: "N/A", language: "English", link: "https://t.me/ChithrapataAdmin" }]
            }
        });

    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Chithrapata API running on port ${PORT}`));
