const getFullUrl = (req, filePath) => {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}${filePath}`;
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
              `INSERT INTO inventory_movements (variant_id, change, reason, created_by)
               VALUES (?, ?, 'manual_adjustment', ?)`,
              [variant_id, initialStock, request.username || 'supplier']
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
      response.json({ message: 'Product added successfully', product_id });
    } catch (err) {
      await database.run('ROLLBACK');
      console.error('[productController] addProduct error:', err.message);
      response.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  getProducts: async (req, res) => {
    try {
      const products = await database.all(`
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
          c.category_name,
          c.category_name as category,
          IFNULL(AVG(r.rating), 0) as average_rating,
          COUNT(r.review_id) as reviews_count
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN reviews r ON p.product_id = r.product_id
        WHERE p.product_status = 'active'
        GROUP BY p.product_id
      `);
      
      const mapped = products.map(p => ({
        ...p,
        image_url: getFullUrl(req, p.image_url)
      }));
      res.json(mapped);
    } catch (err) {
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
           c.category_name,
           IFNULL(AVG(r.rating), 0) as average_rating,
           COUNT(r.review_id) as reviews_count
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.category_id
         LEFT JOIN reviews r ON p.product_id = r.product_id
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

        const baseProduct = { ...product };
        if (!isPrivileged) {
          delete baseProduct.cost_price;
        }

        const variants = await database.all(
          `SELECT pv.*, IFNULL(i.available_stock, 0) AS available_stock, IFNULL(i.reorder_level, 10) AS reorder_level
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
           LEFT JOIN reviews r ON p.product_id = r.product_id
           WHERE p.category_id = ? AND p.product_id <> ? AND p.product_status = 'active'
           GROUP BY p.product_id LIMIT 8`,
          [product.category_id, product.product_id]
        );
        
        const brandList = product.brand ? await database.all(
          `SELECT p.product_id, p.product_name, p.brand, p.selling_price, p.mrp, p.image_url, p.product_status, p.badge, IFNULL(AVG(r.rating), 0) as average_rating
           FROM products p
           LEFT JOIN reviews r ON p.product_id = r.product_id
           WHERE lower(p.brand) = lower(?) AND p.product_id <> ? AND p.product_status = 'active'
           GROUP BY p.product_id LIMIT 8`,
          [product.brand, product.product_id]
        ) : [];

        const freqBoughtList = await database.all(
          `SELECT p.product_id, p.product_name, p.brand, p.selling_price, p.mrp, p.image_url, p.product_status, p.badge, IFNULL(AVG(r.rating), 0) as average_rating
           FROM products p
           LEFT JOIN reviews r ON p.product_id = r.product_id
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

        res.json({
          ...baseProduct,
          image_url: getFullUrl(req, product.image_url),
          variants: mappedVariants,
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
});

module.exports = { createProductController };
