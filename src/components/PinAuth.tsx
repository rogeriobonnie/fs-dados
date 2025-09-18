import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, Key, LogOut, Eye, EyeOff } from 'lucide-react';

interface PinAuthProps {
  onAuthenticated: (isAuth: boolean) => void;
  isAuthenticated: boolean;
}

export const PinAuth = ({ onAuthenticated, isAuthenticated }: PinAuthProps) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const FIXED_PIN = 'FSversatil25';
  const AUTH_KEY = 'financial_dashboard_auth';

  useEffect(() => {
    // Check if already authenticated
    const isAuth = localStorage.getItem(AUTH_KEY) === 'true';
    if (isAuth) {
      onAuthenticated(true);
    }
  }, [onAuthenticated]);

  const hashPin = (pinValue: string): string => {
    // Simple hash for demo - em produção use uma biblioteca de hash adequada
    return btoa(pinValue + 'dashboard_salt');
  };

  const handleLogin = () => {
    const hashedFixedPin = hashPin(FIXED_PIN);
    const hashedInputPin = hashPin(pin);

    if (hashedInputPin !== hashedFixedPin) {
      toast({
        title: "PIN incorreto",
        description: "Tente novamente",
        variant: "destructive",
      });
      setPin('');
      return;
    }

    setIsLoading(true);
    
    setTimeout(() => {
      localStorage.setItem(AUTH_KEY, 'true');
      onAuthenticated(true);
      setPin('');
      setIsLoading(false);
      
      toast({
        title: "Acesso liberado!",
        description: "Bem-vindo ao dashboard financeiro",
      });
    }, 500);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    onAuthenticated(false);
    toast({
      title: "Logout realizado",
      description: "Acesso ao dashboard bloqueado",
    });
  };

  const handleResetPin = () => {
    localStorage.removeItem(AUTH_KEY);
    onAuthenticated(false);
    setPin('');
    
    toast({
      title: "Sessão resetada",
      description: "Faça login novamente com o PIN",
    });
  };

  if (isAuthenticated) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
              <Key className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle>Acesso Autorizado</CardTitle>
          <CardDescription>
            Você está autenticado no dashboard financeiro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleLogout} 
            variant="outline" 
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Fazer Logout
          </Button>
          
          <Button 
            onClick={handleResetPin} 
            variant="destructive" 
            className="w-full"
          >
            Resetar PIN
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle>Dashboard Financeiro</CardTitle>
          <CardDescription>
            Digite o PIN para acessar o dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">PIN de Acesso</Label>
            <div className="relative">
              <Input
                id="pin"
                type={showPin ? "text" : "password"}
                placeholder="Digite seu PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <Button 
            onClick={handleLogin} 
            className="w-full" 
            disabled={!pin.trim() || isLoading}
          >
            {isLoading ? 'Verificando...' : 'Acessar Dashboard'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};