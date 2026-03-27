import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <Construction className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">{title}</h1>
      <p className="text-muted-foreground">
        Dieses Modul wird in Kürze implementiert.
      </p>
    </div>
  );
}
