import "./globals.css";

export const metadata = {
  title: "Southern Values Referral Rewards",
  description: "Track referrals and rewards for customers and partners.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
