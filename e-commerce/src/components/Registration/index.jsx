import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './index.css';

const Registration = () => {
  const [form, setForm] = useState({
    name: '',
    password: '',
    email: '',
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('http://localhost:3000/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (response.ok) {
        // Optionally auto-login after registration (if backend returns JWT)
        // const { jwtToken } = await response.json();
        // document.cookie = `jwtToken=${jwtToken}; path=/`;
  navigate('/login');
      } else {
        const msg = await response.text();
        setError(msg || 'Registration failed');
      }
    } catch {
      setError('Network error');
    }
  };

  return (
    <div className="reg-wrap">
      <h2>Register</h2>
      <form onSubmit={handleSubmit} className="reg-form">
        <label className="form-label">Name
          <input name="name" className="input" value={form.name} onChange={handleChange} required />
        </label>
        <label className="form-label">Email
          <input name="email" type="email" className="input" value={form.email} onChange={handleChange} required />
        </label>
        <label className="form-label">Password
          <input name="password" type="password" className="input" value={form.password} onChange={handleChange} required />
        </label>
        {error && <div className="message error">{error}</div>}
        <button type="submit" className="btn primary">Register</button>
        <div className="form-footer">Already have an account? <Link to="/login">Login</Link></div>
      </form>
    </div>
  );
};

export default Registration;
