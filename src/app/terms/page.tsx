import { CURRENT_TERMS_VERSION, TERMS_TEXT } from "@/lib/terms";

export default function TermsPage() {
  return (
    <main>
      <h1>Terms of Use</h1>
      <p>Version: {CURRENT_TERMS_VERSION}</p>
      <article style={{ whiteSpace: "pre-wrap" }}>{TERMS_TEXT}</article>
    </main>
  );
}
