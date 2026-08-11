import { Navbar } from "@/components/navbar";
import { AboutContent, DocumentsSection } from "@/components/page-sections";
import { AboutSectionShell } from "@/components/about-section-shell";
import { CircularTestimonials } from "@/components/circular-testimonials";
import { PageBackLink } from "@/components/page-back-link";
import { SectionLogoHeading } from "@/components/section-logo-heading";
import { getDocumentsCmsData } from "@/lib/documents-cms";

const CLOUDINARY_BASE =
  "https://res.cloudinary.com/daldas2e7/image/upload/c_fill,g_face,w_600,h_800,f_webp,q_auto";

const boardMembers = [
  {
    designation: "Founder/President",
    name: "Busayo Disu",
    src: `${CLOUDINARY_BASE}/v1783629200/asosc/board/busayo-disu.jpg`,
  },
  {
    designation: "Treasurer",
    name: "Bose Osa-Izeko",
    src: `${CLOUDINARY_BASE}/v1783629201/asosc/board/bose-osa-izeko.jpg`,
  },
  {
    designation: "Director",
    name: "Omoniyi Fabarebo",
    src: `${CLOUDINARY_BASE}/v1783629202/asosc/board/omoniyi-fabarebo.jpg`,
  },
  {
    designation: "Director at Large",
    name: "Kayode Disu",
    src: `${CLOUDINARY_BASE}/v1783629202/asosc/board/kayode-disu.jpg`,
  },
  {
    designation: "Director at Large",
    name: "Temitope Haastrup",
    src: `${CLOUDINARY_BASE}/v1783629203/asosc/board/temitope-haastrup.jpg`,
  },
];

export default async function AboutPage() {
  const documentsData = await getDocumentsCmsData();

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
