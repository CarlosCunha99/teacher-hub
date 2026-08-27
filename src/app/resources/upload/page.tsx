"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import ResourceUploadForm from "@/components/ResourceUploadForm";

export default function UploadResourcePage() {
  const router = useRouter();

  const handleSuccess = (resourceId: string) => {
    router.push(`/?resourceCreated=${resourceId}`);
  };

  return (
    <main>
      <h1>Publish a New Resource</h1>
      <p>
        Share your educational materials with the Teacher Hub community. Fill in the details below
        and upload your PDF resource.
      </p>

      <ResourceUploadForm onSuccess={handleSuccess} />

      <p>
        <Link href="/">← Back to discovery feed</Link>
      </p>
    </main>
  );
}
