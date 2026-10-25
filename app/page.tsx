import UploadForm from "@/components/UploadForm";

export default function Home() {
  return (
    <>
      <header className="topbar"><a href="/" className="brand" style={{ margin: 0 }}><span className="logo">◎</span>Franchise engine</a><a href="/how">How this decides</a></header>
      <main className="page" style={{ margin: "40px auto" }}>
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
