/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'nodemailer'],
    outputFileTracingIncludes: {
      '/api/**/*': ['./prisma/dev.db'],
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // F6.02: Forçar TLS 1.3 / HSTS por 2 anos com subdomínios e preload
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          // Prevenção de Clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // Prevenção de MIME-sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // Proteção de Referrer
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Restrição de APIs do navegador
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
          },
          // Content-Security-Policy compatível com Three.js e WebGL
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' blob:; worker-src 'self' blob:;"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
