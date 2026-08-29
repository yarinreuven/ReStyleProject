import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import usePageStyles from "../hooks/usePageStyles";
import InformationHeader from "../components/InformationHeader";
import { API_BASE_URL } from "../config/api";

const CONTACT_URL = `${API_BASE_URL}/public/contact`;

export default function Contact() {
  usePageStyles("info-pages.css");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    axios.get(CONTACT_URL).then(({ data }) => {
      if (active) setEmail(data.email || "");
    }).catch(() => {
      if (active) setError("Our contact address is temporarily unavailable. Please try again later.");
    });
    return () => { active = false; };
  }, []);

  const mailto = email ? `mailto:${email}?subject=${encodeURIComponent("ReStyle support request")}` : "";

  return (
    <main className="info-page">
      <InformationHeader />
      <section className="contact-layout">
        <div className="contact-visual">
          <img src="/images/about-smart-wardrobe.png" alt="A woman choosing clothes from her organized personal wardrobe" />
          <div className="contact-visual-copy"><h2>Tell us how we can help.</h2><p>A clear description and the name of the screen you were using will help us understand the issue.</p></div>
        </div>
        <div className="contact-copy">
          <span className="info-eyebrow">CONTACT RESTYLE</span>
          <h1>We are here to help.</h1>
          <p>Contact us about your account, wardrobe, virtual try-ons, ReStyle Studio, Marketplace, Sandbox payments or general feedback.</p>
          <section className="contact-card">
            <div className="contact-card-header"><div className="contact-icon"><i className="fa-regular fa-envelope" /></div><div><span className="info-eyebrow">EMAIL SUPPORT</span><h2>Send us a message</h2></div></div>
            <p>Explain what happened and include any useful details. We will reply to the email address you contact us from.</p>
            {email ? <><a className="contact-email" href={mailto}>{email}</a><a className="info-primary-link" href={mailto}>Open email app <i className="fa-solid fa-arrow-up-right-from-square" /></a></> : error ? <p className="contact-error" role="alert">{error}</p> : <p className="contact-loading">Loading contact details...</p>}
            <div className="contact-safety"><i className="fa-solid fa-shield-halved" /><p>For your safety, never email passwords, verification codes, PayPal credentials or full payment details.</p></div>
          </section>
          <p>By using ReStyle, you agree to our <Link to="/terms">Terms of Service</Link>.</p>
        </div>
      </section>
    </main>
  );
}
