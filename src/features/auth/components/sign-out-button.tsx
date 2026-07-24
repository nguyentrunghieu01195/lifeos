import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

import { signOutAction } from "../server/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut aria-hidden />
        Sign out
      </Button>
    </form>
  );
}
