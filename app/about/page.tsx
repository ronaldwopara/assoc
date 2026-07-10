import { Navbar } from "@/components/navbar";
import { AboutContent, DocumentsSection } from "@/components/page-sections";
import { CircularTestimonials } from "@/components/circular-testimonials";
import { SectionLogoHeading } from "@/components/section-logo-heading";

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

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="site-main">
        <section
          className="section-shell bg-(--cream-light)"
          aria-labelledby="about-heading"
        >
          <AboutContent />
        </section>

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

        <DocumentsSection />
      </main>
    </>
  );
}
