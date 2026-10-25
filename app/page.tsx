import UploadForm from "@/components/UploadForm";

export default function Home() {
  return (
    <>
      <header className="topbar"><h1>Franchise <span>decision engine</span></h1><a href="/how">How this decides</a></header>
      <main className="page">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>1. Upload applications</h2>
          <p>Upload the workbook in the template format (Applications, Territories, Existing stores). Every applicant gets a decision, a reason, an owner and a next step. No login.</p>
          <UploadForm />
          <p className="muted small">Each upload opens its own private session; nobody else&apos;s changes affect yours.</p>
        </div>
      </main>
    </>
  );
}
