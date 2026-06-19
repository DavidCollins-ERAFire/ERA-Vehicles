/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Google profile images come from these hosts.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
};

module.exports = nextConfig;
