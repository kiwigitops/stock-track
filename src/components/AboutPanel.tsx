import { AlertTriangle, Database, Scale, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AboutPanel() {
  return (
    <section className="about-panel" aria-label="About, privacy, and risk disclosures">
      <header className="about-hero">
        <span className="tiny-label">About / Privacy</span>
        <h2>Use Stock Track at your own risk.</h2>
        <p>
          Stock Track is a local-first market dashboard for exploration, paper trading, and visual analysis. It is not a broker,
          investment adviser, research provider, or trading system.
        </p>
      </header>

      <div className="about-grid">
        <AboutCard icon={<AlertTriangle size={20} />} title="Market And Projection Risk">
          <p>
            Quotes may be delayed, incomplete, stale, or unavailable. Projection signals are experimental browser-side pattern
            calculations from historical candles and may be wrong. Nothing in the app is financial, investment, tax, legal, or
            trading advice. This is not financial advice.
          </p>
          <ul>
            <li>Do your own research before making decisions.</li>
            <li>Do not rely on projections as predictions or guarantees.</li>
            <li>You are responsible for any trades, losses, or decisions you make.</li>
          </ul>
        </AboutCard>

        <AboutCard icon={<ShieldCheck size={20} />} title="Privacy">
          <p>
            The app does not have accounts, authentication, analytics, ads, or a backend database controlled by this project.
            Preferences stay in your browser storage.
          </p>
          <ul>
            <li>Favorites, custom symbols, cash amount, settings, and cached quotes use local storage.</li>
            <li>Paper trade entries use IndexedDB with a local storage fallback.</li>
            <li>Clearing browser site data removes local app data.</li>
          </ul>
        </AboutCard>

        <AboutCard icon={<Database size={20} />} title="Public Data Sources">
          <p>
            Stock Track requests delayed quote and candle data from public market endpoints through a public CORS proxy. Requests
            necessarily include ticker symbols and normal network metadata visible to those providers.
          </p>
          <ul>
            <li>No API key is required by the default setup.</li>
            <li>Third-party data providers may have their own logging, rate limits, or terms.</li>
            <li>Paper trades are simulated locally and are never real orders.</li>
          </ul>
        </AboutCard>

        <AboutCard icon={<Scale size={20} />} title="License">
          <p>
            Stock Track is released under the MIT License. The license text is kept standard; the finance and projections warnings
            here are product disclosures, not custom license terms.
          </p>
          <ul>
            <li>The software is provided as-is, without warranty.</li>
            <li>The authors are not liable for use of the software or outputs.</li>
            <li>See the repository LICENSE file for the full MIT License text.</li>
          </ul>
        </AboutCard>
      </div>
    </section>
  );
}

function AboutCard({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <article className="about-card">
      <div>
        <span>{icon}</span>
        <strong>{title}</strong>
      </div>
      {children}
    </article>
  );
}
