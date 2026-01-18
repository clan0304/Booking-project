// components/admin/notifications/notification-modal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Star, Gift, MoreVertical, Check } from 'lucide-react';
import Image from 'next/image';
import {
  getNotifications,
  getNotificationCounts,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getBookingGroupById,
  type Notification,
  type NotificationCategory,
  type NotificationCounts,
} from '@/app/actions/notifications';
import type { BookingGroupWithAppointments } from '@/types/calendar';
import { EditAppointmentModal } from '../calendar/appointment/edit-appointment-modal';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Category config
const CATEGORIES = [
  { id: 'appointments' as const, label: 'Appointments', icon: Calendar },
  { id: 'reviews' as const, label: 'Reviews', icon: Star },
  { id: 'tips' as const, label: 'Tips', icon: Gift },
] as const;

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60)
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function NotificationModal({ isOpen, onClose }: NotificationModalProps) {
  const [activeCategory, setActiveCategory] =
    useState<NotificationCategory>('appointments');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({
    total: 0,
    unread: 0,
    appointments: 0,
    reviews: 0,
    tips: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  // Edit booking modal state
  const [selectedBooking, setSelectedBooking] =
    useState<BookingGroupWithAppointments | null>(null);
  const [isLoadingBooking, setIsLoadingBooking] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const [notificationsResult, countsResult] = await Promise.all([
        getNotifications({ category: activeCategory }),
        getNotificationCounts(),
      ]);

      if (notificationsResult.success && notificationsResult.data) {
        setNotifications(notificationsResult.data);
      }
      if (countsResult.success && countsResult.data) {
        setCounts(countsResult.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markNotificationAsRead(notification.id);
      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, is_read: true } : n
        )
      );
      setCounts((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        [activeCategory]: Math.max(0, prev[activeCategory] - 1),
      }));
    }

    // If appointment notification with booking_group_id, open edit modal
    if (
      notification.category === 'appointments' &&
      notification.booking_group_id
    ) {
      setIsLoadingBooking(true);
      try {
        const result = await getBookingGroupById(notification.booking_group_id);
        if (result.success && result.data) {
          setSelectedBooking(result.data);
        } else {
          console.error('Failed to fetch booking:', result.error);
        }
      } catch (error) {
        console.error('Error fetching booking:', error);
      } finally {
        setIsLoadingBooking(false);
      }
    }

    // For review notifications, we could navigate to a review detail page
    // or open a review modal in the future
    if (notification.category === 'reviews') {
      // Currently just mark as read - can be extended to show review detail
      console.log('Review notification clicked:', notification.metadata);
    }
  };

  // Handle edit modal close
  const handleEditModalClose = () => {
    setSelectedBooking(null);
  };

  // Handle edit modal success (refresh notifications)
  const handleEditModalSuccess = () => {
    fetchNotifications();
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead(activeCategory);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setCounts((prev) => ({
      ...prev,
      unread: prev.unread - prev[activeCategory],
      [activeCategory]: 0,
    }));
    setShowMenu(false);
  };

  // Get unread notifications
  const unreadNotifications = notifications.filter((n) => !n.is_read);
  const readNotifications = notifications.filter((n) => n.is_read);

  // Get empty state icon based on category
  const EmptyIcon =
    CATEGORIES.find((c) => c.id === activeCategory)?.icon || Calendar;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex">
        {/* Sidebar */}
        <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col">
          {/* Close Button */}
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Categories */}
          <nav className="flex-1 p-4 space-y-1">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const count = counts[category.id];
              const isActive = activeCategory === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    isActive
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      isActive ? 'text-purple-600' : 'text-gray-500'
                    }`}
                  />
                  <span className="font-medium">{category.label}</span>
                  {count > 0 && (
                    <span
                      className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">
              {CATEGORIES.find((c) => c.id === activeCategory)?.label}
            </h2>

            {/* Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <MoreVertical className="h-5 w-5 text-gray-600" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    <button
                      onClick={handleMarkAllAsRead}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Check className="h-4 w-4" />
                      Mark all as read
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <EmptyIcon className="h-12 w-12 text-gray-300 mb-3" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Unread Section */}
                {unreadNotifications.length > 0 && (
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Unread
                    </h3>
                    <div className="space-y-3">
                      {unreadNotifications.map((notification) => (
                        <NotificationCard
                          key={notification.id}
                          notification={notification}
                          onClick={() => handleNotificationClick(notification)}
                          isLoading={
                            isLoadingBooking &&
                            notification.booking_group_id ===
                              selectedBooking?.id
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Read Section */}
                {readNotifications.length > 0 && (
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-500 mb-3">
                      Earlier
                    </h3>
                    <div className="space-y-3">
                      {readNotifications.map((notification) => (
                        <NotificationCard
                          key={notification.id}
                          notification={notification}
                          onClick={() => handleNotificationClick(notification)}
                          isLoading={
                            isLoadingBooking &&
                            notification.booking_group_id ===
                              selectedBooking?.id
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading overlay when fetching booking */}
      {isLoadingBooking && (
        <div className="fixed inset-0 bg-black/20 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 shadow-xl flex items-center gap-3">
            <div className="h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-700">Loading booking...</span>
          </div>
        </div>
      )}

      {/* Edit Appointment Modal */}
      {selectedBooking && (
        <EditAppointmentModal
          isOpen={true}
          onClose={handleEditModalClose}
          booking={selectedBooking}
          onSuccess={handleEditModalSuccess}
          initialStep="view"
          allowEdit={true}
        />
      )}
    </>
  );
}

// =====================================================
// NOTIFICATION CARD COMPONENT
// =====================================================

interface NotificationCardProps {
  notification: Notification;
  onClick: () => void;
  isLoading?: boolean;
}

function NotificationCard({
  notification,
  onClick,
  isLoading,
}: NotificationCardProps) {
  const clientInitial =
    notification.client?.first_name?.charAt(0).toUpperCase() || '?';

  // Get rating from metadata for review notifications
  const rating = notification.metadata?.rating as number | undefined;

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:border-purple-300 hover:shadow-md transition-all text-left relative disabled:opacity-50"
    >
      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="absolute top-4 right-4 h-3 w-3 bg-purple-500 rounded-full" />
      )}

      <div className="flex gap-4">
        {/* Content */}
        <div className="flex-1 min-w-0 pr-8">
          <p className="font-semibold text-gray-900 mb-1">
            {notification.title}
          </p>

          {/* Star rating display for reviews */}
          {notification.category === 'reviews' && rating && (
            <div className="flex items-center gap-0.5 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-gray-200 text-gray-200'
                  }`}
                />
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500 mb-2">
            {formatRelativeTime(notification.created_at)}
          </p>
          <p className="text-sm text-gray-600 line-clamp-2">
            {notification.message}
          </p>
        </div>

        {/* Client Avatar */}
        <div className="flex-shrink-0 relative">
          {notification.client?.photo_url ? (
            <div className="relative h-14 w-14 rounded-full overflow-hidden">
              <Image
                src={notification.client.photo_url}
                alt={notification.client.first_name}
                fill
                className="object-cover"
                unoptimized={
                  !notification.client.photo_url.includes('supabase')
                }
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 h-14 w-14 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center -z-10">
                <span className="text-xl font-medium text-white">
                  {clientInitial}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
              <span className="text-xl font-medium text-white">
                {clientInitial}
              </span>
            </div>
          )}

          {/* Category badge - different colors based on category */}
          {notification.category === 'appointments' && (
            <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-purple-500 rounded-full flex items-center justify-center">
              <Calendar className="h-3 w-3 text-white" />
            </div>
          )}
          {notification.category === 'reviews' && (
            <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-yellow-500 rounded-full flex items-center justify-center">
              <Star className="h-3 w-3 text-white fill-white" />
            </div>
          )}
          {notification.category === 'tips' && (
            <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 rounded-full flex items-center justify-center">
              <Gift className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
