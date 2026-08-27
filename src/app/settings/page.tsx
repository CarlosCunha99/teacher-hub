import { getCurrentTeacherId } from "@/lib/auth";
import { getAcceptanceStatus } from "@/lib/terms-acceptance";

export default async function SettingsPage() {
  const teacherId = await getCurrentTeacherId();
  const status = teacherId ? await getAcceptanceStatus(teacherId) : { accepted: false };

  return (
    <main>
      <h1>Account settings</h1>
      <section>
        <h2>Terms of use</h2>
        {status.accepted ? (
          <p>
            Accepted version {status.version} on{" "}
            {new Date(status.acceptedAt as string).toLocaleString()}
          </p>
        ) : (
          <p>You have not yet accepted the current terms of use.</p>
        )}
      </section>
    </main>
  );
}
