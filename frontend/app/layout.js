import Nav from "./components/Nav";

export const metadata = {
  title: "Convenio",
  description: "Venue marketplace",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#fafafa" }}>
        <div style={{ borderBottom: "1px solid #ddd", background: "white" }}>
          <Nav />
        </div>

        <div style={{ padding: 16 }}>
          {children}
        </div>
      </body>
    </html>
  );
}