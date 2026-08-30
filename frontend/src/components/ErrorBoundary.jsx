import { Component } from "react";
import "./ErrorBoundary.css";

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Unhandled React rendering error", error, errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-error-boundary" role="alert" aria-labelledby="app-error-title">
        <section className="app-error-card">
          <span className="app-error-eyebrow">Something went wrong</span>
          <h1 id="app-error-title">ReStyle needs a quick refresh.</h1>
          <p>
            We could not display this page. Your account and wardrobe data have not been changed.
          </p>
          <div className="app-error-actions">
            <button type="button" onClick={this.handleRetry}>Try again</button>
            <a href="/">Back to home</a>
          </div>
        </section>
      </main>
    );
  }
}
