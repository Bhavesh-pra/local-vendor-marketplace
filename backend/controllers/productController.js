const getFullUrl = (req, filePath) => {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}${filePath}`;
};

const mapReturnPolicy = (type, days) => {
  if (!type) return null;
  return {
    type,
    days,
    message: type === 'returnable'
      ? `${days} Day Returns`
      : type === 'replacement_only'
        ? `${days} Day Replacement`
        : 'Non Returnable'
  };
};

let cachedVocabulary = null;

// Rebuild vocabulary cache
async function rebuildSearchVocabulary(db) {
  try {
    const products = await db.all('SELECT product_name, brand FROM products WHERE product_status = "active"');
    const categories = await db.all('SELECT category_name FROM categories');
    
    const words = new Set();
    const synonyms = ['iphone', 'samsung', 'phone', 'clothes', 'tshirt', 't shirt', 'earbuds', 'earphones', 'mobile', 'cellphone', 'shoes', 'footwear'];
    synonyms.forEach(w => words.add(w.toLowerCase()));

    products.forEach(p => {
      if (p.product_name) {
        p.product_name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).forEach(w => words.add(w));
      }
      if (p.brand) {
        words.add(p.brand.toLowerCase().trim());
      }
    });

    categories.forEach(c => {
      if (c.category_name) {
        c.category_name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).forEach(w => words.add(w));
      }
    });

    cachedVocabulary = Array.from(words).filter(w => w.length >= 4);
  } catch (err) {
    console.error('[productController] rebuildSearchVocabulary error:', err.message);
  }
}

// Levenshtein distance implementation
function levenshteinDistance(s, t) {
  if (!s || !t) return Math.max((s || '').length, (t || '').length);
  const d = [];
  for (let i = 0; i <= s.length; i++) d[i] = [i];
  for (let j = 0; j <= t.length; j++) d[0][j] = j;
  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[s.length][t.length];
}

// Typo correction function
async function getTypoCorrection(db, cleanQuery) {
  if (!cachedVocabulary) {
    await rebuildSearchVocabulary(db);
  }
  if (!cachedVocabulary || cachedVocabulary.length === 0) return null;

  const tokens = cleanQuery.split(' ');
  let corrected = false;
  const correctedTokens = tokens.map(token => {
    // Only correct tokens with length >= 4
    if (token.length < 4) return token;
    if (cachedVocabulary.includes(token)) return token;

    let bestMatch = null;
    let minDistance = 3; // Must be <= 2

    for (const vocab of cachedVocabulary) {
      const dist = levenshteinDistance(token, vocab);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = vocab;
      }
    }

    if (bestMatch && minDistance <= 2) {
      corrected = true;
      return bestMatch;
    }
    return token;
  });

  return corrected ? correctedTokens.join(' ') : null;
}

global.clearSearchVocabularyCache = () => {
  cachedVocabulary = null;
};

const createProductController = (database) => ({
  addProduct: async (request, response) => {
    const {
      product_name,
      brand,
      category,
      supplier_id: bodySupplierId,
      description,
      short_description,
      slug,
      selling_price,
      cost_price,
      mrp,
      badge,
      image_url,
      product_status,
      media,
      variants,
      specifications,
      warranty,
      shipping,
    } = request.body;

    if (request.role !== 'supplier' && request.role !== 'admin') {
      return response.status(403).json({ message: 'Only suppliers or admins may create products' });
    }

    let supplier_id = null;
    const supplierRow = await database.get('SELECT supplier_id FROM suppliers WHERE user_id = ?', [request.userId]);
    if (supplierRow) {
      supplier_id = supplierRow.supplier_id;
    } else if (request.role === 'admin') {
      if (!bodySupplierId) {
        return response.status(400).json({ message: 'Admin must provide a supplier_id in the request body' });
      }
      const validSupplier = await database.get('SELECT supplier_id FROM suppliers WHERE supplier_id = ?', [bodySupplierId]);
      if (!validSupplier) {
        return response.status(400).json({ message: 'Invalid supplier_id' });
      }
      supplier_id = bodySupplierId;
    } else {
      return response.status(400).json({ message: 'Supplier record not found for this user' });
    }

    let catRow = await database.get(
      'SELECT category_id, category_name FROM categories WHERE lower(category_name) = ? OR category_id = ?',
      [String(category || 'others').trim().toLowerCase(), Number(category) || 0]
    );
    let category_id = catRow ? catRow.category_id : 5;
    let category_name = catRow ? catRow.category_name : 'Others';

    try {
      await database.run('BEGIN TRANSACTION');

      const primary_image = media?.cover || image_url || '';
      const base_selling = parseFloat(selling_price || (variants?.[0]?.selling_price ?? 0));
      const base_cost = parseFloat(cost_price || (variants?.[0]?.cost_price ?? base_selling));
      const base_mrp = parseFloat(mrp || (variants?.[0]?.mrp ?? base_selling));

      if (base_selling < 0 || base_cost < 0 || base_mrp < 0) {
        throw new Error('Prices must be non-negative');
      }

      if (base_selling < base_cost) {
        throw new Error('Selling price cannot be less than cost price');
      }

      if (base_mrp < base_selling) {
        throw new Error('MRP cannot be less than selling price');
      }

      // Generate unique slug
      const finalSlug = (slug || product_name).toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

      const status = product_status || 'draft';

      const productQuery = `
        INSERT INTO products
          (supplier_id, category_id, product_name, brand, description, short_description, slug, cost_price, selling_price, mrp, image_url, size_or_quantity, product_status, badge)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const sizeSpec = variants?.[0]?.size || null;

      const productResult = await database.run(productQuery, [
        supplier_id,
        category_id,
        product_name,
        brand || null,
        description,
        short_description || null,
        finalSlug,
        base_cost,
        base_selling,
        base_mrp,
        primary_image,
        sizeSpec,
        status,
        badge || null
      ]);
      const product_id = productResult.lastID;

      // Specifications
      if (specifications && Array.isArray(specifications)) {
        for (const spec of specifications) {
          if (spec.name && spec.value) {
            await database.run(
              `INSERT INTO product_attributes (product_id, attribute_name, attribute_value, is_highlight) VALUES (?, ?, ?, ?)`,
              [product_id, spec.name.trim(), spec.value.trim(), spec.is_highlight ? 1 : 0]
            );
          }
        }
      }

      // Warranty
      if (warranty) {
        await database.run(
          `INSERT INTO product_warranty (product_id, warranty_period, warranty_type, replacement_days, return_days, description)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            product_id,
            warranty.warranty_period || null,
            warranty.warranty_type || null,
            parseInt(warranty.replacement_days || 0, 10),
            parseInt(warranty.return_days || 0, 10),
            warranty.description || null
          ]
        );
      }

      // Shipping
      if (shipping) {
        await database.run(
          `INSERT INTO product_shipping (product_id, weight, length, width, height, shipping_class, cod_available, free_shipping)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product_id,
            shipping.weight !== undefined ? parseFloat(shipping.weight) : null,
            shipping.length !== undefined ? parseFloat(shipping.length) : null,
            shipping.width !== undefined ? parseFloat(shipping.width) : null,
            shipping.height !== undefined ? parseFloat(shipping.height) : null,
            shipping.shipping_class || null,
            shipping.cod_available ? 1 : 0,
            shipping.free_shipping ? 1 : 0
          ]
        );
      }

      // Variants & Inventory
      const insertedVariants = [];
      if (variants && Array.isArray(variants) && variants.length > 0) {
        let isFirst = true;
        for (const v of variants) {
          const catPart = category_name.trim().slice(0, 3).toUpperCase();
          const prodPart = product_name.trim().slice(0, 3).toUpperCase();
          const sizePart = (v.size || 'UNI').trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
          const uniqueSku = v.sku || `${catPart}-${prodPart}-${sizePart}-${Date.now().toString(36)}-${product_id}`;

          const variantResult = await database.run(
            `INSERT INTO product_variants 
              (product_id, sku, size, color, version, weight, storage, model, barcode, price_override, cost_override, mrp_override, is_default, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [
              product_id,
              uniqueSku,
              v.size || null,
              v.color || 'Default',
              v.version || null,
              v.weight || null,
              v.storage || null,
              v.model || null,
              v.barcode || null,
              v.selling_price !== undefined && v.selling_price !== '' ? parseFloat(v.selling_price) : null,
              v.cost_price !== undefined && v.cost_price !== '' ? parseFloat(v.cost_price) : null,
              v.mrp !== undefined && v.mrp !== '' ? parseFloat(v.mrp) : null,
              isFirst ? 1 : 0
            ]
          );
          const variant_id = variantResult.lastID;
          insertedVariants.push({ ...v, variant_id });
          isFirst = false;

          const initialStock = parseInt(v.stock || 0, 10);
          const reorderLevel = parseInt(v.reorder_level || 10, 10);
          const purchaseCost = v.cost_price !== undefined ? parseFloat(v.cost_price) : base_cost;
          await database.run(
            `INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price, last_restock_date)
             VALUES (?, ?, ?, 0, ?, ?, datetime('now'))`,
            [variant_id, supplier_id, initialStock, reorderLevel, purchaseCost]
          );

          if (initialStock > 0) {
            await database.run(
              `INSERT INTO inventory_movements (variant_id, actor_user_id, movement_type, quantity_change, previous_quantity, new_quantity, notes, created_at)
               VALUES (?, ?, 'SUPPLIER_RESTOCK', ?, 0, ?, 'Initial stock on product creation', datetime('now'))`,
              [variant_id, request.userId || 1, initialStock, initialStock]
            );
          }
        }
      } else {
        const catPart = category_name.trim().slice(0, 3).toUpperCase();
        const prodPart = product_name.trim().slice(0, 3).toUpperCase();
        const sku = `${catPart}-${prodPart}-UNI-${product_id}`;

        const variantResult = await database.run(
          `INSERT INTO product_variants (product_id, sku, size, color, price_override, cost_override, mrp_override, is_default, status)
           VALUES (?, ?, NULL, 'Default', ?, ?, ?, 1, 'active')`,
          [product_id, sku, base_selling, base_cost, base_mrp]
        );
        const variant_id = variantResult.lastID;

        await database.run(
          `INSERT INTO inventory (variant_id, supplier_id, available_stock, reserved_stock, reorder_level, purchase_price, last_restock_date)
           VALUES (?, ?, 0, 0, 10, ?, datetime('now'))`,
          [variant_id, supplier_id, base_cost]
        );
      }

      // Media Sync
      let mediaPosition = 0;
      if (primary_image) {
        await database.run(
          `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
           VALUES (?, NULL, 'image', ?, ?, ?, 1)`,
          [product_id, primary_image, media?.coverAlt || 'Cover image', mediaPosition++]
        );
        await database.run(
          `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
           VALUES (?, ?, 1, 0)`,
          [product_id, primary_image]
        );
      }

      if (media?.gallery && Array.isArray(media.gallery)) {
        for (let index = 0; index < media.gallery.length; index++) {
          const img = media.gallery[index];
          const alt = media.galleryAlts?.[index] || 'Gallery image';
          if (img && img !== primary_image) {
            await database.run(
              `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
               VALUES (?, NULL, 'image', ?, ?, ?, 0)`,
              [product_id, img, alt, mediaPosition]
            );
            await database.run(
              `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
               VALUES (?, ?, 0, ?)`,
              [product_id, img, mediaPosition]
            );
            mediaPosition++;
          }
        }
      }

      if (media?.video) {
        await database.run(
          `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
           VALUES (?, NULL, 'video', ?, ?, ?, 0)`,
          [product_id, media.video, media.videoAlt || 'Product video', mediaPosition++]
        );
      }

      if (media?.variantMedia && Array.isArray(media.variantMedia)) {
        for (const vm of media.variantMedia) {
          const targetVar = insertedVariants.find(v => (v.size === vm.size || (!v.size && !vm.size)) && (v.color === vm.color));
          if (targetVar && vm.file_path) {
            await database.run(
              `INSERT INTO product_media (product_id, variant_id, media_type, file_path, alt_text, position, is_primary)
               VALUES (?, ?, 'image', ?, ?, ?, 0)`,
              [product_id, targetVar.variant_id, vm.file_path, vm.alt_text || 'Variant image', mediaPosition++]
            );
          }
        }
      }

      await database.run('COMMIT');
      if (global.clearSearchVocabularyCache) {
        global.clearSearchVocabularyCache();
      }
      response.json({ message: 'Product added successfully', product_id });
    } catch (err) {
      await database.run('ROLLBACK');
      console.error('[productController] addProduct error:', err.message);
      response.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getProducts: async (req, res) => {
    try {
      let {
        q,
        category,
        brand,
        minPrice,
        maxPrice,
        rating,
        stock,
        sort = 'relevance',
        page = 1,
        limit = 10
      } = req.query;

      const pPage = Math.max(1, parseInt(page, 10));
      const pLimit = Math.max(1, parseInt(limit, 10));
      const offset = (pPage - 1) * pLimit;

      const params = [];
      let matchQuery = '';

      // Preserve original query string for telemetry / corrections
      const originalQuery = req.query.q || '';

      // ─── Query Intent Mappings (Hidden Overrides) ───
      let intentOverride = null;
      if (q && q.trim().length > 0) {
        const cleanVal = q.toLowerCase().trim().replace(/\s+/g, ' ');
        if (cleanVal === 'cheap phone' || cleanVal === 'cheap phones') {
          intentOverride = {
            qApplied: 'phone',
            categoryApplied: 'electronics',
            sortApplied: 'price_asc'
          };
        } else if (cleanVal === 'best earbud' || cleanVal === 'best earbuds') {
          intentOverride = {
            qApplied: 'earbuds',
            categoryApplied: 'electronics',
            sortApplied: 'rating_desc'
          };
        } else if (cleanVal === 'popular shoe' || cleanVal === 'popular shoes') {
          intentOverride = {
            qApplied: 'shoes',
            categoryApplied: 'clothes',
            sortApplied: 'popularity'
          };
        }

        if (intentOverride) {
          q = intentOverride.qApplied;
          category = intentOverride.categoryApplied;
          sort = intentOverride.sortApplied;
        }
      }

      if (q && q.trim().length > 0) {
        // Query normalization pipeline
        let cleanQ = q.toLowerCase().trim();
        cleanQ = cleanQ.replace(/[^a-zA-Z0-9\s]/g, '');
        cleanQ = cleanQ.replace(/\s+/g, ' ').trim();

        if (cleanQ.length > 0) {
          const SYNONYMS = {
            cloths: 'clothes',
            tshirt: 't shirt',
            tee: 'tshirt',
            earphones: 'earbuds',
            mobile: 'phone',
            cellphone: 'phone'
          };
          
          let tokens = cleanQ.split(' ');
          tokens = tokens.map(token => SYNONYMS[token] || token);
          
          cleanQ = tokens.join(' ').replace(/\s+/g, ' ').trim();
          tokens = cleanQ.split(' ');
          
          const ftsTokens = tokens.map(token => `${token}*`);
          matchQuery = ftsTokens.join(' AND ');
        }
      }

      // Base query
      let query = `
        SELECT
          p.product_id,
          p.supplier_id,
          p.category_id,
          p.product_name,
          p.brand,
          p.short_description,
          p.slug,
          p.description,
          p.sku,
          p.cost_price,
          p.selling_price,
          p.mrp,
          p.badge,
          p.image_url,
          p.size_or_quantity,
          p.product_status,
          p.created_at,
          p.updated_at,
          p.return_policy_id,
          rp.type as return_policy_type,
          rp.days as return_policy_days,
          c.category_name,
          c.category_name as category,
          IFNULL(AVG(r.rating), 0) as average_rating,
          COUNT(r.review_id) as reviews_count,
          COALESCE(sales.quantity_sold, 0) as sales_qty,
          IFNULL(stock_info.total_stock, 0) as total_stock
      `;

      if (matchQuery) {
        query += `,
          (1.0 - 1.0 / (1.0 + ABS(fts.bm25_score))) as relevance_score,
          CASE WHEN COALESCE(sales.quantity_sold, 0) >= 10 THEN 1.0 ELSE CAST(COALESCE(sales.quantity_sold, 0) AS REAL) / 10.0 END as popularity_score,
          (IFNULL(AVG(r.rating), 0) / 5.0) as rating_score,
          (0.7 * (1.0 - 1.0 / (1.0 + ABS(fts.bm25_score))) +
           0.2 * (CASE WHEN COALESCE(sales.quantity_sold, 0) >= 10 THEN 1.0 ELSE CAST(COALESCE(sales.quantity_sold, 0) AS REAL) / 10.0 END) +
           0.1 * (IFNULL(AVG(r.rating), 0) / 5.0)) as search_score
        `;
      } else {
        query += `,
          0.0 as relevance_score,
          CASE WHEN COALESCE(sales.quantity_sold, 0) >= 10 THEN 1.0 ELSE CAST(COALESCE(sales.quantity_sold, 0) AS REAL) / 10.0 END as popularity_score,
          (IFNULL(AVG(r.rating), 0) / 5.0) as rating_score,
          0.0 as search_score
        `;
      }

      if (matchQuery) {
        query += `
          FROM (
            SELECT product_id, bm25(products_fts) as bm25_score
            FROM products_fts
            WHERE products_fts MATCH ?
            LIMIT -1
          ) fts
          INNER JOIN products p ON fts.product_id = p.product_id
        `;
        params.push(matchQuery);
      } else {
        query += `
          FROM products p
        `;
      }

      query += `
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN reviews r ON p.product_id = r.product_id AND r.status <> 'hidden'
        LEFT JOIN return_policies rp ON p.return_policy_id = rp.policy_id
        LEFT JOIN (
          SELECT pv.product_id, SUM(oi.quantity) as quantity_sold
          FROM order_items oi
          JOIN product_variants pv ON oi.variant_id = pv.variant_id
          GROUP BY pv.product_id
        ) sales ON p.product_id = sales.product_id
        LEFT JOIN (
          SELECT pv.product_id, SUM(i.available_stock) as total_stock
          FROM product_variants pv
          JOIN inventory i ON pv.variant_id = i.variant_id
          WHERE pv.status <> 'archived'
          GROUP BY pv.product_id
        ) stock_info ON p.product_id = stock_info.product_id
        WHERE p.product_status = 'active'
      `;

      // Category filter
      if (category && category !== 'all') {
        if (/^\d+$/.test(category)) {
          query += ` AND p.category_id = ? `;
          params.push(parseInt(category, 10));
        } else {
          query += ` AND (lower(c.category_name) = ? OR lower(c.category_slug) = ?) `;
          params.push(category.toLowerCase(), category.toLowerCase());
        }
      }

      // Brand filter
      if (brand) {
        query += ` AND lower(p.brand) = ? `;
        params.push(brand.toLowerCase());
      }

      // Price filters
      if (minPrice) {
        query += ` AND p.selling_price >= ? `;
        params.push(parseFloat(minPrice));
      }
      if (maxPrice) {
        query += ` AND p.selling_price <= ? `;
        params.push(parseFloat(maxPrice));
      }

      query += ` GROUP BY p.product_id `;

      const havingClauses = [];
      if (rating) {
        havingClauses.push(` average_rating >= ? `);
        params.push(parseFloat(rating));
      }
      if (stock === '1' || stock === 'true') {
        havingClauses.push(` total_stock > 0 `);
      }

      if (havingClauses.length > 0) {
        query += ` HAVING ` + havingClauses.join(' AND ');
      }

      // Sorting
      switch (sort) {
        case 'relevance':
          if (matchQuery) {
            query += ` ORDER BY search_score DESC `;
          } else {
            query += ` ORDER BY sales_qty DESC `;
          }
          break;
        case 'popularity':
          query += ` ORDER BY sales_qty DESC `;
          break;
        case 'newest':
          query += ` ORDER BY p.created_at DESC `;
          break;
        case 'price_asc':
          query += ` ORDER BY p.selling_price ASC `;
          break;
        case 'price_desc':
          query += ` ORDER BY p.selling_price DESC `;
          break;
        case 'rating_desc':
          query += ` ORDER BY average_rating DESC `;
          break;
        case 'discount_desc':
          query += ` ORDER BY (CASE WHEN p.mrp > 0 THEN (p.mrp - p.selling_price) * 1.0 / p.mrp ELSE 0.0 END) DESC `;
          break;
        default:
          query += ` ORDER BY p.product_id ASC `;
          break;
      }

      // To get total count, wrap the base query (excluding pagination limit/offset) in a SELECT COUNT(*) subquery
      let countQuery = `
        SELECT COUNT(*) as total FROM (
          SELECT p.product_id
      `;

      if (matchQuery) {
        countQuery += `
          FROM (
            SELECT product_id
            FROM products_fts
            WHERE products_fts MATCH ?
          ) fts
          INNER JOIN products p ON fts.product_id = p.product_id
        `;
      } else {
        countQuery += `
          FROM products p
        `;
      }

      countQuery += `
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN reviews r ON p.product_id = r.product_id
        LEFT JOIN (
          SELECT pv.product_id, SUM(oi.quantity) as quantity_sold
          FROM order_items oi
          JOIN product_variants pv ON oi.variant_id = pv.variant_id
          GROUP BY pv.product_id
        ) sales ON p.product_id = sales.product_id
        LEFT JOIN (
          SELECT pv.product_id, SUM(i.available_stock) as total_stock
          FROM product_variants pv
          JOIN inventory i ON pv.variant_id = i.variant_id
          WHERE pv.status <> 'archived'
          GROUP BY pv.product_id
        ) stock_info ON p.product_id = stock_info.product_id
        WHERE p.product_status = 'active'
      `;

      // Apply same WHERE conditions to countQuery
      const countParams = [];
      if (matchQuery) {
        countParams.push(matchQuery);
      }

      if (category && category !== 'all') {
        if (/^\d+$/.test(category)) {
          countQuery += ` AND p.category_id = ? `;
          countParams.push(parseInt(category, 10));
        } else {
          countQuery += ` AND (lower(c.category_name) = ? OR lower(c.category_slug) = ?) `;
          countParams.push(category.toLowerCase(), category.toLowerCase());
        }
      }

      if (brand) {
        countQuery += ` AND lower(p.brand) = ? `;
        countParams.push(brand.toLowerCase());
      }

      if (minPrice) {
        countQuery += ` AND p.selling_price >= ? `;
        countParams.push(parseFloat(minPrice));
      }
      if (maxPrice) {
        countQuery += ` AND p.selling_price <= ? `;
        countParams.push(parseFloat(maxPrice));
      }

      countQuery += ` GROUP BY p.product_id `;

      if (havingClauses.length > 0) {
        countQuery += ` HAVING ` + havingClauses.join(' AND ');
      }

      // Add the HAVING parameters
      if (rating) {
        countParams.push(parseFloat(rating));
      }

      countQuery += ` ) `; // Close subquery

      // Pagination
      query += ` LIMIT ? OFFSET ? `;
      params.push(pLimit, offset);

      const [products, totalCountRow] = await Promise.all([
        database.all(query, params),
        database.get(countQuery, countParams)
      ]);

      const total_count = totalCountRow?.total || 0;

      const mapped = products.map(p => ({
        ...p,
        image_url: getFullUrl(req, p.image_url),
        return_policy: mapReturnPolicy(p.return_policy_type, p.return_policy_days)
      }));

      // Calculate brand facets (always showing all brands, even if count is 0)
      let brandFacets = [];
      try {
        let facetQuery = `
          SELECT b.brand as name, COUNT(p.product_id) as count
          FROM (
            SELECT DISTINCT brand 
            FROM products 
            WHERE brand IS NOT NULL AND brand != '' AND product_status = 'active'
          ) b
          LEFT JOIN products p ON b.brand = p.brand 
            AND p.product_status = 'active'
        `;

        const facetParams = [];
        const facetConditions = [];

        if (matchQuery) {
          facetConditions.push(` p.product_id IN (
            SELECT product_id
            FROM products_fts
            WHERE products_fts MATCH ?
          ) `);
          facetParams.push(matchQuery);
        }

        if (category && category !== 'all') {
          if (/^\d+$/.test(category)) {
            facetConditions.push(` p.category_id = ? `);
            facetParams.push(parseInt(category, 10));
          } else {
            facetConditions.push(` p.category_id IN (SELECT category_id FROM categories WHERE lower(category_name) = ? OR lower(category_slug) = ?) `);
            facetParams.push(category.toLowerCase(), category.toLowerCase());
          }
        }

        if (minPrice) {
          facetConditions.push(` p.selling_price >= ? `);
          facetParams.push(parseFloat(minPrice));
        }
        if (maxPrice) {
          facetConditions.push(` p.selling_price <= ? `);
          facetParams.push(parseFloat(maxPrice));
        }

        if (stock === '1' || stock === 'true') {
          facetConditions.push(` p.product_id IN (
            SELECT pv.product_id
            FROM product_variants pv
            JOIN inventory i ON pv.variant_id = i.variant_id
            WHERE pv.status <> 'archived'
            GROUP BY pv.product_id
            HAVING SUM(i.available_stock) > 0
          ) `);
        }

        if (rating) {
          facetConditions.push(` p.product_id IN (
            SELECT product_id
            FROM reviews
            GROUP BY product_id
            HAVING AVG(rating) >= ?
          ) `);
          facetParams.push(parseFloat(rating));
        }

        if (facetConditions.length > 0) {
          facetQuery += ` AND ` + facetConditions.join(' AND ');
        }

        facetQuery += ` GROUP BY b.brand `;

        const facetRows = await database.all(facetQuery, facetParams);
        brandFacets = facetRows.map(row => ({ name: row.name, count: row.count }));
      } catch (facetErr) {
        console.error('[productController] brand facets calculation error:', facetErr);
      }

      // ─── Typo Correction & Trending Recovery ───
      let didYouMean = null;
      let trending = [];

      if (mapped.length === 0 && originalQuery) {
        const cleanOrig = originalQuery.toLowerCase().trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ');
        if (cleanOrig.length > 0) {
          didYouMean = await getTypoCorrection(database, cleanOrig);

          // Fetch trending products excluding matches to original query tokens
          const searchTokens = cleanOrig.split(' ').filter(t => t.length > 0);
          let excludeClauses = '';
          const excludeParams = [];
          searchTokens.forEach(t => {
            excludeClauses += ` AND p.product_name NOT LIKE ? AND p.brand NOT LIKE ? AND p.description NOT LIKE ? `;
            excludeParams.push(`%${t}%`, `%${t}%`, `%${t}%`);
          });

          try {
            const trendingRows = await database.all(`
              SELECT p.product_id, p.product_name, p.selling_price, p.mrp, p.image_url, p.brand, p.category_id,
                     c.category_name, p.badge, p.product_status, IFNULL(stock_info.total_stock, 0) AS total_stock,
                     IFNULL(r.avg_rating, 0.0) AS average_rating,
                     p.return_policy_id, rp.type as return_policy_type, rp.days as return_policy_days,
                     (IFNULL(v.views_count, 0) * 1 +
                      IFNULL(rc.click_count, 0) * 2 +
                      IFNULL(atc.cart_count, 0) * 4 +
                      IFNULL(pur.purchase_count, 0) * 8) AS trending_score
              FROM products p
              LEFT JOIN categories c ON p.category_id = c.category_id
              LEFT JOIN return_policies rp ON p.return_policy_id = rp.policy_id
              LEFT JOIN (
                SELECT pv.product_id, SUM(i.available_stock) as total_stock
                FROM product_variants pv
                JOIN inventory i ON pv.variant_id = i.variant_id
                WHERE pv.status <> 'archived'
                GROUP BY pv.product_id
              ) stock_info ON p.product_id = stock_info.product_id
              LEFT JOIN (
                SELECT product_id, AVG(rating) as avg_rating
                FROM reviews
                GROUP BY product_id
              ) r ON p.product_id = r.product_id
              LEFT JOIN (
                SELECT product_id, COUNT(*) AS views_count 
                FROM analytics_events 
                WHERE event_name = 'product_view' 
                GROUP BY product_id
              ) v ON p.product_id = v.product_id
              LEFT JOIN (
                SELECT product_id, COUNT(*) AS click_count 
                FROM analytics_events 
                WHERE event_name = 'recommendation_click' 
                GROUP BY product_id
              ) rc ON p.product_id = rc.product_id
              LEFT JOIN (
                SELECT product_id, COUNT(*) AS cart_count 
                FROM analytics_events 
                WHERE event_name = 'add_to_cart' 
                GROUP BY product_id
              ) atc ON p.product_id = atc.product_id
              LEFT JOIN (
                SELECT pv.product_id, COUNT(*) AS purchase_count 
                FROM order_items oi
                JOIN product_variants pv ON oi.variant_id = pv.variant_id
                GROUP BY pv.product_id
              ) pur ON p.product_id = pur.product_id
              WHERE p.product_status = 'active'
                ${excludeClauses}
              ORDER BY 
                (IFNULL(stock_info.total_stock, 0) > 0) DESC,
                trending_score DESC
              LIMIT 4
            `, excludeParams);

            trending = trendingRows.map(tp => ({
              product_id: tp.product_id,
              product_name: tp.product_name,
              selling_price: tp.selling_price,
              mrp: tp.mrp,
              image_url: getFullUrl(req, tp.image_url),
              brand: tp.brand,
              category_id: tp.category_id,
              category_name: tp.category_name,
              average_rating: tp.average_rating || 0.0,
              badge: tp.badge || null,
              product_status: tp.product_status,
              total_stock: tp.total_stock,
              return_policy: mapReturnPolicy(tp.return_policy_type, tp.return_policy_days)
            }));
          } catch (trendErr) {
            console.error('[productController] getProducts trending recovery error:', trendErr);
          }
        }
      }

      res.json({
        items: mapped,
        total_count,
        page: pPage,
        limit: pLimit,
        has_next: offset + mapped.length < total_count,
        facets: {
          brands: brandFacets
        },
        intentOverride,
        didYouMean,
        trending
      });
    } catch (err) {
      console.error('[productController] getProducts error:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getProductSuggestions: async (req, res) => {
    try {
      const { q } = req.query;
      
      // Rule: minimum query length = 3 characters
      if (!q || q.trim().length < 3) {
        return res.json([]);
      }

      let cleanQ = q.toLowerCase().trim();
      cleanQ = cleanQ.replace(/[^a-zA-Z0-9\s]/g, '');
      cleanQ = cleanQ.replace(/\s+/g, ' ').trim();

      if (cleanQ.length === 0) {
        return res.json([]);
      }

      const SYNONYMS = {
        cloths: 'clothes',
        tshirt: 't shirt',
        tee: 'tshirt',
        earphones: 'earbuds',
        mobile: 'phone',
        cellphone: 'phone'
      };

      let tokens = cleanQ.split(' ');
      tokens = tokens.map(token => SYNONYMS[token] || token);
      cleanQ = tokens.join(' ').replace(/\s+/g, ' ').trim();
      tokens = cleanQ.split(' ');

      const ftsTokens = tokens.map(token => `${token}*`);
      const matchQuery = ftsTokens.join(' AND ');

      // Query database for all matching products and sales counts
      const products = await database.all(`
        SELECT p.product_name, COALESCE(sales.quantity_sold, 0) AS sales_qty
        FROM products p
        INNER JOIN products_fts fts ON p.product_id = fts.product_id
        LEFT JOIN (
          SELECT pv.product_id, SUM(oi.quantity) as quantity_sold
          FROM order_items oi
          JOIN product_variants pv ON oi.variant_id = pv.variant_id
          GROUP BY pv.product_id
        ) sales ON p.product_id = sales.product_id
        WHERE p.product_status = 'active'
          AND fts.products_fts MATCH ?
      `, [matchQuery]);

      // Query database for categories matching prefix
      const categories = await database.all(`
        SELECT c.category_name, COUNT(oi.order_id) AS sales_qty
        FROM categories c
        LEFT JOIN products p ON c.category_id = p.category_id
        LEFT JOIN product_variants pv ON p.product_id = pv.product_id
        LEFT JOIN order_items oi ON pv.variant_id = oi.variant_id
        WHERE lower(c.category_name) LIKE ?
        GROUP BY c.category_name
        ORDER BY sales_qty DESC
      `, [`${cleanQ}%`]);

      // Query database for brands matching prefix
      const brands = await database.all(`
        SELECT p.brand, COUNT(oi.order_id) AS sales_qty
        FROM products p
        LEFT JOIN product_variants pv ON p.product_id = pv.product_id
        LEFT JOIN order_items oi ON pv.variant_id = oi.variant_id
        WHERE lower(p.brand) LIKE ? AND p.product_status = 'active'
        GROUP BY p.brand
        ORDER BY sales_qty DESC
      `, [`${cleanQ}%`]);

      const suggestionsSet = new Set();

      // ─── Priority 1: Exact prefix product matches ───
      const exactPrefixProducts = products
        .filter(p => p.product_name.toLowerCase().startsWith(cleanQ))
        .sort((a, b) => b.sales_qty - a.sales_qty);

      exactPrefixProducts.forEach(p => suggestionsSet.add(p.product_name));

      // ─── Priority 2: Popular matching product names ───
      const popularProducts = products
        .filter(p => !p.product_name.toLowerCase().startsWith(cleanQ))
        .sort((a, b) => b.sales_qty - a.sales_qty);

      popularProducts.forEach(p => suggestionsSet.add(p.product_name));

      // ─── Priority 3: Popular matching categories ───
      categories.forEach(c => suggestionsSet.add(c.category_name));

      // ─── Priority 4: Popular matching brands ───
      brands.forEach(b => suggestionsSet.add(b.brand));

      const suggestions = Array.from(suggestionsSet).slice(0, 8);
      res.json(suggestions);
    } catch (err) {
      console.error('[productController] getProductSuggestions error:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getProduct: async (req, res) => {
    const { product_id } = req.params;
    try {
      const product = await database.get(
        `SELECT
           p.product_id,
           p.supplier_id,
           p.category_id,
           p.product_name,
           p.brand,
           p.short_description,
           p.slug,
           p.description,
           p.sku,
           p.manufacture_date,
           p.cost_price,
           p.selling_price,
           p.mrp,
           p.badge,
           p.image_url,
           p.size_or_quantity,
           p.product_status,
           p.created_at,
           p.updated_at,
           p.return_policy_id,
           rp.type as return_policy_type,
           rp.days as return_policy_days,
           c.category_name,
           IFNULL(AVG(r.rating), 0) as average_rating,
           COUNT(r.review_id) as reviews_count
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.category_id
         LEFT JOIN reviews r ON p.product_id = r.product_id AND r.status <> 'hidden'
         LEFT JOIN return_policies rp ON p.return_policy_id = rp.policy_id
         WHERE (p.product_id = ? OR p.slug = ?) AND p.product_status <> 'archived'
         GROUP BY p.product_id`,
        [product_id, product_id]
      );
      if (product) {
        // Authenticated check to conditionally expose cost price values
        const authHeader = req.headers['authorization'];
        let role = null;
        if (authHeader) {
          try {
            const jwtToken = authHeader.split(' ')[1];
            const payload = require('jsonwebtoken').verify(jwtToken, process.env.JWT_SECRET || 'HELLO_WORLD');
            role = payload?.role;
          } catch (e) {
            // Ignore verification error for public route
          }
        }
        const isPrivileged = (role === 'admin' || role === 'supplier');

        const baseProduct = {
          ...product,
          return_policy: mapReturnPolicy(product.return_policy_type, product.return_policy_days)
        };
        if (!isPrivileged) {
          delete baseProduct.cost_price;
        }

        const variants = await database.all(
          `SELECT pv.*, 
                  IFNULL(i.available_stock, 0) AS available_stock, 
                  IFNULL(i.reorder_level, 10) AS reorder_level,
                  i.last_restock_date,
                  (SELECT MAX(created_at) FROM inventory_movements WHERE variant_id = pv.variant_id) AS last_movement_date
           FROM product_variants pv 
           LEFT JOIN inventory i ON pv.variant_id = i.variant_id
           WHERE pv.product_id = ? AND pv.status <> 'archived'`,
          [product.product_id]
        );
        const media = await database.all(
          `SELECT media_id, variant_id, media_type, file_path, alt_text, position, is_primary FROM product_media WHERE product_id = ? ORDER BY position`,
          [product.product_id]
        );
        const specifications = await database.all(
          `SELECT attribute_id, attribute_name as name, attribute_value as value, is_highlight FROM product_attributes WHERE product_id = ?`,
          [product.product_id]
        );
        const warranty = await database.get(
          `SELECT warranty_period, warranty_type, replacement_days, return_days, description FROM product_warranty WHERE product_id = ?`,
          [product.product_id]
        );
        const shipping = await database.get(
          `SELECT weight, length, width, height, shipping_class, cod_available, free_shipping FROM product_shipping WHERE product_id = ?`,
          [product.product_id]
        );

        // Related Products queries
        const similarList = await database.all(
          `SELECT p.product_id, p.product_name, p.brand, p.selling_price, p.mrp, p.image_url, p.product_status, p.badge, IFNULL(AVG(r.rating), 0) as average_rating
           FROM products p
           LEFT JOIN reviews r ON p.product_id = r.product_id AND r.status <> 'hidden'
           WHERE p.category_id = ? AND p.product_id <> ? AND p.product_status = 'active'
           GROUP BY p.product_id LIMIT 8`,
          [product.category_id, product.product_id]
        );
        
        const brandList = product.brand ? await database.all(
          `SELECT p.product_id, p.product_name, p.brand, p.selling_price, p.mrp, p.image_url, p.product_status, p.badge, IFNULL(AVG(r.rating), 0) as average_rating
           FROM products p
           LEFT JOIN reviews r ON p.product_id = r.product_id AND r.status <> 'hidden'
           WHERE lower(p.brand) = lower(?) AND p.product_id <> ? AND p.product_status = 'active'
           GROUP BY p.product_id LIMIT 8`,
          [product.brand, product.product_id]
        ) : [];

        const freqBoughtList = await database.all(
          `SELECT p.product_id, p.product_name, p.brand, p.selling_price, p.mrp, p.image_url, p.product_status, p.badge, IFNULL(AVG(r.rating), 0) as average_rating
           FROM products p
           LEFT JOIN reviews r ON p.product_id = r.product_id AND r.status <> 'hidden'
           WHERE p.category_id = ? AND p.product_id <> ? AND p.product_status = 'active'
           GROUP BY p.product_id ORDER BY p.product_id DESC LIMIT 4`,
          [product.category_id, product.product_id]
        );

        const mapRelated = (list) => list.map(item => ({
          ...item,
          image_url: getFullUrl(req, item.image_url)
        }));

        const relatedProducts = {
          similar: mapRelated(similarList),
          brand: mapRelated(brandList),
          frequentlyBought: mapRelated(freqBoughtList)
        };

        const defaultVar = variants.find(v => v.is_default === 1) || variants[0];
        const primaryImage = media.find(m => m.is_primary === 1 && m.media_type === 'image')?.file_path || product.image_url;

        const mappedMedia = media.map(m => ({
          ...m,
          file_path: getFullUrl(req, m.file_path)
        }));

        const mappedVariants = variants.map(v => {
          const selling = v.price_override ?? product.selling_price;
          const mrpVal = v.mrp_override ?? product.mrp;
          const mapped = {
            ...v,
            selling_price: selling,
            mrp: mrpVal,
          };
          if (!isPrivileged) {
            delete mapped.cost_price;
            delete mapped.cost_override;
            delete mapped.reorder_level;
            delete mapped.last_restock_date;
            delete mapped.last_movement_date;
          } else {
            mapped.cost_price = v.cost_override ?? product.cost_price;
          }
          return mapped;
        });

        // legacy_fields mapping
        const legacy = {
          selling_price: defaultVar ? (defaultVar.price_override ?? product.selling_price) : product.selling_price,
          mrp: defaultVar ? (defaultVar.mrp_override ?? product.mrp) : product.mrp,
          image_url: getFullUrl(req, primaryImage),
          size_or_quantity: defaultVar ? defaultVar.size : product.size_or_quantity
        };
        if (isPrivileged) {
          legacy.cost_price = defaultVar ? (defaultVar.cost_override ?? product.cost_price) : product.cost_price;
        }

        const purchaseStats = await database.get(
          `SELECT IFNULL(SUM(oi.quantity), 0) AS count
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.order_id
           WHERE oi.variant_id IN (SELECT variant_id FROM product_variants WHERE product_id = ?)
             AND o.status = 'delivered'`,
          [product.product_id]
        );
        const purchasesCount = purchaseStats?.count || 0;

        const verifiedStats = await database.get(
          `SELECT COUNT(*) AS count
           FROM reviews
           WHERE product_id = ? AND status <> 'hidden' AND is_verified_purchase = 1`,
          [product.product_id]
        );
        const verifiedReviewsCount = verifiedStats?.count || 0;

        const trustMetrics = {
          purchases_count: purchasesCount,
          rating_average: Number(product.average_rating || 0),
          verified_reviews_count: verifiedReviewsCount
        };

        res.json({
          ...baseProduct,
          image_url: getFullUrl(req, product.image_url),
          variants: mappedVariants,
          trust_metrics: trustMetrics,
          media: {
            cover: getFullUrl(req, primaryImage),
            coverAlt: media.find(m => m.is_primary === 1 && m.media_type === 'image')?.alt_text || '',
            gallery: mappedMedia.filter(m => m.is_primary === 0 && m.media_type === 'image' && !m.variant_id).map(m => m.file_path),
            galleryAlts: media.filter(m => m.is_primary === 0 && m.media_type === 'image' && !m.variant_id).map(m => m.alt_text || ''),
            video: getFullUrl(req, media.find(m => m.media_type === 'video')?.file_path || ''),
            videoAlt: media.find(m => m.media_type === 'video')?.alt_text || '',
            variantMedia: mappedMedia.filter(m => m.variant_id !== null).map(m => {
              const matchedVar = variants.find(v => v.variant_id === m.variant_id);
              return {
                size: matchedVar ? matchedVar.size : null,
                color: matchedVar ? matchedVar.color : 'Default',
                file_path: m.file_path,
                alt_text: m.alt_text
              };
            })
          },
          specifications,
          warranty: warranty || null,
          shipping: shipping || null,
          relatedProducts,
          legacy_fields: legacy
        });
      } else {
        res.status(404).json({ message: 'Product not found' });
      }
    } catch (err) {
      console.error('[productController] getProduct error:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getRecommendations: async (req, res) => {
    try {
      const { product_id } = req.params;
      const targetId = parseInt(product_id, 10);

      if (isNaN(targetId)) {
        return res.status(400).json({ message: 'Invalid product_id' });
      }

      // Fetch current product details to use in similarity queries
      const currentProduct = await database.get(
        'SELECT category_id, selling_price, brand FROM products WHERE product_id = ? AND product_status = "active"',
        [targetId]
      );

      if (!currentProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const getFullUrl = (request, filepath) => {
        if (!filepath) return '';
        if (filepath.startsWith('http://') || filepath.startsWith('https://')) return filepath;
        return `${request.protocol}://${request.get('host')}/${filepath.replace(/\\/g, '/')}`;
      };

      // Map products to include legacy fields and full URLs
      const mapProductDetails = async (rows) => {
        if (!rows || rows.length === 0) return [];
        const productIds = rows.map(r => r.product_id);
        const placeholders = productIds.map(() => '?').join(',');
        const policies = await database.all(
          `SELECT p.product_id, rp.type as return_policy_type, rp.days as return_policy_days
           FROM products p
           LEFT JOIN return_policies rp ON p.return_policy_id = rp.policy_id
           WHERE p.product_id IN (${placeholders})`,
          productIds
        );
        const policyMap = new Map(policies.map(item => [item.product_id, item]));

        return rows.map(p => {
          const pol = policyMap.get(p.product_id);
          return {
            product_id: p.product_id,
            product_name: p.product_name,
            selling_price: p.selling_price,
            mrp: p.mrp,
            image_url: getFullUrl(req, p.image_url),
            brand: p.brand,
            category_id: p.category_id,
            category_name: p.category_name,
            average_rating: p.average_rating || 0.0,
            badge: p.badge || null,
            product_status: p.product_status,
            total_stock: p.total_stock,
            return_policy: mapReturnPolicy(pol?.return_policy_type, pol?.return_policy_days)
          };
        });
      };

      // ─── 1. Frequently Bought Together (FBT) ───
      const fbtRows = await database.all(`
        SELECT p.product_id, p.product_name, p.selling_price, p.mrp, p.image_url, p.brand, p.category_id,
               c.category_name, p.badge, p.product_status, IFNULL(stock_info.total_stock, 0) AS total_stock,
               IFNULL(r.avg_rating, 0.0) AS average_rating,
               COUNT(DISTINCT oi2.order_id) AS co_purchase_count
        FROM order_items oi1
        JOIN product_variants pv1 ON oi1.variant_id = pv1.variant_id
        JOIN order_items oi2 ON oi1.order_id = oi2.order_id
        JOIN product_variants pv2 ON oi2.variant_id = pv2.variant_id
        JOIN products p ON pv2.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN (
          SELECT pv.product_id, SUM(i.available_stock) as total_stock
          FROM product_variants pv
          JOIN inventory i ON pv.variant_id = i.variant_id
          WHERE pv.status <> 'archived'
          GROUP BY pv.product_id
        ) stock_info ON p.product_id = stock_info.product_id
        LEFT JOIN (
          SELECT product_id, AVG(rating) as avg_rating
          FROM reviews
          GROUP BY product_id
        ) r ON p.product_id = r.product_id
        WHERE pv1.product_id = ?
          AND p.product_id != ?
          AND p.product_status = 'active'
        GROUP BY p.product_id
        HAVING co_purchase_count >= 3
        ORDER BY co_purchase_count DESC, (IFNULL(stock_info.total_stock, 0) > 0) DESC
        LIMIT 20
      `, [targetId, targetId]);

      // ─── 2. Customers Also Viewed (CAV) ───
      const cavRows = await database.all(`
        SELECT p.product_id, p.product_name, p.selling_price, p.mrp, p.image_url, p.brand, p.category_id,
               c.category_name, p.badge, p.product_status, IFNULL(stock_info.total_stock, 0) AS total_stock,
               IFNULL(r.avg_rating, 0.0) AS average_rating,
               COUNT(DISTINCT ae2.session_id) AS co_view_count
        FROM analytics_events ae1
        JOIN analytics_events ae2 ON ae1.session_id = ae2.session_id
        JOIN products p ON ae2.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN (
          SELECT pv.product_id, SUM(i.available_stock) as total_stock
          FROM product_variants pv
          JOIN inventory i ON pv.variant_id = i.variant_id
          WHERE pv.status <> 'archived'
          GROUP BY pv.product_id
        ) stock_info ON p.product_id = stock_info.product_id
        LEFT JOIN (
          SELECT product_id, AVG(rating) as avg_rating
          FROM reviews
          GROUP BY product_id
        ) r ON p.product_id = r.product_id
        WHERE ae1.event_name = 'product_view'
          AND ae2.event_name = 'product_view'
          AND ae1.product_id = ?
          AND p.product_id != ?
          AND p.product_status = 'active'
        GROUP BY p.product_id
        HAVING co_view_count >= 5
        ORDER BY co_view_count DESC, (IFNULL(stock_info.total_stock, 0) > 0) DESC
        LIMIT 20
      `, [targetId, targetId]);

      // ─── 3. Similar Products ───
      const similarRows = await database.all(`
        SELECT p.product_id, p.product_name, p.selling_price, p.mrp, p.image_url, p.brand, p.category_id,
               c.category_name, p.badge, p.product_status, IFNULL(stock_info.total_stock, 0) AS total_stock,
               IFNULL(r.avg_rating, 0.0) AS average_rating,
               IFNULL(sales.quantity_sold, 0) AS quantity_sold
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN (
          SELECT pv.product_id, SUM(i.available_stock) as total_stock
          FROM product_variants pv
          JOIN inventory i ON pv.variant_id = i.variant_id
          WHERE pv.status <> 'archived'
          GROUP BY pv.product_id
        ) stock_info ON p.product_id = stock_info.product_id
        LEFT JOIN (
          SELECT pv.product_id, SUM(oi.quantity) as quantity_sold
          FROM order_items oi
          JOIN product_variants pv ON oi.variant_id = pv.variant_id
          GROUP BY pv.product_id
        ) sales ON p.product_id = sales.product_id
        LEFT JOIN (
          SELECT product_id, AVG(rating) as avg_rating
          FROM reviews
          GROUP BY product_id
        ) r ON p.product_id = r.product_id
        WHERE p.category_id = ?
          AND p.product_id != ?
          AND p.product_status = 'active'
        ORDER BY 
          (IFNULL(stock_info.total_stock, 0) > 0) DESC,
          ABS(p.selling_price - ?) ASC,
          (CASE WHEN p.brand = ? THEN 0 ELSE 1 END) ASC,
          average_rating DESC,
          quantity_sold DESC
        LIMIT 20
      `, [currentProduct.category_id, targetId, currentProduct.selling_price, currentProduct.brand]);

      // ─── 4. Trending Products ───
      const trendingRows = await database.all(`
        SELECT p.product_id, p.product_name, p.selling_price, p.mrp, p.image_url, p.brand, p.category_id,
               c.category_name, p.badge, p.product_status, IFNULL(stock_info.total_stock, 0) AS total_stock,
               IFNULL(r.avg_rating, 0.0) AS average_rating,
               (IFNULL(v.views_count, 0) * 1 +
                IFNULL(rc.click_count, 0) * 2 +
                IFNULL(atc.cart_count, 0) * 4 +
                IFNULL(pur.purchase_count, 0) * 8) AS trending_score
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN (
          SELECT pv.product_id, SUM(i.available_stock) as total_stock
          FROM product_variants pv
          JOIN inventory i ON pv.variant_id = i.variant_id
          WHERE pv.status <> 'archived'
          GROUP BY pv.product_id
        ) stock_info ON p.product_id = stock_info.product_id
        LEFT JOIN (
          SELECT product_id, AVG(rating) as avg_rating
          FROM reviews
          GROUP BY product_id
        ) r ON p.product_id = r.product_id
        LEFT JOIN (
          SELECT product_id, COUNT(*) AS views_count 
          FROM analytics_events 
          WHERE event_name = 'product_view' 
          GROUP BY product_id
        ) v ON p.product_id = v.product_id
        LEFT JOIN (
          SELECT product_id, COUNT(*) AS click_count 
          FROM analytics_events 
          WHERE event_name = 'recommendation_click' 
          GROUP BY product_id
        ) rc ON p.product_id = rc.product_id
        LEFT JOIN (
          SELECT product_id, COUNT(*) AS cart_count 
          FROM analytics_events 
          WHERE event_name = 'add_to_cart' 
          GROUP BY product_id
        ) atc ON p.product_id = atc.product_id
        LEFT JOIN (
          SELECT pv.product_id, COUNT(*) AS purchase_count 
          FROM order_items oi
          JOIN product_variants pv ON oi.variant_id = pv.variant_id
          GROUP BY pv.product_id
        ) pur ON p.product_id = pur.product_id
        WHERE p.product_status = 'active'
          AND p.product_id != ?
        ORDER BY 
          (IFNULL(stock_info.total_stock, 0) > 0) DESC,
          trending_score DESC
        LIMIT 20
      `, [targetId]);

      const [fbt, cav, similar, trending] = await Promise.all([
        mapProductDetails(fbtRows),
        mapProductDetails(cavRows),
        mapProductDetails(similarRows),
        mapProductDetails(trendingRows)
      ]);

      res.json({
        frequently_bought_together: fbt,
        customers_also_viewed: cav,
        similar_products: similar,
        trending_products: trending
      });
    } catch (err) {
      console.error('[productController] getRecommendations error:', err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },
});

module.exports = { createProductController };
