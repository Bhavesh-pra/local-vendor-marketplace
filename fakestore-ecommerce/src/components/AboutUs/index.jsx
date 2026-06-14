import React from "react";
import Header from '../Header';
import "./index.css";

const teamMembers = [
  {
    name: "Bhavesh Prajapati",
    role: "Frontend Developer",
    description:
      "A passionate fresher with strong HTML, CSS, and React skills. Loves crafting clean UI for eCommerce platforms.",
    image: "https://avatars.githubusercontent.com/u/100123456?v=4",
  },
  {
    name: "Shanawaz Shaikh",
    role: "Team Leader",
    description:
      "Learning the ropes of leading teams. Dedicated to building the best team for any challenge.",
    image: "https://avatars.githubusercontent.com/u/100234567?v=4",
  },
  {
    name: "Rahbar Raza",
    role: "UI/UX Designer",
    description:
      "Creative mind with a flair for user-centric designs. Focused on making shopping intuitive and enjoyable.",
    image: "https://avatars.githubusercontent.com/u/100345678?v=4",
  },
  {
    name: "Vijay Kumar Pal",
    role: "Database Developer",
    description:
      "Exploring MongoDB and SQL. Eager to manage structured and scalable product data.",
    image: "https://avatars.githubusercontent.com/u/100456789?v=4",
  },
];

const AboutUs = () => {
  return (
    <div>
      <Header />

      <div className="about-us-banner">
        <h1>ABOUT US</h1>
      </div>

      <div className="about-us">
        <p className="about-description">
          We are a team of enthusiastic freshers, stepping into the world of
          eCommerce with passion and innovation. Our goal is to build a modern,
          user-friendly platform for online shoppers.
        </p>

        <div className="team-section">
          {teamMembers.map((member, index) => (
            <div key={index} className="team-member">
              <img src={member.image} alt={member.name} />
              <h3>{member.name}</h3>
              <p className="role">{member.role}</p>
              <p className="bio">{member.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
