import { useState, type FormEvent } from 'react';
import { Info, XCircle } from 'lucide-react';
import {
  purchase,
  type RejectionReason,
  type Sale,
  type SaleStatus,
} from '@/features/sale/sale-api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { formatDuration, useCountdown } from '@/features/sale/use-countdown';
import { formatCents } from '@/lib/money';

interface Props {
  sale: Sale;
  clockOffsetMs: number;
  onPurchased: (orderId: number, email: string) => void;
}

interface Message {
  tone: 'info' | 'error';
  title: string;
  detail?: string;
}

const STATUS_LABEL: Record<SaleStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Live now',
  sold_out: 'Sold out',
  ended: 'Ended',
};

const STATUS_VARIANT: Record<
  SaleStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  upcoming: 'secondary',
  active: 'default',
  sold_out: 'destructive',
  ended: 'outline',
};

const REJECTION_MESSAGE: Record<RejectionReason, Message> = {
  limit_reached: {
    tone: 'info',
    title: 'You already have this item',
    detail: 'Each customer can buy a limited number of units in this sale.',
  },
  sold_out: {
    tone: 'error',
    title: 'Sold out',
    detail: 'All units have been claimed.',
  },
  upcoming: { tone: 'info', title: 'The sale has not started yet' },
  ended: { tone: 'info', title: 'The sale has ended' },
};

export function SaleCard({ sale, clockOffsetMs, onPurchased }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const countdownTarget =
    sale.status === 'upcoming'
      ? sale.startsAt
      : sale.status === 'active'
        ? sale.endsAt
        : null;
  const countdownMs = useCountdown(countdownTarget, clockOffsetMs);

  async function handleBuy(event: FormEvent) {
    event.preventDefault();
    const buyer = email.trim().toLowerCase();
    setBusy(true);
    setMessage(null);
    try {
      const outcome = await purchase(buyer);
      if (outcome.result === 'success') {
        onPurchased(outcome.orderId, buyer);
        return;
      }
      setMessage(REJECTION_MESSAGE[outcome.reason]);
    } catch (err) {
      setMessage({
        tone: 'error',
        title: 'Something went wrong',
        detail: err instanceof Error ? err.message : undefined,
      });
    }
    setBusy(false);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-2xl">{sale.name}</CardTitle>
          <Badge variant={STATUS_VARIANT[sale.status]}>
            {STATUS_LABEL[sale.status]}
          </Badge>
        </div>
        <CardDescription>
          {sale.status === 'upcoming' && (
            <>Starts in {formatDuration(countdownMs)}</>
          )}
          {sale.status === 'active' && (
            <>Ends in {formatDuration(countdownMs)}</>
          )}
          {sale.status === 'sold_out' && <>Every unit has been claimed.</>}
          {sale.status === 'ended' && <>This sale is over.</>}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4">
          <p className="text-lg font-semibold">{sale.item.name}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {formatCents(sale.item.salePriceCents)}
            </span>
            {sale.item.salePriceCents < sale.item.priceCents && (
              <span className="text-muted-foreground line-through">
                {formatCents(sale.item.priceCents)}
              </span>
            )}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {sale.item.remainingStock} left · limit {sale.item.maxPerUser} per
            customer
          </p>
        </div>

        <form className="space-y-3" onSubmit={handleBuy}>
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            required
          />
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={sale.status !== 'active' || busy || email.trim() === ''}
          >
            {busy ? (
              <>
                <Spinner /> Securing your item…
              </>
            ) : (
              'Buy Now'
            )}
          </Button>
        </form>

        {message && (
          <Alert
            variant={message.tone === 'error' ? 'destructive' : 'default'}
            role="status"
          >
            {message.tone === 'info' ? <Info /> : <XCircle />}
            <AlertTitle>{message.title}</AlertTitle>
            {message.detail && (
              <AlertDescription>{message.detail}</AlertDescription>
            )}
          </Alert>
        )}
      </CardContent>

      <CardFooter className="text-muted-foreground text-xs">
        Stock shown is approximate; your purchase is confirmed on the order
        page.
      </CardFooter>
    </Card>
  );
}
