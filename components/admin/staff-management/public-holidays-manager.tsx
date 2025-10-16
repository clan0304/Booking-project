'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar as CalendarIcon,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  getPublicHolidays,
  addPublicHoliday,
  updatePublicHoliday,
  deletePublicHoliday,
} from '@/app/actions/staff-pay-rates';
import { useRouter } from 'next/navigation';

interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  is_recurring: boolean;
  created_at: string;
}

export function PublicHolidaysManager() {
  const router = useRouter();
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [addFormData, setAddFormData] = useState({
    date: '',
    name: '',
    is_recurring: false,
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    is_recurring: false,
  });

  // ✅ FIX: Memoize loadHolidays with useCallback
  const loadHolidays = useCallback(async () => {
    setLoading(true);
    const result = await getPublicHolidays(selectedYear);
    if (result.success && result.data) {
      setHolidays(result.data);
    }
    setLoading(false);
  }, [selectedYear]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const handleAdd = async () => {
    if (!addFormData.date || !addFormData.name.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);
    const result = await addPublicHoliday(addFormData);
    if (result.success) {
      await loadHolidays();
      setIsAddModalOpen(false);
      setAddFormData({ date: '', name: '', is_recurring: false });
      router.refresh();
    } else {
      alert(result.error || 'Failed to add holiday');
    }
    setSaving(false);
  };

  const handleEdit = (holiday: PublicHoliday) => {
    setEditingHoliday(holiday);
    setEditFormData({
      name: holiday.name,
      is_recurring: holiday.is_recurring,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingHoliday) return;
    if (!editFormData.name.trim()) {
      alert('Holiday name is required');
      return;
    }

    setSaving(true);
    const result = await updatePublicHoliday(editingHoliday.id, editFormData);
    if (result.success) {
      await loadHolidays();
      setIsEditModalOpen(false);
      setEditingHoliday(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to update holiday');
    }
    setSaving(false);
  };

  const handleDelete = async (holidayId: string, holidayName: string) => {
    if (!confirm(`Delete "${holidayName}"? This cannot be undone.`)) return;

    setSaving(true);
    const result = await deletePublicHoliday(holidayId);
    if (result.success) {
      await loadHolidays();
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete holiday');
    }
    setSaving(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getUpcomingHolidays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return holidays
      .filter((h) => new Date(h.date + 'T00:00:00') >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  };

  const getPastHolidays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return holidays
      .filter((h) => new Date(h.date + 'T00:00:00') < today)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const upcomingHolidays = getUpcomingHolidays();
  const pastHolidays = getPastHolidays();

  return (
    <>
      <div className="space-y-6">
        {/* Header with Year Selector */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Public Holidays
                </CardTitle>
                <CardDescription>
                  Manage public holidays for accurate payroll calculations
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-lg font-semibold px-4">{selectedYear}</div>
                <Button
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  variant="outline"
                  size="sm"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button onClick={() => setIsAddModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holiday
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Upcoming Holidays Card */}
        {upcomingHolidays.length > 0 && (
          <Card className="border-2 border-blue-500">
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Holidays</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingHolidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">{holiday.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(holiday.date)}
                      </p>
                    </div>
                    {holiday.is_recurring && (
                      <Badge variant="secondary">Recurring</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Holidays List */}
        <Card>
          <CardHeader>
            <CardTitle>All Holidays ({holidays.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">
                Loading holidays...
              </div>
            ) : holidays.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <CalendarIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No holidays added yet</p>
                <p className="text-sm mt-2">
                  Click &quot;Add Holiday&quot; to create your first public
                  holiday
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Upcoming Section */}
                {upcomingHolidays.length > 0 && (
                  <>
                    <div className="text-sm font-medium text-muted-foreground mb-2">
                      UPCOMING
                    </div>
                    {holidays
                      .filter((h) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return new Date(h.date + 'T00:00:00') >= today;
                      })
                      .sort(
                        (a, b) =>
                          new Date(a.date).getTime() -
                          new Date(b.date).getTime()
                      )
                      .map((holiday) => (
                        <HolidayRow
                          key={holiday.id}
                          holiday={holiday}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          saving={saving}
                        />
                      ))}
                  </>
                )}

                {/* Past Section */}
                {pastHolidays.length > 0 && (
                  <>
                    <div className="text-sm font-medium text-muted-foreground mb-2 mt-6">
                      PAST
                    </div>
                    {pastHolidays.map((holiday) => (
                      <HolidayRow
                        key={holiday.id}
                        holiday={holiday}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        saving={saving}
                        isPast
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Holiday Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Public Holiday</DialogTitle>
            <DialogDescription>
              Add a new public holiday for payroll calculations
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="add_date">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="add_date"
                type="date"
                value={addFormData.date}
                onChange={(e) =>
                  setAddFormData({ ...addFormData, date: e.target.value })
                }
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="add_name">
                Holiday Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="add_name"
                placeholder="e.g., Christmas Day"
                value={addFormData.name}
                onChange={(e) =>
                  setAddFormData({ ...addFormData, name: e.target.value })
                }
              />
            </div>

            {/* Recurring */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="add_recurring"
                checked={addFormData.is_recurring}
                onCheckedChange={(checked) =>
                  setAddFormData({
                    ...addFormData,
                    is_recurring: checked === true,
                  })
                }
              />
              <label
                htmlFor="add_recurring"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Recurring annually
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              Check this if the holiday occurs on the same date every year
              (e.g., Christmas)
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => setIsAddModalOpen(false)}
                variant="outline"
                disabled={saving}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Adding...' : 'Add Holiday'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Holiday Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Holiday</DialogTitle>
            <DialogDescription>Update holiday details</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date (read-only) */}
            <div className="space-y-2">
              <Label>Date</Label>
              <div className="text-lg font-semibold">
                {editingHoliday && formatDate(editingHoliday.date)}
              </div>
              <p className="text-sm text-muted-foreground">
                To change the date, delete and create a new holiday
              </p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit_name">
                Holiday Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit_name"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
              />
            </div>

            {/* Recurring */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit_recurring"
                checked={editFormData.is_recurring}
                onCheckedChange={(checked) =>
                  setEditFormData({
                    ...editFormData,
                    is_recurring: checked === true,
                  })
                }
              />
              <label
                htmlFor="edit_recurring"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Recurring annually
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => setIsEditModalOpen(false)}
                variant="outline"
                disabled={saving}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={saving}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Holiday Row Component
function HolidayRow({
  holiday,
  onEdit,
  onDelete,
  saving,
  isPast = false,
}: {
  holiday: PublicHoliday;
  onEdit: (holiday: PublicHoliday) => void;
  onDelete: (id: string, name: string) => void;
  saving: boolean;
  isPast?: boolean;
}) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 ${
        isPast ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="text-center min-w-[80px]">
          <div className="text-2xl font-bold">
            {new Date(holiday.date + 'T00:00:00').getDate()}
          </div>
          <div className="text-sm text-muted-foreground">
            {formatDate(holiday.date)}
          </div>
        </div>
        <div>
          <p className="font-medium">{holiday.name}</p>
          <div className="flex items-center gap-2 mt-1">
            {holiday.is_recurring && (
              <Badge variant="secondary" className="text-xs">
                Recurring
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => onEdit(holiday)}
          variant="outline"
          size="sm"
          disabled={saving}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => onDelete(holiday.id, holiday.name)}
          variant="outline"
          size="sm"
          disabled={saving}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
