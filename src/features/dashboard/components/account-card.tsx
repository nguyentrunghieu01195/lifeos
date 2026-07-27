import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initialsOf } from "@/utils/initials";

interface AccountCardProps {
  name: string | null;
  email: string;
  image: string | null;
  createdAt: Date;
}

export function AccountCard({ name, email, image, createdAt }: AccountCardProps) {
  const memberSince = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(createdAt);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Member since {memberSince}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Avatar className="size-12">
          {image ? <AvatarImage src={image} alt="" /> : null}
          <AvatarFallback>{initialsOf(name, email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{name ?? "Unnamed"}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        </div>
      </CardContent>
    </Card>
  );
}
