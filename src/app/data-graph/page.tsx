import Link from "next/link";
import { BarChart3, Clock3, Home, MessageSquare, Network } from "lucide-react";
import { redirect } from "next/navigation";
import { isDcmshriramSite } from "@/lib/site-variant";

export const metadata = {
  title: "SFS Data Discovery Graph",
  description: "Use case and data field graph for the Shriram Farm Solutions executive cockpit.",
};

const graphSrc = "/sfs-data-discovery-graph.html?embed=1";

export default function DataGraphPage() {
  if (!isDcmshriramSite()) {
    redirect("/");
  }

  return (
    <>
      <main className="app-shell data-graph-shell">
        <aside className="sfs-sidebar">
          <div className="brand-lockup">
            <div className="sfs-mark">SFS</div>
            <div>
              <div className="project-label">Project Leap</div>
              <p>Shriram Farm Solutions</p>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Primary">
            <Link href="/" title="Chat">
              <MessageSquare size={17} />
              <span>Chat</span>
            </Link>
            <Link href="/dashboard" title="Saved Reports">
              <BarChart3 size={17} />
              <span>Saved Reports</span>
            </Link>
            <Link href="/data-graph" className="active" title="SFS Data Discovery Graph" aria-current="page">
              <Network size={17} />
              <span>Data Graph</span>
            </Link>
          </nav>

          <section className="sidebar-section">
            <h2>Conversations</h2>
            <Link className="conversation" href="/">
              <strong>Field force Q3</strong>
              <span>2 mins ago</span>
            </Link>
            <Link className="conversation" href="/">
              <strong>Procurement</strong>
              <span>Yesterday</span>
            </Link>
            <Link className="conversation" href="/">
              <strong>Farmer NPS</strong>
              <span>Mon</span>
            </Link>
          </section>

          <section className="sidebar-section sidebar-pinned">
            <h2>Pinned</h2>
            <Link href="/dashboard" className="pinned-link">
              <BarChart3 size={15} />
              <span>Saved reports</span>
            </Link>
          </section>
        </aside>

        <div className="app-main data-graph-main">
          <header className="top-bar">
            <div className="breadcrumb">
              <Link href="/" className="breadcrumb-home" aria-label="Return to the Executive Cockpit home screen">
                <strong>Executive Cockpit</strong>
              </Link>
              <span>/</span>
              <em>Data Graph</em>
            </div>

            <div className="top-actions">
              <div className="avatar">AK</div>
            </div>
          </header>

          <section className="data-graph-frame-shell" aria-label="SFS Data Discovery Graph">
            <iframe className="data-graph-frame" src={graphSrc} title="SFS Data Discovery Graph" />
          </section>
        </div>
      </main>

      <section className="data-graph-mobile" aria-label="SFS Data Discovery Graph mobile cockpit">
        <header className="mobile-header">
          <div className="mobile-brand">
            <div className="mobile-mark">SFS</div>
            <strong>Data Graph</strong>
          </div>
        </header>

        <div className="data-graph-mobile-frame-shell">
          <iframe className="data-graph-frame" src={graphSrc} title="SFS Data Discovery Graph" />
        </div>

        <nav className="mobile-tabbar" aria-label="Mobile primary navigation">
          <Link className="mobile-tab" href="/">
            <Home size={21} />
            <span>Home</span>
          </Link>
          <Link className="mobile-tab" href="/">
            <MessageSquare size={21} />
            <span>Chat</span>
          </Link>
          <Link className="mobile-tab" href="/dashboard">
            <BarChart3 size={22} />
            <span>Charts</span>
          </Link>
          <Link className="mobile-tab" href="/">
            <Clock3 size={21} />
            <span>History</span>
          </Link>
          <Link className="mobile-tab mobile-tab-active" href="/data-graph" aria-current="page">
            <Network size={21} />
            <span>Graph</span>
          </Link>
        </nav>
      </section>
    </>
  );
}
