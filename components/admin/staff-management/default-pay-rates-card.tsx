'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit, DollarSign, Clock, Save, X } from 'lucide-react';
import { updateDefaultPayRates } from '@/app/actions/staff-pay-rates';
import { useRouter } from 'next/navigation';

interface DefaultPayRates {
  weekday_rate: number;
  saturday_rate: number;
  sunday_rate: number;
  public_holiday_rate: number;
  paid_break_minutes: number;
}

interface DefaultPayRatesCardProps {
  initialRates: DefaultPayRates | null;
  onUpdate: () => void;
}

export function DefaultPayRatesCard({
  initialRates,
  onUpdate,
}: DefaultPayRatesCardProps) {
  const router = useRouter();
  const [rates, setRates] = useState<DefaultPayRates | null>(initialRates);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<DefaultPayRates>({
    weekday_rate: 25,
    saturday_rate: 30,
    sunday_rate: 35,
    public_holiday_rate: 50,
    paid_break_minutes: 30,
  });

  // ✅ Update local state when props change
  useEffect(() => {
    if (initialRates) {
      setRates(initialRates);
      setFormData({
        weekday_rate: initialRates.weekday_rate,
        saturday_rate: initialRates.saturday_rate,
        sunday_rate: initialRates.sunday_rate,
        public_holiday_rate: initialRates.public_holiday_rate,
        paid_break_minutes: initialRates.paid_break_minutes,
      });
    }
  }, [initialRates]);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateDefaultPayRates(formData);
    if (result.success) {
      onUpdate(); // ✅ Call parent refresh
      setIsEditing(false);
      router.refresh();
    } else {
      alert(result.error || 'Failed to update rates');
    }
    setSaving(false);
  };

  const handleCancel = () => {
    if (rates) {
      setFormData({
        weekday_rate: rates.weekday_rate,
        saturday_rate: rates.saturday_rate,
        sunday_rate: rates.sunday_rate,
        public_holiday_rate: rates.public_holiday_rate,
        paid_break_minutes: rates.paid_break_minutes,
      });
    }
    setIsEditing(false);
  };

  if (!rates) {
    return null; // Parent is loading
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Default Pay Rates
            </CardTitle>
            <CardDescription>
              These rates apply to all team members unless overridden
            </CardDescription>
          </div>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)} variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Hourly Rates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weekday Rate */}
            <div className="space-y-2">
              <Label htmlFor="weekday_rate">Weekday Rate (Mon-Fri)</Label>
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="weekday_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.weekday_rate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        weekday_rate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="pl-7"
                  />
                </div>
              ) : (
                <div className="text-2xl font-bold">
                  ${rates?.weekday_rate.toFixed(2)}/hr
                </div>
              )}
            </div>

            {/* Saturday Rate */}
            <div className="space-y-2">
              <Label htmlFor="saturday_rate">Saturday Rate</Label>
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="saturday_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.saturday_rate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        saturday_rate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="pl-7"
                  />
                </div>
              ) : (
                <div className="text-2xl font-bold">
                  ${rates?.saturday_rate.toFixed(2)}/hr
                </div>
              )}
            </div>

            {/* Sunday Rate */}
            <div className="space-y-2">
              <Label htmlFor="sunday_rate">Sunday Rate</Label>
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="sunday_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sunday_rate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sunday_rate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="pl-7"
                  />
                </div>
              ) : (
                <div className="text-2xl font-bold">
                  ${rates?.sunday_rate.toFixed(2)}/hr
                </div>
              )}
            </div>

            {/* Public Holiday Rate */}
            <div className="space-y-2">
              <Label htmlFor="public_holiday_rate">Public Holiday Rate</Label>
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="public_holiday_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.public_holiday_rate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        public_holiday_rate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="pl-7"
                  />
                </div>
              ) : (
                <div className="text-2xl font-bold">
                  ${rates?.public_holiday_rate.toFixed(2)}/hr
                </div>
              )}
            </div>
          </div>

          {/* Paid Break Minutes */}
          <div className="space-y-2 border-t pt-6">
            <Label
              htmlFor="paid_break_minutes"
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Paid Break Duration
            </Label>
            {isEditing ? (
              <div className="relative max-w-xs">
                <Input
                  id="paid_break_minutes"
                  type="number"
                  min="0"
                  value={formData.paid_break_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      paid_break_minutes: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  minutes
                </span>
              </div>
            ) : (
              <div className="text-2xl font-bold">
                {rates?.paid_break_minutes} minutes
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Break time under this duration will be paid. Additional break time
              is unpaid.
            </p>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
