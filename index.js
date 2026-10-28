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

// 1. Latest Movies Endpoint
app.get('/api/v1/chithrapata/latest', async (req, res) => {
    try {
        const pageNum = req.query.page || 1;
        const latestUrl = pageNum == 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${pageNum}/`;
        
        const response = await axios.get(latestUrl, { headers: HEADERS, timeout: 30000 });
        const $ = cheerio.load(response.data);
        const results = [];

        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const parent = $(el).closest('article, .item, .post, div');
            
            let title = $(el).find('h2, h3, .title').text().trim();
            if (!title) title = $(el).attr('title') || '';
            if (!title) title = $(el).text().trim();

            let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || parent.find('img').attr('src') || parent.find('img').attr('data-src') || '';
            if (img.startsWith('//')) img = 'https:' + img;

            let quality = parent.find('.quality, .badge').text().trim() || 'WEB-DL';
            let rating = parent.find('.rating, .imdb').text().trim() || 'N/A';

            if (href.includes('/movies/') && title.length > 2 && img) {
                title = title.replace(/\t|\n/g, '').trim();
                if (!results.some(r => r.link === href)) {
                    results.push({ title, image: img, quality, rating, link: href });
                }
            }
        });

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

        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const parent = $(el).closest('article, .item, .post, .result-item, div');
            
            let title = $(el).find('h2, h3, .title').text().trim();
            if (!title) title = $(el).attr('title') || '';
            if (!title) title = $(el).text().trim();

            let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || parent.find('img').attr('src') || parent.find('img').attr('data-src') || '';
            if (img.startsWith('//')) img = 'https:' + img;

            let quality = parent.find('.quality, .badge').text().trim() || 'WEB-DL';
            let rating = parent.find('.rating, .imdb').text().trim() || 'N/A';

            if (href.includes('/movies/') && title.length > 2 && img) {
                title = title.replace(/\t|\n/g, '').trim();
                if (!results.some(r => r.link === href)) {
                    results.push({ title, image: img, quality, rating, link: href });
                }
            }
        });

        res.json({ status: true, creator: "@Imalsha", site: "chithrapata", results_count: results.length, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// 3. Info & Download Endpoint (Clean Filtered Links)
app.get('/api/v1/chithrapata/infodl', async (req, res) => {
    res.setTimeout(60000, () => {
        if (!res.headersSent) {
            res.status(504).json({ status: false, error: "Gateway Timeout" });
        }
    });

    const movieUrl = req.query.url;
    if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

    console.log(`\n==============================================`);
    console.log(`🔥 [CHITHRAPATA API] Processing: ${movieUrl}`);

    try {
        const movieRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 45000 });
        const $ = cheerio.load(movieRes.data);

        const title = $('meta[property="og:title"]').attr('content') || $('h1').text().trim() || 'Unknown';
        const image = $('meta[property="og:image"]').attr('content') || '';
        const quality = $('.quality').first().text().trim() || 'WEB-DL';
        const rating = $('span.rating, .imdb-rate').first().text().trim() || 'N/A';
        const director = $('span.director').text().trim() || 'N/A';

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

        const cast = [];
        $('.cast-item, .person, .actor').each((i, el) => {
            const name = $(el).find('.name, h4').text().trim();
            const role = $(el).find('.role, .character').text().trim();
            const img = $(el).find('img').attr('src') || '';
            if (name) cast.push({ name, role: role || 'Actor', image: img });
        });

        const gallery = [];
        $('.gallery img, .screenshots img, .slider img').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src) gallery.push(src);
        });

        const downloads = [];
        
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            const parentBlock = $(el).closest('tr, div, section, li').text();

            if (href && (href.includes('/links/') || href.includes('pixeldrain.com') || href.includes('t.me/') || href.includes('streamx.link'))) {
                
                let qName = "HD";
                if (text.match(/480p/i) || parentBlock.match(/480p/i)) qName = "480p";
                else if (text.match(/720p/i) || parentBlock.match(/720p/i)) qName = "720p";
                else if (text.match(/1080p|FHD/i) || parentBlock.match(/1080p|FHD/i)) qName = "1080p";
                else if (text.match(/2160p|4k/i) || parentBlock.match(/2160p|4k/i)) qName = "2160p";

                let typeLabel = "Direct DL";
                if (href.includes('pixeldrain')) typeLabel = "PixelDrain";
                else if (href.includes('t.me/')) typeLabel = "Telegram Bot";
                else if (href.includes('streamx.link') || href.includes('/links/')) typeLabel = "High-Speed Server";

                let size = "N/A";
                const sizeMatch = parentBlock.match(/(\d+(\.\d+)?\s*(MB|GB))/i);
                if (sizeMatch) size = sizeMatch[0];

                if (!downloads.some(d => d.link === href)) {
                    downloads.push({
                        quality: `WEB-DL ${qName} [${typeLabel}]`,
                        size,
                        language: "English / Sinhala Sub",
                        link: href
                    });
                }
            }
        });

        console.log(`🎉 Successfully extracted ${downloads.length} clean download links!`);
        console.log(`==============================================\n`);

        if (!res.headersSent) {
            res.json({
                status: true,
                creator: "@Imalsha",
                site: "chithrapata",
                url: movieUrl,
                data: {
                    title,
                    image: image.trim(),
                    quality,
                    rating: rating || '8.0',
                    imdb: rating ? `${rating} (IMDb)` : 'N/A',
                    director,
                    language: "ENGLISH",
                    genres: genres.length > 0 ? genres : ["Action", "Adventure", "Sinhala Subtitles"],
                    story: story || 'No description available',
                    cast,
                    gallery,
                    trailer: "https://www.youtube.com/@chithrapata",
                    year: "2026",
                    duration: "145 min",
                    downloads: downloads.length > 0 ? downloads : [{ quality: "HD [Telegram]", size: "N/A", language: "English", link: "https://t.me/ChithrapataAdmin" }]
                }
            });
        }

    } catch (err) {
        console.error(`❌ [API ERROR]: ${err.message}`);
        if (!res.headersSent) {
            res.status(500).json({ status: false, error: err.message });
        }
    }
});

app.listen(PORT, () => console.log(`Chithrapata API running on port ${PORT}`));
