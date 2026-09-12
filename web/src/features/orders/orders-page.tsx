import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, PackageSearch } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router';
import {
  fetchUserPurchases,
  type UserPurchases,
} from '@/features/sale/sale-api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { formatCents } from '@/lib/money';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; purchases: UserPurchases }
  | { status: 'error'; error: string };

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function OrdersPage() {
  const location = useLocation();
  const justOrdered = (location.state as { orderId?: number } | null)?.orderId;
  const [searchParams, setSearchParams] = useSearchParams();
  const email = searchParams.get('email')?.trim().toLowerCase() ?? '';
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    if (email === '') {
      setState({ status: 'idle' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });
    fetchUserPurchases(email)
      .then(
        (purchases) => !cancelled && setState({ status: 'loaded', purchases }),
      )
      .catch(
        (err: unknown) =>
          !cancelled &&
          setState({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [email]);

  function handleLookup(event: FormEvent) {
    event.preventDefault();
    setSearchParams({ email: draft.trim().toLowerCase() });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Check your purchase</CardTitle>
        <CardDescription>
          {email === ''
            ? 'Enter the email you used to buy.'
            : `Orders for ${email}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {justOrdered !== undefined && (
          <Alert role="status">
            <CheckCircle2 />
            <AlertTitle>Order #{justOrdered} confirmed</AlertTitle>
            <AlertDescription>
              Your item is secured. You can come back to this page any time.
            </AlertDescription>
          </Alert>
        )}

        {state.status === 'idle' && (
          <form className="space-y-3" onSubmit={handleLookup}>
            <label className="block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              required
            />
            <Button
              type="submit"
              className="w-full"
              disabled={draft.trim() === ''}
            >
              Check
            </Button>
          </form>
        )}

        {state.status === 'loading' && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Spinner /> Checking your orders…
          </p>
        )}

        {state.status === 'error' && (
          <Alert variant="destructive" role="status">
            <AlertTitle>Could not load your orders</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {state.status === 'loaded' && !state.purchases.purchased && (
          <div className="text-muted-foreground flex items-center gap-3 rounded-lg border p-4 text-sm">
            <PackageSearch className="size-5 shrink-0" />
            No purchase yet for this email.
          </div>
        )}

        {state.status === 'loaded' && state.purchases.purchased && (
          <ul className="divide-y rounded-lg border">
            {state.purchases.orders.map((order) => (
              <li
                key={order.orderId}
                className="flex items-center justify-between gap-3 p-4 text-sm"
              >
                <div>
                  <p className="font-medium">Order #{order.orderId}</p>
                  <p className="text-muted-foreground">
                    {dateFormatter.format(new Date(order.purchasedAt))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {formatCents(order.priceCents)}
                  </p>
                  <p className="text-muted-foreground">Secured</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {state.status === 'loaded' && (
          <p className="text-muted-foreground text-xs">
            {state.purchases.orders.length} of {state.purchases.maxPerUser}{' '}
            unit(s) used in this sale.
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        {email !== '' && (
          <Link
            to="/orders"
            className={buttonVariants({
              variant: 'ghost',
              className: 'w-full',
            })}
          >
            Check another email
          </Link>
        )}
        <Link
          to="/"
          className={buttonVariants({
            variant: 'outline',
            className: 'w-full',
          })}
        >
          Back to the sale
        </Link>
      </CardFooter>
    </Card>
  );
}
