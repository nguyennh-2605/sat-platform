import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Clock, ChevronRight, Filter, Layers, Calendar, GraduationCap } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';
import Ripple from '../components/RippleButton';

// --- CONSTANTS ---
const TEST_DATES = [
  "All Dates", 
  "11/2025", "10/2025", "09/2025", "08/2025", 
  "06/2025", "05/2025", "03/2025", 
  "10/2024", "08/2024", "06/2024"
];

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ElementType; // Kiểu dữ liệu cho Icon component (Lucide)
  colorClass?: string;
}

interface Test {
  id: number | string;
  title: string;
  description?: string;
  duration: number;
  subject: string;     // 'RW' | 'MATH'
  category: string;    // 'REAL' | 'CLASS'
  mode: string;        // 'PRACTICE' | 'EXAM'
  testDate?: string | null;
  classTests?: any[];
  isDoing?: boolean;   // Optional vì có thể chưa làm
}

interface ClassInfo {
  id: string;
  name: string;
}

// Component con: Chip Filter (Nút bấm bộ lọc)
const FilterChip = ({ label, active, onClick, icon: Icon, colorClass = "blue" }: FilterChipProps) => {
  const activeStyle = colorClass === "blue" 
    ? 'bg-blue-600 text-white border-blue-600'
    : 'bg-slate-800 text-white border-slate-800 shadow-md';

  return (
    <button
      onClick={onClick}
      className={`
        whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border flex items-center gap-2
        ${active 
          ? activeStyle
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
        }
      `}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
};

const PracticeTest = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: '', role: '' });
  
  // State dữ liệu
  const [tests, setTests] = useState<Test[]>([]);
  const [myClasses, setMyClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // --- STATE QUẢN LÝ FILTER ---
  // 1. Category: 'ALL' | 'REAL' | ClassUUID (string)
  const [activeCategory, setActiveCategory] = useState('ALL'); 
  
  // 2. Date: Chỉ dùng khi category = 'REAL'
  const [activeDate, setActiveDate] = useState('All Dates');   
  
  // 3. Subject: 'ALL' | 'RW' | 'MATH'
  const [activeSubject, setActiveSubject] = useState('ALL');

  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Setup User
    const name = localStorage.getItem('userName') || 'Student';
    const role = localStorage.getItem('userRole');
    setUser({ name: name, role: role || 'STUDENT'});

    const fetchData = async () => {
      setLoading(true);
      try {
        const [classesRes, testsRes] = await Promise.all([
          axiosClient.get<ClassInfo[], ClassInfo[]>(`/api/tests/classes`),
          axiosClient.get<Test[], Test[]>(`/api/tests`)
        ]);

        setMyClasses(classesRes);
        setTests(testsRes);
        console.log("Tat ca test nhan duoc", testsRes);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Không thể tải dữ liệu bài thi");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    // Nếu flyout đang mở VÀ vị trí click không nằm trong filterRef
    if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
      setIsFilterOpen(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  // Quan trọng: Gỡ bỏ sự kiện khi component unmount để tránh rò rỉ bộ nhớ
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, []);

  const debouncedSearch = useDebounce(searchQuery, 150);

  // --- LOGIC FILTER (CORE) ---
  const filteredTests = useMemo(() => {
    const query = debouncedSearch.toLowerCase().trim();

    return tests.filter(test => {
      // 1. Search Query
      if (debouncedSearch && !test.title.toLowerCase().includes(query)) {
        return false;
      }

      // 2. Category Filter
      if (activeCategory === 'REAL') {
        if (test.category !== 'REAL') return false;
        // Check Date
        if (activeDate !== 'All Dates' && test.testDate !== activeDate) return false;
      } 
      else if (activeCategory !== 'ALL') {
        // Đây là trường hợp lọc theo Class ID (activeCategory là chuỗi UUID)
        // Check xem test này có được assign vào lớp đó không
        const assignedToClass = test.classTests?.some(ct => ct.classId === activeCategory);
        if (!assignedToClass) return false;
      }

      // 3. Subject Filter
      if (activeSubject !== 'ALL' && test.subject !== activeSubject) {
        return false;
      }

      return true;
    });
  }, [tests, activeCategory, activeDate, activeSubject, debouncedSearch]);

  const handleStartExam = (exam: Test) => {
    const examInfo = {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      duration: exam.duration
    };
    localStorage.setItem('current_exam_info', JSON.stringify(examInfo));
    navigate(`/test/${exam.id}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* 1. HEADER SECTION (Chỉ còn chữ) */}
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold text-slate-800 mb-2">
          Xin chào, {user.name.split(' ').pop()}! 👋
        </h2>
        <p className="text-slate-500 text-lg">Hôm nay bạn muốn luyện tập kỹ năng nào?</p>
      </div>

      {/* 2. ACTION TOOLBAR (Search, Filter, Add Button nằm cùng 1 dòng) */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-6 relative">
        {/* Search Bar (flex-1 để tự động chiếm hết khoảng trống) */}
        <div className="flex-1 w-full bg-white px-4 h-[52px] rounded-2xl shadow-sm 
          border border-slate-300 flex items-center gap-2 focus-within:border-2 focus-within:border-blue-500">
          <div className="pl-1 text-slate-400">
            <Search size={20} />
          </div>
          <input 
            type="text"   
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tests by name..." 
            className="w-full outline-none text-slate-700 placeholder-slate-400 bg-transparent text-base font-medium"
          />
        </div>

        {/* Nút Filter & Flyout */}
        <div className="relative w-full sm:w-auto z-40" ref={filterRef}>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`w-full sm:w-auto relative overflow-hidden flex items-center justify-center gap-2 px-5 h-[52px] rounded-2xl font-semibold transition-all border shadow-sm ${
              isFilterOpen || activeCategory !== 'ALL' 
                ? 'bg-slate-100 border-slate-300 text-slate-800' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Ripple color="rgba(15, 23, 42, 0.1)" />
            <span className="relative z-10 pointer-events-none flex items-center gap-2 text-sm">
              <Filter size={18} /> 
              <span>Filter</span>
            </span>
            {activeCategory !== 'ALL' && (
              <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-red-500 border border-slate-100 shadow-sm z-20"></span>
            )}
          </button>

          {/* FLYOUT FILTER (Hiển thị khi isFilterOpen === true) */}
          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-2 w-full sm:w-[420px] bg-white border border-slate-200 rounded-2xl shadow-xl p-5 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
              <div className="space-y-5">
                
                {/* Nhóm 1: Nguồn */}
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Nguồn đề thi</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FilterChip label="Tất cả" active={activeCategory === 'ALL'} onClick={() => setActiveCategory('ALL')} />
                    <FilterChip label="Real Tests" icon={Layers} active={activeCategory === 'REAL'} onClick={() => setActiveCategory('REAL')} />
                    
                    {myClasses.length > 0 && <div className="h-6 w-[1px] bg-slate-300 mx-1"></div>}

                    {myClasses.map(cls => (
                      <FilterChip 
                        key={cls.id} label={cls.name} icon={GraduationCap} 
                        active={activeCategory === cls.id} onClick={() => setActiveCategory(cls.id)} colorClass="slate"
                      />
                    ))}
                  </div>
                </div>

                <div className="h-[1px] w-full bg-slate-100"></div>

                {/* Nhóm 2: Chi tiết (Môn & Ngày) */}
                <div className="flex flex-col gap-4">
                  {/* Môn thi */}
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Môn thi</div>
                    <div className="inline-flex bg-slate-100 p-1 rounded-xl">
                      {['RW', 'MATH', 'ALL'].map((sub) => (
                        <button
                          key={sub}
                          onClick={() => setActiveSubject(sub)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            activeSubject === sub ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {sub === 'ALL' ? 'ALL' : sub}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kỳ thi (Chỉ hiện khi chọn Real Test) */}
                  {activeCategory === 'REAL' && (
                    <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Calendar size={14}/> Kỳ thi
                      </div>
                      <select 
                        value={activeDate}
                        onChange={(e) => setActiveDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none"
                      >
                        {TEST_DATES.map(date => <option key={date} value={date}>{date}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nút Thêm đề thi */}
        {(user.role === 'TEACHER' || user.role === 'ADMIN') && (
          <button 
            onClick={() => navigate('create')}
            className="w-full sm:w-auto relative overflow-hidden flex items-center justify-center gap-2 bg-slate-900 text-white px-5 h-[52px] rounded-2xl font-semibold hover:bg-slate-800 hover:shadow-lg transition-all"
          >
            <Ripple color="rgba(255, 255, 255, 0.2)" />
            <span className="relative z-10 pointer-events-none flex items-center gap-2 text-sm">
              <Plus size={18} /> 
              <span>Add new</span>
            </span>
          </button>
        )}
      </div>

      {/* List Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-60">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {filteredTests.length > 0 ? (
            filteredTests.map((test, index) => (
              <div 
                key={test.id} 
                className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] hover:shadow-md transition-all duration-300 flex flex-col"
              >
                {/* Card Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                      <Clock size={12} className="text-slate-400"/>
                      <span>{Math.floor(test.duration)} phút</span>
                    </div>
                    
                    <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border 
                      ${test.mode === 'PRACTICE' 
                        ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
                        : 'text-rose-600 bg-rose-50 border-rose-100'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full animate-pulse 
                        ${test.mode === 'PRACTICE' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      ></div>
                      <span>{test.mode}</span>
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-2">
                    {test.title}
                  </h3>
                  <p className="text-slate-500 text-sm mb-4 line-clamp-2">
                    {test.description || "No description"}
                  </p>
                </div>

                {/* Action Button */}
                <button 
                  onClick={() => handleStartExam(test)} 
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                    test.isDoing
                      ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                      : "bg-slate-900 text-white hover:bg-blue-600 shadow-lg shadow-slate-200"
                  }`}
                >
                  {test.isDoing ? "Tiếp tục bài thi" : "Bắt đầu làm bài"}
                  {!test.isDoing && <ChevronRight size={18} />}
                </button>
              </div>
            ))
          ) : (
            // Empty State
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-dashed border-slate-300">
              <div className="bg-slate-50 p-4 rounded-full mb-4">
                <Search size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">Không tìm thấy bài thi</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">Thử thay đổi bộ lọc môn học hoặc từ khóa tìm kiếm.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PracticeTest;