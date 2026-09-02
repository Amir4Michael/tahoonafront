import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { ArrowRight, Phone, MapPin, Printer, Loader2 } from 'lucide-react';
import { fmtMoney, fmtDate } from '@/lib/formatters';
import { Empty } from '@/components/shop/Empty';
import { Badge } from '@/components/shop/Badge';
import { PrintPortal } from '@/components/shop/PrintPortal';
import { usePrint } from '@/hooks/usePrint';
import * as customersApi from '@/services/api/customers';
import * as salesApi from '@/services/api/sales';
import { thCls, tdCls } from '@/components/shop/styles';

// Fetched in one call (the backend's max page size) rather than paginated —
// keeps this page's design close to the original (no pager UI here) while
// comfortably covering the realistic scale this system targets. A customer
// with more than 100 invoices ever would only see the most recent 100 here.
const HISTORY_LIMIT = 100;

export function CustomerDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [printing, startPrint] = usePrint();

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [customerRes, salesRes] = await Promise.all([
        customersApi.getCustomer(id),
        salesApi.listSales({ customerId: id, limit: HISTORY_LIMIT }),
      ]);
      setCustomer(customerRes.data);
      setSales(salesRes.data);
    } catch (err) {
      if (err.status === 404) setNotFound(true);
      else toast.error(err.message || 'تعذر تحميل بيانات العميل');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (notFound || !customer) {
    return <Empty text="العميل غير موجود" actionLabel="العودة للعملاء" onAction={() => navigate('/customers')} />;
  }

  const t = customer.totals || { total: 0, paid: 0, remaining: 0, count: 0, lastPurchase: null };

  return (
    <div className="grid gap-4">
      <Helmet><title>{customer.name} — نظام إدارة المحل</title><meta name="description" content={`تفاصيل العميل ${customer.name}`} /></Helmet>

      <Link to="/customers" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowRight size={15} /> العودة للعملاء
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{customer.name}</h1>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {customer.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {customer.phone}</span>}
              {customer.address && <span className="flex items-center gap-1.5"><MapPin size={14} /> {customer.address}</span>}
            </div>
          </div>
          <button onClick={startPrint} className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            <Printer size={15} /> طباعة كشف حساب
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">إجمالي المشتريات</div>
            <div className="mt-1 text-lg font-bold text-foreground">{fmtMoney(t.total)}</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">المدفوع</div>
            <div className="mt-1 text-lg font-bold text-emerald-600">{fmtMoney(t.paid)}</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">المتبقي</div>
            <div className="mt-1 text-lg font-bold text-destructive">{fmtMoney(t.remaining)}</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">عدد الفواتير</div>
            <div className="mt-1 text-lg font-bold text-foreground">{t.count}</div>
          </div>
        </div>
      </div>

      {/* Sales history */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-start">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className={thCls}>رقم الفاتورة</th>
              <th className={thCls}>التاريخ</th>
              <th className={thCls}>المنتجات</th>
              <th className={thCls}>الإجمالي</th>
              <th className={thCls}>المدفوع</th>
              <th className={thCls}>المتبقي</th>
              <th className={thCls}>طريقة الدفع</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className={`${tdCls} font-mono text-xs`}>{s.invoiceNumber}</td>
                <td className={`${tdCls} text-muted-foreground`}>{fmtDate(s.date)}</td>
                <td className={`${tdCls} text-muted-foreground`}>{s.items?.map((i) => i.name).join('، ')}</td>
                <td className={`${tdCls} font-mono`}>{fmtMoney(s.total)}</td>
                <td className={`${tdCls} font-mono`}>{fmtMoney(s.paid)}</td>
                <td className={`${tdCls} font-mono`}>{s.remaining > 0 ? <span className="text-destructive">{fmtMoney(s.remaining)}</span> : '—'}</td>
                <td className={tdCls}><Badge tone={s.paymentMethod === 'cash' ? 'green' : 'amber'}>{s.paymentMethod === 'cash' ? 'كاش' : 'آجل'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {sales.length === 0 && <Empty text="لا توجد فواتير مسجلة لهذا العميل" />}
      </div>

      {printing && (
        <PrintPortal>
          <div className="p-8" dir="rtl">
            <h1 className="mb-1 text-xl font-bold">كشف حساب — {customer.name}</h1>
            <p className="mb-4 text-sm text-muted-foreground">{customer.phone}</p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/20">
                  <th className="p-2 text-start">رقم الفاتورة</th>
                  <th className="p-2 text-start">التاريخ</th>
                  <th className="p-2 text-start">الإجمالي</th>
                  <th className="p-2 text-start">المدفوع</th>
                  <th className="p-2 text-start">المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s._id} className="border-b border-black/10">
                    <td className="p-2 font-mono">{s.invoiceNumber}</td>
                    <td className="p-2">{fmtDate(s.date)}</td>
                    <td className="p-2 font-mono">{fmtMoney(s.total)}</td>
                    <td className="p-2 font-mono">{fmtMoney(s.paid)}</td>
                    <td className="p-2 font-mono">{fmtMoney(s.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end gap-8 text-sm font-bold">
              <span>الإجمالي: {fmtMoney(t.total)}</span>
              <span>المدفوع: {fmtMoney(t.paid)}</span>
              <span>المتبقي: {fmtMoney(t.remaining)}</span>
            </div>
          </div>
        </PrintPortal>
      )}
    </div>
  );
}

export default CustomerDetailsPage;
