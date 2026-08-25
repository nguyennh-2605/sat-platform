import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { Bell } from 'lucide-react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { authenticatedFetch, endAuthSession, getAccessToken, refreshAccessToken, subscribeAuthSession } from '../../lib/authSession';

const timeAgo = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  const now = new Date();

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return "A few seconds ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days < 7) return `${days} days ago`;
  
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric' 
  });
};

interface NotificationItem {
  id: string | number;
  message: string;
  createdAt?: string | Date | null;
  isRead?: boolean;
  link?: string | null;
}

export default function NotificationBell({ currentUserId }: { currentUserId: number | string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const accessToken = useSyncExternalStore(subscribeAuthSession, getAccessToken, getAccessToken);

  // 1. Kết nối luồng SSE từ Backend
  useEffect(() => {
    if (!currentUserId || !accessToken) return;
    const ctrl = new AbortController();

    const fetchHistory = async () => {
      try {
        const res = await authenticatedFetch(`${import.meta.env.VITE_API_URL}/api/notifications`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (res.ok) {
          const pastNotifications = await res.json();
          setNotifications(pastNotifications); 
        }
      } catch (error) {
        console.error("Lỗi tải lịch sử thông báo:", error);
      }
    };

    fetchHistory();

    const connectSSE = async () => {
      try {
        await fetchEventSource(`${import.meta.env.VITE_API_URL}/api/notifications/stream`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'text/event-stream',
          },
          signal: ctrl.signal,
          
          // Xử lý khi kết nối thành công
          async onopen(response) {
            if (response.ok) {
              console.log('SSE Connected securely!');
              return; 
            } else if (response.status === 401) {
              ctrl.abort();
              const refreshed = await refreshAccessToken();
              if (!refreshed) endAuthSession('session-expired');
              throw new Error('Session expired');
            } else if (response.status >= 400 && response.status < 500) {
              throw new Error(`Server trả về lỗi: ${response.status}`);
            }
          },

          // Xử lý khi có tin nhắn mới từ Backend gửi về
          onmessage(event) {
            // event.data chính là chuỗi JSON mà res.write() bên backend đẩy về
            if (!event.data) return;
            const parsedData = JSON.parse(event.data);
            if (parsedData.type === 'CONNECTED') return;
            // Đẩy thông báo mới lên đầu
            setNotifications((prev) => [parsedData, ...prev]);
            window.dispatchEvent(new Event('classroom-todos:refresh'));
          },

          // Xử lý khi rớt mạng hoặc có lỗi ngầm
          onerror(err) {
            console.error('SSE connection error:', err);
            // Bạn có thể return để nó tự động thử kết nối lại (auto-reconnect)
          }
        });
      } catch (error) {
        console.error("Lỗi khởi tạo SSE:", error);
      }
    };

    connectSSE();

    return () => {
      ctrl.abort();
    };
  }, [accessToken, currentUserId]);

  // 2. Xử lý click ra ngoài để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllAsRead = async () => {
    setNotifications(notifications.map(n => ({...n, isRead: true})));
    await authenticatedFetch(`${import.meta.env.VITE_API_URL}/api/notifications/read-all`, {
      method: 'PUT',
    });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-ui-border bg-surface shadow-elevated animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-ui-border bg-surface-subtle p-3">
            <h3 className="text-body font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllAsRead()}
                className="min-h-8 rounded-control px-2 text-caption font-semibold text-primary hover:bg-primary-soft hover:text-primary-hover"
              >
                Mark as read
              </button>
            )}
          </div>
          
          <div className="max-h-[350px] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <button
                  type="button"
                  role="menuitem"
                  key={notif.id}
                  className={`block w-full border-b border-ui-border p-4 text-left transition-colors hover:bg-surface-subtle ${!notif.isRead ? 'bg-primary-soft/60' : ''}`}
                  onClick={() => {
                    if (notif.link) window.location.href = notif.link;
                    setIsOpen(false);
                  }}
                >
                  <p className="text-body leading-relaxed text-subtle-foreground">{notif.message}</p>
                  <span className="mt-1 block text-caption text-muted-foreground">
                    {timeAgo(notif.createdAt)}
                  </span>
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Bell size={32} className="mb-2 opacity-30" aria-hidden="true" />
                <p className="text-body">No notifications yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
