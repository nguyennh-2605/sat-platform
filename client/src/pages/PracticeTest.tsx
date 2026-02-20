import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Clock, ChevronRight, Filter, Layers, Calendar, GraduationCap } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import CreateTestWizard from '../components/CreateTestWizard';
import axiosClient from '../api/axiosClient';
import toast from 'react-hot-toast';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
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
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 mb-2">
            Xin chào, {user.name.split(' ').pop()}! 👋
          </h2>
          <p className="text-slate-500 text-lg">Hôm nay bạn muốn luyện tập kỹ năng nào?</p>
        </div>
        
        {(user.role === 'TEACHER' || user.role === 'ADMIN') && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <Plus size={20} /> 
            <span>Tạo đề thi mới</span>
          </button>
        )}
      </div>

      {/* === FILTER UI SECTION === */}
      <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-300 shadow-sm">
        
        {/* ROW 1: Context (Category) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0 scrollbar-hide">
          <div className="text-slate-600 mr-2 flex items-center gap-1 font-medium text-sm">
            <Filter size={16}/> Nguồn:
          </div>
          
          <FilterChip 
            label="Tất cả" 
            active={activeCategory === 'ALL'} 
            onClick={() => setActiveCategory('ALL')} 
          />
          <FilterChip 
            label="Real Tests" 
            icon={Layers}
            active={activeCategory === 'REAL'} 
            onClick={() => setActiveCategory('REAL')} 
          />
          
          <div className="h-6 w-[1px] bg-slate-300 mx-1"></div>

          {myClasses.map(cls => (
            <FilterChip 
              key={cls.id}
              label={cls.name} 
              icon={GraduationCap}
              active={activeCategory === cls.id} 
              onClick={() => setActiveCategory(cls.id)} 
              colorClass="slate"
            />
          ))}
        </div>

        {/* ROW 2: Details (Date & Subject) */}
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4">
          
          {/* Subject Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Môn thi:</span>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {['RW', 'MATH'].map((sub) => (
                <button
                  key={sub}
                  onClick={() => setActiveSubject(sub)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    activeSubject === sub 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {sub === 'ALL' ? 'Tất cả' : sub}
                </button>
              ))}
            </div>
          </div>

          {/* Date Filter (Chỉ hiện khi chọn Real Test) */}
          {activeCategory === 'REAL' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4">
               <div className="h-4 w-[1px] bg-slate-300 mx-2"></div>
               <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                 <Calendar size={12}/> Kỳ thi:
               </span>
               <select 
                  value={activeDate}
                  onChange={(e) => setActiveDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 outline-none"
               >
                 {TEST_DATES.map(date => <option key={date} value={date}>{date}</option>)}
               </select>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2 max-w-md">
        <div className="p-2 text-slate-400">
          <Search size={20} />
        </div>
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm theo tên đề thi..." 
          className="w-full outline-none text-slate-700 placeholder-slate-400 bg-transparent"
        />
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
                className="group bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_30px_-6px_rgba(6,81,237,0.15)] hover:border-blue-100 transition-all duration-300 flex flex-col"
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
                  <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {test.title}
                  </h3>
                  <p className="text-slate-500 text-sm mb-4 line-clamp-2">
                    {test.description || "Bài kiểm tra tổng hợp Reading & Math chuẩn SAT."}
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

      {/* WIZARD MODAL */}
      {showCreateModal && (
        <CreateTestWizard 
          onClose={() => setShowCreateModal(false)}
          onUploadSuccess={() => {
            window.location.reload(); 
          }}
          userRole={user?.role}
        />
      )}
    </div>
  );
};

export default PracticeTest;