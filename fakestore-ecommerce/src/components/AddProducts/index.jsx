import React, { useState } from 'react';
import Header from '../Header';
import './index.css';

const AddProduct = () => {
  const [form, setForm] = useState({
    product_name: '',
    category: '',
    description: '',
    date_of_manufacture: '',
    original_price: '',
    discounted_price: '',
    image_url: '',
    size_or_quantity: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    const token = getCookie('jwt_token');
    console.log('JWT Token:', token); // Debug log
    if (!token) {
      setError('You must be logged in to add products.');
      return;
    }
    if (
      !form.product_name ||
      !form.category ||
      !form.description ||
      !form.date_of_manufacture ||
      !form.original_price ||
      !form.discounted_price ||
      !form.image_url
    ) {
      setError('All fields except size_or_quantity are required.');
      return;
    }
    try {
      const res = await fetch('http://localhost:3000/products/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_name: form.product_name,
          category: form.category,
          description: form.description,
          date_of_manufacture: form.date_of_manufacture,
          original_price: Number(form.original_price),
          discounted_price: Number(form.discounted_price),
          image_url: form.image_url,
          size_or_quantity: form.size_or_quantity || null,
        }),
      });
      if (res.ok) {
        setMessage('Product added successfully!');
        setForm({
          product_name: '',
          category: '',
          description: '',
          date_of_manufacture: '',
          original_price: '',
          discounted_price: '',
          image_url: '',
          size_or_quantity: '',
        });
      } else {
        setError('Could not add product. Check inputs.');
      }
    } catch {
      setError('Network error. Could not add product.');
    }
  };

  return (
    <>
    
    <div className='add-product-container'>
      <Header />
      <div className="add-product-card">
      <h2>Add New Product</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Product Name:
          <input type="text" name="product_name" value={form.product_name} onChange={handleChange} required />
        </label>
        <br />
        <label>
          Category:
          <select name="category" value={form.category} onChange={handleChange} required >
            <option value="">Select a category</option>
            <option value="clothes">Clothes</option>
            <option value="furniture">Furniture</option>
            <option value="electronics">Electronics</option>
            <option value="accessories">Accessories</option>
            <option value="others">Others</option>
          </select>
        </label>
        <br />
        <label>
          Description:
          <textarea name="description" value={form.description} onChange={handleChange} required rows={3} />
        </label>
        <br />
        <label>
          Date of Manufacture:
          <input type="date" name="date_of_manufacture" value={form.date_of_manufacture} onChange={handleChange} required />
        </label>
        <br />
        <label>
          Original Price:
          <input type="number" name="original_price" value={form.original_price} onChange={handleChange} required min="1" />
        </label>
        <br />
        <label>
          Discounted Price:
          <input type="number" name="discounted_price" value={form.discounted_price} onChange={handleChange} required min="0" />
        </label>
        <br />
        <label>
          Image URL:
          <input type="url" name="image_url" value={form.image_url} onChange={handleChange} required placeholder="https://example.com/photo.jpg" />
        </label>
        <br />
        <label>
          Size/Quantity (optional):
          <input type="text" name="size_or_quantity" value={form.size_or_quantity} onChange={handleChange} />
        </label>
        <br />
        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
        <button type="submit" className="btn add-btn">
          Add Product
        </button>
      </form>
    </div>
    </div>
    </>
  );
};

export default AddProduct;
