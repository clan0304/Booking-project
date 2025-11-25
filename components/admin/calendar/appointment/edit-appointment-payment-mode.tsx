// components/admin/calendar/appointment/edit-appointment-payment-mode.tsx
'use client';

import { ChevronLeft, X } from 'lucide-react';
import type { PaymentModeProps } from './edit-appointment-types';

export function PaymentMode({
  editingAppointments,
  totalPrice,
  onBack,
  onClose,
  getPriceDisplay,
}: PaymentModeProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">Payment</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body - Placeholder */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💳</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Payment Integration
          </h3>
          <p className="text-gray-600 text-sm">
            Payment processing will be implemented here.
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Total: {getPriceDisplay(totalPrice)}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {editingAppointments.size} service
            {editingAppointments.size !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </>
  );
}
