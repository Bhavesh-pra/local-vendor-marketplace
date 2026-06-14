import {Link} from "react-router-dom";

import Popup from "reactjs-popup";
import { FaUser } from "react-icons/fa";
import { FaSearch } from "react-icons/fa";
import { FaHeart } from "react-icons/fa";
import { GiHamburgerMenu } from "react-icons/gi";
import { RiCloseLine } from "react-icons/ri";

import './index.css';

const Header = () => {
    const onClickLogout = () => {
        // Simple cookie removal (no library needed!)
        document.cookie = "jwt_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        
        // Simple redirect
        window.location.href = "/login";
    }

    return (
        <nav className="navbar navbar-expand-lg app-nav navbar-light nav-container">
            <div className="profile-slot d-flex align-items-center gap-2">
                <FaUser className="react-icon"/>
                <p className="username">Username</p>
            </div>
            <div className="nav-links">
                <Link className="nav-pill" to="/">Home</Link>
                <Link className="nav-pill" to="/Products">Add Products</Link>
                <Link className="nav-pill" to="/Cart">Cart</Link>
            </div>
            <div className="popup-container">
                <Popup
                    trigger={
                        <button type="button" className="hamburger-btn" aria-label="menu">
                            <GiHamburgerMenu className="react-icon" />
                        </button>
                    }
                    modal
                    className="header-popup"
                >
                    {(close) => (
                        <div className="popup-panel">
                            <button type="button" className="close-btn" onClick={() => close()} aria-label="close">
                                <RiCloseLine />
                            </button>
                            <ul className="menu-list">
                                <li><Link className="menu-btn bg-secondary" to="/Contact">Contact Us</Link></li>
                                <li><Link className="menu-btn bg-secondary" to="/About">About us</Link></li>
                                <li><Link className="menu-btn bg-secondary" to="/Profile">Your Profile</Link></li>
                                <li><button type="button" className="logout-btn btn btn-secondary" onClick={onClickLogout}>Log-out</button></li>
                            </ul>
                            
                        </div>
                    )}
                </Popup>
            </div>
        </nav>
    )
}

export default Header;