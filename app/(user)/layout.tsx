import type { ReactNode } from "react";
import { UserNavigation } from "./components/user-navigation";

export default function UserLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UserNavigation />
      {children}
    </>
  );
}
