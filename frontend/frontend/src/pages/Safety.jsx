import { Link } from "react-router-dom";
import { ShieldCheck, ArrowRight, ExternalLink } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { Loading, ErrorState } from "../components/Feedback";
export default function Safety() {
  const resource = useResource("/safety");
  return (
    <div className="page narrow">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRACTICAL INFORMATION</p>
          <h1>Stay safe around flooding</h1>
          <p>Your safety comes before any report.</p>
        </div>
        <ShieldCheck size={32} className="teal" />
      </div>
      <div className="notice info">
        This is general safety guidance. FloodWatch does not provide weather
        forecasts, evacuation orders or live emergency alerts.
      </div>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.reload} />
      ) : (
        <>
          <div className="safety-guides">
            {resource.data.data.guidance.map((guide, index) => (
              <section key={guide.id}>
                <span className="guide-number">0{index + 1}</span>
                <div>
                  <h2>{guide.title}</h2>
                  <p>{guide.text}</p>
                </div>
              </section>
            ))}
          </div>
          <a
            className="text-link"
            href={resource.data.data.source.url}
            target="_blank"
            rel="noreferrer"
          >
            {resource.data.data.source.title} <ExternalLink size={15} />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </>
      )}
      <div className="safety-bottom">
        <h2>Share an observation from a safe place.</h2>
        <p>You don’t need to get closer to water to make a report.</p>
        <Link to="/report" className="button primary">
          Report flooding <ArrowRight size={17} />
        </Link>
      </div>
      <Link to="/help" className="text-link">
        Read about help requests <ArrowRight size={17} />
      </Link>
    </div>
  );
}
