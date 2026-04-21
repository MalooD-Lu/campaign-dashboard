// app/layout.jsx
import './globals.css';

export const metadata = {
  title: 'Campaign CSV Dashboard',
  description: 'Process and manage campaign CSV files with transliteration',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
