require('dotenv').config();
const nodemailer = require('nodemailer');

const getOrderRecipients = () => (
  process.env.ORDER_NOTIFICATION_EMAIL ||
  process.env.MAIL_RECEIVER ||
  process.env.ADMIN_EMAIL ||
  ''
)
  .split(',')
  .map((recipient) => recipient.trim())
  .filter(Boolean);

const createTransporter = () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
};

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toFixed(2)}`;

const sendOrderEmail = async (orderNumber, name, email, address, paymentMethod, items, total, phone = '') => {
  const recipients = getOrderRecipients();
  if (recipients.length === 0) {
    console.warn(`[EmailService] Order email skipped for ${orderNumber}: ORDER_NOTIFICATION_EMAIL/MAIL_RECEIVER is not configured.`);
    return { skipped: true, reason: 'recipient_not_configured' };
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`[EmailService] Order email skipped for ${orderNumber}: GMAIL_USER/GMAIL_PASS is not configured.`);
    return { skipped: true, reason: 'smtp_not_configured' };
  }

  const itemsText = items
    .map((item) => {
      const productName = item.product_name || `Product #${item.product_id}`;
      return `${productName} - Qty: ${item.quantity} - ${formatCurrency(item.unit_price)}`;
    })
    .join('\n');

  const mailText = `
New order received

Order Number: ${orderNumber}
Payment Method: ${paymentMethod}
Total Amount: ${formatCurrency(total)}

Customer:
Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Address: ${address}

Purchased Items:
${itemsText}
  `.trim();

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: recipients,
    replyTo: email,
    subject: `New Order Placed - ${orderNumber}`,
    text: mailText,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('Order email sent successfully:', info.response);
  return info;
};

module.exports = { sendOrderEmail };
