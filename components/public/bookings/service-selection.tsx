// components/public/bookings/service-selection.tsx
'use client';

import { useState } from 'react';
import { Clock, DollarSign, Check } from 'lucide-react';
import type { Service, SelectedAppointment } from '@/types/bookings';

interface ServiceSelectionProps {
  services: Service[];
  selectedAppointments: SelectedAppointment[];
  onSelect: (appointments: SelectedAppointment[]) => void;
  onBack: () => void;
}

export function ServiceSelection({
  services,
  selectedAppointments,
  onSelect,
}: ServiceSelectionProps) {
  const [selected, setSelected] = useState<string[]>(
    selectedAppointments.map((a) => a.serviceId)
  );

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    const categoryName = service.service_categories?.name || 'Other Services';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const handleServiceToggle = (serviceId: string) => {
    setSelected((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleContinue = () => {
    const appointments: SelectedAppointment[] = selected.map((serviceId) => {
      const service = services.find((s) => s.id === serviceId)!;
      return {
        serviceId: service.id,
        serviceName: service.name,
        teamMemberId: '', // Will be selected in next step
        teamMemberName: '',
        startTime: '',
        endTime: '',
        durationMinutes: service.duration_minutes,
        price: service.price,
      };
    });
    onSelect(appointments);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Select Services
        </h2>
        <p className="text-gray-600">
          Choose one or more services for your appointment
        </p>
      </div>

      {/* Services List */}
      <div className="space-y-8">
        {Object.entries(servicesByCategory).map(
          ([categoryName, categoryServices]) => (
            <div key={categoryName}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {categoryName}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {categoryServices.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleServiceToggle(service.id)}
                    className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                      selected.includes(service.id)
                        ? 'border-[#6C5CE7] bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {selected.includes(service.id) && (
                      <div className="absolute top-3 right-3">
                        <div className="rounded-full bg-[#6C5CE7] p-1">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}

                    <h4 className="font-semibold text-gray-900 pr-8 mb-1">
                      {service.name}
                    </h4>

                    {service.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {service.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{service.duration_minutes} min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        <span>${service.price.toFixed(2)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={handleContinue}
          disabled={selected.length === 0}
          className="flex-1 bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue ({selected.length}{' '}
          {selected.length === 1 ? 'service' : 'services'})
        </button>
      </div>
    </div>
  );
}
