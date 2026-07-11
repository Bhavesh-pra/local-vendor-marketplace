const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const DB_PATH = path.join(__dirname, '..', 'ecommerce.sqlite');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'products');

const CATEGORY_NAMES = {
  1: 'Clothes',
  2: 'Electronics',
  3: 'Accessories',
  4: 'Furniture',
  5: 'Others',
};

const CATEGORY_PALETTES = {
  Clothes: { bgA: '#f6efe8', bgB: '#d9c3a8', accent: '#7c4d2f', ink: '#2a1d15' },
  Electronics: { bgA: '#eff6ff', bgB: '#bfdbfe', accent: '#1d4ed8', ink: '#0f172a' },
  Accessories: { bgA: '#fff7ed', bgB: '#fed7aa', accent: '#c2410c', ink: '#2b160a' },
  Furniture: { bgA: '#f3f4f6', bgB: '#d1d5db', accent: '#6b4f3a', ink: '#1f2937' },
  Others: { bgA: '#f0fdf4', bgB: '#bbf7d0', accent: '#15803d', ink: '#102217' },
};

const REVIEW_PHRASES = {
  5: [
    'Excellent quality for the price.',
    'Exactly what I wanted for regular use.',
    'Packaging was neat and the product feels premium.',
    'Looks good in person and works as expected.',
  ],
  4: [
    'Good overall value and easy to recommend.',
    'Comfortable to use and nicely finished.',
    'Works well for daily use with no major issues.',
    'Solid buy if you want something dependable.',
  ],
  3: [
    'Decent product, but the finish could be better.',
    'Useful item, though not as polished as premium options.',
    'Good enough for the price, but there is room for improvement.',
  ],
};

const FILTER_QUERIES = [
  'earbuds', 'wireless charger', 'study chair', 'cotton shirt', 'office backpack',
  'water bottle', 'yoga mat', 'bookshelf', 'sneakers', 'smart watch',
];

