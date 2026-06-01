import Link from "next/link";

export function PageSections() {
  return (
    <>
      <section
        id="about"
        className="section-shell bg-[var(--cream-light)]"
        aria-labelledby="about-heading"
      >
        <div className="supplemental mx-auto max-w-3xl">
          <h2 id="about-heading" className="section-heading">
            About ASOSC
          </h2>
          <div className="section-lead">
            The Africans Society of Strathcona County connects African
            communities with neighbors, partners, and local institutions. We
            create spaces to belong, celebrate culture, and build opportunity
            together.
          </div>
        </div>
      </section>

      <section
        id="gallery"
        className="section-shell bg-[var(--cream-light)]"
        aria-labelledby="gallery-heading"
      >
        <div className="supplemental mx-auto max-w-3xl text-center">
          <h2 id="gallery-heading" className="section-heading">
            Gallery
          </h2>
          <div className="section-lead mx-auto">
            Event photos and community highlights will appear here as we publish
            new collections from festivals, workshops, and gatherings.
          </div>
        </div>
      </section>

      <section
        id="get-involved"
        className="section-shell bg-[var(--orange)]"
        aria-labelledby="get-involved-heading"
      >
        <div className="supplemental mx-auto max-w-3xl text-center">
          <h2
            id="get-involved-heading"
            className="section-heading text-white"
          >
            Get Involved
          </h2>
          <div className="section-lead mx-auto text-white/95">
            Volunteer at events, partner on programs, or join as a member. Every
            contribution strengthens the network we are building in Strathcona
            County.
          </div>
          <Link
            href="#contact"
            className="hero-cta-btn focus-ring-light mt-8 inline-flex min-h-14 cursor-pointer items-center justify-center px-10 py-4 text-base font-semibold text-black transition duration-200 ease-out"
          >
            Contact us
          </Link>
        </div>
      </section>

      <section
        id="contact"
        className="section-shell bg-[var(--brown-dark)]"
        aria-labelledby="contact-heading"
      >
        <div className="supplemental mx-auto max-w-3xl text-center">
          <h2 id="contact-heading" className="section-heading text-[var(--cream-light)]">
            Contact
          </h2>
          <div className="section-lead mx-auto text-[var(--cream)]">
            Questions about membership, programs, or partnerships? Reach out and
            we will connect you with the right person on our team.
          </div>
          <div className="mt-8 text-lg font-medium text-[var(--gold)]">
            info@asosc.org
          </div>
        </div>
      </section>
    </>
  );
}
