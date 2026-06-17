import { Link } from "react-router-dom";
import ProductContext from "../../context/ProductContext";
import { FiMinus } from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import { FaDollarSign } from "react-icons/fa";

import './index.css'

const CartItem = props => {
    const {productDetails} = props
    const {id, title, rating, mainImage, price} = productDetails

    return (
        <ProductContext.Consumer>
            {
                value => {
                    const {removeItems} = value

                    const onClickRemoveFromCart = () => {
                        removeItems(productDetails)
                    }

                    return (
                        <div className="cart-item-container">
                            <div className="image-container">
                                <Link to={`/products/${id}`}>
                                    <img src={mainImage} alt="product" className="item-img" />
                                </Link>
                            </div>
                            <div className="details-container">
                                <p className="title">{title}</p>
                                <p className="price">{price} <FaDollarSign/></p>
                                <p className="rating">{rating} <FaStar/></p>
                            </div>
                            <div className="remove-btn-container">
                                <button type="button" className="remove-btn" onClick={onClickRemoveFromCart}><FiMinus/></button>
                            </div>
                        </div>
                    )
                }
            }
        </ProductContext.Consumer>
    )
}

export default CartItem
