import React from 'react';

const ProductContext = React.createContext({
    productItemList: [],
    totalCost: 0,
    addItems: () => {},
    removeItems: () => {},
    clearItems: () => {},
    setUserId: () => {},
    setAuthUser: () => {},
    clearAuthUser: () => {},
    userId: null,
    username: '',
    role: '',
})

export default ProductContext;
