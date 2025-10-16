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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { User, Edit, Save, X, Trash2 } from 'lucide-react';
import {
  getCustomPayRates,
  upsertCustomPayRates,
  deleteCustomPayRates,
} from '@/app/actions/staff-pay-rates';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
}

interface CustomPayRate {
  id: string;
  team_member_id: string;
  weekday_rate: number | null;
  saturday_rate: number | null;
  sunday_rate: number | null;
  public_holiday_rate: number | null;
  paid_break_minutes: number | null;
  notes: string | null;
  users: {
    first_name: string;
    last_name: string | null;
  };
}

interface DefaultRates {
  weekday_rate: number;
  saturday_rate: number;
  sunday_rate: number;
  public_holiday_rate: number;
  paid_break_minutes: number;
}

interface CustomPayRatesListProps {
  teamMembers: TeamMember[];
  initialCustomRates: CustomPayRate[];
  defaultRates: DefaultRates | null;
  onUpdate: () => void;
}

export function CustomPayRatesList({
  teamMembers,
  initialCustomRates,
  defaultRates,
  onUpdate,
}: CustomPayRatesListProps) {
  const router = useRouter();
  const [customRates, setCustomRates] =
    useState<CustomPayRate[]>(initialCustomRates);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    weekday_rate: null as number | null,
    saturday_rate: null as number | null,
    sunday_rate: null as number | null,
    public_holiday_rate: null as number | null,
    paid_break_minutes: null as number | null,
    notes: '',
  });

  // ✅ Update local state when props change
  useEffect(() => {
    setCustomRates(initialCustomRates);
  }, [initialCustomRates]);

  const handleEdit = async (member: TeamMember) => {
    setEditingMember(member);

    // ✅ Only load custom rates for THIS member (1 API call only when editing)
    const result = await getCustomPayRates(member.id);
    if (result.success && result.data && !Array.isArray(result.data)) {
      setFormData({
        weekday_rate: result.data.weekday_rate,
        saturday_rate: result.data.saturday_rate,
        sunday_rate: result.data.sunday_rate,
        public_holiday_rate: result.data.public_holiday_rate,
        paid_break_minutes: result.data.paid_break_minutes,
        notes: result.data.notes || '',
      });
    } else {
      // No custom rates, start with null (will use defaults)
      setFormData({
        weekday_rate: null,
        saturday_rate: null,
        sunday_rate: null,
        public_holiday_rate: null,
        paid_break_minutes: null,
        notes: '',
      });
    }

    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingMember) return;

    setSaving(true);
    const result = await upsertCustomPayRates(editingMember.id, formData);
    if (result.success) {
      onUpdate(); // ✅ Call parent refresh
      setIsModalOpen(false);
      setEditingMember(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to update rates');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editingMember) return;
    if (
      !confirm(
        'Remove custom rates for this team member? They will use default rates.'
      )
    )
      return;

    setSaving(true);
    const result = await deleteCustomPayRates(editingMember.id);
    if (result.success) {
      onUpdate(); // ✅ Call parent refresh
      setIsModalOpen(false);
      setEditingMember(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete rates');
    }
    setSaving(false);
  };

  const getMemberCustomRate = (memberId: string) => {
    return customRates.find((rate) => rate.team_member_id === memberId);
  };

  const hasCustomRates = (rate: CustomPayRate) => {
    return (
      rate.weekday_rate !== null ||
      rate.saturday_rate !== null ||
      rate.sunday_rate !== null ||
      rate.public_holiday_rate !== null ||
      rate.paid_break_minutes !== null
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Custom Pay Rates
          </CardTitle>
          <CardDescription>
            Override default rates for individual team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {teamMembers.map((member) => {
              const customRate = getMemberCustomRate(member.id);
              const hasCustom = customRate && hasCustomRates(customRate);

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {member.photo_url ? (
                      <Image
                        src={member.photo_url}
                        alt={member.first_name}
                        className="w-10 h-10 rounded-full"
                        width={40}
                        height={40}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                        {member.first_name[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">
                        {member.first_name} {member.last_name || ''}
                      </p>
                      {hasCustom ? (
                        <Badge variant="secondary" className="mt-1">
                          Custom Rates
                        </Badge>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Using default rates
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleEdit(member)}
                    variant="outline"
                    size="sm"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {hasCustom ? 'Edit' : 'Set Custom'}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Custom Pay Rates for {editingMember?.first_name}{' '}
              {editingMember?.last_name || ''}
            </DialogTitle>
            <DialogDescription>
              Leave fields empty to use default rates. Set values to override.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Rates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Weekday Rate */}
              <div className="space-y-2">
                <Label htmlFor="custom_weekday_rate">
                  Weekday Rate (Mon-Fri)
                  {defaultRates && (
                    <span className="text-muted-foreground ml-2">
                      Default: ${defaultRates.weekday_rate.toFixed(2)}
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="custom_weekday_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Use default"
                    value={formData.weekday_rate ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        weekday_rate: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    className="pl-7"
                  />
                </div>
              </div>

              {/* Saturday Rate */}
              <div className="space-y-2">
                <Label htmlFor="custom_saturday_rate">
                  Saturday Rate
                  {defaultRates && (
                    <span className="text-muted-foreground ml-2">
                      Default: ${defaultRates.saturday_rate.toFixed(2)}
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="custom_saturday_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Use default"
                    value={formData.saturday_rate ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        saturday_rate: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    className="pl-7"
                  />
                </div>
              </div>

              {/* Sunday Rate */}
              <div className="space-y-2">
                <Label htmlFor="custom_sunday_rate">
                  Sunday Rate
                  {defaultRates && (
                    <span className="text-muted-foreground ml-2">
                      Default: ${defaultRates.sunday_rate.toFixed(2)}
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="custom_sunday_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Use default"
                    value={formData.sunday_rate ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sunday_rate: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    className="pl-7"
                  />
                </div>
              </div>

              {/* Public Holiday Rate */}
              <div className="space-y-2">
                <Label htmlFor="custom_public_holiday_rate">
                  Public Holiday Rate
                  {defaultRates && (
                    <span className="text-muted-foreground ml-2">
                      Default: ${defaultRates.public_holiday_rate.toFixed(2)}
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="custom_public_holiday_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Use default"
                    value={formData.public_holiday_rate ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        public_holiday_rate: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            {/* Paid Break Minutes */}
            <div className="space-y-2">
              <Label htmlFor="custom_paid_break_minutes">
                Paid Break Duration
                {defaultRates && (
                  <span className="text-muted-foreground ml-2">
                    Default: {defaultRates.paid_break_minutes} minutes
                  </span>
                )}
              </Label>
              <div className="relative max-w-xs">
                <Input
                  id="custom_paid_break_minutes"
                  type="number"
                  min="0"
                  placeholder="Use default"
                  value={formData.paid_break_minutes ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      paid_break_minutes: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  minutes
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this team member's custom rates..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-4">
              <div>
                {getMemberCustomRate(editingMember?.id || '') && (
                  <Button
                    onClick={handleDelete}
                    variant="destructive"
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Custom Rates
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsModalOpen(false)}
                  variant="outline"
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