const NO_RESULT_QUERIES = [
  'airpod cover', 'gaming sofa', 'organic quinoa', 'dslr tripod', 'luxury perfume',
];

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hashText(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function integer(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function roundMoney(value) {
  return Math.round(Number(value));
}

function isoDaysAgo(daysAgo, minuteOffset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCMinutes(date.getUTCMinutes() - minuteOffset);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function backupDatabase() {
  ensureDirectory(BACKUP_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `ecommerce.pre-phase4-seed.${timestamp}.sqlite`);
  fs.copyFileSync(DB_PATH, backupPath);
  return backupPath;
}

function apparelVariants(colors, sizes, baseStock, priceStep = 40) {
  const variants = [];
  colors.forEach((color, colorIndex) => {
    sizes.forEach((size, sizeIndex) => {
      variants.push({
        size,
        color,
        stock: baseStock + ((sizeIndex + colorIndex) % 4) * 2,
        priceDelta: sizeIndex >= 2 ? priceStep : 0,
      });
    });
  });
  return variants;
}

function shoeVariants(colors, sizes, baseStock) {
  const variants = [];
  colors.forEach((color, colorIndex) => {
    sizes.forEach((size, sizeIndex) => {
      variants.push({
        size: String(size),
        color,
        stock: baseStock + ((colorIndex + sizeIndex) % 3),
        priceDelta: size >= 9 ? 60 : 0,
      });
    });
  });
  return variants;
}

function colorVariants(colors, baseStock, extras = {}) {
  return colors.map((color, index) => ({
    color,
    stock: baseStock + (index % 3) * 2,
    ...extras,
  }));
}

function finishVariants(items) {
  return items.map((item) => ({ ...item }));
}

function packVariants(items) {
  return items.map((item) => ({ ...item }));
}

function renderIllustration(categoryName, scene, accent, title, brand) {
  const stroke = categoryName === 'Electronics' ? 18 : 14;
  const titleShort = escapeXml(title.slice(0, 20));
  const brandText = escapeXml(brand || 'ShopCart Local');

  if (categoryName === 'Electronics') {
    return `
      <rect x="120" y="96" rx="28" ry="28" width="280" height="160" fill="${accent}" opacity="0.18" />
      <rect x="165" y="82" rx="24" ry="24" width="190" height="220" fill="white" opacity="0.96" stroke="${accent}" stroke-width="6" />
      <circle cx="260" cy="278" r="8" fill="${accent}" opacity="0.55" />
      <rect x="195" y="115" rx="14" ry="14" width="130" height="16" fill="${accent}" opacity="0.20" />
      <rect x="195" y="148" rx="14" ry="14" width="${scene === 'detail' ? 140 : 120}" height="92" fill="${accent}" opacity="0.10" />
      <circle cx="225" cy="198" r="${stroke}" fill="${accent}" opacity="0.72" />
      <circle cx="293" cy="198" r="${stroke}" fill="${accent}" opacity="0.42" />
      <text x="40" y="328" font-size="22" font-weight="700" fill="${accent}">${brandText}</text>
      <text x="40" y="355" font-size="15" fill="#1f2937">${titleShort}</text>
    `;
  }

  if (categoryName === 'Clothes') {
    return `
      <path d="M196 90 232 68h56l36 22 44 28-28 44-36-26v166H220V136l-36 26-28-44z" fill="white" opacity="0.95" stroke="${accent}" stroke-width="6"/>
      <path d="M232 68c8 18 22 28 28 28s20-10 28-28" fill="none" stroke="${accent}" stroke-width="6" opacity="0.6"/>
      <rect x="182" y="310" rx="14" ry="14" width="176" height="28" fill="${accent}" opacity="0.14" />
      <text x="40" y="328" font-size="22" font-weight="700" fill="${accent}">${brandText}</text>
      <text x="40" y="355" font-size="15" fill="#3f2d22">${titleShort}</text>
    `;
  }

  if (categoryName === 'Accessories') {
    return `
      <ellipse cx="260" cy="310" rx="126" ry="18" fill="${accent}" opacity="0.10"/>
      <path d="M178 184c0-58 36-96 82-96 44 0 80 38 80 96v92H178z" fill="white" opacity="0.96" stroke="${accent}" stroke-width="6"/>
      <path d="M212 184c4-28 22-48 48-48 26 0 44 20 48 48" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
      <rect x="232" y="210" rx="10" ry="10" width="56" height="30" fill="${accent}" opacity="0.18"/>
      <text x="40" y="328" font-size="22" font-weight="700" fill="${accent}">${brandText}</text>
      <text x="40" y="355" font-size="15" fill="#412515">${titleShort}</text>
    `;
  }

  if (categoryName === 'Furniture') {
    return `
      <rect x="140" y="190" rx="16" ry="16" width="240" height="24" fill="${accent}" opacity="0.90"/>
      <rect x="154" y="214" rx="10" ry="10" width="18" height="112" fill="${accent}" opacity="0.62"/>
      <rect x="348" y="214" rx="10" ry="10" width="18" height="112" fill="${accent}" opacity="0.62"/>
      <rect x="186" y="126" rx="18" ry="18" width="148" height="54" fill="white" opacity="0.96" stroke="${accent}" stroke-width="6"/>
      <rect x="214" y="72" rx="18" ry="18" width="92" height="54" fill="${accent}" opacity="0.18"/>
      <text x="40" y="328" font-size="22" font-weight="700" fill="${accent}">${brandText}</text>
      <text x="40" y="355" font-size="15" fill="#2e241d">${titleShort}</text>
    `;
  }

  return `
    <ellipse cx="260" cy="314" rx="118" ry="18" fill="${accent}" opacity="0.10"/>
    <rect x="210" y="94" rx="28" ry="28" width="100" height="190" fill="white" opacity="0.96" stroke="${accent}" stroke-width="6"/>
    <rect x="226" y="120" rx="18" ry="18" width="68" height="120" fill="${accent}" opacity="0.18" />
    <rect x="220" y="88" rx="16" ry="16" width="80" height="18" fill="${accent}" opacity="0.55" />
    <text x="40" y="328" font-size="22" font-weight="700" fill="${accent}">${brandText}</text>
    <text x="40" y="355" font-size="15" fill="#1d2b1d">${titleShort}</text>
  `;
}

function buildSvg(product, scene, accentOverride) {
  const palette = CATEGORY_PALETTES[CATEGORY_NAMES[product.categoryId]];
  const accent = accentOverride || product.imageAccent || palette.accent;
  const title = escapeXml(product.name);
  const sceneTitle = scene === 'detail' ? 'Detail View' : scene === 'lifestyle' ? 'In Use' : 'Gallery View';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">${escapeXml(product.summary || product.name)}</desc>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.bgA}" />
      <stop offset="100%" stop-color="${palette.bgB}" />
    </linearGradient>
  </defs>
  <rect width="640" height="420" fill="url(#bg)" />
  <circle cx="92" cy="86" r="54" fill="${accent}" opacity="0.10" />
  <circle cx="548" cy="84" r="72" fill="${accent}" opacity="0.08" />
  <text x="40" y="50" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="${accent}">ShopCart Local</text>
  <text x="40" y="78" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="800" fill="#111827">${title}</text>
  <text x="40" y="106" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#475569">${escapeXml(sceneTitle)} · ${escapeXml(CATEGORY_NAMES[product.categoryId])}</text>
  ${renderIllustration(CATEGORY_NAMES[product.categoryId], scene, accent, product.name, product.brand)}
</svg>`;
}

function writeSvgAsset(fileName, contents) {
  ensureDirectory(UPLOAD_DIR);
  const outputPath = path.join(UPLOAD_DIR, fileName);
  fs.writeFileSync(outputPath, contents, 'utf8');
  return `/uploads/products/${fileName}`;
}

function buildDescription(product) {
  const keywords = product.searchTerms.join(', ');
  return `${product.summary} Built for a neighborhood marketplace catalog, this ${product.brand} item is easy to discover through search terms such as ${keywords}. It is intended for repeat daily use, priced for value-conscious shoppers, and stocked in practical variants for local delivery and pickup.`;
}

function createCatalog() {
  return [
    {
      key: 'dailyweave-essential-crew-tee',
      name: 'DailyWeave Essential Crew Tee',
      brand: 'DailyWeave',
      categoryId: 1,
      price: 599,
      mrp: 799,
      cost: 338,
      badge: 'Best Seller',
      summary: 'Soft combed-cotton crew tee with an easy regular fit for daily wear.',
      searchTerms: ['crew tee', 'cotton t-shirt', 'daily wear tee'],
      specs: [['Material', '100% combed cotton'], ['Fit', 'Regular fit'], ['Neck', 'Crew neck'], ['Wash Care', 'Machine wash cold']],
      shipping: { weight: 0.28, length: 30, width: 24, height: 3, class: 'apparel', cod: true, free: false },
      warranty: null,
      targetRating: 4.4,
      reviewCount: 10,
      imageAccent: '#5a7d4d',
      variants: apparelVariants(['Sage Green', 'Charcoal'], ['S', 'M', 'L', 'XL'], 10, 30),
    },
    {
      key: 'dailyweave-stretch-polo',
      name: 'DailyWeave Stretch Polo',
      brand: 'DailyWeave',
      categoryId: 1,
      price: 899,
      mrp: 1199,
      cost: 520,
      badge: 'Trending',
      summary: 'Pique-knit polo with breathable stretch fabric and a clean collar stand.',
      searchTerms: ['polo t-shirt', 'stretch polo', 'smart casual tee'],
      specs: [['Material', 'Cotton-spandex pique'], ['Fit', 'Slim fit'], ['Sleeve', 'Half sleeve'], ['Occasion', 'Office casual']],
      shipping: { weight: 0.3, length: 31, width: 25, height: 3, class: 'apparel', cod: true, free: false },
      warranty: null,
      targetRating: 4.3,
      reviewCount: 9,
      imageAccent: '#1f6f78',
      variants: apparelVariants(['Navy Blue', 'Wine Red'], ['M', 'L', 'XL'], 9, 40),
    },
    {
      key: 'korastreet-linen-blend-kurta',
      name: 'KoraStreet Linen Blend Kurta',
      brand: 'KoraStreet',
      categoryId: 1,
      price: 1299,
      mrp: 1699,
      cost: 760,
      badge: 'New Arrival',
      summary: 'Straight-cut linen blend kurta with side pockets and a neat mandarin collar.',
      searchTerms: ['mens kurta', 'linen kurta', 'festive kurta'],
      specs: [['Fabric', 'Linen-cotton blend'], ['Length', 'Knee length'], ['Collar', 'Mandarin collar'], ['Pockets', '2 side pockets']],
      shipping: { weight: 0.34, length: 34, width: 26, height: 3, class: 'apparel', cod: true, free: true },
      warranty: null,
      targetRating: 4.5,
      reviewCount: 8,
      imageAccent: '#9a6b3f',
      variants: apparelVariants(['Sand Beige', 'Forest Green'], ['M', 'L', 'XL'], 8, 45),
    },
    {
      key: 'korastreet-tapered-chino-pants',
      name: 'KoraStreet Tapered Chino Pants',
      brand: 'KoraStreet',
      categoryId: 1,
      price: 1499,
      mrp: 1999,
      cost: 870,
      badge: 'Value Pick',
      summary: 'Everyday chinos with a tapered leg, soft twill finish, and added stretch.',
      searchTerms: ['chino pants', 'office trousers', 'stretch chinos'],
      specs: [['Material', 'Cotton twill with stretch'], ['Rise', 'Mid rise'], ['Fit', 'Tapered fit'], ['Closure', 'Zip fly']],
      shipping: { weight: 0.42, length: 35, width: 28, height: 4, class: 'apparel', cod: true, free: true },
      warranty: null,
      targetRating: 4.2,
      reviewCount: 11,
      imageAccent: '#6b7280',
      variants: apparelVariants(['Khaki', 'Midnight Navy'], ['30', '32', '34', '36'], 8, 55),
    },
    {
      key: 'loomline-soft-cotton-night-suit',
      name: 'Loomline Soft Cotton Night Suit',
      brand: 'Loomline',
      categoryId: 1,
      price: 1199,
      mrp: 1599,
      cost: 680,
      badge: 'Best Seller',
      summary: 'Two-piece sleep set in soft cotton jersey with a relaxed, home-friendly fit.',
      searchTerms: ['night suit', 'sleepwear set', 'cotton loungewear'],
      specs: [['Set Includes', 'Top and pajama'], ['Fabric', 'Cotton jersey'], ['Fit', 'Relaxed fit'], ['Season', 'All-season']],
      shipping: { weight: 0.44, length: 32, width: 27, height: 4, class: 'apparel', cod: true, free: false },
      warranty: null,
      targetRating: 4.6,
      reviewCount: 12,
      imageAccent: '#b45309',
      variants: apparelVariants(['Lavender', 'Powder Blue'], ['S', 'M', 'L'], 9, 35),
    },
    {
      key: 'urbanfold-zip-hoodie',
      name: 'UrbanFold Zip Hoodie',
      brand: 'UrbanFold',
      categoryId: 1,
      price: 1899,
      mrp: 2499,
      cost: 1090,
      badge: 'Trending',
      summary: 'Midweight zip hoodie with brushed inner lining for cool evenings and travel.',
      searchTerms: ['zip hoodie', 'hooded jacket', 'winter sweatshirt'],
      specs: [['Fabric', 'Cotton-poly fleece'], ['Closure', 'Full zip'], ['Pockets', '2 hand pockets'], ['Lining', 'Brushed inner']],
      shipping: { weight: 0.58, length: 36, width: 30, height: 5, class: 'apparel', cod: true, free: true },
      warranty: null,
      targetRating: 4.3,
      reviewCount: 10,
      imageAccent: '#374151',
      variants: apparelVariants(['Jet Black', 'Heather Grey'], ['M', 'L', 'XL'], 7, 60),
    },
    {
      key: 'northdock-denim-jacket',
      name: 'NorthDock Denim Jacket',
      brand: 'NorthDock',
      categoryId: 1,
      price: 2299,
      mrp: 2999,
      cost: 1335,
      badge: 'New Arrival',
      summary: 'Structured denim jacket with utility pockets and a slightly relaxed silhouette.',
      searchTerms: ['denim jacket', 'casual jacket', 'layering outerwear'],
      specs: [['Material', 'Cotton denim'], ['Pockets', '4 pockets'], ['Fit', 'Relaxed fit'], ['Wash', 'Stone wash']],
      shipping: { weight: 0.72, length: 38, width: 31, height: 5, class: 'apparel', cod: true, free: true },
      warranty: null,
      targetRating: 4.5,
      reviewCount: 8,
      imageAccent: '#1d4ed8',
      variants: apparelVariants(['Deep Indigo', 'Washed Blue'], ['M', 'L', 'XL'], 6, 70),
    },
    {
      key: 'loomline-everyday-leggings',
      name: 'Loomline Everyday Leggings',
      brand: 'Loomline',
      categoryId: 1,
      price: 699,
      mrp: 949,
      cost: 402,
      badge: 'Value Pick',
      summary: 'Stretch-knit leggings with a smooth waistband for all-day comfort.',
      searchTerms: ['leggings', 'stretch pants', 'everyday bottoms'],
      specs: [['Fabric', 'Cotton elastane'], ['Waist', 'High rise'], ['Length', 'Ankle length'], ['Use', 'Daily wear']],
      shipping: { weight: 0.26, length: 28, width: 22, height: 3, class: 'apparel', cod: true, free: false },
      warranty: null,
      targetRating: 4.4,
      reviewCount: 11,
      imageAccent: '#7c3aed',
      variants: apparelVariants(['Black', 'Maroon'], ['S', 'M', 'L', 'XL'], 11, 25),
    },
    {
      key: 'summerthread-rayon-printed-top',
      name: 'SummerThread Rayon Printed Top',
      brand: 'SummerThread',
      categoryId: 1,
      price: 799,
      mrp: 1099,
      cost: 465,
      badge: 'Trending',
      summary: 'Light rayon top with an all-over print and a fluid drape for warm days.',
      searchTerms: ['printed top', 'rayon top', 'casual blouse'],
      specs: [['Fabric', 'Rayon'], ['Neckline', 'Round neck'], ['Sleeve', 'Three-quarter sleeve'], ['Pattern', 'All-over print']],
      shipping: { weight: 0.24, length: 29, width: 24, height: 3, class: 'apparel', cod: true, free: false },
      warranty: null,
      targetRating: 4.1,
      reviewCount: 7,
      imageAccent: '#db2777',
      variants: apparelVariants(['Peach Floral', 'Teal Floral'], ['S', 'M', 'L'], 8, 20),
    },
    {
      key: 'cedarrun-school-uniform-shirt',
      name: 'CedarRun School Uniform Shirt',
      brand: 'CedarRun',
      categoryId: 1,
      price: 549,
      mrp: 699,
      cost: 312,
      badge: 'Local Pick',
      summary: 'Easy-care uniform shirt with reinforced seams and a crisp everyday finish.',
      searchTerms: ['school shirt', 'uniform shirt', 'white formal shirt'],
      specs: [['Fabric', 'Poly-cotton blend'], ['Collar', 'Spread collar'], ['Care', 'Wrinkle-resistant'], ['Use', 'School uniform']],
      shipping: { weight: 0.22, length: 27, width: 22, height: 2, class: 'apparel', cod: true, free: false },
      warranty: null,
      targetRating: 4.0,
      reviewCount: 6,
      imageAccent: '#2563eb',
      variants: apparelVariants(['White', 'Light Blue'], ['28', '30', '32', '34'], 9, 18),
    },
    {
      key: 'smartberry-airbeat-lite-earbuds',
      name: 'Smartberry AirBeat Lite Earbuds',
      brand: 'Smartberry',
      categoryId: 2,
      price: 1599,
      mrp: 2199,
      cost: 940,
      badge: 'Best Seller',
      summary: 'Compact TWS earbuds with low-latency audio, dual mics, and pocket-friendly charging.',
      searchTerms: ['wireless earbuds', 'tws earbuds', 'bluetooth earbuds'],
      specs: [['Bluetooth', 'v5.3'], ['Playback', '30 hours with case'], ['Water Resistance', 'IPX4'], ['Controls', 'Touch controls']],
      shipping: { weight: 0.18, length: 9, width: 9, height: 4, class: 'small-electronics', cod: true, free: true },
      warranty: { period: '12 Months', type: 'Brand Warranty', replacementDays: 7, returnDays: 5, description: 'Warranty covers manufacturing defects.' },
      targetRating: 4.5,
      reviewCount: 14,
      imageAccent: '#0f172a',
      variants: colorVariants(['Midnight Black', 'Ocean Blue', 'Ivory White'], 12, { model: 'AirBeat Lite' }),
    },
    {
      key: 'smartberry-neckloop-anc-earphones',
      name: 'Smartberry NeckLoop ANC Earphones',
      brand: 'Smartberry',
      categoryId: 2,
      price: 1899,
      mrp: 2599,
      cost: 1120,
      badge: 'Trending',
      summary: 'Wireless neckband earphones with environmental noise reduction and fast pairing.',
      searchTerms: ['wireless neckband', 'bluetooth earphones', 'anc earphones'],
      specs: [['Battery', '28 hours'], ['Fast Charge', '10 min = 5 hours'], ['Driver Size', '12 mm'], ['Modes', 'Music and call modes']],
      shipping: { weight: 0.19, length: 12, width: 10, height: 4, class: 'small-electronics', cod: true, free: true },
      warranty: { period: '12 Months', type: 'Brand Warranty', replacementDays: 7, returnDays: 5, description: 'Coverage excludes physical damage.' },
      targetRating: 4.2,
      reviewCount: 9,
      imageAccent: '#164e63',
      variants: colorVariants(['Slate Black', 'Teal'], 10, { model: 'NeckLoop ANC' }),
    },
    {
      key: 'voltedge-20w-usb-c-fast-charger',
      name: 'VoltEdge 20W USB-C Fast Charger',
      brand: 'VoltEdge',
      categoryId: 2,
      price: 799,
      mrp: 1099,
      cost: 455,
      badge: 'Value Pick',
      summary: 'Travel-friendly PD charger for phones, earbuds, and compact accessories.',
      searchTerms: ['fast charger', 'usb c charger', '20w charger'],
      specs: [['Output', '20W PD'], ['Ports', 'USB-C single port'], ['Safety', 'Over-voltage protection'], ['Plug Type', 'Indian 2-pin']],
      shipping: { weight: 0.14, length: 7, width: 5, height: 4, class: 'small-electronics', cod: true, free: false },
      warranty: { period: '6 Months', type: 'Brand Warranty', replacementDays: 5, returnDays: 3, description: 'Warranty valid for charger body and adapter internals.' },
      targetRating: 4.3,
      reviewCount: 13,
      imageAccent: '#ea580c',
      variants: finishVariants([
        { color: 'White', model: '20W PD', stock: 20 },
        { color: 'Black', model: '20W PD', stock: 18 },
      ]),
    },
    {
      key: 'voltedge-10000mah-power-bank',
      name: 'VoltEdge 10000mAh Power Bank',
      brand: 'VoltEdge',
      categoryId: 2,
      price: 1499,
      mrp: 1999,
      cost: 880,
      badge: 'Best Seller',
      summary: 'Slim power bank with USB-C input, dual outputs, and a grippy matte finish.',
      searchTerms: ['power bank', '10000mah battery pack', 'portable charger'],
      specs: [['Capacity', '10000 mAh'], ['Ports', 'USB-C + 2 USB-A'], ['Body', 'Matte ABS shell'], ['Display', '4-point LED indicator']],
      shipping: { weight: 0.28, length: 15, width: 8, height: 2, class: 'small-electronics', cod: true, free: true },
      warranty: { period: '12 Months', type: 'Brand Warranty', replacementDays: 7, returnDays: 5, description: 'Battery health covered against manufacturing defects.' },
      targetRating: 4.4,
      reviewCount: 12,
      imageAccent: '#334155',
      variants: finishVariants([
        { color: 'Graphite', model: '10000mAh', stock: 16 },
        { color: 'Navy', model: '10000mAh', stock: 14 },
      ]),
    },
    {
      key: 'nexon-spark-5g-smartphone',
      name: 'Nexon Spark 5G Smartphone',
      brand: 'Nexon',
      categoryId: 2,
      price: 16999,
      mrp: 19999,
      cost: 13850,
      badge: 'Trending',
      summary: 'Balanced 5G phone with a smooth display, clean software, and reliable battery life.',
      searchTerms: ['5g phone', 'android smartphone', '128gb mobile'],
      specs: [['Display', '6.6-inch FHD+'], ['Storage', '128GB and 256GB'], ['Battery', '5000 mAh'], ['Camera', '50 MP main camera']],
      shipping: { weight: 0.39, length: 18, width: 10, height: 5, class: 'electronics', cod: true, free: true },
      warranty: { period: '12 Months', type: 'Brand Warranty', replacementDays: 7, returnDays: 5, description: 'Handset and in-box charger covered.' },
      targetRating: 4.3,
      reviewCount: 8,
      imageAccent: '#1d4ed8',
      variants: finishVariants([
        { color: 'Graphite Black', storage: '128GB', model: 'Spark 5G', stock: 9 },
        { color: 'Silver Mist', storage: '128GB', model: 'Spark 5G', stock: 8 },
        { color: 'Graphite Black', storage: '256GB', model: 'Spark 5G', stock: 6, priceDelta: 2000, mrpDelta: 2000, costDelta: 1600 },
      ]),
    },
    {
      key: 'homepulse-mini-bluetooth-speaker',
      name: 'HomePulse Mini Bluetooth Speaker',
      brand: 'HomePulse',
      categoryId: 2,
      price: 1299,
      mrp: 1699,
      cost: 760,
      badge: 'Value Pick',
      summary: 'Compact Bluetooth speaker tuned for clear vocals in small rooms and desks.',
      searchTerms: ['bluetooth speaker', 'mini speaker', 'portable speaker'],
      specs: [['Driver', '8W driver'], ['Battery', '12 hours'], ['Connectivity', 'Bluetooth + AUX'], ['Build', 'Fabric mesh front']],
      shipping: { weight: 0.32, length: 14, width: 8, height: 8, class: 'small-electronics', cod: true, free: true },
      warranty: { period: '6 Months', type: 'Brand Warranty', replacementDays: 5, returnDays: 3, description: 'Warranty excludes water damage.' },
      targetRating: 4.1,
      reviewCount: 10,
      imageAccent: '#7c3aed',
      variants: colorVariants(['Charcoal', 'Brick Red'], 11, { model: 'Mini' }),
    },
    {
      key: 'soundmint-clip-wireless-speaker',
      name: 'SoundMint Clip Wireless Speaker',
      brand: 'SoundMint',
      categoryId: 2,
      price: 1799,
      mrp: 2399,
      cost: 1030,
      badge: 'New Arrival',
      summary: 'Clip-on wireless speaker for cycling, balconies, and easy outdoor listening.',
      searchTerms: ['wireless speaker', 'clip speaker', 'portable bluetooth speaker'],
      specs: [['Battery', '14 hours'], ['Mount', 'Integrated clip loop'], ['Water Resistance', 'IPX5'], ['Playback', 'Stereo pairing supported']],
      shipping: { weight: 0.34, length: 13, width: 9, height: 6, class: 'small-electronics', cod: true, free: true },
      warranty: { period: '6 Months', type: 'Brand Warranty', replacementDays: 5, returnDays: 3, description: 'Functional defects covered under normal use.' },
      targetRating: 4.2,
      reviewCount: 7,
      imageAccent: '#0f766e',
      variants: colorVariants(['Black', 'Coral'], 9, { model: 'Clip' }),
    },
    {
      key: 'novanest-led-study-lamp',
      name: 'NovaNest LED Study Lamp',
      brand: 'NovaNest',
      categoryId: 2,
      price: 1399,
      mrp: 1899,
      cost: 815,
      badge: 'Trending',
      summary: 'Adjustable study lamp with three color temperatures and a compact desk base.',
      searchTerms: ['study lamp', 'desk light', 'led lamp'],
      specs: [['Lighting', '3-tone LED'], ['Power', 'USB powered'], ['Controls', 'Touch dimmer'], ['Arm', 'Flexible arm']],
      shipping: { weight: 0.47, length: 22, width: 11, height: 7, class: 'small-electronics', cod: true, free: true },
      warranty: { period: '6 Months', type: 'Brand Warranty', replacementDays: 5, returnDays: 3, description: 'LED unit and control board covered.' },
      targetRating: 4.4,
      reviewCount: 9,
      imageAccent: '#f59e0b',
      variants: finishVariants([
        { color: 'Pearl White', model: 'Touch Base', stock: 13 },
        { color: 'Matte Black', model: 'Touch Base', stock: 11 },
      ]),
    },
    {
      key: 'chronoedge-fitband-smartwatch',
      name: 'ChronoEdge FitBand Smartwatch',
      brand: 'ChronoEdge',
      categoryId: 2,
      price: 2999,
      mrp: 3999,
      cost: 1760,
      badge: 'Best Seller',
      summary: 'Lightweight smartwatch with step tracking, call alerts, and bright everyday display.',
      searchTerms: ['smart watch', 'fitness band watch', 'bluetooth watch'],
      specs: [['Display', '1.72-inch touch display'], ['Battery', '7 days'], ['Tracking', 'Heart rate and steps'], ['Calling', 'Bluetooth notifications']],
      shipping: { weight: 0.19, length: 11, width: 9, height: 4, class: 'small-electronics', cod: true, free: true },
      warranty: { period: '12 Months', type: 'Brand Warranty', replacementDays: 7, returnDays: 5, description: 'Strap excluded from cosmetic warranty claims.' },
      targetRating: 4.0,
      reviewCount: 11,
      imageAccent: '#1e293b',
      variants: finishVariants([
        { color: 'Black Strap', model: 'FitBand', stock: 12 },
        { color: 'Rose Gold Strap', model: 'FitBand', stock: 8 },
      ]),
    },
    {
      key: 'pixelroot-hd-webcam',
      name: 'PixelRoot HD Webcam',
      brand: 'PixelRoot',
      categoryId: 2,
      price: 2199,
      mrp: 2899,
      cost: 1280,
      badge: 'Local Pick',
      summary: 'Plug-and-play HD webcam made for study calls, interviews, and remote office setups.',
      searchTerms: ['webcam', 'hd camera', 'meeting camera'],
      specs: [['Resolution', '1080p'], ['Mic', 'Dual microphone'], ['Mount', 'Monitor clip'], ['Privacy', 'Slide shutter']],
      shipping: { weight: 0.22, length: 9, width: 8, height: 5, class: 'small-electronics', cod: true, free: true },
      warranty: { period: '12 Months', type: 'Brand Warranty', replacementDays: 7, returnDays: 5, description: 'Sensor and microphone defects are covered.' },
      targetRating: 4.3,
      reviewCount: 6,
      imageAccent: '#475569',
      variants: finishVariants([
        { color: 'Graphite', model: '1080p', stock: 10 },
        { color: 'Silver', model: '1080p', stock: 8 },
      ]),
    },
    {
      key: 'trailmax-urban-walk-sneakers',
      name: 'TrailMax Urban Walk Sneakers',
      brand: 'TrailMax',
      categoryId: 3,
      price: 2399,
      mrp: 3199,
      cost: 1400,
      badge: 'Best Seller',
      summary: 'Cushioned daily sneakers with breathable knit upper and a grippy outsole.',
      searchTerms: ['sneakers', 'walking shoes', 'casual shoes'],
      specs: [['Upper', 'Breathable knit'], ['Sole', 'EVA and rubber'], ['Use', 'Daily walking'], ['Closure', 'Lace-up']],
      shipping: { weight: 0.86, length: 32, width: 22, height: 12, class: 'footwear', cod: true, free: true },
      warranty: null,
      targetRating: 4.4,
      reviewCount: 12,
      imageAccent: '#0f766e',
      variants: shoeVariants(['Jet Black', 'Ash Grey'], [7, 8, 9, 10], 5),
    },
    {
      key: 'trailmax-running-socks-pack',
      name: 'TrailMax Running Socks Pack',
      brand: 'TrailMax',
      categoryId: 3,
      price: 399,
      mrp: 549,
      cost: 220,
      badge: 'Value Pack',
      summary: 'Sweat-managing ankle socks for runners, walkers, and gym bags.',
      searchTerms: ['running socks', 'sports socks', 'ankle socks'],
      specs: [['Pack Size', '3 pairs'], ['Fabric', 'Cotton rich blend'], ['Support', 'Arch support rib'], ['Height', 'Ankle length']],
      shipping: { weight: 0.12, length: 18, width: 12, height: 3, class: 'accessories', cod: true, free: false },
      warranty: null,
      targetRating: 4.2,
      reviewCount: 7,
      imageAccent: '#1d4ed8',
      variants: finishVariants([
        { size: 'Free Size', color: 'Black/Grey Mix', stock: 24, model: 'Pack of 3' },
        { size: 'Free Size', color: 'Blue/Grey Mix', stock: 18, model: 'Pack of 3' },
      ]),
    },
    {
      key: 'packsmith-commuter-backpack',
      name: 'Packsmith Commuter Backpack',
      brand: 'Packsmith',
      categoryId: 3,
      price: 1699,
      mrp: 2299,
      cost: 980,
      badge: 'Trending',
      summary: 'Water-resistant commuter backpack with laptop sleeve and quick-access pockets.',
      searchTerms: ['backpack', 'laptop bag', 'college bag'],
      specs: [['Capacity', '22 liters'], ['Laptop Sleeve', '15.6-inch'], ['Material', 'Water-resistant polyester'], ['Pockets', 'Front utility pocket']],
      shipping: { weight: 0.64, length: 44, width: 31, height: 8, class: 'accessories', cod: true, free: true },
      warranty: null,
      targetRating: 4.5,
      reviewCount: 11,
      imageAccent: '#4b5563',
      variants: finishVariants([
        { color: 'Black', model: '22L', stock: 14 },
        { color: 'Olive', model: '22L', stock: 11 },
      ]),
    },
    {
      key: 'hide-and-hue-bifold-wallet',
      name: 'Hide & Hue Bifold Wallet',
      brand: 'Hide & Hue',
      categoryId: 3,
      price: 899,
      mrp: 1299,
      cost: 520,
      badge: 'Local Pick',
      summary: 'Compact bifold wallet with RFID lining and practical card storage.',
      searchTerms: ['wallet', 'leather wallet', 'rfid wallet'],
      specs: [['Material', 'Textured faux leather'], ['Slots', '6 card slots'], ['Security', 'RFID lining'], ['Profile', 'Slim bifold']],
      shipping: { weight: 0.16, length: 12, width: 10, height: 2, class: 'accessories', cod: true, free: false },
      warranty: null,
      targetRating: 4.1,
      reviewCount: 8,
      imageAccent: '#7c2d12',
      variants: finishVariants([
        { color: 'Coffee Brown', stock: 18 },
        { color: 'Tan', stock: 16 },
      ]),
    },
    {
      key: 'sunloop-uv-guard-sunglasses',
      name: 'Sunloop UV Guard Sunglasses',
      brand: 'Sunloop',
      categoryId: 3,
      price: 1199,
      mrp: 1699,
      cost: 700,
      badge: 'Trending',
      summary: 'Light square-frame sunglasses with UV400 lenses for everyday outdoor errands.',
      searchTerms: ['sunglasses', 'uv sunglasses', 'square frame shades'],
      specs: [['Lens', 'UV400'], ['Frame', 'Lightweight polycarbonate'], ['Fit', 'Medium'], ['Style', 'Square frame']],
      shipping: { weight: 0.14, length: 16, width: 8, height: 6, class: 'accessories', cod: true, free: false },
      warranty: null,
      targetRating: 4.0,
      reviewCount: 6,
      imageAccent: '#9333ea',
      variants: finishVariants([
        { color: 'Black Frame', model: 'Smoke Lens', stock: 12 },
        { color: 'Tortoise Frame', model: 'Brown Lens', stock: 9 },
      ]),
    },
    {
      key: 'eliteknots-office-tie-set',
      name: 'EliteKnots Office Tie Set',
      brand: 'EliteKnots',
      categoryId: 3,
      price: 699,
      mrp: 999,
      cost: 385,
      badge: 'Value Pack',
      summary: 'Pair of office-ready ties with subtle weave patterns and gifting-friendly packaging.',
      searchTerms: ['tie set', 'formal tie', 'office accessories'],
      specs: [['Pack Size', '2 ties'], ['Fabric', 'Microfiber blend'], ['Width', 'Standard width'], ['Pattern', 'Subtle textured weave']],
      shipping: { weight: 0.2, length: 24, width: 11, height: 4, class: 'accessories', cod: true, free: false },
      warranty: null,
      targetRating: 4.2,
      reviewCount: 5,
      imageAccent: '#9f1239',
      variants: finishVariants([
        { color: 'Navy and Maroon', model: 'Pack of 2', stock: 13 },
        { color: 'Grey and Blue', model: 'Pack of 2', stock: 10 },
      ]),
    },
    {
      key: 'chronoedge-mesh-strap-watch',
      name: 'ChronoEdge Mesh Strap Watch',
      brand: 'ChronoEdge',
      categoryId: 3,
      price: 1999,
      mrp: 2799,
      cost: 1160,
      badge: 'Best Seller',
      summary: 'Minimal analog watch with a clean dial and breathable magnetic mesh strap.',
      searchTerms: ['analog watch', 'mesh strap watch', 'formal wrist watch'],
      specs: [['Movement', 'Quartz movement'], ['Dial', '40 mm dial'], ['Strap', 'Magnetic mesh strap'], ['Water Resistance', 'Splash resistant']],
      shipping: { weight: 0.18, length: 11, width: 10, height: 5, class: 'accessories', cod: true, free: true },
      warranty: { period: '12 Months', type: 'Brand Warranty', replacementDays: 5, returnDays: 3, description: 'Movement defects covered under warranty.' },
      targetRating: 4.3,
      reviewCount: 7,
      imageAccent: '#334155',
      variants: finishVariants([
        { color: 'Gunmetal', stock: 10 },
        { color: 'Rose Gold', stock: 8 },
      ]),
    },
    {
      key: 'loopcraft-leather-belt',
      name: 'LoopCraft Leather Belt',
      brand: 'LoopCraft',
      categoryId: 3,
      price: 799,
      mrp: 1099,
      cost: 460,
      badge: 'Local Pick',
      summary: 'Everyday formal belt with a matte buckle and a clean stitched edge finish.',
      searchTerms: ['belt', 'formal belt', 'mens belt'],
      specs: [['Material', 'PU leather'], ['Buckle', 'Matte pin buckle'], ['Width', '35 mm'], ['Use', 'Formal and casual']],
      shipping: { weight: 0.24, length: 18, width: 14, height: 4, class: 'accessories', cod: true, free: false },
      warranty: null,
      targetRating: 4.1,
      reviewCount: 6,
      imageAccent: '#7c2d12',
      variants: finishVariants([
        { size: '32', color: 'Black', stock: 9 },
        { size: '34', color: 'Black', stock: 10 },
        { size: '36', color: 'Tan', stock: 8 },
      ]),
    },
    {
      key: 'packsmith-laptop-sleeve-15-inch',
      name: 'Packsmith Laptop Sleeve 15-inch',
      brand: 'Packsmith',
      categoryId: 3,
      price: 999,
      mrp: 1399,
      cost: 585,
      badge: 'Value Pick',
      summary: 'Padded laptop sleeve with top zip opening and soft scratch-safe lining.',
      searchTerms: ['laptop sleeve', '15 inch sleeve', 'notebook sleeve'],
      specs: [['Size', 'Fits up to 15.6-inch'], ['Lining', 'Soft brushed lining'], ['Closure', 'Top zip'], ['Carry', 'Slim hand-carry profile']],
      shipping: { weight: 0.29, length: 40, width: 29, height: 3, class: 'accessories', cod: true, free: false },
      warranty: null,
      targetRating: 4.4,
      reviewCount: 8,
      imageAccent: '#1d4ed8',
      variants: finishVariants([
        { color: 'Charcoal', stock: 12 },
        { color: 'Navy', stock: 10 },
      ]),
    },
    {
      key: 'oakline-compact-study-desk',
      name: 'Oakline Compact Study Desk',
      brand: 'Oakline',
      categoryId: 4,
      price: 4299,
      mrp: 5599,
      cost: 2840,
      badge: 'Best Seller',
      summary: 'Compact engineered-wood desk sized for apartments, study corners, and hostels.',
      searchTerms: ['study desk', 'computer table', 'compact desk'],
      specs: [['Top Size', '90 x 45 cm'], ['Material', 'Engineered wood'], ['Load Capacity', '40 kg'], ['Assembly', 'DIY assembly']],
      shipping: { weight: 16.5, length: 96, width: 52, height: 9, class: 'furniture-flatpack', cod: false, free: true },
      warranty: null,
      targetRating: 4.3,
      reviewCount: 9,
      imageAccent: '#7c5a43',
      variants: finishVariants([
        { color: 'Walnut Brown', model: '90 cm', stock: 6 },
        { color: 'Natural Oak', model: '90 cm', stock: 5 },
      ]),
    },
    {
      key: 'oakline-foldable-side-table',
      name: 'Oakline Foldable Side Table',
      brand: 'Oakline',
      categoryId: 4,
      price: 2199,
      mrp: 2899,
      cost: 1440,
      badge: 'Trending',
      summary: 'Handy foldable side table for tea corners, balconies, and laptop overflow space.',
      searchTerms: ['side table', 'foldable table', 'small table'],
      specs: [['Top Size', '45 x 45 cm'], ['Feature', 'Foldable legs'], ['Material', 'Powder-coated metal and wood'], ['Use', 'Balcony and bedside']],
      shipping: { weight: 5.8, length: 50, width: 50, height: 8, class: 'furniture-flatpack', cod: false, free: true },
      warranty: null,
      targetRating: 4.1,
      reviewCount: 6,
      imageAccent: '#8b5e34',
      variants: finishVariants([
        { color: 'Natural Wood', stock: 7 },
        { color: 'Black Walnut', stock: 6 },
      ]),
    },
    {
      key: 'ergonest-mesh-study-chair',
      name: 'ErgoNest Mesh Study Chair',
      brand: 'ErgoNest',
      categoryId: 4,
      price: 5199,
      mrp: 6899,
      cost: 3420,
      badge: 'Best Seller',
      summary: 'Breathable study chair with lumbar support and smooth caster movement.',
      searchTerms: ['study chair', 'office chair', 'mesh chair'],
      specs: [['Backrest', 'Breathable mesh'], ['Support', 'Fixed lumbar support'], ['Seat', 'High-density foam'], ['Mobility', 'Caster wheels']],
      shipping: { weight: 11.2, length: 58, width: 56, height: 28, class: 'furniture-boxed', cod: false, free: true },
      warranty: null,
      targetRating: 4.5,
      reviewCount: 11,
      imageAccent: '#475569',
      variants: finishVariants([
        { color: 'Black', model: 'Standard', stock: 6 },
        { color: 'Grey', model: 'Standard', stock: 5 },
      ]),
    },
    {
      key: 'cedarcraft-4-tier-bookshelf',
      name: 'CedarCraft 4-Tier Bookshelf',
      brand: 'CedarCraft',
      categoryId: 4,
      price: 4999,
      mrp: 6499,
      cost: 3290,
      badge: 'Trending',
      summary: 'Four-tier open bookshelf designed for books, plants, folders, and decor accents.',
      searchTerms: ['bookshelf', 'storage shelf', 'display rack'],
      specs: [['Shelves', '4 open shelves'], ['Material', 'Engineered wood'], ['Finish', 'Scratch-resistant laminate'], ['Use', 'Books and decor']],
      shipping: { weight: 18.4, length: 104, width: 34, height: 10, class: 'furniture-flatpack', cod: false, free: true },
      warranty: null,
      targetRating: 4.2,
      reviewCount: 8,
      imageAccent: '#6b4f3a',
      variants: finishVariants([
        { color: 'Rustic Brown', stock: 5 },
        { color: 'White Oak', stock: 4 },
      ]),
    },
    {
      key: 'hearthlane-entryway-shoe-rack',
      name: 'Hearthlane Entryway Shoe Rack',
      brand: 'Hearthlane',
      categoryId: 4,
      price: 2799,
      mrp: 3599,
      cost: 1850,
      badge: 'Local Pick',
      summary: 'Tiered shoe rack that keeps entryways organized without taking much depth.',
      searchTerms: ['shoe rack', 'entryway storage', 'footwear organizer'],
      specs: [['Capacity', 'Up to 12 pairs'], ['Material', 'Metal frame with shelves'], ['Footprint', 'Slim depth'], ['Use', 'Entryway and hallway']],
      shipping: { weight: 7.6, length: 78, width: 30, height: 8, class: 'furniture-flatpack', cod: false, free: true },
      warranty: null,
      targetRating: 4.0,
      reviewCount: 5,
      imageAccent: '#92400e',
      variants: finishVariants([
        { color: 'Matte Black', stock: 6 },
        { color: 'Walnut and Black', stock: 5 },
      ]),
    },
    {
      key: 'oakline-bedside-table',
      name: 'Oakline Bedside Table',
      brand: 'Oakline',
      categoryId: 4,
      price: 3399,
      mrp: 4299,
      cost: 2235,
      badge: 'Value Pick',
      summary: 'Simple bedside table with one drawer and an open shelf for books and chargers.',
      searchTerms: ['bedside table', 'night stand', 'bedroom side table'],
      specs: [['Storage', '1 drawer and 1 shelf'], ['Material', 'Engineered wood'], ['Handle', 'Cut-out handle'], ['Use', 'Bedroom storage']],
      shipping: { weight: 12.4, length: 52, width: 40, height: 12, class: 'furniture-flatpack', cod: false, free: true },
      warranty: null,
      targetRating: 4.1,
      reviewCount: 6,
      imageAccent: '#7c5a43',
      variants: finishVariants([
        { color: 'Oak White', stock: 5 },
        { color: 'Dark Walnut', stock: 5 },
      ]),
    },
    {
      key: 'ergonest-adjustable-laptop-table',
      name: 'ErgoNest Adjustable Laptop Table',
      brand: 'ErgoNest',
      categoryId: 4,
      price: 2599,
      mrp: 3399,
      cost: 1705,
      badge: 'Trending',
      summary: 'Portable laptop table with adjustable height for sofa work and casual study.',
      searchTerms: ['laptop table', 'bed table', 'adjustable table'],
      specs: [['Height', 'Adjustable'], ['Use', 'Laptop and study'], ['Legs', 'Foldable legs'], ['Top', 'Spill-resistant top']],
      shipping: { weight: 4.8, length: 62, width: 36, height: 8, class: 'furniture-boxed', cod: false, free: true },
      warranty: null,
      targetRating: 4.0,
      reviewCount: 7,
      imageAccent: '#475569',
      variants: finishVariants([
        { color: 'Beech', stock: 7 },
        { color: 'Grey Walnut', stock: 6 },
      ]),
    },
    {
      key: 'cedarcraft-storage-ottoman',
      name: 'CedarCraft Storage Ottoman',
      brand: 'CedarCraft',
      categoryId: 4,
      price: 2899,
      mrp: 3799,
      cost: 1895,
      badge: 'Local Pick',
      summary: 'Soft padded ottoman with hidden storage for throws, toys, and extra living-room clutter.',
      searchTerms: ['ottoman', 'storage stool', 'living room stool'],
      specs: [['Storage', 'Hidden lift-up storage'], ['Top', 'Padded seat'], ['Use', 'Living room or bedroom'], ['Frame', 'Wooden support frame']],
      shipping: { weight: 6.2, length: 46, width: 46, height: 12, class: 'furniture-boxed', cod: false, free: true },
      warranty: null,
      targetRating: 4.2,
      reviewCount: 5,
      imageAccent: '#92400e',
      variants: finishVariants([
        { color: 'Charcoal', stock: 6 },
        { color: 'Beige', stock: 5 },
      ]),
    },
    {
      key: 'hearthlane-dining-stool-set',
      name: 'Hearthlane Dining Stool Set',
      brand: 'Hearthlane',
      categoryId: 4,
      price: 3699,
      mrp: 4699,
      cost: 2430,
      badge: 'Value Pack',
      summary: 'Two-piece stool set for breakfast nooks, balconies, and extra guest seating.',
      searchTerms: ['stool set', 'dining stool', 'compact seating'],
      specs: [['Set Includes', '2 stools'], ['Frame', 'Powder-coated metal'], ['Seat', 'Wood top'], ['Use', 'Indoor seating']],
      shipping: { weight: 9.1, length: 64, width: 34, height: 14, class: 'furniture-boxed', cod: false, free: true },
      warranty: null,
      targetRating: 4.0,
      reviewCount: 5,
      imageAccent: '#6b4f3a',
      variants: finishVariants([
        { color: 'Walnut and Black', stock: 4 },
        { color: 'Natural and White', stock: 4 },
      ]),
    },
    {
      key: 'freshnest-stainless-steel-bottle-1l',
      name: 'FreshNest Stainless Steel Bottle 1L',
      brand: 'FreshNest',
      categoryId: 5,
      price: 749,
      mrp: 999,
      cost: 430,
      badge: 'Best Seller',
      summary: 'Leak-resistant insulated bottle for school bags, office desks, and gym routines.',
      searchTerms: ['water bottle', 'steel bottle', 'insulated bottle'],
      specs: [['Capacity', '1 liter'], ['Body', 'Stainless steel'], ['Insulation', 'Double wall'], ['Cap', 'Leak-resistant cap']],
      shipping: { weight: 0.42, length: 31, width: 8, height: 8, class: 'home-essentials', cod: true, free: false },
      warranty: null,
      targetRating: 4.5,
      reviewCount: 12,
      imageAccent: '#0f766e',
      variants: finishVariants([
        { color: 'Steel Silver', stock: 18 },
        { color: 'Mint Green', stock: 14 },
      ]),
    },
    {
      key: 'freshnest-glass-spice-jar-set',
      name: 'FreshNest Glass Spice Jar Set',
      brand: 'FreshNest',
      categoryId: 5,
      price: 999,
      mrp: 1399,
      cost: 590,
      badge: 'Value Pack',
      summary: 'Kitchen jar set for masalas and seeds with tidy labels and moisture-conscious lids.',
      searchTerms: ['spice jars', 'glass jar set', 'kitchen storage jars'],
      specs: [['Set Includes', '6 jars'], ['Material', 'Glass and steel lids'], ['Use', 'Dry spice storage'], ['Feature', 'Clear visibility']],
      shipping: { weight: 1.4, length: 30, width: 20, height: 10, class: 'home-essentials', cod: true, free: false },
      warranty: null,
      targetRating: 4.2,
      reviewCount: 8,
      imageAccent: '#a16207',
      variants: finishVariants([
        { size: '250 ml', model: 'Set of 6', stock: 10 },
        { size: '350 ml', model: 'Set of 6', stock: 8, priceDelta: 150, mrpDelta: 150, costDelta: 90 },
      ]),
    },
    {
      key: 'homepride-lunch-box-3-compartment',
      name: 'HomePride Lunch Box 3-Compartment',
      brand: 'HomePride',
      categoryId: 5,
      price: 899,
      mrp: 1249,
      cost: 530,
      badge: 'Trending',
      summary: 'Three-compartment lunch box built for office meals and school snacks.',
      searchTerms: ['lunch box', 'tiffin box', 'meal prep lunch box'],
      specs: [['Compartments', '3 compartments'], ['Body', 'Food-grade plastic'], ['Lid', 'Secure clip-lock lid'], ['Use', 'Office and school']],
      shipping: { weight: 0.34, length: 24, width: 18, height: 7, class: 'home-essentials', cod: true, free: false },
      warranty: null,
      targetRating: 4.1,
      reviewCount: 9,
      imageAccent: '#dc2626',
      variants: finishVariants([
        { color: 'Blue', stock: 16 },
        { color: 'Coral', stock: 12 },
      ]),
    },
    {
      key: 'zentrail-yoga-mat',
      name: 'ZenTrail Yoga Mat',
      brand: 'ZenTrail',
      categoryId: 5,
      price: 1399,
      mrp: 1899,
      cost: 820,
      badge: 'Best Seller',
      summary: 'Cushioned yoga mat with carrying strap for home sessions and terrace workouts.',
      searchTerms: ['yoga mat', 'exercise mat', 'fitness mat'],
      specs: [['Thickness', '6 mm'], ['Material', 'Textured TPE'], ['Carry', 'Strap included'], ['Use', 'Yoga and stretching']],
      shipping: { weight: 0.92, length: 62, width: 14, height: 14, class: 'fitness', cod: true, free: true },
      warranty: null,
      targetRating: 4.4,
      reviewCount: 10,
      imageAccent: '#0f766e',
      variants: finishVariants([
        { color: 'Sea Green', stock: 11 },
        { color: 'Plum', stock: 9 },
      ]),
    },
    {
      key: 'tinytales-wooden-building-blocks',
      name: 'TinyTales Wooden Building Blocks',
      brand: 'TinyTales',
      categoryId: 5,
      price: 1199,
      mrp: 1599,
      cost: 700,
      badge: 'Local Pick',
      summary: 'Colorful wooden block set that encourages stacking, sorting, and open-ended play.',
      searchTerms: ['wooden blocks', 'kids toy blocks', 'stacking blocks'],
      specs: [['Pieces', '50 pieces'], ['Material', 'Smooth-finish wood'], ['Age', '3+ years'], ['Use', 'Creative play']],
      shipping: { weight: 0.98, length: 28, width: 20, height: 8, class: 'toys', cod: true, free: false },
      warranty: null,
      targetRating: 4.5,
      reviewCount: 7,
      imageAccent: '#d97706',
      variants: finishVariants([
        { model: '50-piece set', stock: 8 },
        { model: '80-piece set', stock: 6, priceDelta: 400, mrpDelta: 400, costDelta: 240 },
      ]),
    },
    {
      key: 'greenhaven-indoor-planter-set',
      name: 'GreenHaven Indoor Planter Set',
      brand: 'GreenHaven',
      categoryId: 5,
      price: 899,
      mrp: 1299,
      cost: 520,
      badge: 'Trending',
      summary: 'Three-piece planter set sized for herbs, pothos cuttings, and window-sill greens.',
      searchTerms: ['planter set', 'indoor pots', 'small planters'],
      specs: [['Set Includes', '3 planters'], ['Material', 'Matte ceramic finish'], ['Use', 'Indoor plants'], ['Drainage', 'Drain tray included']],
      shipping: { weight: 1.12, length: 30, width: 14, height: 12, class: 'home-essentials', cod: true, free: false },
      warranty: null,
      targetRating: 4.0,
      reviewCount: 6,
      imageAccent: '#15803d',
      variants: finishVariants([
        { color: 'White and Sage', stock: 10 },
        { color: 'Terracotta Mix', stock: 8 },
      ]),
    },
    {
      key: 'kitchenmitra-non-stick-fry-pan-24cm',
      name: 'KitchenMitra Non-Stick Fry Pan 24cm',
      brand: 'KitchenMitra',
      categoryId: 5,
      price: 1099,
      mrp: 1499,
      cost: 645,
      badge: 'Value Pick',
      summary: 'Everyday fry pan with a smooth non-stick coating and cool-touch handle.',
      searchTerms: ['fry pan', 'non stick pan', 'kitchen pan'],
      specs: [['Diameter', '24 cm'], ['Coating', 'PFOA-free non-stick'], ['Handle', 'Stay-cool handle'], ['Use', 'Gas stove compatible']],
      shipping: { weight: 0.92, length: 42, width: 24, height: 6, class: 'kitchenware', cod: true, free: false },
      warranty: null,
      targetRating: 4.1,
      reviewCount: 8,
      imageAccent: '#1f2937',
      variants: finishVariants([
        { size: '24 cm', stock: 10 },
        { size: '28 cm', stock: 8, priceDelta: 250, mrpDelta: 250, costDelta: 150 },
      ]),
    },
    {
      key: 'cleanloop-microfiber-cleaning-cloth-pack',
      name: 'CleanLoop Microfiber Cleaning Cloth Pack',
      brand: 'CleanLoop',
      categoryId: 5,
      price: 349,
      mrp: 499,
      cost: 190,
      badge: 'Value Pack',
      summary: 'Soft microfiber cloth pack useful for kitchen counters, screens, and mirrors.',
      searchTerms: ['microfiber cloth', 'cleaning cloth', 'kitchen cleaning wipes'],
      specs: [['Pack Size', '4 cloths'], ['Material', 'Microfiber'], ['Use', 'Dry and wet cleaning'], ['Finish', 'Lint-free finish']],
      shipping: { weight: 0.16, length: 20, width: 15, height: 2, class: 'home-essentials', cod: true, free: false },
      warranty: null,
      targetRating: 4.0,
      reviewCount: 6,
      imageAccent: '#0284c7',
      variants: finishVariants([
        { model: 'Pack of 4', stock: 24 },
        { model: 'Pack of 8', stock: 18, priceDelta: 180, mrpDelta: 180, costDelta: 105 },
      ]),
    },
    {
      key: 'pawjoy-pet-feeding-bowl-set',
      name: 'PawJoy Pet Feeding Bowl Set',
      brand: 'PawJoy',
      categoryId: 5,
      price: 649,
      mrp: 899,
      cost: 375,
      badge: 'Local Pick',
      summary: 'Dual-bowl feeding set for cats and small dogs with a spill-managing tray base.',
      searchTerms: ['pet bowl', 'feeding bowl set', 'cat dog bowls'],
      specs: [['Set Includes', '2 bowls with tray'], ['Material', 'Food-grade steel bowls'], ['Use', 'Food and water'], ['Base', 'Anti-skid tray']],
      shipping: { weight: 0.38, length: 28, width: 16, height: 5, class: 'home-essentials', cod: true, free: false },
      warranty: null,
      targetRating: 4.3,
      reviewCount: 5,
      imageAccent: '#f97316',
      variants: finishVariants([
        { color: 'Grey', stock: 12 },
        { color: 'Blue', stock: 10 },
      ]),
    },
  ];
}

function buildProductRecord(entry) {
  const description = buildDescription(entry);
  const slug = slugify(entry.name);
  return {
    ...entry,
    slug,
    description,
    shortDescription: entry.summary,
  };
}

async function insertProduct(db, entry, supplierIds, rng) {
  const createdAt = isoDaysAgo(integer(rng, 2, 120), integer(rng, 0, 1200));
  const supplierId = supplierIds[integer(rng, 0, supplierIds.length - 1)];
  const coverFile = `${entry.slug}-cover.svg`;
  const detailFile = `${entry.slug}-detail.svg`;
  const lifestyleFile = `${entry.slug}-lifestyle.svg`;
  const imageUrl = writeSvgAsset(coverFile, buildSvg(entry, 'cover'));
  const detailUrl = writeSvgAsset(detailFile, buildSvg(entry, 'detail'));
  const lifestyleUrl = writeSvgAsset(lifestyleFile, buildSvg(entry, 'lifestyle'));

  const baseSizeOrQuantity = entry.variants[0]?.size || entry.variants[0]?.model || entry.variants[0]?.storage || null;

  const result = await db.run(
    `INSERT INTO products
      (supplier_id, category_id, product_name, brand, description, short_description, slug, cost_price, selling_price, mrp, image_url, size_or_quantity, product_status, badge, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    [
      supplierId,
      entry.categoryId,
      entry.name,
      entry.brand,
      entry.description,
      entry.shortDescription,
      entry.slug,
      entry.cost,
      entry.price,
      entry.mrp,
      imageUrl,
      baseSizeOrQuantity,
      entry.badge || null,
      createdAt,
      createdAt,
    ]
  );

  const productId = result.lastID;

  for (const [index, [name, value]] of entry.specs.entries()) {
    await db.run(
      `INSERT INTO product_attributes (product_id, attribute_name, attribute_value, is_highlight)
       VALUES (?, ?, ?, ?)`,
      [productId, name, value, index < 2 ? 1 : 0]
    );
  }

  if (entry.warranty) {
    await db.run(
      `INSERT INTO product_warranty (product_id, warranty_period, warranty_type, replacement_days, return_days, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        productId,
        entry.warranty.period,
        entry.warranty.type,
        entry.warranty.replacementDays,
        entry.warranty.returnDays,
        entry.warranty.description,
      ]
    );
  }

  if (entry.shipping) {
    await db.run(
      `INSERT INTO product_shipping (product_id, weight, length, width, height, shipping_class, cod_available, free_shipping)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        entry.shipping.weight,
        entry.shipping.length,
        entry.shipping.width,
        entry.shipping.height,
        entry.shipping.class,
        entry.shipping.cod ? 1 : 0,
        entry.shipping.free ? 1 : 0,
      ]
    );
  }

  const generalImages = [
    { url: imageUrl, alt: `${entry.name} front image`, primary: 1 },
    { url: detailUrl, alt: `${entry.name} detail image`, primary: 0 },
    { url: lifestyleUrl, alt: `${entry.name} lifestyle image`, primary: 0 },
  ];

  for (const [position, image] of generalImages.entries()) {
    await db.run(
      `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
       VALUES (?, NULL, 'image', ?, ?, ?, ?)`,
      [productId, image.url, image.alt, position, image.primary]
    );
    await db.run(
      `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
       VALUES (?, ?, ?, ?)`,
      [productId, image.url, image.primary, position]
    );
  }

  const variantIds = [];
  const distinctColors = [];

  for (const [index, option] of entry.variants.entries()) {
    const price = roundMoney(entry.price + (option.priceDelta || 0));
    const cost = roundMoney(entry.cost + (option.costDelta || 0));
    const mrp = roundMoney(entry.mrp + (option.mrpDelta || 0));
    const sku = `${entry.slug.slice(0, 12).toUpperCase().replace(/-/g, '')}-${String(index + 1).padStart(2, '0')}`;
    const variantResult = await db.run(
      `INSERT INTO product_variants
        (product_id, sku, size, color, version, weight, storage, model, barcode, price_override, cost_override, mrp_override, is_default, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        productId,
        sku,
        option.size || null,
        option.color || 'Default',
        option.version || null,
        option.weight || null,
        option.storage || null,
        option.model || null,
        `890${String(productId).padStart(4, '0')}${String(index + 1).padStart(3, '0')}54`,
        price,
        cost,
        mrp,
        index === 0 ? 1 : 0,
        createdAt,
        createdAt,
      ]
    );

    const variantId = variantResult.lastID;
    variantIds.push({
      variantId,
      productId,
      categoryId: entry.categoryId,
      productName: entry.name,
      color: option.color || 'Default',
      size: option.size || null,
      storage: option.storage || null,
      model: option.model || null,
      unitPrice: price,
      stock: option.stock,
    });

    await db.run(
      `INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price, last_restock_date, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
      [variantId, supplierId, option.stock, Math.max(2, Math.min(8, Math.floor(option.stock / 3))), cost, createdAt, createdAt]
    );

    await db.run(
      `INSERT INTO inventory_movements (variant_id, change, reason, created_by, created_at)
       VALUES (?, ?, 'manual_adjustment', 'phase4-seed', ?)`,
      [variantId, option.stock, createdAt]
    );

    if (option.color && !distinctColors.includes(option.color) && distinctColors.length < 2) {
      distinctColors.push(option.color);
      const colorHash = hashText(`${entry.slug}-${option.color}`).slice(0, 6);
      const variantUrl = writeSvgAsset(
        `${entry.slug}-${slugify(option.color)}.svg`,
        buildSvg(entry, 'detail', `#${colorHash}`)
      );
      await db.run(
        `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
         VALUES (?, ?, 'image', ?, ?, ?, 0)`,
        [productId, variantId, variantUrl, `${entry.name} in ${option.color}`, 10 + distinctColors.length]
      );
    }
  }

  return {
    ...entry,
    productId,
    defaultVariantId: variantIds[0].variantId,
    variants: variantIds,
  };
}

async function ensureExistingProductGallery(db) {
  const products = await db.all(`
    SELECT p.product_id, p.product_name, p.brand, p.slug, p.category_id, p.image_url,
           COUNT(DISTINCT pi.image_id) AS image_count,
           COUNT(DISTINCT pm.media_id) AS media_count
    FROM products p
    LEFT JOIN product_images pi ON p.product_id = pi.product_id
    LEFT JOIN product_media pm ON p.product_id = pm.product_id AND pm.media_type = 'image'
    WHERE p.product_status = 'active'
    GROUP BY p.product_id
  `);

  for (const product of products) {
    const productStub = {
      name: product.product_name,
      brand: product.brand || 'Local Seller',
      categoryId: product.category_id,
      summary: `${product.product_name} catalog gallery image`,
    };
    const baseSlug = product.slug || slugify(product.product_name);
    const detailUrl = writeSvgAsset(`${baseSlug}-gallery-detail.svg`, buildSvg(productStub, 'detail'));
    const lifestyleUrl = writeSvgAsset(`${baseSlug}-gallery-lifestyle.svg`, buildSvg(productStub, 'lifestyle'));

    if (!product.media_count) {
      const fallbackCover = product.image_url || writeSvgAsset(`${baseSlug}-gallery-cover.svg`, buildSvg(productStub, 'cover'));
      await db.run(
        `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
         VALUES (?, NULL, 'image', ?, ?, 0, 1)`,
        [product.product_id, fallbackCover, `${product.product_name} cover image`]
      );
    }

    const existingImages = await db.all(
      `SELECT image_url FROM product_images WHERE product_id = ? ORDER BY display_order ASC`,
      [product.product_id]
    );
    const imageSet = new Set(existingImages.map((row) => row.image_url));
    const candidates = [detailUrl, lifestyleUrl];
    let nextOrder = existingImages.length;

    for (const candidate of candidates) {
      if (!imageSet.has(candidate)) {
        await db.run(
          `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
           VALUES (?, ?, 0, ?)`,
          [product.product_id, candidate, nextOrder++]
        );
      }
    }

    const existingMedia = await db.all(
      `SELECT file_path FROM product_media WHERE product_id = ? AND media_type = 'image'`,
      [product.product_id]
    );
    const mediaSet = new Set(existingMedia.map((row) => row.file_path));
    let mediaPosition = existingMedia.length;
    for (const [index, candidate] of candidates.entries()) {
      if (!mediaSet.has(candidate)) {
        await db.run(
          `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
           VALUES (?, NULL, 'image', ?, ?, ?, 0)`,
          [product.product_id, candidate, `${product.product_name} gallery ${index + 1}`, mediaPosition++]
        );
      }
    }
  }
}

function generateReviewRatings(target, count, rng) {
  const ratings = [];
  while (ratings.length < count) {
    const roll = rng();
    let rating = 4;
    if (target >= 4.5) rating = roll < 0.55 ? 5 : roll < 0.92 ? 4 : 3;
    else if (target >= 4.3) rating = roll < 0.42 ? 5 : roll < 0.88 ? 4 : 3;
    else if (target >= 4.1) rating = roll < 0.30 ? 5 : roll < 0.80 ? 4 : 3;
    else rating = roll < 0.18 ? 5 : roll < 0.70 ? 4 : 3;
    ratings.push(rating);
  }
  return ratings;
}

async function seedReviews(db, products, customers, rng) {
  const reviewColumns = await db.all(`PRAGMA table_info(reviews)`);
  const hasUpdatedAt = reviewColumns.some((column) => column.name === 'updated_at');

  for (const product of products) {
    const sampledUsers = [...customers]
      .sort(() => rng() - 0.5)
      .slice(0, Math.min(product.reviewCount, customers.length));
    const ratings = generateReviewRatings(product.targetRating, sampledUsers.length, rng);

    for (const [index, user] of sampledUsers.entries()) {
      const rating = ratings[index];
      const phrase = pick(rng, REVIEW_PHRASES[rating]);
      const reviewText = `${phrase} ${product.summary}`;
      const createdAt = isoDaysAgo(integer(rng, 3, 90), integer(rng, 0, 720));
      if (hasUpdatedAt) {
        await db.run(
          `INSERT INTO reviews (product_id, user_id, rating, comment, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [product.productId, user.user_id, rating, reviewText, createdAt, createdAt]
        );
      } else {
        await db.run(
          `INSERT INTO reviews (product_id, user_id, rating, comment, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [product.productId, user.user_id, rating, reviewText, createdAt]
        );
      }
    }
  }
}

async function loadCatalogForSimulation(db, insertedProducts) {
  const rows = await db.all(`
    SELECT p.product_id, p.product_name, p.category_id, p.brand, p.slug,
           pv.variant_id, pv.size, pv.color, pv.storage, pv.model,
           COALESCE(pv.price_override, p.selling_price) AS unit_price
    FROM products p
    JOIN product_variants pv ON p.product_id = pv.product_id
    WHERE p.product_status = 'active' AND pv.status = 'active'
  `);

  const productMap = new Map();
  for (const row of rows) {
    if (!productMap.has(row.product_id)) {
      productMap.set(row.product_id, {
        productId: row.product_id,
        productName: row.product_name,
        brand: row.brand,
        categoryId: row.category_id,
        slug: row.slug,
        variants: [],
      });
    }
    productMap.get(row.product_id).variants.push({
      variantId: row.variant_id,
      size: row.size,
      color: row.color,
      storage: row.storage,
      model: row.model,
      unitPrice: row.unit_price,
    });
  }

  const byKey = {};
  for (const product of insertedProducts) {
    byKey[product.key] = productMap.get(product.productId);
  }

  const existingRows = await db.all(`
    SELECT p.product_id, p.product_name, p.category_id, p.slug, pv.variant_id,
           COALESCE(pv.price_override, p.selling_price) AS unit_price
    FROM products p
    JOIN product_variants pv ON p.product_id = pv.product_id AND pv.is_default = 1
    WHERE p.product_id IN (2, 3, 4, 8, 9, 13, 14)
  `);

  for (const row of existingRows) {
    byKey[row.slug] = {
      productId: row.product_id,
      productName: row.product_name,
      categoryId: row.category_id,
      slug: row.slug,
      variants: [{ variantId: row.variant_id, unitPrice: row.unit_price }],
    };
  }

  return {
    products: [...productMap.values()],
    byKey,
  };
}

function chooseDefaultVariant(product, rng) {
  return product.variants[integer(rng, 0, product.variants.length - 1)];
}

async function seedOrdersAndAnalytics(db, catalog, customers, rng) {
  const bundles = [
    ['smartberry-airbeat-lite-earbuds', 'voltedge-20w-usb-c-fast-charger', 'voltedge-10000mah-power-bank'],
    ['nexon-spark-5g-smartphone', 'voltedge-20w-usb-c-fast-charger', 'smartberry-airbeat-lite-earbuds'],
    ['oakline-compact-study-desk', 'ergonest-mesh-study-chair', 'novanest-led-study-lamp'],
    ['oakline-classic-study-table-9', 'ergonest-comfort-chair-8', 'novanest-led-study-lamp'],
    ['dailyweave-stretch-polo', 'korastreet-tapered-chino-pants', 'loopcraft-leather-belt'],
    ['trailmax-urban-walk-sneakers', 'trailmax-running-socks-pack'],
    ['packsmith-commuter-backpack', 'packsmith-laptop-sleeve-15-inch', 'pixelroot-hd-webcam'],
    ['freshnest-stainless-steel-bottle-1l', 'homepride-lunch-box-3-compartment'],
    ['zentrail-yoga-mat', 'freshnest-stainless-steel-bottle-1l'],
    ['smartberry-pro-wireless-earbuds-mqv5gcvx', 'smartberry-neckloop-anc-earphones'],
    ['cedarcraft-4-tier-bookshelf', 'cedarcraft-storage-ottoman'],
  ];

  const orderStatuses = ['delivered', 'delivered', 'delivered', 'shipped', 'processing', 'cancelled', 'returned'];
  const paymentMethods = ['COD', 'UPI', 'CARD'];
  const customerAddresses = [
    ['Shivaji Nagar', 'Pune', 'Maharashtra', '411005'],
    ['Bopal', 'Ahmedabad', 'Gujarat', '380058'],
    ['Kondapur', 'Hyderabad', 'Telangana', '500084'],
    ['Indiranagar', 'Bengaluru', 'Karnataka', '560038'],
    ['Anna Nagar', 'Chennai', 'Tamil Nadu', '600040'],
  ];

  let seededOrders = 0;

  for (let orderIndex = 0; orderIndex < 92; orderIndex += 1) {
    const customer = customers[orderIndex % customers.length];
    const bundle = pick(rng, bundles)
      .map((key) => catalog.byKey[key])
      .filter(Boolean);
    if (!bundle.length) continue;

    const itemCount = Math.min(bundle.length, integer(rng, 2, Math.min(3, bundle.length)));
    const selectedProducts = bundle.slice(0, itemCount);
    const selectedAddress = customerAddresses[orderIndex % customerAddresses.length];
    const status = orderStatuses[orderIndex % orderStatuses.length];
    const paymentMethod = paymentMethods[orderIndex % paymentMethods.length];
    const paymentStatus = status === 'cancelled' ? 'failed' : paymentMethod === 'COD' && status !== 'delivered' ? 'pending' : 'paid';
    const placedAt = isoDaysAgo(integer(rng, 4, 110), integer(rng, 0, 1800));
    const sessionId = `seed-p4-order-${String(orderIndex + 1).padStart(4, '0')}`;
    const orderNumber = `P4-${new Date().getFullYear()}-${String(orderIndex + 1).padStart(5, '0')}`;

    let subtotal = 0;
    const orderLines = selectedProducts.map((product) => {
      const variant = chooseDefaultVariant(product, rng);
      const quantity = integer(rng, 1, product.productName.includes('Bottle') || product.productName.includes('Cloth') ? 3 : 2);
      const lineTotal = variant.unitPrice * quantity;
      subtotal += lineTotal;
      return {
        product,
        variant,
        quantity,
        lineTotal,
      };
    });

    const shippingAmount = subtotal >= 1499 ? 0 : 79;
    const taxAmount = roundMoney(subtotal * 0.05);
    const totalAmount = subtotal + shippingAmount + taxAmount;

    const orderResult = await db.run(
      `INSERT INTO orders
        (user_id, order_number, status, payment_method, payment_status, subtotal_amount, shipping_amount, tax_amount, total_amount, customer_name, customer_email, customer_phone, address_line_1, address_line_2, city, state, postal_code, country_code, placed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN', ?, ?)`,
      [
        customer.user_id,
        orderNumber,
        status,
        paymentMethod,
        paymentStatus,
        subtotal,
        shippingAmount,
        taxAmount,
        totalAmount,
        customer.username,
        customer.email,
        `9${String(100000000 + orderIndex).slice(-9)}`,
        `House ${10 + (orderIndex % 25)}, ${selectedAddress[0]}`,
        'Near Local Market',
        selectedAddress[1],
        selectedAddress[2],
        selectedAddress[3],
        placedAt,
        placedAt,
      ]
    );

    const orderId = orderResult.lastID;

    await db.run(
      `INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, 'placed', ?, ?)`,
      [orderId, 'Order placed successfully.', placedAt]
    );

    if (status !== 'cancelled') {
      await db.run(
        `INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, 'processing', ?, ?)`,
        [orderId, 'Order is being prepared by the seller.', placedAt]
      );
    }

    if (status === 'shipped' || status === 'delivered' || status === 'returned') {
      await db.run(
        `INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, 'shipped', ?, ?)`,
        [orderId, 'Order handed over for delivery.', placedAt]
      );
    }

    if (status === 'delivered') {
      await db.run(
        `INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, 'delivered', ?, ?)`,
        [orderId, 'Order delivered to the customer.', placedAt]
      );
    }

    if (status === 'cancelled') {
      await db.run(
        `INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, 'cancelled', ?, ?)`,
        [orderId, 'Order cancelled before dispatch.', placedAt]
      );
    }

    if (status === 'returned') {
      await db.run(
        `INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, 'returned', ?, ?)`,
        [orderId, 'Order returned after delivery.', placedAt]
      );
    }

    for (const line of orderLines) {
      const supplierRow = await db.get(
        `SELECT i.supplier_id
         FROM inventory i
         WHERE i.variant_id = ?`,
        [line.variant.variantId]
      );
      await db.run(
        `INSERT INTO order_items (order_id, variant_id, supplier_id, quantity, unit_price, line_total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, line.variant.variantId, supplierRow.supplier_id, line.quantity, line.variant.unitPrice, line.lineTotal, placedAt]
      );

      if (!['cancelled', 'returned'].includes(status)) {
        await db.run(
          `UPDATE inventory
           SET available_stock = CASE WHEN available_stock >= ? THEN available_stock - ? ELSE available_stock END,
               updated_at = ?
           WHERE variant_id = ?`,
          [line.quantity, line.quantity, placedAt, line.variant.variantId]
        );
        await db.run(
          `INSERT INTO inventory_movements (variant_id, change, reason, created_by, created_at)
           VALUES (?, ?, 'sale', 'phase4-seed', ?)`,
          [line.variant.variantId, -line.quantity, placedAt]
        );
      }
    }

    await db.run(
      `INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'purchase_complete',
        customer.user_id,
        sessionId,
        orderLines[0].product.productId,
        orderLines[0].product.categoryId,
        JSON.stringify({
          order_id: orderId,
          order_number: orderNumber,
          total_amount: totalAmount,
          item_count: orderLines.reduce((sum, line) => sum + line.quantity, 0),
          payment_method: paymentMethod,
        }),
        placedAt,
      ]
    );

    seededOrders += 1;
  }

  return seededOrders;
}

async function seedBrowseTelemetry(db, catalog, customers, rng) {
  const interestGroups = [
    ['smartberry-airbeat-lite-earbuds', 'smartberry-neckloop-anc-earphones', 'voltedge-20w-usb-c-fast-charger', 'voltedge-10000mah-power-bank'],
    ['oakline-compact-study-desk', 'ergonest-mesh-study-chair', 'novanest-led-study-lamp', 'cedarcraft-4-tier-bookshelf'],
    ['dailyweave-essential-crew-tee', 'dailyweave-stretch-polo', 'korastreet-tapered-chino-pants', 'loopcraft-leather-belt'],
    ['trailmax-urban-walk-sneakers', 'trailmax-running-socks-pack', 'packsmith-commuter-backpack'],
    ['freshnest-stainless-steel-bottle-1l', 'homepride-lunch-box-3-compartment', 'zentrail-yoga-mat'],
    ['oakline-classic-study-table-9', 'ergonest-comfort-chair-8', 'smartberry-pro-wireless-earbuds-mqv5gcvx'],
  ];

  for (let sessionIndex = 0; sessionIndex < 240; sessionIndex += 1) {
    const sessionId = `seed-p4-browse-${String(sessionIndex + 1).padStart(4, '0')}`;
    const customer = sessionIndex % 4 === 0 ? null : customers[sessionIndex % customers.length];
    const group = pick(rng, interestGroups)
      .map((key) => catalog.byKey[key])
      .filter(Boolean);
    if (group.length < 2) continue;

    const baseTimestamp = isoDaysAgo(integer(rng, 1, 75), integer(rng, 0, 1400));
    const query = pick(rng, FILTER_QUERIES);
    const firstProduct = group[0];

    await db.run(
      `INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, metadata, created_at)
       VALUES ('search_used', ?, ?, ?, ?, ?, ?)`,
      [
        customer ? customer.user_id : null,
        sessionId,
        firstProduct.productId,
        firstProduct.categoryId,
        JSON.stringify({ query, result_count: integer(rng, 6, 18), sort: pick(rng, ['relevance', 'price_asc', 'rating_desc']), filters: [] }),
        baseTimestamp,
      ]
    );

    if (rng() > 0.55) {
      await db.run(
        `INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, metadata, created_at)
         VALUES ('filter_applied', ?, ?, ?, ?, ?, ?)`,
        [
          customer ? customer.user_id : null,
          sessionId,
          firstProduct.productId,
          firstProduct.categoryId,
          JSON.stringify({ category: CATEGORY_NAMES[firstProduct.categoryId], price_band: pick(rng, ['under_1000', '1000_5000', '5000_plus']) }),
          baseTimestamp,
        ]
      );
    }

    for (const [position, product] of group.entries()) {
      await db.run(
        `INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, metadata, created_at)
         VALUES ('product_view', ?, ?, ?, ?, ?, ?)`,
        [
          customer ? customer.user_id : null,
          sessionId,
          product.productId,
          product.categoryId,
          JSON.stringify({ position: position + 1, source: position === 0 ? 'search_results' : 'co_view_sequence' }),
          baseTimestamp,
        ]
      );
    }

    if (rng() > 0.4) {
      const chosen = pick(rng, group);
      await db.run(
        `INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, metadata, created_at)
         VALUES ('add_to_cart', ?, ?, ?, ?, ?, ?)`,
        [
          customer ? customer.user_id : null,
          sessionId,
          chosen.productId,
          chosen.categoryId,
          JSON.stringify({ quantity: integer(rng, 1, 2), source: 'search_results' }),
          baseTimestamp,
        ]
      );
    }

    if (rng() > 0.65) {
      const chosen = group[group.length - 1];
      await db.run(
        `INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, metadata, created_at)
         VALUES ('recommendation_click', ?, ?, ?, ?, ?, ?)`,
        [
          customer ? customer.user_id : null,
          sessionId,
          chosen.productId,
          chosen.categoryId,
          JSON.stringify({ recommendation_type: 'customers_also_viewed', anchor_product_id: group[0].productId }),
          baseTimestamp,
        ]
      );
    }

    if (rng() > 0.75) {
      const chosen = pick(rng, group);
      await db.run(
        `INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, metadata, created_at)
         VALUES ('wishlist_add', ?, ?, ?, ?, ?, ?)`,
        [
          customer ? customer.user_id : null,
          sessionId,
          chosen.productId,
          chosen.categoryId,
          JSON.stringify({ source: 'product_card' }),
          baseTimestamp,
        ]
      );
    }
  }

  for (let index = 0; index < 36; index += 1) {
    const sessionId = `seed-p4-empty-${String(index + 1).padStart(3, '0')}`;
    await db.run(
      `INSERT INTO analytics_events (event_name, user_id, session_id, product_id, category_id, metadata, created_at)
       VALUES ('no_results_viewed', NULL, ?, NULL, NULL, ?, ?)`,
      [sessionId, JSON.stringify({ query: NO_RESULT_QUERIES[index % NO_RESULT_QUERIES.length] }), isoDaysAgo(integer(rng, 1, 60), integer(rng, 0, 900))]
    );
  }
}

async function summarize(db) {
  const summary = {};
  summary.products = await db.get(`SELECT COUNT(*) AS count FROM products`);
  summary.activeProducts = await db.get(`SELECT COUNT(*) AS count FROM products WHERE product_status = 'active'`);
  summary.variants = await db.get(`SELECT COUNT(*) AS count FROM product_variants WHERE status = 'active'`);
  summary.productImages = await db.get(`SELECT COUNT(*) AS count FROM product_images`);
  summary.productMedia = await db.get(`SELECT COUNT(*) AS count FROM product_media WHERE media_type = 'image'`);
  summary.reviews = await db.get(`SELECT COUNT(*) AS count FROM reviews`);
  summary.orders = await db.get(`SELECT COUNT(*) AS count FROM orders`);
  summary.analyticsEvents = await db.get(`SELECT COUNT(*) AS count FROM analytics_events`);
  return summary;
}

async function main() {
  const rng = mulberry32(4042026);
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

  try {
    const alreadySeeded = await db.get(
      `SELECT product_id FROM products WHERE slug = ? LIMIT 1`,
      ['dailyweave-essential-crew-tee']
    );

    if (alreadySeeded) {
      console.log('Phase 4 discovery dataset already exists. No changes applied.');
      return;
    }

    const backupPath = backupDatabase();
    console.log(`Database backup created at: ${backupPath}`);

    const suppliers = await db.all(`SELECT supplier_id FROM suppliers WHERE supplier_status = 'active' ORDER BY supplier_id`);
    const customers = await db.all(`SELECT user_id, username, email FROM users WHERE role = 'customer' AND status = 'active' ORDER BY user_id`);
    const supplierIds = suppliers.map((row) => row.supplier_id);

    if (!supplierIds.length) {
      throw new Error('No active suppliers found.');
    }
    if (customers.length < 8) {
      throw new Error('Not enough active customers found for review/order generation.');
    }

    const catalog = createCatalog().map(buildProductRecord);
    const insertedProducts = [];

    await db.run('BEGIN TRANSACTION');

    for (const entry of catalog) {
      const inserted = await insertProduct(db, entry, supplierIds, rng);
      insertedProducts.push(inserted);
    }

    await ensureExistingProductGallery(db);
    await seedReviews(db, insertedProducts, customers, rng);

    const simulationCatalog = await loadCatalogForSimulation(db, insertedProducts);
    const seededOrders = await seedOrdersAndAnalytics(db, simulationCatalog, customers, rng);
    await seedBrowseTelemetry(db, simulationCatalog, customers, rng);

    await db.run('COMMIT');

    const summary = await summarize(db);
    console.log(`Seed complete. Orders added: ${seededOrders}`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch (_) {
      // Ignore rollback errors during failure cleanup.
    }
    console.error('Phase 4 discovery dataset seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main();
