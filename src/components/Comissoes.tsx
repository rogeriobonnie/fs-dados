import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Users, User } from 'lucide-react';
import LanceADois from './LanceADois';
import Consultoras from './Consultoras';
import Igor from './Igor';

const Comissoes = () => {
  return (
    <Tabs defaultValue="lance-a-dois" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="lance-a-dois" className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Lance a Dois
        </TabsTrigger>
        <TabsTrigger value="consultoras" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Consultoras
        </TabsTrigger>
        <TabsTrigger value="igor" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Igor
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="lance-a-dois" className="space-y-6">
        <LanceADois />
      </TabsContent>
      
      <TabsContent value="consultoras" className="space-y-6">
        <Consultoras />
      </TabsContent>
      
      <TabsContent value="igor" className="space-y-6">
        <Igor />
      </TabsContent>
    </Tabs>
  );
};

export default Comissoes;
