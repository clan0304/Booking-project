// components/admin/checkout/payment-forms/saved-card-form.tsx
'use client';

import { useState, useEffect } from 'react';
import { CreditCard, ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getClientPaymentMethods } from '@/app/actions/stripe/setup-intents';
import type {
  SavedCardFormProps,
  PaymentEntry,
  SavedCard,
} from '../checkout-types';

export function SavedCardForm({
  clientId,
  amount,
  onPaymentComplete,
  onCancel,
  disabled = false,
}: SavedCardFormProps) {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCards = async () => {
      setIsLoading(true);
      try {
        const { paymentMethods, error } = await getClientPaymentMethods(
          clientId
        );

        if (error) {
          setError(error);
          return;
        }

        const savedCards: SavedCard[] = paymentMethods.map((pm) => ({
          id: pm.id,
          brand: pm.card_brand,
          last4: pm.card_last4,
          expMonth: pm.card_exp_month,
          expYear: pm.card_exp_year,
          isDefault: pm.is_default,
        }));

        setCards(savedCards);

        const defaultCard = savedCards.find((c) => c.isDefault);
        if (defaultCard) {
          setSelectedCardId(defaultCard.id);
        } else if (savedCards.length > 0) {
          setSelectedCardId(savedCards[0].id);
        }
      } catch (err) {
        setError('Failed to load saved cards');
      } finally {
        setIsLoading(false);
      }
    };

    loadCards();
  }, [clientId]);

  const handlePayWithCard = async () => {
    if (!selectedCardId) return;

    setIsProcessing(true);
    setError(null);

    try {
      const selectedCard = cards.find((c) => c.id === selectedCardId);

      const paymentEntry: PaymentEntry = {
        id: `payment_${Date.now()}`,
        method: 'card_saved',
        amount,
        label: `Card •••• ${selectedCard?.last4 || '****'}`,
        status: 'pending',
        paymentMethodId: selectedCardId,
      };

      onPaymentComplete(paymentEntry);
    } catch (err) {
      setError('Failed to add payment');
      setIsProcessing(false);
    }
  };

  const getCardBrandDisplay = (brand: string) => {
    const brandMap: Record<string, string> = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'Amex',
    };
    return brandMap[brand.toLowerCase()] || brand;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-8">
        <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No saved cards available</p>
        <Button variant="link" onClick={onCancel} className="mt-4">
          Choose another method
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          disabled={isProcessing}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="font-medium">Select a card</h3>
      </div>

      {/* Card List */}
      <div className="space-y-2">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => setSelectedCardId(card.id)}
            disabled={disabled || isProcessing}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
              selectedCardId === card.id
                ? 'border-primary bg-accent'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div className="flex-1 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {getCardBrandDisplay(card.brand)} •••• {card.last4}
                </p>
                <p className="text-sm text-muted-foreground">
                  Expires {card.expMonth.toString().padStart(2, '0')}/
                  {card.expYear}
                </p>
              </div>
            </div>
            {card.isDefault && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                Default
              </span>
            )}
            {selectedCardId === card.id && (
              <Check className="h-5 w-5 text-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Amount & Pay Button */}
      <div className="pt-4 border-t border-border">
        <div className="flex justify-between items-center mb-4">
          <span className="text-muted-foreground">Amount</span>
          <span className="text-xl font-semibold">A${amount.toFixed(2)}</span>
        </div>
        <Button
          onClick={handlePayWithCard}
          disabled={!selectedCardId || disabled || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Adding payment...
            </>
          ) : (
            'Add payment'
          )}
        </Button>
      </div>
    </div>
  );
}
