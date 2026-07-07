import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, Shield, Users, User as UserIcon } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().trim().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(6, 'Mindestens 6 Zeichen'),
});

const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Vorname ist erforderlich').max(100),
  lastName: z.string().trim().min(1, 'Nachname ist erforderlich').max(100),
  email: z.string().trim().email('Ungültige E-Mail-Adresse').max(255),
  password: z.string().min(8, 'Mindestens 8 Zeichen'),
  passwordConfirm: z.string(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: 'Passwörter stimmen nicht überein',
  path: ['passwordConfirm'],
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

export default function Auth() {
  const { isAuthenticated, isLoading: authLoading, setPreviewRole, previewRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get('next');
  const nextPath = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const loginForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={nextPath} replace />;
  }

  const handleLogin = async (data: LoginData) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Anmeldung fehlgeschlagen', description: error.message });
      return;
    }
    navigate(nextPath, { replace: true });
  };

  const handleRegister = async (data: RegisterData) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { first_name: data.firstName, last_name: data.lastName },
        emailRedirectTo: `${window.location.origin}${nextPath}`,
      },
    });
    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Registrierung fehlgeschlagen', description: error.message });
      return;
    }
    toast({
      title: 'Registrierung erfolgreich',
      description: 'Bitte bestätige deine E-Mail-Adresse über den Link in deinem Posteingang.',
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight font-[Space_Grotesk]">
            TT-Manager Pro
          </CardTitle>
          <CardDescription>Vereinsverwaltung für Tischtennis</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Dev-Vorschau-Modus: Sicht einer Rolle simulieren (wirkt nach erfolgreichem Login) */}
          <div className="mb-4 rounded-lg border border-dashed border-border p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              <span>Vorschau-Rolle (nach Login angewendet)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={previewRole === null ? 'default' : 'outline'}
                onClick={() => setPreviewRole(null)}
              >
                Echte Rolle
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewRole === 'mitglied' ? 'default' : 'outline'}
                onClick={() => setPreviewRole('mitglied')}
              >
                <UserIcon className="mr-1.5 h-3.5 w-3.5" />
                Member
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewRole === 'trainer' ? 'default' : 'outline'}
                onClick={() => setPreviewRole('trainer')}
              >
                <Users className="mr-1.5 h-3.5 w-3.5" />
                Mannschaftsführer
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewRole === 'admin' ? 'default' : 'outline'}
                onClick={() => setPreviewRole('admin')}
              >
                <Shield className="mr-1.5 h-3.5 w-3.5" />
                Admin
              </Button>
            </div>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Anmelden</TabsTrigger>
              <TabsTrigger value="register">Registrieren</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-Mail</Label>
                  <Input id="login-email" type="email" placeholder="name@verein.de" {...loginForm.register('email')} />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Passwort</Label>
                  <Input id="login-password" type="password" {...loginForm.register('password')} />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Anmelden
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm text-muted-foreground"
                  onClick={async () => {
                    const email = loginForm.getValues('email');
                    if (!email) {
                      toast({ variant: 'destructive', title: 'E-Mail eingeben', description: 'Bitte gib zuerst deine E-Mail-Adresse ein.' });
                      return;
                    }
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) {
                      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
                    } else {
                      toast({ title: 'E-Mail gesendet', description: 'Prüfe deinen Posteingang für den Link zum Zurücksetzen.' });
                    }
                  }}
                >
                  Passwort vergessen?
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-4">
              <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-first">Vorname</Label>
                    <Input id="reg-first" {...registerForm.register('firstName')} />
                    {registerForm.formState.errors.firstName && (
                      <p className="text-sm text-destructive">{registerForm.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-last">Nachname</Label>
                    <Input id="reg-last" {...registerForm.register('lastName')} />
                    {registerForm.formState.errors.lastName && (
                      <p className="text-sm text-destructive">{registerForm.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">E-Mail</Label>
                  <Input id="reg-email" type="email" placeholder="name@verein.de" {...registerForm.register('email')} />
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-pw">Passwort</Label>
                  <Input id="reg-pw" type="password" {...registerForm.register('password')} />
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-pw2">Passwort bestätigen</Label>
                  <Input id="reg-pw2" type="password" {...registerForm.register('passwordConfirm')} />
                  {registerForm.formState.errors.passwordConfirm && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.passwordConfirm.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Registrieren
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
