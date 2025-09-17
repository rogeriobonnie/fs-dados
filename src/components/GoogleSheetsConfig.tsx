import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { Settings, CheckCircle, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';

interface GoogleSheetsConfigProps {
  onConnectionChange: (connected: boolean) => void;
}

export const GoogleSheetsConfig = ({ onConnectionChange }: GoogleSheetsConfigProps) => {
  const [apiKey, setApiKey] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if already configured
    const existingApiKey = GoogleSheetsService.getApiKey();
    const existingSheetId = GoogleSheetsService.getSheetId();
    
    if (existingApiKey && existingSheetId) {
      setApiKey(existingApiKey);
      testConnection();
    }
  }, []);

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const connected = await GoogleSheetsService.testConnection();
      setIsConnected(connected);
      onConnectionChange(connected);
      
      if (connected) {
        toast({
          title: "Conexão estabelecida!",
          description: "Google Sheets conectado com sucesso",
        });
      } else {
        toast({
          title: "Erro de conexão",
          description: "Verifique a API key e a URL da planilha",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setIsConnected(false);
      onConnectionChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim() || !sheetUrl.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a API key e a URL da planilha",
        variant: "destructive",
      });
      return;
    }

    const sheetId = GoogleSheetsService.extractSheetId(sheetUrl);
    if (!sheetId) {
      toast({
        title: "URL inválida",
        description: "URL da planilha do Google Sheets inválida",
        variant: "destructive",
      });
      return;
    }

    GoogleSheetsService.saveApiKey(apiKey);
    GoogleSheetsService.saveSheetId(sheetId);
    
    await testConnection();
  };

  const getInstructions = () => (
    <div className="space-y-4 text-sm">
      <div>
        <h4 className="font-semibold mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Como obter a API Key do Google:
        </h4>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-6">
          <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" 
              className="text-primary hover:underline inline-flex items-center gap-1">
              Google Cloud Console <ExternalLink className="h-3 w-3" />
            </a></li>
          <li>Crie um novo projeto ou selecione um existente</li>
          <li>Habilite a "Google Sheets API"</li>
          <li>Vá em "Credenciais" → "Criar credenciais" → "Chave de API"</li>
          <li>Copie a chave gerada</li>
        </ol>
      </div>
      
      <div>
        <h4 className="font-semibold mb-2">Configuração da Planilha:</h4>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-6">
          <li>A planilha deve estar pública ou compartilhada</li>
          <li>Copie a URL completa da planilha</li>
          <li>Os dados devem estar organizados conforme o modelo original</li>
        </ul>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuração Google Sheets
          {isConnected ? (
            <Badge variant="default" className="bg-success text-success-foreground">
              <CheckCircle className="h-3 w-3 mr-1" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Desconectado
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">Google Sheets API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Cole sua API key aqui..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sheetUrl">URL da Planilha</Label>
              <Input
                id="sheetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
              />
            </div>

            <Button onClick={handleSave} disabled={isLoading} className="w-full">
              {isLoading ? "Testando conexão..." : "Salvar e Conectar"}
            </Button>
          </div>

          <div>
            {getInstructions()}
          </div>
        </div>

        {!isConnected && (
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm">
              <strong>⚠️ Recomendação de Segurança:</strong> Para maior segurança, 
              considere conectar ao Supabase para armazenar as credenciais de forma segura.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};