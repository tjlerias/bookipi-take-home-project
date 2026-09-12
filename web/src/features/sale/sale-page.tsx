import { useNavigate } from 'react-router';
import { SaleCard } from '@/features/sale/sale-card';
import { useSale } from '@/features/sale/use-sale';

export function SalePage() {
  const navigate = useNavigate();
  const { sale, error, clockOffsetMs } = useSale();

  return sale ? (
    <SaleCard
      sale={sale}
      clockOffsetMs={clockOffsetMs}
      onPurchased={(orderId, email) =>
        void navigate(`/orders?email=${encodeURIComponent(email)}`, {
          state: { orderId },
        })
      }
    />
  ) : (
    <p className="text-muted-foreground">
      {error ? `Could not load the sale: ${error}` : 'Loading sale…'}
    </p>
  );
}
