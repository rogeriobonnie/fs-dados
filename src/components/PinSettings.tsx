import { PinAuth } from '@/components/PinAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

interface PinSettingsProps {
  onAuthChange: () => void;
}

export const PinSettings = ({ onAuthChange }: PinSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Controle de Acesso</CardTitle>
            <CardDescription>
              Configure o PIN para proteger seus dados financeiros
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-w-md">
          <PinAuth 
            onAuthenticated={() => onAuthChange()} 
            isAuthenticated={true} 
          />
        </div>
      </CardContent>
    </Card>
  );
};