const createReviewController = (database) => ({
  getReviews: async (req, res) => {
    const { product_id } = req.params;
    try {
      const reviews = await database.all(
        `SELECT r.review_id, r.product_id, r.user_id, r.rating, r.comment, r.created_at, u.username
         FROM reviews r
         JOIN users u ON r.user_id = u.user_id
         WHERE r.product_id = ?
         ORDER BY r.created_at DESC`,
        [product_id]
      );
      res.json(reviews);
    } catch (err) {
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  },

  addReview: async (request, response) => {
    const { product_id, comment, rating } = request.body;
    const user_id = request.userId;

    if (!product_id || !rating) {
      response.status(400).json({ message: 'Missing product_id or rating' });
      return;
    }

    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      response.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
      return;
    }

    try {
      const existingReview = await database.get(
        'SELECT review_id FROM reviews WHERE product_id = ? AND user_id = ?',
        [product_id, user_id]
      );

      if (existingReview) {
        await database.run(
          `UPDATE reviews SET rating = ?, comment = ?, updated_at = datetime('now') WHERE review_id = ?`,
          [parsedRating, comment || null, existingReview.review_id]
        );
        response.json({ message: 'Review updated successfully' });
        return;
      }

      await database.run(
        `INSERT INTO reviews (product_id, user_id, rating, comment)
         VALUES (?, ?, ?, ?)`,
        [product_id, user_id, parsedRating, comment || null]
      );
      response.json({ message: 'Review added successfully' });
    } catch (err) {
      response.status(500).json({ message: 'Database error: ' + err.message });
    }
  },
});

module.exports = { createReviewController };
