import { useEffect, useState, useContext } from "react";
import { useNavigate } from 'react-router-dom';
import { Link } from "react-router-dom";

import Header from "../Header";
import ProductContext from "../../context/ProductContext";
import CartItem from '../CartItem';

import { FaShoppingCart, FaDollarSign } from "react-icons/fa";

import "./index.css";

const Cart = () => {
  const {
    userId,
    productItemList,
    totalCost,
    clearItems,
  } = useContext(ProductContext);

  console.log('User ID in Cart:', userId); // Debug log
  console.log('Product Item List in Cart:', productItemList); // Debug log

  const navigate = useNavigate();

  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  const [prevCarts, setPrevCarts] = useState([]);
  const [loadingPrevCarts, setLoadingPrevCarts] = useState(false);
  const [error, setError] = useState(null);

  // Fetch previous orders for the user
  const fetchUserPrevOrders = async () => {
    if (!userId) return;
    setLoadingPrevCarts(true);
    setError(null);

    const token = getCookie('jwt_token');

    try {
      const ordersRes = await fetch(`http://localhost:3000/orders/my-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!ordersRes.ok) throw new Error('Failed to fetch orders');
      const orders = await ordersRes.json();

      // For each order fetch details
      const ordersWithItems = await Promise.all(
        orders.map(async (ord) => {
          const detailsRes = await fetch(`http://localhost:3000/orders/${ord.order_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const details = detailsRes.ok ? await detailsRes.json() : { items: [] };
          return details;
        })
      );

      setPrevCarts(ordersWithItems);
    } catch (err) {
      setError(err.message || 'Error fetching previous orders');
    }
    setLoadingPrevCarts(false);
  };

  // Refresh prev orders on mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchUserPrevOrders();
    }
  }, [userId]);

  // Handler to create new cart and post all current cart items
  const createNewCartAndAddItems = async () => {
    if (!userId || productItemList.length === 0) return;

    const token = getCookie('jwt_token');

    try {
      // Create new cart
      const createCartRes = await fetch('http://localhost:3000/carts/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({}),
      });
      if (!createCartRes.ok) throw new Error('Failed to create cart');

      const { cart_id } = await createCartRes.json();

      // Add each product item to cart_items with a quantity, default 1 if not available
      await Promise.all(
        productItemList.map(item =>
          fetch('http://localhost:3000/cart-items/', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              cart_id,
              product_id: item.id,
              quantity: item.quantity || 1,
            }),
          })
        )
      );

      fetchUserPrevOrders(); // refresh previous orders
      navigate('/buy-item');

    } catch (err) {
      alert('Error creating order: ' + err.message);
    }
  };

  return (
    <div>
      <Header />
      <div className="cart-bg-container">
        <div className="cart-heading-bar">
          <h1 className="cart">Cart <FaShoppingCart /></h1>
          <button type="button" className="clear-btn" onClick={clearItems}>Clear All</button>
        </div>

        {/* Current Cart Items */}
        {productItemList.length > 0 ? (
          <div>
            <ul className="product-item-list">
              {productItemList.map(each => (
                <CartItem key={each.id} productDetails={each} />
              ))}
            </ul>
            <div className="buy-container">
              <button type="button" className="buy-btn" onClick={createNewCartAndAddItems}>
                <Link to="/buy-item" className="buy-link">
                  Buy All
                </Link>
              </button>
              <h1 className="total-cost">
                Total Cost: ₹{totalCost.toFixed(2)} 
              </h1>
            </div>
          </div>
        ) : (
          <div>
            <img
              src="https://i.pinimg.com/1200x/32/00/dd/3200dda6b6bfe5fdb893476e21f1ef04.jpg"
              alt="Empty cart"
            />
            <p className="note">Return after a while. Till enjoy!</p>
          </div>
        )}

        {/* Previous Carts Section */}
        <div className="previous-carts-section">
          <h2>Your Previous Purchases</h2>
          {loadingPrevCarts ? (
            <p>Loading previous carts...</p>
          ) : error ? (
            <p className="error-message">{error}</p>
          ) : prevCarts.length === 0 ? (
            <p>No previous purchases found.</p>
          ) : (
            prevCarts.map(cart => (
              <div key={cart.order_id || cart.cart_id} className="prev-cart">
                <h3>Order #{cart.order_number || cart.order_id || cart.cart_id}</h3>
                {cart.items && cart.items.length > 0 ? (
                  <ul className="prev-cart-items">
                    {cart.items.map(item => (
                      <li key={item.order_item_id || item.cart_item_id}>
                        {item.product_name || `Product ID: ${item.product_id}`}, Qty: {item.quantity}, Price: ₹{item.unit_price}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No items found for this order.</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Cart;
