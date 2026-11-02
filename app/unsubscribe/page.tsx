import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { UnsubscribeClient } from "@/components/unsubscribe-client";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const q = await searchParams;
  const email = typeof q.e === "string" ? q.e : "";
  const token = typeof q.t === "string" ? q.t : "";
  return (
    <>
      <Navbar />
      <main id="main-content" className="site-main">
        <section className="section-shell bg-(--cream-light)" aria-label="Unsubscribe">
          <UnsubscribeClient email={email} token={token} />
        </section>
      </main>
    </>
  );
}
