const nextConfig = {
  async redirects() {
    return [
      // WordPress → Vercel migration. The old vendor sign-up page has no direct
      // equivalent route (vendor registration is the Join modal's Vendor tab),
      // so send it to the home page with ?join=vendor, which auto-opens that
      // form (see components/join-deep-link.tsx). Both slash variants are listed
      // so the redirect fires without an extra trailing-slash normalization hop.
      {
        source: "/african-festival-vendors-sign-up",
        destination: "/?join=vendor",
        permanent: true,
      },
      {
        source: "/african-festival-vendors-sign-up/",
        destination: "/?join=vendor",
        permanent: true,
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
  // sharp@0.35 loads libvips from a sibling package via dlopen. Next 16.2's
  // Turbopack tracer missed that .so on Vercel; 16.3+ fixes it, and this
  // include keeps the binary in the serverless bundle as a belt-and-suspenders
  // measure. See https://github.com/lovell/sharp/issues/4567
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/daldas2e7/**",
      },
    ],
  },
};

export default nextConfig;
