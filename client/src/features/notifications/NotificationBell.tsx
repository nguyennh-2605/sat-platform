import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { fetchEventSource } from '@microsoft/fetch-event-source';

const timeAgo = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  const now = new Date();

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return "Vài giây trước";
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  
  // Nếu lâu hơn 7 ngày thì hiển thị ngày tháng năm
  return date.toLocaleDateString('vi-VN', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
};

export default function NotificationBell({ currentUserId }: { currentUserId: number | string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Kết nối luồng SSE từ Backend
  useEffect(() => {
    if (!currentUserId) return;

    const token = localStorage.getItem('token');
    const ctrl = new AbortController();

    const fetchHistory = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/notifications`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
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
            'Authorization': `Bearer ${token}`, 
            'Accept': 'text/event-stream',
          },
          signal: ctrl.signal,
          
          // Xử lý khi kết nối thành công
          async onopen(response) {
            if (response.ok) {
              console.log('SSE Connected securely!');
              return; 
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
  }, [currentUserId]);

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
    await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/read-all`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Nút Chuông */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm">Thông báo</h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          
          <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!notif.isRead ? 'bg-indigo-50/40' : ''}`}
                  onClick={() => {
                    if (notif.link) window.location.href = notif.link;
                    setIsOpen(false);
                  }}
                >
                  <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {timeAgo(notif.createdAt)}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
                <Bell size={32} className="mb-2 opacity-20" />
                <p className="text-sm">Chưa có thông báo nào</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}