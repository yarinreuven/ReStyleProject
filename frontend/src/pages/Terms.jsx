import { Link } from "react-router-dom";
import usePageStyles from "../hooks/usePageStyles";
import InformationHeader from "../components/InformationHeader";

const sections = [
  ["acceptance", "Using ReStyle"], ["accounts", "Your account"], ["community", "Marketplace conduct"],
  ["transactions", "Listings and transactions"], ["ai", "AI features"], ["content", "Your content"],
  ["enforcement", "Safety and enforcement"], ["deletion", "Account deletion"], ["changes", "Changes and contact"],
];

export default function Terms() {
  usePageStyles("info-pages.css");
  return (
    <main className="info-page">
      <InformationHeader />
      <header className="terms-hero">
        <span className="info-eyebrow">CLEAR RULES FOR A RESPECTFUL COMMUNITY</span>
        <h1>Terms of Service</h1>
        <p>These terms explain the basic rules for using ReStyle, protecting your account and participating safely and respectfully in the Marketplace.</p>
      </header>

      <section className="community-promise">
        <i className="fa-solid fa-people-group" />
        <div><h2>Our community promise</h2><p>Be honest, respectful and safe. Treat other members as you would want to be treated, describe items truthfully, and report content or behavior that may put someone at risk.</p></div>
      </section>

      <div className="terms-layout">
        <aside className="terms-toc"><strong>On this page</strong>{sections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</aside>
        <article className="terms-content">
          <section className="terms-section" id="acceptance"><h2>1. Using ReStyle</h2><p>By creating an account or using ReStyle, you agree to these Terms. You must be legally able to accept them, or use the service with permission and supervision from a parent or legal guardian. If you do not agree, do not use the service.</p></section>
          <section className="terms-section" id="accounts"><h2>2. Your account</h2><ul><li>Provide accurate information and keep it current.</li><li>Keep your password and access to your email secure.</li><li>Do not share verification codes or let another person impersonate you.</li><li>Tell us promptly if you believe your account has been compromised.</li></ul></section>
          <section className="terms-section" id="community">
            <h2>3. Marketplace conduct</h2><p>The Marketplace should remain welcoming and useful. Messages, listings, reviews and profile content must use respectful and appropriate language.</p>
            <div className="rules-grid">
              <div className="rules-card good"><h3><i className="fa-solid fa-check" /> Do</h3><ul><li>Communicate politely and clearly.</li><li>Use truthful photos and descriptions.</li><li>Respect privacy and personal boundaries.</li><li>Report suspicious or abusive behavior.</li></ul></div>
              <div className="rules-card bad"><h3><i className="fa-solid fa-xmark" /> Do not</h3><ul><li>Harass, threaten, shame or discriminate.</li><li>Use hateful, sexual or abusive language.</li><li>Spam, scam or pressure another member.</li><li>Post private information without consent.</li></ul></div>
            </div>
          </section>
          <section className="terms-section" id="transactions"><h2>4. Listings and transactions</h2><p>Only list items that you have the right to offer. Photos, condition, size, price and availability must be accurate. Counterfeit, stolen, unsafe or unlawful items are prohibited. Members are responsible for reviewing an item and agreeing on transaction details. ReStyle may remove misleading listings and does not guarantee that every member, listing or transaction will meet your expectations.</p></section>
          <section className="terms-section" id="ai"><h2>5. AI styling and Studio features</h2><p>Outfit suggestions, virtual try-ons, item recognition and Studio ideas are generated with automated tools and may be inaccurate. Images are illustrative and may not reproduce fit, color, length, fabric or appearance exactly. Check the real garment before relying on a result, and use appropriate tools, protective measures and adult supervision for any cutting, sewing or modification project.</p></section>
          <section className="terms-section" id="content"><h2>6. Your content</h2><p>You keep ownership of photos and content you upload. You give ReStyle permission to store, process and display that content only as needed to provide and operate the features you use. Upload only content you own or are permitted to use, and do not upload another person’s image without permission.</p></section>
          <section className="terms-section" id="enforcement"><h2>7. Safety and enforcement</h2><p>We may review reports and remove content, restrict features, suspend an account or permanently close an account when reasonably necessary to protect members, enforce these Terms, prevent fraud or comply with law. Serious or repeated violations may lead to immediate action.</p></section>
          <section className="terms-section" id="deletion"><h2>8. Account deletion</h2><p>You can request permanent account deletion from Settings. Deletion removes the account and associated data described on that screen and cannot be undone. Some limited records may need to be retained where required for security, dispute handling or legal compliance.</p></section>
          <section className="terms-section" id="changes"><h2>9. Changes and contact</h2><p>We may update these Terms when ReStyle features or legal requirements change. For questions, support or reports, visit the <Link to="/contact">Contact page</Link>.</p></section>
        </article>
      </div>
    </main>
  );
}
