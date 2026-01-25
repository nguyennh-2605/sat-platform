import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import { 
  BarChart3, Calendar, CheckCircle2, Clock, ChevronRight, ChevronLeft, History 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL; 

const ResultAnalytics = () => {
  const navigate = useNavigate();
  
  // -- STATE --
  const [rawData, setRawData] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7); // Mặc định 7 ngày
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/api/results-analytics?days=${timeRange}`, getAuthHeader());
        
        setRawData(response.data.chartData || []);
        setHistory(response.data.historyData || []);
      } catch (error) {
        console.error("Failed to load analytics:", error);
        toast.error("Không thể tải dữ liệu thống kê");
      } finally {
        // Giả lập delay nhỏ để skeleton hiện mượt hơn (optional)
        setTimeout(() => setLoading(false), 300);
      }
    };
    fetchData();
  }, [timeRange]);

// -- LOGIC XỬ LÝ CHART DATA --
  const chartData = useMemo(() => {
    // Luôn tạo mảng chứa đủ số ngày (7 hoặc 30) để vẽ trục X
    return Array.from({ length: timeRange }).map((_, i) => {
      const date = subDays(new Date(), timeRange - 1 - i);
      
      // Tìm dữ liệu của ngày hôm đó trong rawData
      // Giả sử API trả về: { date: '2026-01-24', accuracy: 80, correctCount: 40, totalQuestions: 50 }
      const testsOnThisDay = rawData.filter((item: any) => isSameDay(parseISO(item.date), date));

      if (isSameDay(date, new Date())) {
         console.log(`Hôm nay (${format(date, 'dd/MM')}) tìm thấy:`, testsOnThisDay.length, "bài test");
         console.log("Chi tiết:", testsOnThisDay);
      }

      if (testsOnThisDay.length > 0) {
        // Cộng dồn số câu đúng và tổng số câu của TẤT CẢ các bài trong ngày
        const totalCorrect = testsOnThisDay.reduce((sum, t: any) => sum + (t.correctCount || 0), 0);
        const totalQs = testsOnThisDay.reduce((sum, t: any) => sum + (t.totalQuestions || 0), 0);
        // Tính lại Accuracy trung bình dựa trên tổng số câu
        const avgAccuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;
        return {
          displayDate: format(date, 'dd/MM'),
          fullDate: format(date, 'dd/MM/yyyy'),
          accuracy: avgAccuracy,
          correctCount: totalCorrect,   // Tổng câu đúng
          totalQuestions: totalQs,      // Tổng số câu hỏi
          hasData: true
        };
      }

      return {
        displayDate: format(date, 'dd/MM'), // Label trục X (24/01)
        fullDate: format(date, 'dd/MM/yyyy'),
        accuracy: null,
        correctCount: 0,
        totalQuestions: 0,
        hasData: false
      };
    });
  }, [rawData, timeRange]);

  // -- PAGINATION --
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentHistoryItems = history.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(history.length / itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  // -- CUSTOM TOOLTIP --
  const CustomTooltip = ({ active, payload }: any) => {
    // Chỉ hiện tooltip nếu active và giá trị accuracy không phải null
    if (active && payload && payload.length && payload[0].value !== null) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-indigo-100 shadow-xl rounded-xl text-sm min-w-[150px]">
          <p className="font-semibold text-gray-700 mb-2 pb-2 border-b border-gray-100 flex items-center gap-2">
            <Calendar size={14} className="text-gray-400"/> {data.fullDate}
          </p>
          
          <div className="space-y-1.5">
             <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500 text-xs">Accuracy:</span>
                <span className="font-bold text-indigo-600">{data.accuracy}%</span>
             </div>
             
             <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500 text-xs">Correct:</span>
                <span className="font-medium text-emerald-600">{data.correctCount} ans</span>
             </div>

             <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500 text-xs">Total:</span>
                <span className="font-medium text-gray-800">{data.totalQuestions} qs</span>
             </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 min-h-screen bg-gray-50/50">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
             Analytics Overview
          </h1>
          <p className="text-gray-500 mt-2 text-base">
            Theo dõi sự tiến bộ và lịch sử làm bài thi của bạn.
          </p>
        </div>
        
        {/* Time Filter */}
        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex">
          {[7, 30].map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                timeRange === days 
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              Last {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* --- PHẦN 1: LINE CHART (ACCURACY TREND) --- */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
             <BarChart3 className="text-indigo-600" size={20}/> 
             Accuracy Trend
           </h2>
        </div>

        <div className="h-[350px] w-full">
          {loading ? (
             <div className="w-full h-full animate-pulse bg-gray-50 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-gray-200" size={48}/>
             </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {/* connectNulls={true} sẽ nối các điểm lại với nhau ngay cả khi có ngày ở giữa không làm bài */}
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                
                {/* Trục X: Luôn hiện ngày tháng */}
                <XAxis 
                  dataKey="displayDate" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#9CA3AF', fontSize: 12}} 
                  dy={10} 
                  padding={{ left: 10, right: 10 }}
                />

                {/* Trục Y: Luôn hiện thang 0-100 */}
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#9CA3AF', fontSize: 12}} 
                />

                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5' }} />
                
                {/* Đường trung bình tham khảo 50% */}
                <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'insideTopRight', value: 'Avg 50%', fill: '#EF4444', fontSize: 10 }} />

                <Line 
                  connectNulls={true} // Quan trọng: Nối các điểm có dữ liệu lại với nhau
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="#4F46E5" 
                  strokeWidth={3}
                  // Chỉ hiện chấm tròn (dot) tại những ngày CÓ dữ liệu
                  dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (!payload.hasData) return <></>; // Ẩn dot nếu ngày đó không làm bài
                      return (
                          <circle cx={cx} cy={cy} r={4} fill="#4F46E5" stroke="#fff" strokeWidth={2} />
                      );
                  }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* --- PHẦN 2: HISTORY TABLE --- */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <History size={20}/>
                </div>
                <h2 className="text-lg font-semibold text-gray-800">Recent Activity</h2>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Total: {history.length}
            </span>
        </div>

        {loading ? (
            // Skeleton cho Table
            <div className="p-6 space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse"></div>)}
            </div>
        ) : (
        <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed min-w-[800px]">
                <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase font-semibold tracking-wider border-b border-gray-100">
                  <tr>
                    {/* Test Name: Căn trái + Padding để thoáng */}
                    <th className="px-6 py-4 w-[30%]">Test Name</th>
                    {/* Các cột còn lại: Căn giữa hoàn toàn */}
                    <th className="px-4 py-4 w-[30%] text-center">Status</th>
                    <th className="px-4 py-4 w-[25%] text-center">Date</th>
                    <th className="px-4 py-4 w-[20%] text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {currentHistoryItems.length > 0 ? (
                    currentHistoryItems.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                        
                        {/* 1. Test Name */}
                        <td className="px-6 py-4 text-left">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900 line-clamp-1" title={item.test?.title}>
                              {item.test?.title || "Unknown Test"}
                            </span>
                          </div>
                        </td>

                        {/* 2. Status (Căn giữa) */}
                        <td className="px-4 py-4 text-center">
                          {item.status === 'COMPLETED' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                              <CheckCircle2 size={12} /> Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                              <Clock size={12} /> Incomplete
                            </span>
                          )}
                        </td>

                        {/* 4. Date + Time (Căn giữa + Format AM/PM) */}
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-600 font-medium">
                            {format(new Date(item.createdAt), 'MMM dd, yyyy')} •{' '}
                            <span className="text-gray-400 font-normal">
                              {format(new Date(item.createdAt), 'HH:mm a')}
                            </span>
                          </span>
                        </td>

                        {/* 5. Action (Căn giữa - Không dính phải nữa) */}
                        <td className="px-4 py-4 text-center">
                          {item.status === 'COMPLETED' ? (
                            <div className="flex justify-center gap-2"> {/* Flex center để nút nằm giữa ô */}
                                <button 
                                  onClick={() => navigate('/score-report', { state: { resultId: item.id } })}
                                  className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap"
                                >
                                  View Details
                                </button>
                            </div>
                          ) : (
                            <button className="text-gray-400 bg-gray-100 px-3 py-1.5 rounded text-xs font-medium cursor-not-allowed">
                              Continue
                            </button>
                          )}
                        </td>

                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                        Chưa có dữ liệu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            {history.length > itemsPerPage && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                Page <span className="font-semibold text-gray-900">{currentPage}</span> of <span className="font-semibold text-gray-900">{totalPages}</span>
                </span>
                
                <div className="flex gap-2">
                <button 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                    <ChevronLeft size={16} />
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                    // Logic ẩn bớt trang nếu quá nhiều trang (Optional simple logic)
                    (Math.abs(currentPage - number) <= 1 || number === 1 || number === totalPages) && (
                         <button
                         key={number}
                         onClick={() => handlePageChange(number)}
                         className={`w-9 h-9 rounded-lg text-sm font-medium transition-all shadow-sm ${
                             currentPage === number 
                             ? "bg-indigo-600 text-white shadow-indigo-200 ring-2 ring-indigo-100" 
                             : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                         }`}
                         >
                         {number}
                         </button>
                    )
                ))}

                <button 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                    <ChevronRight size={16} />
                </button>
                </div>
            </div>
            )}
        </>
        )}
      </div>
    </div>
  );
};

export default ResultAnalytics;