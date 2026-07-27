import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NAV_GROUPS } from "@/components/app-shell/nav-config";

/**
 * Live snapshot of the module roadmap, rendered from the same nav-config the
 * sidebar uses. Each widget of real data replaces its row here as it ships.
 */
export function ModulesOverviewCard() {
  const items = NAV_GROUPS.flatMap((group) => group.items);
  const available = items.filter((item) => item.status === "available");

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Modules</CardTitle>
        <CardDescription>
          {available.length} of {items.length} live — the rest light up here as they ship.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {items.map((item) => (
            <li key={item.href} className="flex items-center gap-2.5 text-sm">
              <item.icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className={item.status === "soon" ? "text-muted-foreground" : "font-medium"}>
                {item.title}
              </span>
              {item.status === "soon" ? (
                <Badge variant="outline" className="ml-auto text-[10px] text-muted-foreground">
                  Soon
                </Badge>
              ) : (
                <Badge className="ml-auto text-[10px]">Live</Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
