import usePageStyles from "../hooks/usePageStyles";
import InformationHeader from "../components/InformationHeader";

export default function About() {
  usePageStyles("info-pages.css");

  return (
    <main className="info-page">
      <InformationHeader />
      <section className="about-editorial">
        <div className="about-editorial-image">
          <img src="/images/about-smart-wardrobe.png" alt="A woman choosing clothes from her organized personal wardrobe" />
        </div>
        <div className="about-editorial-copy">
          <span className="info-eyebrow">A LITTLE ABOUT US</span>
          <h1>Meet ReStyle</h1>
          <p>ReStyle is a smart digital wardrobe created to make everyday fashion simpler, more personal and more sustainable.</p>
          <p>We built one place where you can photograph and organize the clothes you already own, create complete outfits for different occasions and explore how selected pieces may look together through a virtual try-on.</p>
          <p>ReStyle Studio gives forgotten clothing a second chance. It offers creative ideas and step-by-step guidance for transforming suitable pieces instead of immediately throwing them away.</p>
          <p>Our community Marketplace also helps clothing continue its journey. Members can offer items for sale or rent, discover pieces from other wardrobes and communicate directly in a respectful environment.</p>
          <p>From planning a look to reimagining an old garment, ReStyle is designed to help you see more possibilities in the wardrobe you already have.</p>
        </div>
      </section>

      <section className="about-explainer" aria-label="What you can do with ReStyle">
        <header><span className="info-eyebrow">WHAT RESTYLE BRINGS TOGETHER</span><h2>Everything your wardrobe needs, in one place.</h2></header>
        <div className="about-explainer-grid">
          <article><i className="fa-solid fa-shirt" /><div><h3>My Closet</h3><p>Upload, categorize and manage your clothing and accessories in a personal digital wardrobe.</p></div></article>
          <article><i className="fa-solid fa-wand-magic-sparkles" /><div><h3>Outfit Builder</h3><p>Create looks for an occasion, style and weather using pieces selected from your own closet.</p></div></article>
          <article><i className="fa-solid fa-recycle" /><div><h3>ReStyle Studio</h3><p>Discover practical transformation ideas that can give suitable clothing a new purpose.</p></div></article>
          <article><i className="fa-solid fa-bag-shopping" /><div><h3>Marketplace</h3><p>Sell or rent pieces you no longer need and connect them with someone who will enjoy them.</p></div></article>
        </div>
      </section>
    </main>
  );
}
