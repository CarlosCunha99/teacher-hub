import Link from "next/link";
import type { ReactElement } from "react";

export default function HomePage(): ReactElement {
  return (
    <main>
      <h1>Teacher Hub</h1>
      <nav>
        <ul>
          <li>
            <Link href="/teachers/example-id">Example teacher profile</Link>
          </li>
          <li>
            <Link href="/resources/example-id">Example resource detail</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
