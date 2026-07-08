require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const sendOrderEmail = async (orderNumber, name, email, address, paymentMethod, items, total) => {
  const itemsText = items
    .map(item => `${item.product_name || `Product #${item.product_id}`} — Qty: ${item.quantity} — ₹${item.unit_price}`)
    .join('\n');

  const mailText = `
Order Details:
Order Number: ${orderNumber}
Name: ${name}
Email: ${email}
Address: ${address}
Payment Method: ${paymentMethod}

Purchased Items:
${itemsText}

Total Amount: ₹${total.toFixed(2)}
  `;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.MAIL_RECEIVER || email,
    subject: `New Order Placed - ${orderNumber}`,
    text: mailText,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Order email sent successfully:', info.response);
  } catch (err) {
    console.error('Error sending order email:', err.message);
    throw err; // Re-throw so caller can handle
  }
};

module.exports = { sendOrderEmail };
