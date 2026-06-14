import React from 'react';

const ProductContext = React.createContext({
    productItemList: [],
    totalCost: 0,
    addItems: () => {},
    removeItems: () => {},
    clearItems: () => {},
    setUserId: () => {},
    userId: null,
})

export default ProductContext;
