import { Navbar } from "@/components/navbar";
import { AboutContent, DocumentsSection } from "@/components/page-sections";
import { CircularTestimonials } from "@/components/circular-testimonials";

const boardMembers = [
  {
    name: "Board Chair",
    designation: "Chairperson",
    quote:
      "ASOSC exists to celebrate African heritage while building bridges with the wider Strathcona County community. Every program we run is rooted in that mission.",
    src: "/caurosel/1-c.jpeg",
  },
  {
    name: "Vice Chair",
    designation: "Vice Chairperson",
    quote:
      "We are proud to create spaces where African families feel seen, supported, and connected — and where neighbours can learn from one another.",
    src: "/caurosel/2-c.jpeg",
  },
  {
    name: "Treasurer",
    designation: "Treasurer",
    quote:
      "Sound stewardship of our resources lets us invest directly in youth programs, cultural events, and community outreach across the county.",
    src: "/caurosel/3-c.jpeg",
  },
  {
    name: "Secretary",
    designation: "Secretary",
    quote:
      "From volunteers to partners, our community shows up time and again — and we're committed to keeping that momentum going for years to come.",
    src: "/caurosel/4-c.jpeg",
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
          className="section-shell bg-(--cream-light)"
          aria-labelledby="board-heading"
        >
          <h2 id="board-heading" className="mb-6 text-center text-[clamp(2.5rem,6vw,4.5rem)] font-bold tracking-wide text-(--orange)">
            Meet the Board
          </h2>

          <div className="flex justify-center">
            <CircularTestimonials testimonials={boardMembers} />
          </div>
        </section>

        <DocumentsSection />
      </main>
    </>
  );
}
