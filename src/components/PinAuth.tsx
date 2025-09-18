import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Lock, Key, LogOut, Eye, EyeOff } from 'lucide-react';

interface PinAuthProps {
  onAuthenticated: (isAuth: boolean) => void;
  isAuthenticated: boolean;
}

export const PinAuth = ({ onAuthenticated, isAuthenticated }: PinAuthProps) => {
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [hasStoredPin, setHasStoredPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const STORAGE_KEY = 'financial_dashboard_pin';
  const AUTH_KEY = 'financial_dashboard_auth';

  useEffect(() => {
    const storedPin = localStorage.getItem(STORAGE_KEY);
    setHasStoredPin(!!storedPin);
    
    // Check if already authenticated
    const isAuth = localStorage.getItem(AUTH_KEY) === 'true';
    if (isAuth && storedPin) {
      onAuthenticated(true);
    }
  }, [onAuthenticated]);

  const hashPin = (pinValue: string): string => {
    // Simple hash for demo - em produção use uma biblioteca de hash adequada
    return btoa(pinValue + 'dashboard_salt');
  };

  const handleCreatePin = () => {
    if (newPin.length < 4) {
      toast({
        title: "PIN muito curto",
        description: "O PIN deve ter pelo menos 4 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (newPin !== confirmPin) {
      toast({
        title: "PINs não coincidem",
        description: "Confirme o PIN corretamente",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    setTimeout(() => {
      const hashedPin = hashPin(newPin);
      localStorage.setItem(STORAGE_KEY, hashedPin);
      localStorage.setItem(AUTH_KEY, 'true');
      setHasStoredPin(true);
      onAuthenticated(true);
      setNewPin('');
      setConfirmPin('');
      setIsLoading(false);
      
      toast({
        title: "PIN criado com sucesso!",
        description: "Agora você pode acessar o dashboard",
      });
    }, 500);
  };

  const handleLogin = () => {
    const storedPin = localStorage.getItem(STORAGE_KEY);
    const hashedInputPin = hashPin(pin);

    if (!storedPin || hashedInputPin !== storedPin) {
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
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTH_KEY);
    setHasStoredPin(false);
    onAuthenticated(false);
    setPin('');
    setNewPin('');
    setConfirmPin('');
    
    toast({
      title: "PIN resetado",
      description: "Defina um novo PIN para acessar o dashboard",
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
            {hasStoredPin ? 'Digite seu PIN para acessar' : 'Defina um PIN para proteger seus dados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={hasStoredPin ? "login" : "create"} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" disabled={!hasStoredPin}>
                Entrar
              </TabsTrigger>
              <TabsTrigger value="create">
                {hasStoredPin ? 'Trocar PIN' : 'Criar PIN'}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4">
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
            </TabsContent>
            
            <TabsContent value="create" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPin">Novo PIN</Label>
                <div className="relative">
                  <Input
                    id="newPin"
                    type={showPin ? "text" : "password"}
                    placeholder="Mínimo 4 caracteres"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
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
              
              <div className="space-y-2">
                <Label htmlFor="confirmPin">Confirmar PIN</Label>
                <Input
                  id="confirmPin"
                  type={showPin ? "text" : "password"}
                  placeholder="Digite novamente"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreatePin()}
                  disabled={isLoading}
                />
              </div>
              
              <Button 
                onClick={handleCreatePin} 
                className="w-full" 
                disabled={!newPin.trim() || !confirmPin.trim() || isLoading}
              >
                {isLoading ? 'Criando...' : hasStoredPin ? 'Alterar PIN' : 'Criar PIN'}
              </Button>
              
              {hasStoredPin && (
                <Alert>
                  <AlertDescription>
                    Alterar o PIN fará logout automático de todas as sessões.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};