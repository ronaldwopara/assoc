import { Navbar } from "@/components/navbar";
import { AboutContent, DocumentsSection } from "@/components/page-sections";
import { AboutSectionShell } from "@/components/about-section-shell";
import { CircularTestimonials } from "@/components/circular-testimonials";
import { PageBackLink } from "@/components/page-back-link";
import { SectionLogoHeading } from "@/components/section-logo-heading";
import { getDocumentsCmsData } from "@/lib/documents-cms";
import { getSiteContent } from "@/lib/site-content";

export default async function AboutPage() {
  const [documentsData, { board }] = await Promise.all([getDocumentsCmsData(), getSiteContent()]);
  const boardMembers = board.filter((m) => m.name && m.src);

  return (
    <>
      <Navbar />
      <main id="main-content" className="site-main">
        <AboutSectionShell aria-labelledby="about-heading">
          <div className="mx-auto mb-2 max-w-5xl px-4 sm:mb-3 sm:px-6">
            <PageBackLink />
          </div>
          <AboutContent priorityFirstImage />
        </AboutSectionShell>

        <section
          id="board"
          className="section-shell bg-black"
          aria-labelledby="board-heading"
        >
          <SectionLogoHeading
            id="board-heading"
            className="text-(--orange-light)"
          >
            Meet the Board
          </SectionLogoHeading>

          <div className="flex justify-center">
            <CircularTestimonials testimonials={boardMembers} theme="dark" />
          </div>
        </section>

        <DocumentsSection documentsData={documentsData} />
      </main>
    </>
  );
}
