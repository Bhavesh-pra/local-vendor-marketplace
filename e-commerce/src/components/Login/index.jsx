import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ProductContext from '../../context/ProductContext'; // Adjust path
import './index.css';

function Login() {
  const { setAuthUser } = useContext(ProductContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('http://localhost:3000/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        const { jwtToken, userId, username, role } = await response.json();
        document.cookie = `jwt_token=${jwtToken}; path=/`;
        setAuthUser({ userId, username, role });
        navigate('/');
      } else {
        setError(await response.text());
      }
    } catch {
      setError('Network error');
    }
  };

  return (
    <form onSubmit={handleLogin} className="login-card">
      <h2 className="login-title">Login</h2>
      <input
        type="email"
        className="input"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        className="input"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      {error && <div className="message error">{error}</div>}
      <button type="submit" className="btn primary">Login</button>
      <div className="form-footer">
        Don't have an account? <Link to="/register">Sign in / Create an Account</Link>
      </div>
    </form>
  );
}

export default Login;
