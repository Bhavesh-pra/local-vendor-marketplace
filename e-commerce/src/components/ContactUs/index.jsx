import React from "react";

import Header from '../Header'

import './index.css';

const ContactUs = () => {
  return (
    <>
    <Header/>
    <div className="contact-page">
      {/* Banner Section */}
      <div className="contact-banner">
        <h1>Contact Us</h1>
      </div>

      {/* Contact Content */}
      <div className="contact-container">
        {/* Left: Contact Form */}
        <div className="contact-form-section">
          <h2>Send Us a Message</h2>
          <form className="contact-form">
            <input type="text" placeholder="Your Name" required />
            <input type="email" placeholder="Your Email" required />
            <textarea placeholder="Your Message" rows="5" required />
            <button type="submit">Send Message</button>
          </form>
        </div>

        {/* Right: Contact Info */}
        <div className="contact-info-section">
          <h2>Get in Touch</h2>
          <p><strong>📍 Address:</strong> 123 Startup Street, Mumbai, India</p>
          <p><strong>📞 Phone:</strong> +91 9876543210</p>
          <p><strong>📧 Email:</strong> support@freshcart.in</p>
          <p><strong>⏰ Working Hours:</strong> Mon - Fri: 10AM - 6PM</p>
          <div className="social-icons">
            <a href="#"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384005.png" alt="Facebook" /></a>
            <a href="#"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384017.png" alt="Twitter" /></a>
            <a href="#"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384014.png" alt="Instagram" /></a>
            <a href="#"><img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" alt="LinkedIn" /></a>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default ContactUs;
