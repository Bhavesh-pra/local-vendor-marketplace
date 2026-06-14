import { Link } from 'react-router-dom';
import { FaStar } from "react-icons/fa";
import './index.css';

const ProductsItem = props => {
    const { productDetails } = props;
    const {
      id,
      title,
      productImage,
      price,           // original price
      discountedPrice, // discounted price
      rating,
      purchased
    } = productDetails;

    // Renders star rating with filled and empty stars
    const renderStars = () => {
      const stars = [];
      for (let i = 1; i <= 5; i++) {
        stars.push(
          <FaStar
            key={i}
            size={16}
            color={i <= rating ? '#fbbc04' : '#ccc'} // gold or gray
            style={{ marginRight: 2 }}
          />
        );
      }
      return stars;
    };

    return (
        <li className='product-item'>
            <div className="product-item-inner">
                <div className='image-container'>
                <img
                    src={productImage}
                    alt="product"
                    className="product-image"
                    onError={e => { e.target.onerror = null; e.target.src = '/fallback-image.png'; }}
                />
                </div>
                <div className='product-item-details'>
                    <h1 className='product-title'>{title}</h1>

                    <p className='product-price'>
                      Price: ₹ <span className="price-strike">{price}</span>  {/* original price struck through */}
                    </p>
                    <p className='product-discounted-price'>
                      Discounted Price:₹ {discountedPrice}  {/* discounted price */}
                    </p>

                    <p className='product-rating'>
                      {renderStars()}
                      <span>{' '}({rating})</span>
                    </p>

                    <Link to={`/products/${id}`}>
                        <button type="button">View Product</button>
                    </Link>
                </div>
            </div>
        </li>
    );
};

export default ProductsItem;
