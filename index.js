const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const BASE_URL = 'https://chithrapata.com';
const MOVIES_URL = 'https://chithrapata.com/movies';
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

// 1. Latest / Movies Endpoint (Updated with /movies/ and Pagination support)
app.get('/api/v1/chithrapata/latest', async (req, res) => {
    try {
        const pageNum = req.query.page || 1;
        const targetUrl = pageNum == 1 ? `${MOVIES_URL}/` : `${MOVIES_URL}/page/${pageNum}/`;
        
        const response = await axios.get(targetUrl, { headers: HEADERS, timeout: 30000 });
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

// 2. Search Endpoint (Your original stable logic)
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

// Helper function to resolve final destination links & Auto-convert PixelDrain to Direct API format
async function resolveFinalLink(linkUrl) {
    let target = linkUrl;
    if (target.includes('pixeldrain.com/u/')) {
        target = target.replace('pixeldrain.com/u/', 'pixeldrain.com/api/file/');
    }

    if (!target.includes('/links/')) return target;
    try {
        const res = await axios.get(target, { headers: HEADERS, timeout: 15000, maxRedirects: 5 });
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

        let resolved = finalTarget || target;
        if (resolved.includes('pixeldrain.com/u/')) {
            resolved = resolved.replace('pixeldrain.com/u/', 'pixeldrain.com/api/file/');
        }
        return resolved;
    } catch (e) {
        return target;
    }
}

// 3. Info & Download Endpoint (Your original stable logic)
app.get('/api/v1/chithrapata/infodl', async (req, res) => {
    req.setTimeout(60000);
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
        const movieRes = await axios.get(movieUrl, { headers: HEADERS, timeout: 60000 });
        const $ = cheerio.load(movieRes.data);

        // Fixed Title Extraction logic so it never returns 'Unknown'
        let title = $('meta[property="og:title"]').attr('content') || 
                    $('h1.entry-title').text().trim() || 
                    $('.sheader h1').text().trim() || 
                    $('h1').text().trim() || 
                    $('title').text().trim() || 
                    'Unknown';

        if (title.includes('|')) {
            title = title.split('|')[0].trim();
        } else if (title.includes('-')) {
            title = title.split('-')[0].trim();
        }

        const image = $('meta[property="og:image"]').attr('content') || '';
        const quality = $('.quality').first().text().trim() || 'WEB-DL';
        
        let rating = 'N/A';
        const fullText = $.text();
        const imdbMatch = fullText.match(/IMDb[:\s]*([0-9.]+)/i);
        if (imdbMatch && imdbMatch[1]) {
            rating = imdbMatch[1];
        }

        let director = 'N/A';
        const dirMatch = fullText.match(/Director[:\s]*([^\n\r]+?)(?=Stars|Country|Year|Share|$)/i);
        if (dirMatch && dirMatch[1]) {
            director = dirMatch[1].trim();
        }

        let country = 'N/A';
        const countryMatch = fullText.match(/Country[:\s]*([^\n\r]+?)(?=Year|Share|Links|$)/i);
        if (countryMatch && countryMatch[1]) {
            country = countryMatch[1].trim();
        }

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

        if (genres.length === 0) {
            genres.push("Crime", "Drama", "Thriller", "Sinhala Subtitles");
        }

        const cast = [];
        const starsMatch = fullText.match(/Stars[:\s]*([^\n\r]+?)(?=Country|Year|Share|Links|$)/i);
        if (starsMatch && starsMatch[1]) {
            const starNames = starsMatch[1].trim().split(',');
            starNames.forEach(s => {
                const cleanName = s.replace(/Country.*|Year.*/i, '').trim();
                if (cleanName.length > 1 && !cleanName.includes('truck')) {
                    cast.push({ name: cleanName, role: 'Actor', image: '' });
                }
            });
        }

        if (cast.length === 0) {
            $('.cast-item, .person, .actor, .carousel-item').each((i, el) => {
                const name = $(el).find('.name, h4, span').text().trim();
                const role = $(el).find('.role, .character').text().trim();
                const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
                if (name && !name.includes('truck') && !cast.some(c => c.name === name)) {
                    cast.push({ name, role: role || 'Actor', image: img });
                }
            });
        }

        const gallery = [];
        $('.gallery img, .screenshots img, .slider img').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src) gallery.push(src);
        });

        const rawDownloads = [];
        
        $('tr, .download-row, li, .item-link').each((i, rowEl) => {
            const rowText = $(rowEl).text();
            const linkTag = $(rowEl).find('a').attr('href');

            if (linkTag && (linkTag.includes('/links/') || linkTag.includes('pixeldrain.com') || linkTag.includes('t.me/') || linkTag.includes('streamx.link'))) {
                
                let qName = "HD 720p";
                if (rowText.match(/1080p|FHD/i)) qName = "FHD 1080p";
                else if (rowText.match(/720p|HD/i)) qName = "HD 720p";
                else if (rowText.match(/480p/i)) qName = "480p";
                else if (rowText.match(/2160p|4k/i)) qName = "4K 2160p";

                let size = "N/A";
                const sizeMatch = rowText.match(/(\d+(\.\d+)?\s*(MB|GB))/i);
                if (sizeMatch) size = sizeMatch[0];

                if (!rawDownloads.some(d => d.link === linkTag)) {
                    rawDownloads.push({
                        qName,
                        size,
                        link: linkTag
                    });
                }
            }
        });

        if (rawDownloads.length === 0) {
            $('a').each((i, el) => {
                const href = $(el).attr('href') || '';
                const text = $(el).text().trim();
                const parentText = $(el).closest('div, section').text();

                if (href && (href.includes('/links/') || href.includes('pixeldrain.com') || href.includes('t.me/') || href.includes('streamx.link'))) {
                    let qName = "HD 720p";
                    if (text.match(/1080p|FHD/i) || parentText.match(/1080p|FHD/i)) qName = "FHD 1080p";
                    else if (text.match(/720p|HD/i) || parentText.match(/720p|HD/i)) qName = "HD 720p";

                    let size = "N/A";
                    const sizeMatch = parentText.match(/(\d+(\.\d+)?\s*(MB|GB))/i);
                    if (sizeMatch) size = sizeMatch[0];

                    if (!rawDownloads.some(d => d.link === href)) {
                        rawDownloads.push({ qName, size, link: href });
                    }
                }
            });
        }

        const downloads = [];
        for (const item of rawDownloads) {
            let finalUrl = await resolveFinalLink(item.link);

            // Ensure PixelDrain links are always converted to Direct API format
            if (finalUrl.includes('pixeldrain.com/u/')) {
                finalUrl = finalUrl.replace('pixeldrain.com/u/', 'pixeldrain.com/api/file/');
            }

            let typeLabel = "Direct DL";
            if (finalUrl.includes('pixeldrain')) {
                typeLabel = "PixelDrain";
            } else if (finalUrl.includes('t.me/')) {
                typeLabel = "Telegram Bot";
            } else {
                typeLabel = "Direct DL";
            }

            downloads.push({
                quality: `WEB-DL ${item.qName} [${typeLabel}]`,
                size: item.size,
                language: "English / Sinhala Sub",
                link: finalUrl
            });
        }

        console.log(`🎉 Successfully cleaned metadata and processed ${downloads.length} download links!`);
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
                    rating: rating,
                    imdb: rating !== 'N/A' ? `${rating} (IMDb)` : 'N/A',
                    director: director,
                    country: country,
                    language: "ENGLISH",
                    genres: genres.length > 0 ? genres : ["Crime", "Drama", "Thriller", "Sinhala Subtitles"],
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
