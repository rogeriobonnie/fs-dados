import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertCircle, ExternalLink, FileSpreadsheet, Link } from 'lucide-react';

export const ImplementationGuide = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Como Conectar sua Planilha do Google Sheets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20">1</Badge>
                Preparar a API Key do Google
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" 
                    className="text-primary hover:underline inline-flex items-center gap-1">
                    Google Cloud Console <ExternalLink className="h-3 w-3" />
                  </a></li>
                <li>Crie um novo projeto ou selecione um existente</li>
                <li>No menu lateral, vá em "APIs e Serviços" → "Biblioteca"</li>
                <li>Procure por "Google Sheets API" e habilite</li>
                <li>Vá em "Credenciais" → "Criar credenciais" → "Chave de API"</li>
                <li>Copie a chave gerada</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Badge className="bg-success/10 text-success hover:bg-success/20">2</Badge>
                Configurar sua Planilha
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Abra sua planilha no Google Sheets</li>
                <li>Clique em "Compartilhar" no canto superior direito</li>
                <li>Altere para "Qualquer pessoa com link pode visualizar"</li>
                <li>Copie a URL completa da planilha</li>
                <li>Cole a URL na aba "Configurações" desta aplicação</li>
                <li>Insira sua API Key e teste a conexão</li>
              </ol>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              Funcionalidades Disponíveis após Conexão
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-success flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Leitura Automática
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                  <li>• Carrega dados da planilha automaticamente</li>
                  <li>• Atualização manual com botão "Atualizar Dados"</li>
                  <li>• Sincronização em tempo real</li>
                  <li>• Backup automático com dados locais</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-primary flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Estrutura de Dados
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                  <li>• Mantém a estrutura atual da planilha</li>
                  <li>• Interpreta status: PAGO, A PAGAR, VENCIDO</li>
                  <li>• Converte valores monetários automaticamente</li>
                  <li>• Reconhece datas em formato brasileiro</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-warning">Importante sobre Segurança</p>
                <p className="text-sm text-muted-foreground">
                  As credenciais são armazenadas localmente no seu navegador. Para maior segurança em produção, 
                  recomendamos conectar ao Supabase para armazenamento seguro de API keys.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};