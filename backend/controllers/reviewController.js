const path = require('path');
const fs = require('fs');
const { checkReviewEligibility } = require('../services/reviewEligibility');

const createReviewController = (database) => ({
  getReviews: async (req, res) => {
    const { product_id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sort || 'newest';
    const userId = req.userId || null;

    let orderByClause = 'r.created_at DESC';
    if (sortBy === 'oldest') {
      orderByClause = 'r.created_at ASC';
    } else if (sortBy === 'highest') {
      orderByClause = 'r.rating DESC, r.created_at DESC';
    } else if (sortBy === 'lowest') {
      orderByClause = 'r.rating ASC, r.created_at DESC';
    } else if (sortBy === 'helpful') {
      orderByClause = 'r.helpful_count DESC, r.created_at DESC';
    }

    try {
      const [reviews, totalCountObj] = await Promise.all([
        database.all(
          `SELECT r.review_id, r.product_id, r.user_id, r.order_item_id, r.rating, r.title, r.comment, 
                  r.is_verified_purchase, r.helpful_count, r.status, r.created_at, u.username
           FROM reviews r
           JOIN users u ON r.user_id = u.user_id
           WHERE r.product_id = ? AND r.status <> 'hidden'
           ORDER BY ${orderByClause}
           LIMIT ? OFFSET ?`,
          [product_id, limit, offset]
        ),
        database.get(
          `SELECT COUNT(*) as total FROM reviews WHERE product_id = ? AND status <> 'hidden'`,
          [product_id]
        )
      ]);

      const total_count = totalCountObj?.total || 0;
      const has_next = offset + reviews.length < total_count;

      // Populate images and helpful marks for each review
      const enrichedReviews = await Promise.all(
        reviews.map(async (review) => {
          const images = await database.all(
            `SELECT image_id, image_url FROM review_images WHERE review_id = ? ORDER BY created_at ASC`,
            [review.review_id]
          );

          let userMarkedHelpful = false;
          if (userId) {
            const vote = await database.get(
              `SELECT vote_id FROM review_helpful_votes WHERE review_id = ? AND user_id = ?`,
              [review.review_id, userId]
            );
            userMarkedHelpful = !!vote;
          }

          return {
            ...review,
            verified_purchase: !!review.is_verified_purchase,
            images,
            user_marked_helpful: userMarkedHelpful
          };
        })
      );

      res.json({
        reviews: enrichedReviews,
        total_count,
        page,
        limit,
        has_next
      });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  checkEligibility: async (req, res) => {
    const { product_id } = req.params;
    const userId = req.userId;
    try {
      const result = await checkReviewEligibility(database, userId, product_id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  addReview: async (req, res) => {
    const { product_id, order_item_id, rating, title, comment, media_urls } = req.body;
    const userId = req.userId;

    if (!product_id || !order_item_id || !rating) {
      return res.status(400).json({ message: 'Missing product_id, order_item_id or rating' });
    }

    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
    }

    try {
      // 1. Enforce strict eligibility
      const eligibility = await checkReviewEligibility(database, userId, product_id);
      if (!eligibility.eligible) {
        return res.status(403).json({ message: eligibility.message });
      }

      // Verify the specific order_item_id belongs to the unreviewed list
      const matchedItem = eligibility.orderItems.find(item => item.order_item_id === Number(order_item_id));
      if (!matchedItem) {
        return res.status(400).json({ message: 'Invalid or already reviewed order item' });
      }

      await database.run('BEGIN TRANSACTION');

      try {
        // 2. Insert review
        const result = await database.run(
          `INSERT INTO reviews (product_id, user_id, order_item_id, rating, title, comment, is_verified_purchase, status)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'approved')`,
          [product_id, userId, order_item_id, parsedRating, title || null, comment || null]
        );

        const reviewId = result.lastID;

        // 3. Insert images if any
        if (media_urls && Array.isArray(media_urls)) {
          for (const url of media_urls) {
            await database.run(
              `INSERT INTO review_images (review_id, image_url) VALUES (?, ?)`,
              [reviewId, url]
            );
          }
        }

        await database.run('COMMIT');
        res.status(201).json({ message: 'Review submitted successfully', review_id: reviewId });
      } catch (err) {
        await database.run('ROLLBACK');
        throw err;
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  updateReview: async (req, res) => {
    const { review_id } = req.params;
    const { rating, title, comment, media_urls } = req.body;
    const userId = req.userId;

    if (!rating) {
      return res.status(400).json({ message: 'Missing rating' });
    }

    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
    }

    try {
      const existing = await database.get('SELECT * FROM reviews WHERE review_id = ?', [review_id]);
      if (!existing) {
        return res.status(404).json({ message: 'Review not found' });
      }

      // Check ownership
      if (existing.user_id !== userId) {
        return res.status(403).json({ message: 'Access denied: You do not own this review' });
      }

      // Check 7-day edit window limit
      const createdTime = new Date(existing.created_at).getTime();
      const diffMs = Date.now() - createdTime;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      if (diffMs > sevenDaysMs) {
        return res.status(400).json({ message: 'Reviews can only be edited within 7 days of creation.' });
      }

      await database.run('BEGIN TRANSACTION');

      try {
        await database.run(
          `UPDATE reviews
           SET rating = ?, title = ?, comment = ?, updated_at = datetime('now')
           WHERE review_id = ?`,
          [parsedRating, title || null, comment || null, review_id]
        );

        // Re-sync review images
        await database.run('DELETE FROM review_images WHERE review_id = ?', [review_id]);
        if (media_urls && Array.isArray(media_urls)) {
          for (const url of media_urls) {
            await database.run(
              `INSERT INTO review_images (review_id, image_url) VALUES (?, ?)`,
              [review_id, url]
            );
          }
        }

        await database.run('COMMIT');
        res.json({ message: 'Review updated successfully' });
      } catch (err) {
        await database.run('ROLLBACK');
        throw err;
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  deleteReview: async (req, res) => {
    const { review_id } = req.params;
    const userId = req.userId;

    try {
      const existing = await database.get('SELECT * FROM reviews WHERE review_id = ?', [review_id]);
      if (!existing) {
        return res.status(404).json({ message: 'Review not found' });
      }

      // Check ownership
      if (existing.user_id !== userId) {
        return res.status(403).json({ message: 'Access denied: You do not own this review' });
      }

      // Hard delete by owner
      await database.run('DELETE FROM reviews WHERE review_id = ?', [review_id]);
      res.json({ message: 'Review deleted successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  voteHelpful: async (req, res) => {
    const { review_id } = req.params;
    const userId = req.userId;

    try {
      const review = await database.get('SELECT review_id FROM reviews WHERE review_id = ?', [review_id]);
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      await database.run('BEGIN TRANSACTION');

      try {
        const existingVote = await database.get(
          'SELECT vote_id FROM review_helpful_votes WHERE review_id = ? AND user_id = ?',
          [review_id, userId]
        );

        let markedHelpful = false;

        if (existingVote) {
          // Remove vote
          await database.run('DELETE FROM review_helpful_votes WHERE vote_id = ?', [existingVote.vote_id]);
          await database.run('UPDATE reviews SET helpful_count = MAX(0, helpful_count - 1) WHERE review_id = ?', [review_id]);
          markedHelpful = false;
        } else {
          // Add vote
          await database.run(
            'INSERT INTO review_helpful_votes (review_id, user_id) VALUES (?, ?)',
            [review_id, userId]
          );
          await database.run('UPDATE reviews SET helpful_count = helpful_count + 1 WHERE review_id = ?', [review_id]);
          markedHelpful = true;
        }

        await database.run('COMMIT');

        const updated = await database.get('SELECT helpful_count FROM reviews WHERE review_id = ?', [review_id]);
        res.json({
          helpful_count: updated.helpful_count,
          user_marked_helpful: markedHelpful
        });
      } catch (err) {
        await database.run('ROLLBACK');
        throw err;
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  uploadReviewMedia: async (req, res) => {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) {
      return res.status(400).json({ message: 'fileName and fileData are required' });
    }

    try {
      const { validateUploadedFile } = require('../middleware/security');
      let validated;
      try {
        validated = validateUploadedFile(fileName, fileData, ['image']);
      } catch (validationErr) {
        return res.status(400).json({ message: validationErr.message });
      }

      const uploadDir = path.join(__dirname, '../uploads/reviews');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, validated.uniqueName);
      fs.writeFileSync(filePath, validated.buffer);
      
      const relativePath = `/uploads/reviews/${validated.uniqueName}`;
      res.json({ fileUrl: relativePath });
    } catch (err) {
      console.error('[review] uploadReviewMedia:', err.message);
      res.status(500).json({ message: 'Upload error: ' + err.message });
    }
  }
});

module.exports = { createReviewController };
