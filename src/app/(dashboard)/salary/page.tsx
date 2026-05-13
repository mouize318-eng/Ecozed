"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button, Modal } from "@/components/ui";
import { useLanguage } from "@/lib/translations";
import { 
  Wallet, 
  User, 
  ChevronRight, 
  Package, 
  TrendingUp, 
  CheckCircle2, 
  History,
  AlertCircle,
  RefreshCw,
  Coins
} from "lucide-react";

interface UnpaidOrder {
  id: string;
  clientName: string;
  quantity: number;
  hasUpsell: boolean;
  upsellQuantity: number | null;
  createdAt: string;
}

interface SalaryData {
  baseSalary: number;
  orderBonuses: number;
  upsellBonuses: number;
  total: number;
  ordersCount: number;
  upsellCount: number;
  unpaidOrders: UnpaidOrder[];
}

interface Worker {
  id: string;
  username: string;
}

export default function SalaryPage() {
  const { t, language } = useLanguage();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [salaryData, setSalaryData] = useState<SalaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const isRtl = language === "ar";

  const fetchWorkers = async () => {
    const res = await fetch("/api/users");
    if (res.ok) setWorkers(await res.json());
  };

  const fetchSalaryData = async (workerId: string) => {
    if (!workerId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/salary?userId=${workerId}`);
      if (res.ok) setSalaryData(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (selectedWorkerId) {
      fetchSalaryData(selectedWorkerId);
    } else {
      setSalaryData(null);
    }
  }, [selectedWorkerId]);

  const handleProcessPayout = async () => {
    if (!selectedWorkerId || !salaryData) return;
    if (!window.confirm(isRtl ? "هل أنت متأكد من دفع هذا المبلغ وتصفير الحساب؟" : "Are you sure you want to pay this amount and reset the account?")) return;

    setIsProcessingPayout(true);
    try {
      const res = await fetch("/api/salary", {
        method: "POST",
        body: JSON.stringify({ workerId: selectedWorkerId }),
      });
      if (res.ok) {
        setIsSuccessModalOpen(true);
        setSalaryData(null);
        setSelectedWorkerId("");
      }
    } finally {
      setIsProcessingPayout(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-10">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
          {isRtl ? "إدارة الرواتب" : "Salary Management"}
        </h2>
        <p className="text-slate-500">
          {isRtl ? "حساب المستحقات المالية للموظفين بناءً على المبيعات والأداء." : "Calculate financial dues for staff based on sales and performance."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workers List Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-[32px] border-2 border-slate-100 p-6 shadow-sm overflow-hidden relative">
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <User size={14} />
              {isRtl ? "اختر موظفاً" : "Select Worker"}
            </div>
            
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {workers.map((worker) => (
                <button
                  key={worker.id}
                  onClick={() => setSelectedWorkerId(worker.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                    selectedWorkerId === worker.id 
                      ? "bg-slate-900 text-white shadow-xl shadow-slate-900/20" 
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      selectedWorkerId === worker.id ? "bg-white/20" : "bg-slate-200 text-slate-500"
                    }`}>
                      {worker.username[0].toUpperCase()}
                    </div>
                    <span className="font-bold">{worker.username}</span>
                  </div>
                  <ChevronRight size={18} className={selectedWorkerId === worker.id ? "" : "opacity-30"} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Salary Details Content */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedWorkerId ? (
            <div className="bg-white rounded-[40px] border-2 border-dashed border-slate-200 h-[400px] flex flex-col items-center justify-center text-center p-10">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                <Wallet size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-400">
                {isRtl ? "الرجاء اختيار موظف لعرض البيانات" : "Please select a worker to view data"}
              </h3>
            </div>
          ) : isLoading ? (
            <div className="bg-white rounded-[40px] border-2 border-slate-100 h-[400px] flex flex-col items-center justify-center">
               <RefreshCw size={40} className="text-slate-200 animate-spin" />
            </div>
          ) : salaryData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{isRtl ? "الراتب الأساسي" : "Base Salary"}</div>
                   <div className="text-2xl font-black text-slate-900">{salaryData.baseSalary} <span className="text-sm font-bold opacity-50">{isRtl ? "د.ج" : "DA"}</span></div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{isRtl ? "بونص التأكيد" : "Confirmation Bonus"}</div>
                   <div className="text-2xl font-black text-slate-900">{salaryData.orderBonuses} <span className="text-sm font-bold opacity-50">{isRtl ? "د.ج" : "DA"}</span></div>
                   <div className="text-[10px] font-bold text-slate-400 mt-1">({salaryData.ordersCount} {isRtl ? "طلب" : "orders"})</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{isRtl ? "بونص المبيعات" : "Upsell Bonus"}</div>
                   <div className="text-2xl font-black text-slate-900">{salaryData.upsellBonuses} <span className="text-sm font-bold opacity-50">{isRtl ? "د.ج" : "DA"}</span></div>
                   <div className="text-[10px] font-bold text-slate-400 mt-1">({salaryData.upsellCount} {isRtl ? "قطعة إضافية" : "extra pieces"})</div>
                </div>
              </div>

              {/* Total Card */}
              <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl shadow-slate-900/20">
                <div className="absolute top-0 right-0 p-10 opacity-5">
                   <Coins size={150} />
                </div>
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                  <div>
                    <div className="text-xs font-black text-white/40 uppercase tracking-widest mb-2">{isRtl ? "إجمالي المستحقات" : "Total Pending Amount"}</div>
                    <div className="text-5xl font-black tracking-tighter">{salaryData.total} <span className="text-xl opacity-50">DA</span></div>
                  </div>
                  <Button 
                    onClick={handleProcessPayout} 
                    isLoading={isProcessingPayout}
                    className="h-16 px-10 bg-white text-slate-900 hover:bg-slate-50 border-none text-lg font-black gap-3 rounded-2xl shadow-xl shadow-white/10"
                  >
                    <CheckCircle2 size={24} />
                    {isRtl ? "تأكيد الدفع" : "Process Payout"}
                  </Button>
                </div>
              </div>

              {/* Orders List */}
              <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                   <h4 className="font-black text-slate-900 flex items-center gap-2">
                     <History size={18} className="text-slate-400" />
                     {isRtl ? "قائمة الطلبات المسلمة" : "Delivered Orders List"}
                   </h4>
                   <span className="px-3 py-1 bg-white rounded-full text-[10px] font-black text-slate-500 border border-slate-200">
                     {salaryData.ordersCount} {isRtl ? "طلب" : "orders"}
                   </span>
                </div>
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  <table className={`w-full ${isRtl ? "text-right" : "text-left"}`}>
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-8 py-4">{isRtl ? "التاريخ" : "Date"}</th>
                        <th className="px-8 py-4">{isRtl ? "العميل" : "Client"}</th>
                        <th className="px-8 py-4 text-center">{isRtl ? "الكمية" : "Qty"}</th>
                        <th className="px-8 py-4 text-center">{isRtl ? "إضافي (Upsell)" : "Upsell"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {salaryData.unpaidOrders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-4 text-xs font-bold text-slate-500 font-mono">
                            {new Date(order.createdAt).toLocaleDateString(isRtl ? "ar-DZ" : "en-US")}
                          </td>
                          <td className="px-8 py-4 text-sm font-black text-slate-900">{order.clientName}</td>
                          <td className="px-8 py-4 text-center">
                            <span className="px-2 py-1 bg-slate-100 rounded text-xs font-black">x{order.quantity}</span>
                          </td>
                          <td className="px-8 py-4 text-center">
                            {order.hasUpsell ? (
                              <div className="inline-flex items-center gap-1 text-emerald-600 font-black text-xs">
                                <TrendingUp size={12} />
                                +{order.upsellQuantity}
                              </div>
                            ) : (
                              <span className="text-slate-300">--</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {salaryData.unpaidOrders.length === 0 && (
                    <div className="py-20 text-center text-slate-400 font-bold">
                      {isRtl ? "لا توجد طلبات جديدة حالياً" : "No new delivered orders yet"}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-red-50 border border-red-100 rounded-3xl p-8 flex items-center gap-4 text-red-600">
              <AlertCircle size={24} />
              <p className="font-bold">{isRtl ? "حدث خطأ أثناء تحميل البيانات" : "Error loading salary data"}</p>
            </div>
          )}
        </div>
      </div>

      {/* Success Modal */}
      <Modal isOpen={isSuccessModalOpen} onClose={() => setIsSuccessModalOpen(false)} title={isRtl ? "تم الدفع بنجاح" : "Payout Successful"}>
        <div className="text-center py-8">
           <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
           </div>
           <h3 className="text-2xl font-black text-slate-900 mb-2">{isRtl ? "تمت العملية!" : "Transaction Complete!"}</h3>
           <p className="text-slate-500 mb-8">{isRtl ? "لقد تم تصفير حساب الموظف وتسجيل الدفعة في السجلات." : "Staff account has been reset and payout has been recorded."}</p>
           <Button onClick={() => setIsSuccessModalOpen(false)} className="w-full h-14 rounded-2xl">{isRtl ? "حسناً" : "Got it"}</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
