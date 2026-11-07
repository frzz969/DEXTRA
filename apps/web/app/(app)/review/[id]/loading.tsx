import { LoadingSkeleton } from "@/components/states";

export default function Loading() {
  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Review plan</h1>
          <p>Memuat ringkasan rencana, temuan, dan kebijakan yang dievaluasi.</p>
        </div>
      </header>
      <div className="grid grid--sidebar">
        <div className="stack">
          <LoadingSkeleton lines={6} />
          <LoadingSkeleton lines={4} />
        </div>
        <LoadingSkeleton lines={5} />
      </div>
    </>
  );
}
