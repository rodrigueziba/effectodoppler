import './globals.css';

export const metadata = {
  title: 'Efecto Doppler · Simulación',
  description:
    'Simulación interactiva del efecto Doppler acústico y del corrimiento al rojo y al azul, en Three.js.',
};

export const viewport = {
  themeColor: '#04050c',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
