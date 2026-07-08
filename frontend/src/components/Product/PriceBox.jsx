import './PriceBox.css';

export default function PriceBox({ price, mrp }) {
  const sellingPrice = parseFloat(price || 0);
  const mrpVal = parseFloat(mrp || 0);

  const hasDiscount = mrpVal > sellingPrice;
  const discountPct = hasDiscount ? Math.round(((mrpVal - sellingPrice) / mrpVal) * 100) : 0;

  return (
    <div className="price-box-container">
      <div className="price-selling">₹{sellingPrice.toLocaleString('en-IN')}</div>
      {hasDiscount && (
        <>
          <div className="price-mrp">₹{mrpVal.toLocaleString('en-IN')}</div>
          <div className="price-discount">{discountPct}% OFF</div>
        </>
      )}
    </div>
  );
}
