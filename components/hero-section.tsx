import { HeroContent } from "./hero-content";

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative mt-[var(--navbar-height)] min-h-[calc(100dvh-var(--navbar-height))] overflow-hidden"
      aria-label="Welcome"
    >
      <div className="absolute inset-0" aria-hidden>
        <video
          autoPlay
          muted
          loop
          playsInline
          className="hero-video h-full w-full object-cover"
        >
          <source src="/hero-clip.mp4" type="video/mp4" />
        </video>
        
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "var(--hero-overlay)" }}
        />
      </div>
      <HeroContent />
    </section>
  );
}
