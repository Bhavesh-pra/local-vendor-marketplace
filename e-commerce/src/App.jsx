import React, { Component } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';
import Registration from './components/Registration';
import NotFound from './components/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import AddProducts from './components/AddProducts';
import Cart from './components/Cart';
import AboutUs from './components/AboutUs';
import ContactUs from './components/ContactUs';
import YourProfile from './components/YourProfile';
import ProductItemDetails from './components/ProductItemDetails';
import BuyItems from './components/BuyItems'
import OrderSuccess from './components/OrderSuccess';
import ProductContext from './context/ProductContext';
import './App.css';

class App extends Component {
  state = {
    productItemList: [],
    totalCost: 0,
    userId: Number(localStorage.getItem('userId')) || null,
    username: localStorage.getItem('username') || '',
    role: localStorage.getItem('role') || '',
  };

  addItems = (item) => {
    this.setState((prevState) => {
      const price = parseFloat(item.selling_price || item.price || 0);
      const exists = prevState.productItemList.some(each => each.id === item.id);
      let updatedList;
      let updatedCost;
  
      if (exists) {
        updatedList = prevState.productItemList.filter(each => each.id !== item.id);
        updatedCost = Number(prevState.totalCost) - Number(price);
      } else {
        updatedList = [...prevState.productItemList, item];
        updatedCost = Number(prevState.totalCost) + Number(price);
        console.log(updatedCost)
      }
  
      return {
        productItemList: updatedList,
        totalCost: Number(updatedCost.toFixed(2)),  // win against JS float math issues, 2 decimals
      };
    });
  };
  
  removeItems = (item) => {
    this.setState(prevState => {
      const price = parseFloat(item.selling_price || item.price || 0);
      const updatedList = prevState.productItemList.filter(each => each.id !== item.id);
      const updatedCost = Number(prevState.totalCost) - Number(price);
  
      return {
        productItemList: updatedList,
        totalCost: Number(updatedCost.toFixed(2)),
      };
    });
  };

  clearItems = () => {
    this.setState({
      productItemList: []
    });
  };

  setUserId = (id) => {
    console.log("Setting userId in context:", id);
    this.setState({ userId: id });
  };

  setAuthUser = ({ userId, username, role }) => {
    localStorage.setItem('userId', userId);
    localStorage.setItem('username', username);
    localStorage.setItem('role', role);
    this.setState({ userId, username, role });
  };

  clearAuthUser = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    this.setState({ userId: null, username: '', role: '' });
  };

  render() {
    const contextValue = {
      productItemList: this.state.productItemList,
      totalCost: this.state.totalCost,
      userId: this.state.userId,      // provide userId
      username: this.state.username,
      role: this.state.role,
      setUserId: this.setUserId, 
      setAuthUser: this.setAuthUser,
      clearAuthUser: this.clearAuthUser,
      addItems: this.addItems,
      removeItems: this.removeItems,
      clearItems: this.clearItems,
    };

    return (
      <ProductContext.Provider value={contextValue}>
        <div>
          <Routes>
            <Route path="/login" element={<Login setUserId={this.setUserId} />} />
            <Route path="/register" element={<Registration />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } />
            <Route path="/products" element={
              <ProtectedRoute>
                <AddProducts />
              </ProtectedRoute>
            } />
            <Route path="/cart" element={
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            } />
            <Route path="/about" element={
              <ProtectedRoute>
                <AboutUs />
              </ProtectedRoute>
            } />
            <Route path="/contact" element={
              <ProtectedRoute>
                <ContactUs />
              </ProtectedRoute>
            } />
            <Route path="/products/:id" element={
              <ProtectedRoute>
                <ProductItemDetails />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <YourProfile />
              </ProtectedRoute>
            } />
            <Route path="/buy-item" element={
              <ProtectedRoute>
                <BuyItems />
              </ProtectedRoute>
            } />
            <Route path="/order-success" element={
              <ProtectedRoute>
                <OrderSuccess />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </ProductContext.Provider>
    );
  }
}

export default App;
