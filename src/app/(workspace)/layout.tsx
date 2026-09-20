import { CrmProvider } from '@/presentation/hooks/crm-context';
import { WorkspaceShell } from '@/presentation/components/workspace-shell';
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <CrmProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </CrmProvider>
  );
}
