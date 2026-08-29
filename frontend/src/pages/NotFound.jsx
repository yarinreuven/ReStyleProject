import { Link } from "react-router-dom";
import InformationHeader from "../components/InformationHeader";
import usePageStyles from "../hooks/usePageStyles";

export default function NotFound() {
  usePageStyles("info-pages.css");

  return (
    <main className="info-page">
      <InformationHeader />
      <section className="terms-hero" aria-labelledby="not-found-title">
        <span className="info-eyebrow">ERROR 404</span>
        <h1 id="not-found-title">This page is out of style.</h1>
        <p>The page you were looking for does not exist or may have moved.</p>
        <Link className="info-primary-link" to="/">
          <i className="fa-solid fa-house" aria-hidden="true" />
          Back to home
        </Link>
      </section>
    </main>
  );
}
