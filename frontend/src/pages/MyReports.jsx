import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Smartphone } from "lucide-react";
import { api } from "../lib/api";
import { savedReports, clearSavedReports } from "../lib/reports";
import ReportCard from "../components/ReportCard";
import { Empty, Loading, ErrorState } from "../components/Feedback";
export default function MyReports() {
  const [version, setVersion] = useState(0);
  const [result, setState] = useState({ version: -1 });
  const state =
    result.version === version
      ? result
      : { loading: true, reports: [], hidden: 0, failed: 0 };
  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled(
      savedReports().map((id) =>
        api(`/reports/${id}`, { signal: controller.signal }),
      ),
    ).then((results) => {
      if (controller.signal.aborted) return;
      setState({
        version,
        loading: false,
        reports: results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value.data),
        hidden: results.filter(
          (r) => r.status === "rejected" && r.reason.status === 404,
        ).length,
        failed: results.filter(
          (r) => r.status === "rejected" && r.reason.status !== 404,
        ).length,
      });
    });
    return () => controller.abort();
  }, [version]);
  return (
    <div className="page narrow">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR CONTRIBUTIONS</p>
          <h1>My reports</h1>
          <p>Follow observations submitted from this browser.</p>
        </div>
        <Smartphone size={28} />
      </div>
      <p className="notice info">
        Only report references are saved on this device. There is no citizen
        account or cross-device history. Clearing browser storage removes these
        references.
      </p>
      {state.loading ? (
        <Loading />
      ) : (
        <>
          {state.failed > 0 && (
            <ErrorState
              error={{ message: "Some saved reports could not be loaded." }}
              retry={() => setVersion((v) => v + 1)}
            />
          )}
          {state.reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
          {state.hidden > 0 && (
            <p className="notice warning">
              {state.hidden} saved{" "}
              {state.hidden === 1 ? "report is" : "reports are"} no longer
              public. Rejected reports are hidden.
            </p>
          )}
          {!state.reports.length && !state.hidden && !state.failed && (
            <Empty
              title="Your first observation starts here"
              text="When you submit a report, its reference will appear on this device."
            >
              <Link to="/report" className="button primary">
                <Plus size={18} />
                Report flooding
              </Link>
            </Empty>
          )}
          {savedReports().length > 0 && (
            <button
              className="text-button"
              onClick={() => {
                if (
                  window.confirm(
                    "Remove saved references from this device? The reports themselves will stay in FloodWatch.",
                  )
                ) {
                  clearSavedReports();
                  setVersion((v) => v + 1);
                }
              }}
            >
              Clear saved references from this device
            </button>
          )}
        </>
      )}
    </div>
  );
}
