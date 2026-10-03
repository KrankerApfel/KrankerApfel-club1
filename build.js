const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { marked } = require('marked');
const matter = require('gray-matter');
const chokidar = require('chokidar');

const SRC_DIR = path.join(__dirname, 'src');
const BUILD_DIR = path.join(__dirname, 'build');
const COMPONENTS_DIR = path.join(SRC_DIR, 'components');
const TEMPLATE_PATH = path.join(SRC_DIR, 'template.html');
const PHONEME_AUDIO_FILES = {
    'p': 'Voiceless bilabial plosive.ogg',
    'b': 'Voiced bilabial plosive.ogg',
    't': 'Voiceless alveolar plosive.ogg',
    'd': 'Voiced alveolar plosive.ogg',
    'k': 'Voiceless velar plosive.ogg',
    'g': 'Voiced velar plosive.ogg',
    'ʡᵸ': 'Epiglottal stop.ogg',
    'f': 'Voiceless labiodental fricative.ogg',
    'v': 'Voiced labiodental fricative.ogg',
    's': 'Voiceless alveolar sibilant.ogg',
    'z': 'Voiced alveolar sibilant.ogg',
    'ʁ': 'Voiced uvular fricative.ogg',
    'h': 'Voiceless glottal fricative.ogg',
    't͡s': 'Voiceless alveolar sibilant affricate.oga',
    'd͡ʒ': 'Voiced palato-alveolar affricate.ogg',
    'ʈ͡ʂ': 'Voiceless retroflex affricate.ogg',
    'ɖ͡ʐ': 'Voiced retroflex affricate.ogg',
    'l': 'Alveolar lateral approximant.ogg',
    'j': 'Palatal approximant.ogg',
    'w': 'Voiced labio-velar approximant.ogg',
    'ɾ': 'Alveolar tap.ogg',
    'm': 'Bilabial nasal.ogg',
    'n': 'Alveolar nasal.ogg',
    'i': 'Close front unrounded vowel.ogg',
    'i:': 'Close front unrounded vowel.ogg',
    'y': 'Close front rounded vowel.ogg',
    'y:': 'Close front rounded vowel.ogg',
    'u': 'Close back rounded vowel.ogg',
    'e': 'Close-mid front unrounded vowel.ogg',
    'o': 'Close-mid back rounded vowel.ogg',
    'œ': 'Open-mid front rounded vowel.ogg',
    'œ:': 'Open-mid front rounded vowel.ogg',
    'æ': 'Near-open front unrounded vowel.ogg',
    'a': 'Open front unrounded vowel.ogg',
    'a:': 'Open front unrounded vowel.ogg',
    'ã': 'Open back unrounded nasal vowel.ogg',
};
const STYLE_VERSION = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(SRC_DIR, 'css', 'style.css')))
    .digest('hex')
    .slice(0, 8);
const SCRIPT_VERSION = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(SRC_DIR, 'js', 'sidebar.js')))
    .digest('hex')
    .slice(0, 8);

async function cleanBuild() {
    console.log('Cleaning build directory...');
    if (await fs.pathExists(BUILD_DIR)) {
        await fs.remove(BUILD_DIR);
    }
    await fs.ensureDir(BUILD_DIR);
}

async function copyAssets() {
    console.log('Copying assets...');
    const cssSrc = path.join(SRC_DIR, 'css');
    const jsSrc = path.join(SRC_DIR, 'js');

    if (await fs.pathExists(cssSrc)) {
        await fs.copy(cssSrc, path.join(BUILD_DIR, 'css'));
    }
    if (await fs.pathExists(jsSrc)) {
        await fs.copy(jsSrc, path.join(BUILD_DIR, 'js'));
    }

    const favicon = path.join(SRC_DIR, 'favicon.png');
    if (await fs.pathExists(favicon)) {
        await fs.copy(favicon, path.join(BUILD_DIR, 'favicon.png'));
    }
}

async function loadComponent(name) {
    const componentPath = path.join(COMPONENTS_DIR, `${name}.html`);
    if (await fs.pathExists(componentPath)) {
        return await fs.readFile(componentPath, 'utf-8');
    }
    console.warn(`  Component not found: ${name}`);
    return `<!-- Component ${name} not found -->`;
}

async function processVariables(html) {
    const variableRegex = /{{(\w+)}}/g;
    const matches = [...html.matchAll(variableRegex)];

    for (const match of matches) {
        const componentContent = await loadComponent(match[1]);
        html = html.replace(match[0], componentContent);
    }

    return html;
}

function fixAssetPaths(html, outputPath) {
    const prefix = path.relative(path.dirname(outputPath), BUILD_DIR).split(path.sep).join('/');
    const assetRoot = prefix ? `${prefix}/` : '';

    return html
        .replace(/href="\.\/css\/style\.css"/g, `href="${assetRoot}css/style.css?v=${STYLE_VERSION}"`)
        .replace(/src="\.\/js\/sidebar\.js"/g, `src="${assetRoot}js/sidebar.js?v=${SCRIPT_VERSION}"`)
        .replace(/src="\.\/js\/phoneme-audio\.js"/g, `src="${assetRoot}js/phoneme-audio.js"`)
        .replace(/href="favicon\.png"/g, `href="${assetRoot}favicon.png"`);
}

