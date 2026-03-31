import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Folder, FileText, Search, Plus, MoreVertical, 
  Play, Edit, Trash2, ArrowUpDown, CheckSquare, Square,
  FolderInput, X,
  ArrowLeft,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

type BankItem = {
  uniqueId: string;
  id: number;
  type: 'folder' | 'test';
  name: string;
  subject: 'MATH' | 'RW' | null;
  date: string;
};

// Component đệ quy vẽ từng nhánh cây
const FolderNode = ({ 
  folder, 
  allFolders, 
  movingFolderIds, 
  selectedDestId, 
  onSelect, 
  depth = 0 
}: any) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // -> Mọi thư mục con bên trong nó cũng tự động biến mất, không sợ vòng lặp.
  if (movingFolderIds.includes(folder.id)) return null;

  // Tìm xem thư mục này có con không
  const children = allFolders.filter((f: any) => f.parentId === folder.id);
  const hasChildren = children.length > 0;
  const isSelected = selectedDestId === folder.id;

  return (
    <div>
      <div 
        className={`flex items-center gap-1.5 py-1.5 px-2 cursor-pointer transition-colors ${
          isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-100'
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }} // Thụt lề theo bậc (depth)
        onClick={() => onSelect(folder.id)}
      >
        {/* Nút Mũi tên để mở gập */}
        <div 
          onClick={(e) => {
            e.stopPropagation(); // Ngăn không cho sự kiện click lan ra ngoài làm chọn luôn thư mục
            if (hasChildren) setIsExpanded(!isExpanded);
          }}
          className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded"
        >
          {hasChildren && (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
        </div>

        {/* Icon Folder */}
        <Folder 
          size={18} 
          className={isSelected ? 'text-blue-600' : 'text-slate-500'} 
          fill={isSelected ? 'currentColor' : 'currentColor'} // Chỉnh fill để tô kín icon như ảnh của bạn
        />
        
        {/* Tên thư mục */}
        <span className="text-sm select-none truncate">{folder.name}</span>
      </div>

      {/* RENDER CON (Chỉ hiển thị khi đang mở) */}
      {isExpanded && hasChildren && (
        <div>
          {children.map((child: any) => (
            <FolderNode 
              key={child.id} 
              folder={child} 
              allFolders={allFolders} 
              movingFolderIds={movingFolderIds} 
              selectedDestId={selectedDestId} 
              onSelect={onSelect} 
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TestBank = () => {
  const navigate = useNavigate();

  const { folderId } = useParams();
  const currentFolderId = folderId ? parseInt(folderId, 10) : null;

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [itemsToMove, setItemsToMove] = useState<BankItem[]>([]);
  const [destinationFolderId, setDestinationFolderId] = useState<number | null>(null);
  const [allFolders, setAllFolders] = useState<{id: number, name: string, parentId: number | null}[]>([]);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [items, setItems] = useState<BankItem[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const url = currentFolderId ? `/api/bank/${currentFolderId}` : `/api/bank`;
        const response = await axiosClient.get(url) as any;

        if (response.success) {
          const { folders, tests } = response.data;

          const formattedFolders: BankItem[] = folders.map((f: any) => ({
            uniqueId: `folder_${f.id}`,
            id: f.id,
            type: 'folder',
            name: f.name,
            subject: null,
            date: new Date(f.createdAt).toISOString().split('T')[0]
          }));

          const formattedTests: BankItem[] = tests.map((t: any) => ({
            uniqueId: `test_${t.id}`,
            id: t.id,
            type: 'test',
            name: t.title, // Test trong DB lưu là title
            subject: t.subject, // Lấy môn học từ DB (RW, MATH...)
            date: new Date(t.createdAt).toISOString().split('T')[0]
          }));

          setItems([...formattedFolders, ...formattedTests]);
          setSelectedItems([]);
        }
      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu:', error);
      }
    };

    fetchContent();
  }, [currentFolderId]);

  useEffect(() => {
    if (isMoveModalOpen) {
      fetchAllFoldersForMove();
    }
  }, [isMoveModalOpen]);

  // Xử lý chọn nhiều item
  const toggleSelect = (uniqueId: string) => {
    setSelectedItems(prev => 
      prev.includes(uniqueId) ? prev.filter(item => item !== uniqueId) : [...prev, uniqueId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === items.length) setSelectedItems([]);
    else setSelectedItems(items.map(item => item.uniqueId));
  };

  // Bỏ chọn tất cả (Dùng cho nút X trên thanh lơ lửng)
  const clearSelection = () => {
    setSelectedItems([]);
  };

  const handleFolderClick = (id: number) => {
    navigate(`/dashboard/practice-test/my-bank/${id}`);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await axiosClient.post('/api/bank/folders', {
        name: newFolderName.trim(),
        parentId: currentFolderId
      }) as any;

      if (response.success) {
        const createdFolder = response.data; 

        // 3. Ép kiểu về cấu trúc BankItem của Frontend
        const newFolderItem: BankItem = {
          uniqueId: `folder_${createdFolder.id}`, 
          id: createdFolder.id,
          type: 'folder',
          name: createdFolder.name,
          subject: null, // Thư mục thì không có môn học
          date: new Date(createdFolder.createdAt).toISOString().split('T')[0] 
        };

        // 4. Đẩy lên UI và đóng Modal
        setItems(prev => [newFolderItem, ...prev]); 
        setNewFolderName('');
        setIsFolderModalOpen(false);
        
      } else {
        // Trường hợp API trả về HTTP 200 nhưng success = false (nếu backend bạn setup vậy)
        alert(response.message || 'Có lỗi xảy ra khi tạo thư mục!');
      }
    } catch (error) {
      console.error(error);
      alert('Khong the tao thu muc, vui long thu lai');
    }
  };

  const handleDelete = async (itemsToDelete: BankItem[]) => {
    if (!itemsToDelete.length) return;

    const isConfirm = window.confirm(
      `Bạn có chắc chắn muốn xóa vĩnh viễn ${itemsToDelete.length} mục đã chọn?`
    );
    if (!isConfirm) return;

    try {
      const folderIds = itemsToDelete.filter(i => i.type === 'folder').map(i => i.id);
      const testIds = itemsToDelete.filter(i => i.type === 'test').map(i => i.id);

      const response = await axiosClient.delete('/api/bank/delete', {
        data: { folderIds, testIds }
      }) as any;

      if (response.success) {
        const deletedUniqueIds = itemsToDelete.map(i => i.uniqueId);
        setItems(prev => prev.filter(item => !deletedUniqueIds.includes(item.uniqueId)));
        setSelectedItems(prev => prev.filter(id => !deletedUniqueIds.includes(id)));
        setOpenMenuId(null);
      } else {
        alert(response.message || "Có lỗi xảy ra khi xóa !");
      }
    } catch (error) {
      console.error("Lỗi xóa mục", error);
      alert("Không thể xóa, vui lòng thử lại sau");
    }
  };

  const submitMove = async () => {
    if (!itemsToMove.length) return;

    try {
      const folderIds = itemsToMove.filter(i => i.type === 'folder').map(i => i.id);
      const testIds = itemsToMove.filter(i => i.type === 'test').map(i => i.id);

      const response = await axiosClient.put('/api/bank/move', {
        folderIds,
        testIds,
        destinationFolderId
      }) as any;

      if (response.success) {
        const movedUniqueIds = itemsToMove.map(i => i.uniqueId);

        setItems(prev => prev.filter(item => !movedUniqueIds.includes(item.uniqueId)));
        setSelectedItems(prev => prev.filter(id => !movedUniqueIds.includes(id)));

        setIsMoveModalOpen(false);
        setItemsToMove([]);
        setDestinationFolderId(null);

        toast.success("Di chuyển thành công");
      } else {
        alert(response.message);
      }
    } catch (error) {
      console.error('Lỗi khi move:', error);
      alert('Không thể di chuyển, vui lòng thử lại.');
    }
  };

  const fetchAllFoldersForMove = async () => {
    try {
      const response = await axiosClient.get('/api/bank/folders/all') as any;
      if (response.success) {
        setAllFolders(response.data);
      }
    } catch (error) {
      console.error("Lỗi lấy danh sách thư mục:", error);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#F8FAFC] overflow-hidden relative">
      
      {/* HEADER CỐ ĐỊNH */}
      <header className="flex-none h-16 bg-white border-b border-gray-300 px-4 md:px-8 flex items-center justify-center z-30 shadow-sm">
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">
          Practice Center
        </h1>
      </header>

      {/* VÙNG CUỘN CHÍNH */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 flex flex-col min-h-full">
          
          {/* 1. Lời chào & Toolbar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            {currentFolderId && (
              <button 
                onClick={() => navigate('/dashboard/practice-test/my-bank')} // Quay về trang gốc (Root)
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 mb-4 transition-colors w-fit"
              >
                <ArrowLeft size={16} /> Quay lại thư mục gốc
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-slate-800 mb-1">Ngân hàng đề thi</h1>
              <p className="text-sm text-slate-500">Quản lý các thư mục và đề thi của bạn</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm đề thi, thư mục..." 
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 shadow-sm rounded-full focus:ring-2 focus:ring-blue-500 text-sm outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="relative group z-40">
                <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition font-medium text-sm shadow-sm">
                  <Plus size={18} />
                  Tạo mới
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={() => setIsFolderModalOpen(true)}
                      className="flex items-center gap-3 w-full p-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 transition-colors">
                      <Folder size={16} className="text-slate-400" /> Thư mục mới
                    </button>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button 
                      onClick={() => {
                        const targetUrl = currentFolderId
                          ? `/dashboard/practice-test/create?folderId=${currentFolderId}`
                          : `/dashboard/practice-test/create`;
                        navigate(targetUrl);
                      }}
                      className="flex items-center gap-3 w-full p-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 transition-colors">
                      <FileText size={16} className="text-blue-500" /> Bài Test mới
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. DANH SÁCH (LIST LAYOUT) */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex-1 flex flex-col shadow-sm min-h-[400px]">
            {/* Table Header */}
            <div className="grid grid-cols-[40px_minmax(200px,1fr)_120px_150px_100px] gap-4 items-center px-4 py-3 bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="flex justify-center cursor-pointer" onClick={toggleSelectAll}>
                {selectedItems.length === items.length && items.length > 0 ? (
                  <CheckSquare size={16} className="text-blue-600" />
                ) : (
                  <Square size={16} className="text-slate-400 hover:text-slate-600" />
                )}
              </div>
              <div className="flex items-center gap-2 cursor-pointer hover:text-slate-700" onClick={() => setSortBy('name')}>
                Tên <ArrowUpDown size={14} />
              </div>
              <div>Môn học</div>
              <div className="flex items-center gap-2 cursor-pointer hover:text-slate-700" onClick={() => setSortBy('date')}>
                Ngày sửa <ArrowUpDown size={14} />
              </div>
              <div className="text-right pr-2">Thao tác</div>
            </div>

            {/* Table Body */}
            <div className="overflow-y-auto flex-1">
              {items.map((item) => (
                <div 
                  key={item.uniqueId} 
                  className={`grid grid-cols-[40px_minmax(200px,1fr)_120px_150px_100px] gap-4 items-center px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors group ${
                    selectedItems.includes(item.uniqueId) ? 'bg-blue-50/30' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <div className="flex justify-center cursor-pointer" onClick={() => toggleSelect(item.uniqueId)}>
                    {selectedItems.includes(item.uniqueId) ? (
                      <CheckSquare size={16} className="text-blue-600" />
                    ) : (
                      <Square size={16} className="text-slate-300 group-hover:text-slate-400" />
                    )}
                  </div>

                  {/* Tên & Icon */}
                  <div 
                    className="flex items-center gap-3 overflow-hidden cursor-pointer"
                    onClick={() => {
                      if (item.type === 'folder') {
                        handleFolderClick(item.id);
                      }
                    }}
                  >
                    {item.type === 'folder' ? (
                      <Folder size={20} className="text-slate-400 fill-slate-400/20 shrink-0" />
                    ) : (
                      <FileText size={20} className="text-blue-500 fill-blue-500/10 shrink-0" />
                    )}
                    <span className="font-medium text-slate-700 text-sm truncate hover:text-blue-600">
                      {item.name}
                    </span>
                  </div>

                  {/* Môn học (Badge) */}
                  <div>
                    {item.subject && (
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide ${
                        item.subject === 'MATH' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        {item.subject}
                      </span>
                    )}
                  </div>

                  {/* Ngày sửa */}
                  <div className="text-sm text-slate-500">
                    {item.date}
                  </div>

                  {/* Thao tác */}
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative">
                    {item.type === 'test' && (
                      <button title="Làm bài test thử" className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors">
                        <Play size={16} />
                      </button>
                    )}

                    <button 
                      onClick={() => setOpenMenuId(openMenuId === item.uniqueId ? null : item.uniqueId)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {openMenuId === item.uniqueId && (
                      <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                        <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                          <Edit size={14} /> Chỉnh sửa
                        </button>
                        <button 
                          onClick={() => handleDelete([item])}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} /> Xóa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {selectedItems.length > 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 px-4 py-2.5 flex items-center gap-2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          
          {/* Thông tin số lượng */}
          <div className="flex items-center gap-2.5 pr-4 border-r border-slate-200">
            <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600">
              <CheckSquare size={16} className="fill-blue-100" />
            </div>
            <span className="font-semibold text-slate-800 text-sm whitespace-nowrap">
              {selectedItems.length} mục đã chọn
            </span>
          </div>

          {/* Các nút hành động */}
          <div className="flex items-center gap-1 pl-2">
            <button 
              onClick={() => {
                const itemsSelected = items.filter(i => selectedItems.includes(i.uniqueId));
                setItemsToMove(itemsSelected);
                setDestinationFolderId(null);
                setIsMoveModalOpen(true);
              }}    
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium text-sm transition-colors">
              <FolderInput size={16} className="text-slate-500" />
              Move
            </button>
            
            <button 
              onClick={() => {
                const itemToTrash = items.filter(i => selectedItems.includes(i.uniqueId));
                handleDelete(itemToTrash);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-red-50 text-red-600 font-medium text-sm transition-colors"
            >
              <Trash2 size={16} />
              Remove
            </button>
          </div>

          {/* Nút Hủy (Đóng thanh) */}
          <button 
            onClick={clearSelection}
            className="ml-2 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            title="Bỏ chọn"
          >
            <X size={16} />
          </button>

        </div>
      )}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Tạo thư mục mới</h3>
            <p className="text-sm text-slate-500 mb-5">Nhập tên cho thư mục mới của bạn.</p>
            
            <input 
              type="text" 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="VD: Toán học SAT, Lớp 12A1..." 
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all mb-6 text-slate-700"
              autoFocus // Tự động trỏ chuột vào khi mở modal
              onKeyDown={(e) => {
                // Nhấn Enter để tạo luôn, không cần bấm nút
                if (e.key === 'Enter') handleCreateFolder(); 
              }}
            />
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsFolderModalOpen(false);
                  setNewFolderName(''); // Reset lỡ người dùng đang nhập dở
                }}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors text-sm"
              >
                Hủy
              </button>
              <button 
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()} // Khóa nút nếu chưa nhập tên
                className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors text-sm shadow-sm"
              >
                Tạo thư mục
              </button>
            </div>
          </div>
        </div>
      )}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Header Modal */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                Di chuyển tới...
              </h3>
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body Modal */}
              <div className="px-6 py-4 space-y-4 text-left">
                <p className="text-sm text-slate-600">
                  Bạn đang di chuyển <span className="font-bold text-blue-600">{itemsToMove.length}</span> mục. Hãy chọn vị trí mới:
                </p>

                {/* KHUNG TREE VIEW */}
                <div className="border border-slate-200 rounded-lg overflow-y-auto max-h-64 bg-white py-2 shadow-inner">
                  
                  {/* Item Gốc (Tất cả tài liệu) */}
                  <div 
                    className={`flex items-center gap-2 py-2 px-4 cursor-pointer mb-1 transition-colors ${
                      destinationFolderId === null ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    onClick={() => setDestinationFolderId(null)}
                  >
                    <Folder size={20} className={destinationFolderId === null ? "text-blue-600" : "text-slate-500"} fill="currentColor" />
                    <span className="text-sm">Tất cả tài liệu</span>
                  </div>

                  {/* Các nhánh cây con (Chỉ bắt đầu vẽ từ những thư mục có parentId = null) */}
                  {allFolders
                    .filter(folder => folder.parentId === null)
                    .map(rootFolder => (
                      <FolderNode 
                        key={rootFolder.id}
                        folder={rootFolder}
                        allFolders={allFolders}
                        movingFolderIds={itemsToMove.filter(i => i.type === 'folder').map(i => i.id)} // Truyền ID các thư mục đang di chuyển vào đây
                        selectedDestId={destinationFolderId}
                        onSelect={setDestinationFolderId}
                        depth={1} // Lùi vào 1 cấp so với thư mục gốc
                      />
                  ))}
                </div>
              </div>

            {/* Footer Modal */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={submitMove}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
              >
                Xác nhận di chuyển
              </button>
            </div>
            
          </div>
        </div>
)}
    </div>
  );
};

export default TestBank;