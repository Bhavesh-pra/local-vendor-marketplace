import { Component } from "react";

import ProductsItem from '../ProductsItem'
import { FaSearch } from "react-icons/fa";
import { IoClose } from "react-icons/io5";

import PremiumCardCarousal from '../PremiumCardCarousal'

import Header from '../Header'

import './index.css';

const pageState = {
  initial: "INITIAL",
  processing: "PROCESSING",
  success: "SUCCESS",
  failed: "FAILED",
}

const categoryList = [
  {
    categoryId: "",
    categoryName: "All"
  },
  {
    categoryId: "CLOTHES",
    categoryName: "Clothes",
  },
  {
    categoryId: "FURNITURE",
    categoryName: "Furniture",
  },
  {
    categoryId: "ACCESSORIES",
    categoryName: "Accessories",
  },
  {
    categoryId: "ELECTRONICS",
    categoryName: "Electronics",
  },
  {
    categoryId: "OTHERS",
    categoryName: "Others"
  }
]

const filterList = [
  {
    filterId: "LOWT TO HIGH",
    filterName: "Low to High",
  },
  {
    filterId: "HIGH TO LOW",
    filterName: "High to Low",
  },
  {
    filterId: "ABOVE 4 STARS",
    filterName: "Above 4 stars"
  }
]

class Home extends Component {
  state =  {
    activePageState : pageState.initial,
    searchInput: '',
    productItemList: [],
    showPremiumCard: true,
    activeCategoryTab: '',
    activeFilterTab: '',
  }

  componentDidMount(){
    this.getProductList()
  }

  getProductList = async () => {
  this.setState({ activePageState: pageState.processing });

  const url = "http://localhost:3000/products/";

  const response = await fetch(url);

  if (response.ok) {
    const data = await response.json();

    const updatedData = data.map(product => ({
      id: product.product_id,
      category: product.category,
      description: product.description,
      productImage: product.image_url,
      price: product.original_price,
      discountedPrice: product.discounted_price,
      title: product.product_name,
      rating: Math.round(product.average_rating),
      purchased: 0
    }));

    this.setState({
      productItemList: updatedData,
      activePageState: pageState.success,
    });
  } else {
    this.setState({ activePageState: pageState.failed });
  }
};



  renderProcessingView = () => (
    <div>
      <h1>Loading...</h1>
    </div>
  )

  renderFailedView = () => (
    <div>
      <img src="https://i.pinimg.com/1200x/50/18/04/501804bef82c15e6c41e7d26c207a77b.jpg" alt="ERROR!" className="error-img" />
      <h1>Oops! Something Went Wrong</h1>
      <p>Please try again later.</p>
      <button type="button" onClick={() => this.getProductList()}>Retry</button>
    </div>
  )

  onChangeInput = event => {
    this.setState({searchInput: event.target.value})
  }

  onSelectCategory = categoryId => {
    this.setState({activeCategoryTab: categoryId})
  }

  onChangeFilter = event => {
    this.setState({activeFilterTab: event.target.value})
  }

  onSearchProduct = () => {
    // noop for now: search is already reactive via onChangeInput
    return
  }

  removePremium = () => {
    this.setState({showPremiumCard: false})
  }

  renderSuccessView = () => {
    const {searchInput, productItemList, showPremiumCard, activeCategoryTab, activeFilterTab} = this.state

    let filteredList = productItemList.filter(each =>
      each.title.toLowerCase().includes(searchInput.toLowerCase())
    )

    // Filter by category if selected
    if (activeCategoryTab) {
      filteredList = filteredList.filter(each => (each.category || '').toUpperCase() === activeCategoryTab)
    }

    // Apply sorting / filter
    if (activeFilterTab === 'LOWT TO HIGH') {
      filteredList = filteredList.slice().sort((a, b) => a.price - b.price)
    } else if (activeFilterTab === 'HIGH TO LOW') {
      filteredList = filteredList.slice().sort((a, b) => b.price - a.price)
    } else if (activeFilterTab === 'ABOVE 4 STARS') {
      filteredList = filteredList.filter(item => (item.rating || 0) >= 4)
    }
    

    return (
      <div className="home-container">
        <div>
          {showPremiumCard && (
            <div className="premium-card">
            <div className="premium-card-details">
              <h1>Get Premium</h1>
              <p>Get early and free delivery on every order.</p>
              <button type="button">Coming Soon!</button>
            </div>
            <button type="button" className="close-btn" onClick={this.removePremium}>
            <IoClose className="close-icon"/> 
            </button>
          </div>
          )}
          <div>
            <PremiumCardCarousal/>
          </div>
        </div>
          <div className="search-container">
            <input type="text" onChange={this.onChangeInput} value={searchInput} placeholder="Search" />
            <button type="button" onClick={this.onSearchProduct}><FaSearch/></button>
            <p className="item-count">Items: {filteredList.length}</p>
          </div>
          {/* Category tabs and filter select */}
          <div className="filters-row">
            <div className="category-tabs">
              {categoryList.map(cat => (
                <button
                  key={cat.categoryId || 'all'}
                  type="button"
                  className={`category-tab ${this.state.activeCategoryTab === cat.categoryId ? 'active' : ''}`}
                  onClick={() => this.onSelectCategory(cat.categoryId)}
                >
                  {cat.categoryName}
                </button>
              ))}
            </div>

            <div className="filter-select">
              <label htmlFor="filter" className="sort-text">Sort / Filter:</label>
              <select id="filter" value={this.state.activeFilterTab} onChange={this.onChangeFilter}>
                <option value="">None</option>
                {filterList.map(f => (
                  <option key={f.filterId} value={f.filterId}>{f.filterName}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <ul className="product-item-container">
              {filteredList.map(each => <ProductsItem key={each.id} productDetails={each} />)}
            </ul>
          </div>

      </div>
    )
  }

  renderApplication = () => {
    const {activePageState} = this.state
    switch (activePageState){
      case pageState.initial:
        return this.renderProcessingView()
      case pageState.success:
        return this.renderSuccessView()
      case pageState.failed:
        return this.renderFailedView()
      default:
        return null
    }

  }

  render(){
    return (
      <div>
        <Header />
        {this.renderApplication()}
      </div>
    )
  }
}

export default Home;