import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { JoinPageContent } from "@/components/join-page-content";

export const metadata: Metadata = {
  title: "Join Our Community",
  description:
    "Subscribe to our newsletter, volunteer, donate, become a member, register as a vendor, or get in touch with ASOSC.",
};

export default function JoinPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="site-main">
        <section
          className="section-shell bg-(--cream-light)"
          aria-label="Join Our Community"
        >
          <Suspense fallback={null}>
            <JoinPageContent />
          </Suspense>
        </section>
      </main>
    </>
  );
}
