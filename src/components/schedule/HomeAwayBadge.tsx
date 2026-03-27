import { Badge } from '@/components/ui/badge';
import { Home, Plane } from 'lucide-react';

interface Props {
  isHome: boolean;
}

export function HomeAwayBadge({ isHome }: Props) {
  return isHome ? (
    <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 gap-1">
      <Home className="h-3 w-3" />
      Heim
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Plane className="h-3 w-3" />
      Auswärts
    </Badge>
  );
}