function extractHtmlBody(pageContent) {
    const bodyMatch = pageContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
        return bodyMatch[1].trim();
    }
    return pageContent;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]);
}

function renderPhonemeLink(phoneme) {
    const fileName = PHONEME_AUDIO_FILES[phoneme];
    if (!fileName) {
        throw new Error(`No Wikimedia Commons audio mapping exists for phoneme "${phoneme}".`);
    }

    const audioUrl = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(fileName)}`;
    const filePageUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName.replaceAll(' ', '_'))}`;
    const approximation = phoneme === 'ʡᵸ'
        ? ' Audio proche : occlusive épiglottale non aspirée.'
        : phoneme === 'ã'
            ? ' Audio proche : voyelle nasale postérieure ouverte.'
            : '';

    return `<a class="phoneme-audio" href="${escapeHtml(filePageUrl)}" data-phoneme-audio="${escapeHtml(audioUrl)}" aria-label="Écouter ${escapeHtml(phoneme)}.${approximation}" title="Écouter ${escapeHtml(phoneme)}${approximation}">${escapeHtml(phoneme)}</a>`;
}

function renderPhonemeList(value) {
    return String(value ?? '')
        .split(/\s*,\s*/)
        .filter(Boolean)
        .map(renderPhonemeLink)
        .join(', ');
}

function renderConlangMatrix(template, matrix) {
    const headers = matrix.columns
        .map((column) => `<th scope="col">${escapeHtml(column)}</th>`)
        .join('');
    const rows = matrix.rows.map((row) => {
        const cells = row.cells
            .map((cell) => `<td>${renderPhonemeList(cell)}</td>`)
            .join('');
        return `<tr><th scope="row">${escapeHtml(row.label)}</th>${cells}</tr>`;
    }).join('');

    return template
        .split('{{matrixTitle}}').join(escapeHtml(matrix.title))
        .split('{{rowHeading}}').join(escapeHtml(matrix.rowHeading))
        .split('{{columnHeadings}}').join(headers)
        .split('{{matrixRows}}').join(rows);
}

function renderVowelChart(template, chart) {
    const points = chart.points.map((point) =>
        `<span class="vowel-chart-point" style="left:${escapeHtml(point.x)}%;top:${escapeHtml(point.y)}%">${renderPhonemeList(point.label)}</span>`
    ).join('\n');

    return template
        .split('{{chartTitle}}').join(escapeHtml(chart.title))
        .split('{{chartDescription}}').join(escapeHtml(chart.description))
        .split('{{vowelChartPoints}}').join(points);
}

function renderConlangTemplate(template, contentHtml, metadata) {
    const matrixTemplateMatch = template.match(
        /<template id="conlang-matrix-template">([\s\S]*?)<\/template>/i
    );

    if (!matrixTemplateMatch) {
        throw new Error('The conlang template is missing its phonology matrix template.');
    }
    const vowelChartTemplateMatch = template.match(
        /<template id="conlang-vowel-chart-template">([\s\S]*?)<\/template>/i
    );

    if (!vowelChartTemplateMatch) {
        throw new Error('The conlang template is missing its vowel chart template.');
    }

    const matrixTemplate = matrixTemplateMatch[1];
    const infoRows = metadata.infobox.map(([label, value]) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
    ).join('');
    const consonantTable = renderConlangMatrix(matrixTemplate, metadata.phonology.consonants);
    const vowelChart = renderVowelChart(
        vowelChartTemplateMatch[1],
        metadata.phonology.vowels
    );
    const phonologyContent = `<div class="conlang-phonology-inventories">\n${consonantTable}\n${vowelChart}\n</div>`;

    if (!contentHtml.includes('<!-- CONLANG_PHONOLOGY_TABLES -->')) {
        throw new Error('The conlang Markdown page is missing its phonology table marker.');
    }

    const romanizationTablesMatch = contentHtml.match(
        /(<h4>Romanisation<\/h4>\s*<p>[\s\S]*?<\/p>\s*)<table>([\s\S]*?)<\/table>\s*<table>([\s\S]*?)<\/table>/i
    );
    if (!romanizationTablesMatch) {
        throw new Error('The conlang Markdown page is missing its two romanization tables.');
    }

    const romanizationTables = `${romanizationTablesMatch[1]}<div class="conlang-romanization-tables"><table>${romanizationTablesMatch[2]}</table><table>${romanizationTablesMatch[3]}</table></div>`;

    return {
        template: template
            .replace(matrixTemplateMatch[0], '')
            .replace(vowelChartTemplateMatch[0], '')
            .split('{{conlangName}}').join(escapeHtml(metadata.name))
            .split('{{conlangInfoBox}}').join(infoRows),
        content: contentHtml
            .replace('<!-- CONLANG_PHONOLOGY_TABLES -->', phonologyContent)
            .replace(romanizationTablesMatch[0], romanizationTables),
    };
}

