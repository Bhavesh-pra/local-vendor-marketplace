import Carousel from 'react-bootstrap/Carousel';
import "./index.css"

// You can use any array of image URLs!
const premiumImages = [
  "https://i.pinimg.com/736x/d8/33/fa/d833fa881a0b6f690cb560c32f10ca71.jpg",
  "https://i.pinimg.com/1200x/22/0d/2c/220d2c35673601972c13e24cb818ace2.jpg",
  "https://i.pinimg.com/736x/61/b9/19/61b9198a0449a334dede391d5cb6829d.jpg",
  "https://i.pinimg.com/736x/b1/04/fb/b104fb7758e230ad0ce3b5bcaf78a8da.jpg",
];

const PremiumCardCarousal = () => (
  <Carousel className='carousal-container' interval={2500} pause={false}>
    {premiumImages.map((img, idx) => (
      <Carousel.Item key={idx}>
        <img
          src={img}
          alt={`Premium Slide ${idx}`}
          className="d-block carousal-image "
          style={{ maxHeight: "220px", objectFit: "cover", borderRadius: "10px" }}
        />
      </Carousel.Item>
    ))}
  </Carousel>
);

export default PremiumCardCarousal;
