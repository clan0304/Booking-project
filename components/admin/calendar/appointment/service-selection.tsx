// components/admin/calendar/appointment/service-selection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Sparkles } from 'lucide-react';
import { getAvailableServices } from '@/app/actions/services';
import type { SelectedService } from './types';

interface ServiceSelectionProps {
  venueId: string;
  teamMemberId: string;
  services: SelectedService[];
  onServicesChange: (services: SelectedService[]) => void;
}

interface Service {
  id: string;
  name: string;
  type: 'service' | 'variant_group' | 'bundle';
  base_duration: number;
  base_price: number | null;
  service_categories: {
    name: string;
    color: string;
  } | null;
}

export function ServiceSelection({
  venueId,
  teamMemberId,
  services,
  onServicesChange,
}: ServiceSelectionProps) {
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadServices = async () => {
      setIsLoading(true);
      setError('');

      try {
        // ✅ FIXED: Use server action instead of fetch
        const result = await getAvailableServices(venueId, teamMemberId);

        if (result.success) {
          setAvailableServices(result.services || []);
        } else {
          throw new Error(result.error || 'Failed to load services');
        }
      } catch (err) {
        console.error('Error loading services:', err);
        setError('Failed to load services');
      } finally {
        setIsLoading(false);
      }
    };

    loadServices();
  }, [venueId, teamMemberId]);

  const handleAddService = (service: Service) => {
    // For now, use base price and duration
    // In production, you'd handle variants and add-ons here
    const newService: SelectedService = {
      serviceId: service.id,
      serviceName: service.name,
      duration: service.base_duration,
      price: service.base_price || 0,
    };

    onServicesChange([...services, newService]);
    setShowServicePicker(false);
  };

  const handleRemoveService = (index: number) => {
    const updated = services.filter((_, i) => i !== index);
    onServicesChange(updated);
  };

  if (isLoading) {
    return (
      <div className="text-center py-4 text-gray-500">Loading services...</div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Service List */}
      {services.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-1">No services added yet</p>
          <p className="text-sm text-gray-500">
            Add a service to save the appointment
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((service, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {service.serviceName}
                </div>
                <div className="text-sm text-gray-600">
                  {service.duration} min • ${service.price.toFixed(2)}
                </div>
              </div>
              <button
                onClick={() => handleRemoveService(index)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Service Button */}
      <button
        onClick={() => setShowServicePicker(true)}
        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all"
      >
        <Plus className="h-5 w-5 text-gray-400" />
        <span className="font-medium text-gray-700">Add service</span>
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Service Picker Modal */}
      {showServicePicker && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setShowServicePicker(false)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">
                    Select Service
                  </h3>
                  <button
                    onClick={() => setShowServicePicker(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Service List */}
              <div className="flex-1 overflow-y-auto p-4">
                {availableServices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No services available for this team member at this venue
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableServices.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => handleAddService(service)}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">
                              {service.name}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {service.base_duration} min
                              {service.base_price !== null && (
                                <> • ${service.base_price.toFixed(2)}</>
                              )}
                            </div>
                          </div>
                          {service.service_categories && (
                            <div
                              className="flex-shrink-0 px-2 py-1 rounded text-xs font-medium text-white"
                              style={{
                                backgroundColor:
                                  service.service_categories.color,
                              }}
                            >
                              {service.service_categories.name}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
