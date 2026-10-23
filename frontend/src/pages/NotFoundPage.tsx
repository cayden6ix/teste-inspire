import { ButtonLink } from '@/components/ui/Button';
import { Page } from '@/components/ui/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada');

  return (
    <Page>
      <PageHeader
        title="Página não encontrada"
        actions={<ButtonLink to="/">Voltar para o início</ButtonLink>}
      />
    </Page>
  );
}
