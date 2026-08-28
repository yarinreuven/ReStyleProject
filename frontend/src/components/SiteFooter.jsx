import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link to="/about">About</Link>
      <span aria-hidden="true">•</span>
      <Link to="/contact">Contact</Link>
      <span aria-hidden="true">•</span>
      <Link to="/terms">Terms of Service</Link>
    </footer>
  );
}
