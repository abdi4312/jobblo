import { Link, useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { findNavItem } from './nav';
import { PageHeader, Section } from '../../components/developer/kit';
import { Button } from '../../components/developer/ui/button';

/** Placeholder for dashboard sections that are planned but not built — no fake data. */
export default function PlannedPage() {
  const segment = useLocation().pathname.replace(/^\/developer\/?/, '').split('/')[0];
  const item = findNavItem(segment);
  const Icon = item?.icon || Construction;
  return (
    <div className="space-y-5">
      <PageHeader title={item?.label || 'Not found'} description={item?.description} />
      <Section title="Planned" description="See docs/DEVELOPER-DASHBOARD-PLAN.md for the phase this page belongs to">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
            <Icon className="size-5" />
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            This section is not built yet. It will only show real data from Jobblo's systems — nothing here is simulated.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/developer">Back to overview</Link>
          </Button>
        </div>
      </Section>
    </div>
  );
}