async function applyTemplate(contentHtml, outputPath, frontmatter = {}) {
    const templatePath = frontmatter.template === 'conlang_template.html'
        ? path.join(SRC_DIR, frontmatter.template)
        : TEMPLATE_PATH;
    let template = await fs.readFile(templatePath, 'utf-8');

    if (frontmatter.template === 'conlang_template.html') {
        const rendered = renderConlangTemplate(
            template,
            contentHtml,
            frontmatter.conlang
        );
        template = rendered.template;
        contentHtml = rendered.content;
    }

    let html = template.split('{{content}}').join(contentHtml);

    if (frontmatter.title) {
        html = html.replace(
            /<title>[\s\S]*?<\/title>/,
            `<title>${frontmatter.title} - KrankerApfel</title>`
        );
    }

    html = await processVariables(html);
    html = fixAssetPaths(html, outputPath);
    return html;
}

async function writePage(outputPath, html) {
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, html);
}

async function processMarkdownFile(filePath, outputPath) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const { data, content } = matter(fileContent);

    if (data.draft === true) {
        return { skipped: true, data };
    }

    const htmlContent = marked.parse(content);
    const html = await applyTemplate(htmlContent, outputPath, data);
    await writePage(outputPath, html);
    return { skipped: false, data };
}

async function processPages() {
    console.log('Processing pages...');
    const pagesDir = path.join(SRC_DIR, 'pages');
    const buildPagesDir = path.join(BUILD_DIR, 'pages');

    if (!(await fs.pathExists(pagesDir))) {
        console.log('  No pages directory found, skipping...');
        return;
    }

    await fs.ensureDir(buildPagesDir);
    async function processDir(dir, relativePath = '') {
        const entries = await fs.readdir(dir);

        for (const entry of entries) {
            const pagePath = path.join(dir, entry);
            const stat = await fs.stat(pagePath);

            if (stat.isDirectory()) {
                await processDir(pagePath, path.join(relativePath, entry));
                continue;
            }

            const ext = path.extname(entry).toLowerCase();
            const outputPath = path.join(
                buildPagesDir,
                relativePath,
                `${path.basename(entry, ext)}.html`
            );
            const relativeOutputPath = path.join(relativePath, `${path.basename(entry, ext)}.html`);

            if (ext === '.html') {
                const pageContent = await fs.readFile(pagePath, 'utf-8');
                const content = extractHtmlBody(pageContent);
                const html = await applyTemplate(content, outputPath);
                await writePage(outputPath, html);
                console.log(`  ${relativeOutputPath}`);
            } else if (ext === '.md') {
                const result = await processMarkdownFile(pagePath, outputPath);
                if (result.skipped) {
                    console.log(`  skip ${relativeOutputPath} (draft)`);
                } else {
                    console.log(`  ${relativeOutputPath}`);
                }
            }
        }
    }

    await processDir(pagesDir);
}

async function processArticles() {
    console.log('Processing markdown articles...');
    const articlesDir = path.join(SRC_DIR, 'articles');

    if (!(await fs.pathExists(articlesDir))) {
        console.log('  No articles directory found, skipping...');
        return;
    }

    const buildPagesDir = path.join(BUILD_DIR, 'pages');

    async function processDir(dir, relativePath = '') {
        const entries = await fs.readdir(dir);

        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = await fs.stat(fullPath);

            if (stat.isDirectory()) {
                await processDir(fullPath, path.join(relativePath, entry));
            } else if (path.extname(entry).toLowerCase() === '.md') {
                const outputFile = entry.replace(/\.md$/i, '.html');
                const outputPath = path.join(buildPagesDir, relativePath, outputFile);
                const result = await processMarkdownFile(fullPath, outputPath);
                const relOut = path.join(relativePath, outputFile);

                if (result.skipped) {
                    console.log(`  skip ${relOut} (draft)`);
                } else {
                    console.log(`  ${relOut}`);
                }
            }
        }
    }

    await processDir(articlesDir);
}

async function build() {
    console.log('Starting build...\n');

    try {
        await cleanBuild();
        await copyAssets();
        await processPages();
        await processArticles();

        console.log('\nBuild completed successfully!');
        console.log(`Output directory: ${BUILD_DIR}`);
    } catch (error) {
        console.error('\nBuild failed:', error);
        process.exit(1);
    }
}

function watch() {
    console.log('Watching for changes...\n');
    build();

    const watcher = chokidar.watch(SRC_DIR, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
    });

    watcher.on('change', (filePath) => {
        console.log(`\nFile changed: ${filePath}`);
        build();
    });

    watcher.on('add', (filePath) => {
        console.log(`\nFile added: ${filePath}`);
        build();
    });

    watcher.on('unlink', (filePath) => {
        console.log(`\nFile removed: ${filePath}`);
        build();
    });
}

const watchMode = process.argv.includes('--watch') || process.argv.includes('-w');

if (watchMode) {
    watch();
} else {
    build();
}
