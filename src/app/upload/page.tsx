import TermsAcceptanceModal from "@/components/TermsAcceptanceModal";
import { getCurrentTeacherId } from "@/lib/auth";
import { CURRENT_TERMS_VERSION, TERMS_TEXT } from "@/lib/terms";
import { getAcceptanceStatus } from "@/lib/terms-acceptance";

export default async function UploadPage() {
  const teacherId = await getCurrentTeacherId();
  const status = teacherId ? await getAcceptanceStatus(teacherId) : { accepted: false };

  if (!status.accepted) {
    return (
      <main>
        <h1>Upload a resource</h1>
        <TermsAcceptanceModal termsVersion={CURRENT_TERMS_VERSION} termsText={TERMS_TEXT} />
      </main>
    );
  }

  return (
    <main>
      <h1>Upload a resource</h1>
      <p>Upload form coming soon.</p>
    </main>
  );
}
